import type { IncomingMessage, ServerResponse } from "node:http";

import { validateConfig } from "../../src/config.js";
import { runMigrations } from "../../src/db/migrations.js";

export const config = {
  maxDuration: 30
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

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
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!expectedSecret) {
      sendJson(res, 503, { ok: false, error: "webhook_not_configured" });
      return;
    }

    const receivedSecret = String(
      req.headers["x-telegram-bot-api-secret-token"] || ""
    ).trim();
    if (receivedSecret !== expectedSecret) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }

    const token =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim();
    if (!token) {
      sendJson(res, 500, { ok: false, error: "missing_bot_token" });
      return;
    }

    let update: unknown;
    try {
      update = await readJson(req);
    } catch {
      sendJson(res, 400, { ok: false, error: "invalid_json" });
      return;
    }

    if (!update || typeof update !== "object") {
      sendJson(res, 400, { ok: false, error: "invalid_update" });
      return;
    }

    try {
      validateConfig();
      runMigrations();
      const { bot } = await import("../../src/bot/bot.js");
      await bot.handleUpdate(update as object);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "update_failed";
      console.error("Telegram webhook update failed", error);
      // Acknowledge so Telegram does not retry forever
      sendJson(res, 200, { ok: false, error: message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    console.error("Telegram webhook crashed", error);
    sendJson(res, 200, { ok: false, error: message });
  }
}
