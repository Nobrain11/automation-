export default function handler(): Response {
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

  return Response.json({
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
}
