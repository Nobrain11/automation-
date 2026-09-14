import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  maxDuration: 10
};

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  let rpcHost = "unknown";
  try {
    const rpc =
      process.env.SOLANA_RPC_URL?.trim() ||
      "https://api.mainnet-beta.solana.com";
    rpcHost = new URL(rpc).host;
  } catch {
    /* keep unknown */
  }

  const webBaseUrl = (
    process.env.APP_URL?.trim() ||
    process.env.WEB_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    ""
  ).replace(/\/$/, "");

  const body = JSON.stringify({
    ok: true,
    chain: "solana",
    rpcHost,
    webhookConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
    botTokenConfigured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim()
    ),
    encryptionKeyConfigured: Boolean(
      process.env.WALLET_ENCRYPTION_KEY?.trim()
    ),
    webBaseUrl: webBaseUrl || null,
    runtime: process.env.VERCEL ? "vercel" : "node"
  });

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}
