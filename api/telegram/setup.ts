import { logger } from "../../src/utils/logger.js";

export const config = {
  maxDuration: 30
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const setupToken = process.env.TELEGRAM_WEBHOOK_SETUP_TOKEN?.trim();
    if (setupToken) {
      const suppliedToken = new URL(request.url).searchParams.get("token")?.trim();
      if (suppliedToken !== setupToken) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    const token = requiredEnv("TELEGRAM_BOT_TOKEN");
    const appUrl = (
      process.env.APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "")
    ).replace(/\/$/, "");
    if (!appUrl) throw new Error("Missing required environment variable: APP_URL");
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"]
    };
    if (secret) body.secret_token = secret;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const telegramResult = await telegramResponse.json();

    return Response.json(
      { ok: telegramResponse.ok && telegramResult.ok === true, webhookUrl, telegram: telegramResult },
      { status: telegramResponse.ok && telegramResult.ok === true ? 200 : 502 }
    );
  } catch (error) {
    logger.error("Telegram webhook setup failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "setup_failed" }, { status: 500 });
  }
}
