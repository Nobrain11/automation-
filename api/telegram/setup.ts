import { bot } from "../../src/bot/bot.js";
import { logger } from "../../src/utils/logger.js";

export const config = {
  maxDuration: 30
};

function configuredBaseUrl(): string {
  const explicit = process.env.WEB_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  throw new Error("WEB_BASE_URL or VERCEL_URL is required");
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const setupToken = process.env.TELEGRAM_WEBHOOK_SETUP_TOKEN?.trim();
  const receivedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!setupToken || receivedToken !== setupToken) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json({ ok: false, error: "webhook_secret_not_configured" }, { status: 503 });
  }

  try {
    const url = `${configuredBaseUrl()}/api/telegram/webhook`;
    const result = await bot.api.setWebhook(url, {
      secret_token: secret,
      allowed_updates: ["message", "callback_query"]
    });
    return Response.json({ ok: result, webhookUrl: url });
  } catch (error) {
    logger.error("Telegram webhook setup failed", error);
    return Response.json({ ok: false, error: "setup_failed" }, { status: 502 });
  }
}
