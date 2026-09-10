// src/bot/bot.ts - PUMP AUTO terminal handlers + web login
// Multi-admin: ADMIN_TELEGRAM_ID or ADMIN_TELEGRAM_IDS (comma-separated)

import {
  Bot,
  Context,
  InlineKeyboard
} from "grammy";

import { config } from "../config.js";

import {
  ensureUser,
  getAwaitingInput,
  getSettings,
  setAwaitingInput,
  updateSettings,
  userExists,
  ensureReferral,
  hasReferralRecord,
  getReferralStats
} from "../db/repositories.js";

import {
  createWallet,
  exportSecretKeyBase58,
  getAddress,
  getBalance,
  hasWallet,
  importWallet,
  logoutWallet
} from "../services/wallet.js";

import { createLoginToken } from "../web/auth.js";
import { logger } from "../utils/logger.js";

import {
  mainKeyboard,
  referralKeyboard,
  settingsKeyboard,
  walletKeyboard,
  confirmExportKeyboard
} from "./keyboards.js";

import {
  helpText,
  homeText,
  portfolioText,
  positionsText,
  referralText,
  settingsText,
  statusText,
  walletText
} from "./screens.js";

export const bot = new Bot(config.botToken);

function describeUser(from: NonNullable<Context["from"]>) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const un = from.username ? `@${from.username}` : "no username";
  return `${name || "user"} (${un}) · <code>${from.id}</code>`;
}

function adminTelegramIds(): number[] {
  const raw = [
    process.env.ADMIN_TELEGRAM_ID || "",
    process.env.ADMIN_TELEGRAM_IDS || ""
  ].join(",");
  const ids = new Set<number>();
  for (const part of raw.split(/[,\s]+/)) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }
  return [...ids];
}

async function notifyAdmin(text: string) {
  const ids = adminTelegramIds();
  if (!ids.length) return;
  for (const adminId of ids) {
    try {
      await bot.api.sendMessage(adminId, text, { parse_mode: "HTML" });
    } catch (error) {
      logger.warn(`Failed to notify admin ${adminId}.`, error);
    }
  }
}

export async function notifyAdminTradeExecuted(
  telegramId: number,
  username: string | null,
  mint: string,
  side: "buy" | "sell",
  amountSol: number,
  txSignature: string
) {
  await notifyAdmin(
    `${side === "buy" ? "🟢" : "🔴"} <b>TRADE ${side.toUpperCase()}</b>\n` +
      `👤 ${username ?? "unknown"}\n` +
      `🆔 ${telegramId}\n` +
      `🪙 <code>${mint}</code>\n` +
      `💰 ${amountSol} SOL\n` +
      `🔗 <code>${txSignature}</code>\n` +
      `📅 ${adminTimestamp()}`
  );
}

function adminTimestamp(): string {
  return new Date().toLocaleString("en-US", { hour12: true });
}

function requireUser(ctx: Context): number {
  const id = ctx.from?.id;
  if (!id) throw new Error("No user");
  if (!userExists(id)) {
    ensureUser(id, {
      username: ctx.from?.username,
      first_name: ctx.from?.first_name
    });
  }
  return id;
}

