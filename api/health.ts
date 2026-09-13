import { config } from "../src/config.js";

export default function handler(): Response {
  let rpcHost = "unknown";
  try {
    rpcHost = new URL(config.rpcUrl).host;
  } catch {
    // Keep health available when an optional RPC URL is malformed.
  }

  return Response.json({
    ok: true,
    chain: "solana",
    rpcHost,
    webhookConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    webBaseUrl: config.webBaseUrl || null
  });
}
