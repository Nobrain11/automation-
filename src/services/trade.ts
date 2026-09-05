// Jupiter-routed buy/sell

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction
} from "@solana/web3.js";
import bs58 from "bs58";

import { config } from "../config.js";
import { getWallet, getSettings } from "../db/repositories.js";
import {
  openPosition,
  recordTrade,
  getPosition,
  closePosition
} from "../db/positions.js";
import { enrichMints } from "./market.js";
import { decrypt } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_QUOTE = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP = "https://quote-api.jup.ag/v6/swap";

const connection = new Connection(config.rpcUrl, "confirmed");

function loadKeypair(telegramId: number): Keypair {
  const wallet = getWallet(telegramId);
  if (!wallet) {
    throw new Error("No wallet connected.");
  }
  const secret = decrypt(wallet.encrypted_secret, config.walletEncryptionKey);
  return Keypair.fromSecretKey(bs58.decode(secret));
}

async function jupiterSwap(input: {
  keypair: Keypair;
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}): Promise<string> {
  const quoteUrl =
    `${JUPITER_QUOTE}?inputMint=${input.inputMint}` +
    `&outputMint=${input.outputMint}` +
    `&amount=${input.amount}` +
    `&slippageBps=${input.slippageBps}` +
    `&onlyDirectRoutes=false`;

  const quoteRes = await fetch(quoteUrl, {
    signal: AbortSignal.timeout(12_000)
  });
  if (!quoteRes.ok) {
    const text = await quoteRes.text();
    throw new Error(`No route: ${text.slice(0, 120)}`);
  }

  const quote = await quoteRes.json();
  if (!quote || (quote as any).error) {
    throw new Error(String((quote as any)?.error || "No quote"));
  }

  const swapRes = await fetch(JUPITER_SWAP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: input.keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto"
    }),
    signal: AbortSignal.timeout(12_000)
  });

  if (!swapRes.ok) {
    const text = await swapRes.text();
    throw new Error(`Swap build failed: ${text.slice(0, 120)}`);
  }

  const swapJson: any = await swapRes.json();
  if (!swapJson.swapTransaction) {
    throw new Error("Missing swap transaction");
  }

  const tx = VersionedTransaction.deserialize(
    Buffer.from(swapJson.swapTransaction, "base64")
  );
  tx.sign([input.keypair]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });

  void connection
    .confirmTransaction(signature, "confirmed")
    .catch((e) => logger.warn("Confirm lag", e));

  return signature;
}

export async function buyToken(input: {
  telegramId: number;
  mint: string;
  amountSol?: number;
  symbol?: string | null;
}): Promise<{ ok: boolean; signature?: string; error?: string }> {
  const settings = getSettings(input.telegramId);
  if (settings.kill_switch) {
    return { ok: false, error: "Emergency stop is active." };
  }

  const amountSol = input.amountSol ?? settings.max_buy;
  if (!(amountSol > 0) || amountSol > 5) {
    return { ok: false, error: "Invalid buy size (max 5 SOL per click)." };
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(input.mint);
  } catch {
    return { ok: false, error: "Invalid mint address." };
  }

  const keypair = loadKeypair(input.telegramId);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const slippageBps = Math.min(
    5000,
    Math.max(50, Math.floor(settings.slippage * 100))
  );

  try {
    const bal = await connection.getBalance(keypair.publicKey, "confirmed");
    if (bal < lamports + 5_000_000) {
      return {
        ok: false,
        error: `Insufficient SOL. Need ~${amountSol + 0.005} SOL including fees.`
      };
    }

    // Snapshot entry price for PnL monitor (best-effort)
    let entryPriceUsd: number | null = null;
    try {
      const enriched = await enrichMints([mint.toBase58()]);
      entryPriceUsd = enriched[0]?.priceUsd ?? null;
    } catch {
      entryPriceUsd = null;
    }

    const signature = await jupiterSwap({
      keypair,
      inputMint: SOL_MINT,
      outputMint: mint.toBase58(),
      amount: lamports,
      slippageBps
    });

    openPosition({
      telegramId: input.telegramId,
      mint: mint.toBase58(),
      symbol: input.symbol ?? null,
      entrySol: amountSol,
      signature,
      entryPriceUsd
    });

    recordTrade({
      telegramId: input.telegramId,
      mint: mint.toBase58(),
      side: "buy",
      amountSol,
      signature,
      status: "submitted"
    });

    return { ok: true, signature };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("buyToken failed", error);
    recordTrade({
      telegramId: input.telegramId,
      mint: input.mint,
      side: "buy",
      amountSol,
      status: "failed",
      error: msg.slice(0, 300)
    });
    return {
      ok: false,
      error: msg.includes("No route")
        ? "No Jupiter route (token may still be on pure bonding curve / too new)."
        : msg.slice(0, 200)
    };
  }
}

/** Sell 100% of token balance for a position via Jupiter */
export async function sellPosition(input: {
  telegramId: number;
  positionId: number;
}): Promise<{ ok: boolean; signature?: string; error?: string }> {
  const pos = getPosition(input.telegramId, input.positionId);
  if (!pos || pos.status !== "open") {
    return { ok: false, error: "Position not found or already closed." };
  }

  const settings = getSettings(input.telegramId);
  const keypair = loadKeypair(input.telegramId);
  const slippageBps = Math.min(
    5000,
    Math.max(50, Math.floor(settings.slippage * 100))
  );

  try {
    const mint = new PublicKey(pos.mint);
    const accounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { mint },
      "confirmed"
    );

    let amount = 0n;
    for (const acc of accounts.value) {
      const info: any = acc.account.data.parsed?.info;
      const amt = info?.tokenAmount?.amount;
      if (amt) amount += BigInt(amt);
    }

    if (amount <= 0n) {
      closePosition({
        telegramId: input.telegramId,
        positionId: input.positionId,
        exitSol: 0,
        signature: null
      });
      return { ok: false, error: "No token balance found — marked closed." };
    }

    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { ok: false, error: "Balance too large to sell via this path." };
    }

    const signature = await jupiterSwap({
      keypair,
      inputMint: pos.mint,
      outputMint: SOL_MINT,
      amount: Number(amount),
      slippageBps
    });

    closePosition({
      telegramId: input.telegramId,
      positionId: input.positionId,
      exitSol: null,
      signature
    });

    recordTrade({
      telegramId: input.telegramId,
      mint: pos.mint,
      side: "sell",
      amountSol: pos.entry_sol,
      signature,
      status: "submitted"
    });

    return { ok: true, signature };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("sellPosition failed", error);
    recordTrade({
      telegramId: input.telegramId,
      mint: pos.mint,
      side: "sell",
      amountSol: pos.entry_sol,
      status: "failed",
      error: msg.slice(0, 300)
    });
    return { ok: false, error: msg.slice(0, 200) };
  }
}