export function createBot() {
  bot.command("start", async (ctx) => {
    const id = requireUser(ctx);
    const payload = typeof ctx.match === "string" ? ctx.match : "";
    let refCode: string | null = null;
    if (payload.startsWith("ref_")) refCode = payload.slice(4);
    const hadReferral = hasReferralRecord(id);
    const referral = ensureReferral(id, refCode);
    if (!hadReferral && referral.referred_by) {
      void notifyAdmin(
        `🎁 <b>Referral signup</b>\n${describeUser(ctx.from!)} was referred by user ${referral.referred_by}`
      );
    }
    await ctx.reply(
      `⚡ <b>PUMP AUTO</b>\n\nAutomated Solana trading terminal.\n\nUse the buttons below or open the Web Terminal.`,
      { parse_mode: "HTML", reply_markup: mainKeyboard() }
    );
  });

  bot.command("help", async (ctx) => {
    requireUser(ctx);
    await ctx.reply(helpText(), { parse_mode: "HTML", reply_markup: mainKeyboard() });
  });

  bot.command("status", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await statusText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
  });

  bot.command("wallet", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await walletText(id), {
      parse_mode: "HTML",
      reply_markup: walletKeyboard(hasWallet(id))
    });
  });

  bot.command("settings", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(settingsText(id), { parse_mode: "HTML", reply_markup: settingsKeyboard() });
  });

  bot.command("pnl", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await portfolioText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
  });

  bot.command("positions", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await positionsText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
  });

  bot.command("referral", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(referralText(id, ctx.me.username ?? null), {
      parse_mode: "HTML",
      reply_markup: referralKeyboard()
    });
  });

  bot.command("kill", async (ctx) => {
    const id = requireUser(ctx);
    updateSettings(id, { auto_state: "stopped", kill_switch: 1 });
    void notifyAdmin(`🆘 <b>KILL</b> from ${describeUser(ctx.from!)}`);
    await ctx.reply("Emergency stop active. Automation disabled until you clear kill.", {
      reply_markup: mainKeyboard()
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const id = requireUser(ctx);
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }

    if (data === "web:terminal") {
      const base = config.webBaseUrl;
      if (!base) {
        await ctx.reply("WEB_BASE_URL is not configured.");
        return;
      }
      const token = createLoginToken(id);
      const link = `${base}/auth/telegram?token=${encodeURIComponent(token)}`;
      await ctx.reply(`🖥 <b>WEB TERMINAL</b>\n\nLink expires in <b>10 minutes</b>.`, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url("Open Terminal", link)
      });
      return;
    }

    if (data === "wallet:create") {
      if (hasWallet(id)) {
        await ctx.reply("Wallet already connected.", { reply_markup: walletKeyboard(true) });
        return;
      }
      try {
        const wallet = createWallet(id);
        void notifyAdmin(
          `🔐 <b>NEW WALLET</b>\n👤 ${describeUser(ctx.from!)}\n📍 <code>${wallet.publicKey}</code>\n📅 ${adminTimestamp()}`
        );
        await ctx.reply(`✅ Wallet created.\n<code>${wallet.publicKey}</code>`, {
          parse_mode: "HTML",
          reply_markup: walletKeyboard(true)
        });
      } catch (e) {
        await ctx.reply(`Failed: ${e instanceof Error ? e.message : e}`);
      }
      return;
    }

    if (data === "wallet:import") {
      setAwaitingInput(id, "import_wallet");
      await ctx.reply("Send your private key or 12/24-word seed as the next message.");
      return;
    }

    if (data === "wallet:export" || data === "wallet:export:confirm") {
      if (!hasWallet(id)) {
        await ctx.reply("No wallet.");
        return;
      }
      if (data === "wallet:export") {
        await ctx.reply("Confirm export? Only do this on a secure device.", {
          reply_markup: confirmExportKeyboard()
        });
        return;
      }
      try {
        const sk = exportSecretKeyBase58(id);
        await ctx.reply(`⚠️ <b>PRIVATE KEY</b> — delete after saving\n<code>${sk}</code>`, {
          parse_mode: "HTML"
        });
      } catch (e) {
        await ctx.reply(`Export failed: ${e instanceof Error ? e.message : e}`);
      }
      return;
    }

    if (data === "wallet:logout") {
      logoutWallet(id);
      await ctx.reply("Wallet disconnected from this bot session.", {
        reply_markup: walletKeyboard(false)
      });
      return;
    }

    if (data === "wallet" || data === "wallet:refresh") {
      await ctx.reply(await walletText(id), {
        parse_mode: "HTML",
        reply_markup: walletKeyboard(hasWallet(id))
      });
      return;
    }

    if (data === "home" || data === "start") {
      await ctx.reply(await homeText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
      return;
    }
    if (data === "status") {
      await ctx.reply(await statusText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
      return;
    }
    if (data === "settings") {
      await ctx.reply(settingsText(id), { parse_mode: "HTML", reply_markup: settingsKeyboard() });
      return;
    }
    if (data === "referral" || data === "referral:copy") {
      await ctx.reply(referralText(id, ctx.me.username ?? null), {
        parse_mode: "HTML",
        reply_markup: referralKeyboard()
      });
      return;
    }
    if (data === "positions") {
      await ctx.reply(await positionsText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
      return;
    }
    if (data === "pnl" || data === "portfolio") {
      await ctx.reply(await portfolioText(id), { parse_mode: "HTML", reply_markup: mainKeyboard() });
      return;
    }
    if (data === "kill") {
      updateSettings(id, { auto_state: "stopped", kill_switch: 1 });
      void notifyAdmin(`🆘 <b>KILL</b> from ${describeUser(ctx.from!)}`);
      await ctx.reply("Emergency stop active.", { reply_markup: mainKeyboard() });
      return;
    }
  });

  bot.on("message:text", async (ctx) => {
    const id = requireUser(ctx);
    const text = ctx.message.text?.trim() || "";
    const awaiting = getAwaitingInput(id);
    if (awaiting === "import_wallet") {
      setAwaitingInput(id, null);
      try {
        const w = importWallet(id, text);
        void notifyAdmin(
          `📥 <b>WALLET IMPORT</b>\n${describeUser(ctx.from!)}\n📍 <code>${w.publicKey}</code>`
        );
        await ctx.reply(`✅ Wallet imported.\n<code>${w.publicKey}</code>`, {
          parse_mode: "HTML",
          reply_markup: walletKeyboard(true)
        });
      } catch (e) {
        await ctx.reply(`Import failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  });

  bot.catch((err) => {
    logger.error("Bot error", err);
  });

  return bot;
}

export { notifyAdmin };
