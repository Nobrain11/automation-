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
    const token = requiredEnv("TELEGRAM_BOT_TOKEN");
    const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
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
