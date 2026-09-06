// Lightweight Telegram messages without importing the Grammy bot graph

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

async function send(chatId: number | string, text: string): Promise<void> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }),
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!res.ok) {
      const t = await res.text();
      logger.warn(`Telegram notify failed ${res.status}: ${t.slice(0, 120)}`);
    }
  } catch (error) {
    logger.warn("Telegram notify error", error);
  }
}

export async function notifyUser(
  telegramId: number,
  text: string
): Promise<void> {
  await send(telegramId, text);
}

export async function notifyAdmin(text: string): Promise<void> {
  const adminId = process.env.ADMIN_TELEGRAM_ID?.trim();
  if (!adminId) return;
  await send(adminId, text);
}

export async function notifyTrade(input: {
  telegramId: number;
  side: "buy" | "sell";
  mint: string;
  symbol?: string | null;
  amountSol: number;
  signature?: string | null;
  ok: boolean;
  error?: string | null;
  route?: string | null;
}): Promise<void> {
  const sym = input.symbol ? `$${input.symbol}` : "token";
  if (input.ok) {
    const msg =
      `${input.side === "buy" ? "🟢" : "🔴"} <b>${input.side.toUpperCase()} ${sym}</b>\n` +
      `<code>${input.mint}</code>\n` +
      `💰 ${input.amountSol} SOL` +
      (input.route ? ` · ${input.route}` : "") +
      (input.signature
        ? `\n🔗 <code>${input.signature}</code>`
        : "");
    await notifyUser(input.telegramId, msg);
    await notifyAdmin(
      msg + `\n🆔 ${input.telegramId}\n📅 ${new Date().toISOString()}`
    );
  } else {
    await notifyUser(
      input.telegramId,
      `⚠️ <b>${input.side.toUpperCase()} failed</b> ${sym}\n` +
        `${(input.error || "unknown").slice(0, 180)}`
    );
  }
}
