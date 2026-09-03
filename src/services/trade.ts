// Jupiter-routed buy — works for liquid / migrated tokens; brand-new curves may fail until routed

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction
} from "@solana/web3.js";
import bs58 from "bs58";

import { config } from "../config.js";
import { getWallet } from "../db/repositories.js";
import { openPosition, recordTrade } from "../db/positions.js";
import { getSettings } from "../db/repositories.js";
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
  const slippageBps = Math.min(5000, Math.max(50, Math.floor(settings.slippage * 100)));

  try {
    const bal = await connection.getBalance(keypair.publicKey, "confirmed");
    if (bal < lamports + 5_000_000) {
      return {
        ok: false,
        error: `Insufficient SOL. Need ~${amountSol + 0.005} SOL including fees.`
      };
    }

    const quoteUrl =
      `${JUPITER_QUOTE}?inputMint=${SOL_MINT}` +
      `&outputMint=${mint.toBase58()}` +
      `&amount=${lamports}` +
      `&slippageBps=${slippageBps}` +
      `&onlyDirectRoutes=false`;

    const quoteRes = await fetch(quoteUrl, {
      signal: AbortSignal.timeout(12_000)
    });
    if (!quoteRes.ok) {
      const text = await quoteRes.text();
      recordTrade({
        telegramId: input.telegramId,
        mint: mint.toBase58(),
        side: "buy",
        amountSol,
        status: "failed",
        error: `Quote failed: ${text.slice(0, 200)}`
      });
      return {
        ok: false,
        error:
          "No Jupiter route (token may still be on pure bonding curve / too new)."
      };
    }

    const quote = await quoteRes.json();
    if (!quote || quote.error) {
      return {
        ok: false,
        error: String(quote?.error || "No quote available")
      };
    }

    const swapRes = await fetch(JUPITER_SWAP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto"
      }),
      signal: AbortSignal.timeout(12_000)
    });

    if (!swapRes.ok) {
      const text = await swapRes.text();
      return { ok: false, error: `Swap build failed: ${text.slice(0, 180)}` };
    }

    const swapJson: any = await swapRes.json();
    const swapTx = swapJson.swapTransaction;
    if (!swapTx) {
      return { ok: false, error: "Swap response missing transaction." };
    }

    const txBuf = Buffer.from(swapTx, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([keypair]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });

    // Don't block forever on confirm
    void connection
      .confirmTransaction(signature, "confirmed")
      .catch((e) => logger.warn("Confirm lag", e));

    openPosition({
      telegramId: input.telegramId,
      mint: mint.toBase58(),
      symbol: input.symbol ?? null,
      entrySol: amountSol,
      signature
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
    return { ok: false, error: msg.slice(0, 200) };
  }
}
