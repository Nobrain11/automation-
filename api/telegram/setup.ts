import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  maxDuration: 30
};

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const url = new URL(
      req.url || "/",
      `https://${req.headers.host || "localhost"}`
    );

    const setupToken = process.env.TELEGRAM_WEBHOOK_SETUP_TOKEN?.trim();
    if (setupToken) {
      const supplied = url.searchParams.get("token")?.trim();
      if (supplied !== setupToken) {
        sendJson(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
    }

    const token =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim();
    if (!token) {
      sendJson(res, 500, {
        ok: false,
        error: "Missing TELEGRAM_BOT_TOKEN"
      });
      return;
    }

    const appUrl = (
      process.env.APP_URL?.trim() ||
      process.env.WEB_BASE_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    ).replace(/\/$/, "");

    if (!appUrl) {
      sendJson(res, 500, { ok: false, error: "Missing APP_URL" });
      return;
    }

    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"]
    };
    if (secret) body.secret_token = secret;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    const telegramResult = (await telegramResponse.json()) as Record<
      string,
      unknown
    >;

    const ok = telegramResponse.ok && telegramResult.ok === true;
    sendJson(res, ok ? 200 : 502, {
      ok,
      webhookUrl,
      telegram: telegramResult
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "setup_failed"
    });
  }
}
