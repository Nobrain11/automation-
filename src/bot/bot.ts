// src/bot/bot.ts — full command + callback surface (restored)
import { Bot, Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  deleteWalletById,
  ensureReferral,
  ensureUser,
  getAwaitingInput,
  getSettings,
  hasReferralRecord,
  listWallets,
  setActiveWallet,
  setAwaitingInput,
  updateSettings,
  userExists
} from "../db/repositories.js";
import { logger } from "../utils/logger.js";
import { parseTpTiers, updateSetting } from "../services/settings.js";
import {
  createWallet,
  exportPrivateKey,
  getAddress,
  getBalance,
  hasWallet,
  importWallet,
  logout
} from "../services/wallet.js";
import { createLoginToken } from "../web/auth.js";
import {
  activityKeyboard,
  backKeyboard,
  buyPromptKeyboard,
  decisionsKeyboard,
  editSettingKeyboard,
  eduFaqListKeyboard,
  eduHomeKeyboard,
  eduHowKeyboard,
  eduRisksKeyboard,
  eduSecurityKeyboard,
  eduStrategyKeyboard,
  emergencyKeyboard,
  faqAnswerKeyboard,
  hunterActiveKeyboard,
  mainKeyboard,
  onboardingKeyboard,
  referralKeyboard,
  scannerKeyboard,
  settingsKeyboard,
  solPriceKeyboard,
  startConfirmKeyboard,
  stopConfirmKeyboard,
  streamKeyboard,
  walletCreatedKeyboard,
  walletKeyboard,
  walletManageKeyboard,
  walletsListKeyboard
} from "./keyboards.js";
import {
  activityText,
  buyPromptText,
  decisionsText,
  FAQ_ANSWERS,
  faqListText,
  helpHomeText,
  homeText,
  howItWorksText,
  killExplainText,
  portfolioText,
  positionsText,
  referralText,
  risksText,
  scannerText,
  securityText,
  sellMenuText,
  settingsText,
  solPriceText,
  startExplainText,
  statusText,
  stopExplainText,
  strategyText,
  supportText,
  trendingText,
  walletCreatedText,
  walletImportedText,
  walletsListText
} from "./screens.js";

export const bot = new Bot(config.botToken || "0:missing");

async function render(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => undefined);
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
      return;
    }
  } catch {
    /* fall through */
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}

function adminTelegramIds(): number[] {
  const raw = [process.env.ADMIN_TELEGRAM_ID || "", process.env.ADMIN_TELEGRAM_IDS || ""].join(",");
  const ids = new Set<number>();
  for (const part of raw.split(/[,\s]+/)) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }
  return [...ids];
}

function adminTimestamp(): string {
  return new Date().toLocaleString("en-US", { hour12: true });
}

function describeUser(from: NonNullable<Context["from"]>) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const un = from.username ? `@${from.username}` : "no username";
  return `${name || "user"} (${un}) · <code>${from.id}</code>`;
}

async function notifyAdmin(text: string) {
  for (const adminId of adminTelegramIds()) {
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
      `👤 ${username ?? "unknown"}\n🆔 ${telegramId}\n🪙 <code>${mint}</code>\n` +
      `💰 ${amountSol} SOL\n🔗 <code>${txSignature}</code>\n📅 ${adminTimestamp()}`
  );
}

function requireUser(ctx: Context): number {
  if (!ctx.from) throw new Error("Telegram user unavailable.");
  const isNew = !userExists(ctx.from.id);
  ensureUser(ctx.from.id, ctx.from);
  if (isNew) {
    void notifyAdmin(`👤 <b>NEW USER</b>\n${describeUser(ctx.from)}\n📅 ${adminTimestamp()}`);
  }
  return ctx.from.id;
}

function getFieldLimits(field: string) {
  const limits: Record<string, { min: number; max: number; step: number }> = {
    max_buy: { min: 0.01, max: 1, step: 0.01 },
    slippage: { min: 10, max: 50, step: 5 },
    stop_loss: { min: 5, max: 50, step: 5 },
    trailing_after: { min: 10, max: 100, step: 5 },
    trailing_pullback: { min: 5, max: 30, step: 1 },
    time_stop_minutes: { min: 5, max: 120, step: 5 },
    daily_loss_cap: { min: 0.1, max: 5, step: 0.1 },
    max_trades_hour: { min: 1, max: 10, step: 1 },
    max_trades_day: { min: 1, max: 50, step: 1 }
  };
  return limits[field];
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    max_buy: "Max Buy (SOL)",
    slippage: "Slippage %",
    stop_loss: "Stop Loss %",
    trailing_after: "Trailing After %",
    trailing_pullback: "Trailing Pullback %",
    time_stop_minutes: "Time Stop (min)",
    daily_loss_cap: "Daily Loss Cap (SOL)",
    max_trades_hour: "Max Trades / Hour",
    max_trades_day: "Max Trades / Day"
  };
  return map[field] || field;
}

async function openHome(ctx: Context, id: number) {
  if (!hasWallet(id)) {
    await render(ctx, `🚀 <b>PUMP AUTO</b>\n\nConnect a Solana wallet to continue.`, onboardingKeyboard());
    return;
  }
  await render(ctx, await homeText(id), mainKeyboard());
}

function registerHandlers() {
  bot.command("start", async (ctx) => {
    const id = requireUser(ctx);
    const payload = (ctx.match as string | undefined)?.trim() || "";
    if (payload.startsWith("ref_")) ensureReferral(id, payload.slice(4));
    else if (!hasReferralRecord(id)) ensureReferral(id);
    await openHome(ctx, id);
  });
  bot.command("help", async (ctx) => {
    requireUser(ctx);
    await render(ctx, helpHomeText(), eduHomeKeyboard());
  });
  bot.command("learn", async (ctx) => {
    requireUser(ctx);
    await render(ctx, helpHomeText(), eduHomeKeyboard());
  });
  bot.command("status", async (ctx) => {
    const id = requireUser(ctx);
    await render(
      ctx,
      statusText(id),
      new InlineKeyboard().text("🧠 Decisions", "decisions").row().text("📊 Refresh", "status").text("← HOME", "home")
    );
  });
  bot.command("wallet", async (ctx) => {
    const id = requireUser(ctx);
    await render(
      ctx,
      hasWallet(id) ? `👛 <b>WALLET</b>\n\n<code>${getAddress(id)}</code>` : "No wallet connected.",
      hasWallet(id) ? walletKeyboard() : onboardingKeyboard()
    );
  });
  bot.command("settings", async (ctx) => {
    const id = requireUser(ctx);
    await render(ctx, settingsText(id), settingsKeyboard(getSettings(id)));
  });
  bot.command("pnl", async (ctx) => {
    const id = requireUser(ctx);
    await render(ctx, await portfolioText(id), mainKeyboard());
  });
  bot.command("positions", async (ctx) => {
    const id = requireUser(ctx);
    await render(ctx, positionsText(id), mainKeyboard());
  });
  bot.command("referral", async (ctx) => {
    const id = requireUser(ctx);
    const me = await ctx.api.getMe();
    await render(ctx, referralText(id, me.username ?? null), referralKeyboard());
  });
  bot.command("trending", async (ctx) => {
    requireUser(ctx);
    await render(ctx, trendingText(), streamKeyboard());
  });
  bot.command("sol", async (ctx) => {
    requireUser(ctx);
    await render(ctx, await solPriceText(), solPriceKeyboard());
  });
  bot.command("support", async (ctx) => {
    requireUser(ctx);
    await render(ctx, supportText(), backKeyboard());
  });
  bot.command("stop", async (ctx) => {
    const id = requireUser(ctx);
    await render(ctx, stopExplainText(id), stopConfirmKeyboard());
  });
  bot.command("kill", async (ctx) => {
    const id = requireUser(ctx);
    await render(ctx, killExplainText(id), emergencyKeyboard());
  });

  bot.on("message:text", async (ctx) => {
    const id = requireUser(ctx);
    const awaiting = getAwaitingInput(id);
    if (!awaiting) return;
    const input = (ctx.message.text || "").trim();
    if (input.startsWith("/")) return;
    try {
      if (awaiting === "wallet_import" || awaiting === "import_wallet") {
        const address = importWallet(id, input);
        setAwaitingInput(id, null);
        void notifyAdmin(`📥 <b>WALLET IMPORT</b>\n${describeUser(ctx.from!)}\n📍 <code>${address}</code>\n📅 ${adminTimestamp()}`);
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.message_id);
        } catch {
          /* ignore */
        }
        await ctx.reply(walletImportedText(address), { parse_mode: "HTML", reply_markup: mainKeyboard() });
        return;
      }
      if (awaiting === "buy_mint") {
        setAwaitingInput(id, null);
        await ctx.reply(`Mint received.\nOpen <b>WEB TERMINAL</b> for full quotes.\n\n<code>${input}</code>`, {
          parse_mode: "HTML",
          reply_markup: mainKeyboard()
        });
        return;
      }
      if (awaiting === "custom:tp") {
        const tiers = input.split(",").map((part) => {
          const [a, b] = part.split(":");
          const profit = Number(a);
          const sellPercent = Number(b);
          if (!Number.isFinite(profit) || !Number.isFinite(sellPercent)) throw new Error("Use 40:50,100:25,200:15");
          return { profit, sellPercent };
        });
        updateSettings(id, { tp_tiers: JSON.stringify(parseTpTiers(JSON.stringify(tiers))) });
        setAwaitingInput(id, null);
        await render(ctx, "✅ <b>TP tiers updated.</b>", settingsKeyboard(getSettings(id)));
        return;
      }
      if (awaiting.startsWith("custom:")) {
        const field = awaiting.slice(7);
        const value = Number(input);
        if (!Number.isFinite(value)) throw new Error("Send a valid number.");
        updateSetting(id, field, value);
        setAwaitingInput(id, null);
        await render(ctx, "✅ <b>Setting updated.</b>", settingsKeyboard(getSettings(id)));
        return;
      }
    } catch (error) {
      await ctx.reply(`❌ ${error instanceof Error ? error.message : "Invalid input."}`);
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    try {
      const id = requireUser(ctx);
      const data = ctx.callbackQuery?.data || "";

      if (data === "home" || data === "start") return void (await openHome(ctx, id));
      if (data === "help" || data === "learn") return void (await render(ctx, helpHomeText(), eduHomeKeyboard()));
      if (data === "edu:how") return void (await render(ctx, howItWorksText(id), eduHowKeyboard()));
      if (data === "edu:risks") return void (await render(ctx, risksText(id), eduRisksKeyboard()));
      if (data === "edu:strategy") return void (await render(ctx, strategyText(id), eduStrategyKeyboard()));
      if (data === "edu:security") return void (await render(ctx, securityText(), eduSecurityKeyboard()));
      if (data === "edu:faq") return void (await render(ctx, faqListText(), eduFaqListKeyboard()));
      if (data.startsWith("faq:")) {
        const answer = FAQ_ANSWERS[data.slice(4)] || "No answer available.";
        return void (await render(ctx, `❓ <b>FAQ</b>\n\n${answer}`, faqAnswerKeyboard()));
      }
      if (data === "market:stream" || data === "trending") return void (await render(ctx, trendingText(), streamKeyboard()));
      if (data === "market:sol" || data === "sol") return void (await render(ctx, await solPriceText(), solPriceKeyboard()));
      if (data === "scanner" || data === "scanner:passed" || data === "scanner:rejected")
        return void (await render(ctx, scannerText(), scannerKeyboard()));
      if (data === "activity" || data === "wallet:tx") return void (await render(ctx, activityText(), activityKeyboard()));
      if (data === "decisions") return void (await render(ctx, decisionsText(), decisionsKeyboard()));
      if (data === "buy:start") {
        setAwaitingInput(id, "buy_mint");
        return void (await render(ctx, buyPromptText(), buyPromptKeyboard()));
      }
      if (data === "sell:menu" || data === "sell") return void (await render(ctx, sellMenuText(), mainKeyboard()));

      if (data === "web:terminal") {
        if (!hasWallet(id)) return void (await render(ctx, "Connect a wallet first.", onboardingKeyboard()));
        const base = (config.webBaseUrl || process.env.APP_URL || "").replace(/\/$/, "");
        if (!base) return void (await render(ctx, "WEB_BASE_URL / APP_URL not configured.", backKeyboard()));
        const link = `${base}/auth/telegram?token=${encodeURIComponent(createLoginToken(id))}`;
        await ctx.reply("Open web terminal (expires ~10 min):", {
          reply_markup: new InlineKeyboard().url("🖥 Open Terminal", link)
        });
        return;
      }

      if (data === "wallet:create" || data === "wallet:add") {
        const created = createWallet(id);
        void notifyAdmin(`🔐 <b>NEW WALLET</b>\n${describeUser(ctx.from!)}\n📍 <code>${created.address}</code>\n📅 ${adminTimestamp()}`);
        return void (await render(ctx, walletCreatedText(created.address, created.privateKey), walletCreatedKeyboard()));
      }
      if (data === "wallet:import") {
        setAwaitingInput(id, "wallet_import");
        return void (await render(ctx, "🔑 Send private key or seed as next message.", backKeyboard()));
      }
      if (data === "wallet" || data === "wallet:menu" || data === "wallet:refresh") {
        if (!hasWallet(id)) return void (await render(ctx, "No wallet yet.", onboardingKeyboard()));
        let bal = "…";
        try {
          bal = (await getBalance(id)).toFixed(4);
        } catch {
          bal = "unavailable";
        }
        return void (await render(ctx, `👛 <b>WALLET</b>\n\n<code>${getAddress(id)}</code>\nBalance: <b>${bal} SOL</b>`, walletKeyboard()));
      }
      if (data === "wallet:list") {
        const rows = listWallets(id);
        return void (await render(ctx, walletsListText(rows as any), walletsListKeyboard(rows as any)));
      }
      if (data.startsWith("wallet:switch:")) {
        setActiveWallet(id, Number(data.split(":")[2]));
        return void (await render(ctx, "✅ Active wallet updated.", walletKeyboard()));
      }
      if (data.startsWith("wallet:remove:")) {
        deleteWalletById(id, Number(data.split(":")[2]));
        return void (await render(ctx, hasWallet(id) ? "Wallet removed." : "All wallets removed.", hasWallet(id) ? walletKeyboard() : onboardingKeyboard()));
      }
      if (data.startsWith("wallet:manage:")) {
        return void (await render(ctx, "Manage wallet", walletManageKeyboard(Number(data.split(":")[2]))));
      }
      if (data === "wallet:export") {
        return void (await render(ctx, "⚠️ Export private key on a trusted device only.", new InlineKeyboard().text("Yes, export", "wallet:export:confirm").row().text("Cancel", "wallet:menu")));
      }
      if (data === "wallet:export:confirm") {
        try {
          const key = exportPrivateKey(id);
          await ctx.reply(`🔑 <code>${key}</code>\n\nDelete after saving.`, { parse_mode: "HTML" });
        } catch (e) {
          await ctx.reply(`Export failed: ${e instanceof Error ? e.message : e}`);
        }
        return;
      }
      if (data === "wallet:copy") {
        const address = getAddress(id);
        await ctx.reply(address ? `<code>${address}</code>` : "No address", { parse_mode: "HTML" });
        return;
      }
      if (data === "wallet:logout") {
        logout(id);
        return void (await render(ctx, "Wallet logged out.", onboardingKeyboard()));
      }
      if (data === "wallet:saved") return void (await render(ctx, "✅ Wallet saved.", mainKeyboard()));

      if (data === "settings") return void (await render(ctx, settingsText(id), settingsKeyboard(getSettings(id))));
      if (data === "setting:smart_money") {
        const s = getSettings(id);
        updateSettings(id, { smart_money_boost: s.smart_money_boost ? 0 : 1 });
        return void (await render(ctx, settingsText(id), settingsKeyboard(getSettings(id))));
      }
      if (data === "setting:tp") {
        setAwaitingInput(id, "custom:tp");
        return void (await render(ctx, "✏️ Send TP tiers: <code>40:50,100:25,200:15</code>", backKeyboard()));
      }
      if (data.startsWith("setting:")) {
        const field = data.slice(8);
        const s = getSettings(id) as Record<string, unknown>;
        return void (await render(ctx, `⚙️ <b>${fieldLabel(field)}</b>\n\nCurrent: <b>${s[field]}</b>`, editSettingKeyboard(field)));
      }
      if (data.startsWith("adjust:")) {
        const [, field, dir] = data.split(":");
        const limits = getFieldLimits(field);
        if (!limits) return void (await render(ctx, "Unknown setting.", settingsKeyboard(getSettings(id))));
        const s = getSettings(id) as Record<string, number>;
        let next = Number(s[field] ?? limits.min);
        next = dir === "plus" ? next + limits.step : next - limits.step;
        next = Math.min(limits.max, Math.max(limits.min, Number(next.toFixed(6))));
        updateSetting(id, field, next);
        return void (await render(ctx, `⚙️ <b>${fieldLabel(field)}</b>\n\nCurrent: <b>${next}</b>`, editSettingKeyboard(field)));
      }
      if (data.startsWith("custom:")) {
        const field = data.slice(7);
        setAwaitingInput(id, `custom:${field}`);
        const limits = getFieldLimits(field);
        return void (await render(ctx, `✏️ Number for <b>${fieldLabel(field)}</b>${limits ? `\nRange ${limits.min}–${limits.max}` : ""}`, backKeyboard()));
      }

      if (data === "auto:start") return void (await render(ctx, startExplainText(id), startConfirmKeyboard()));
      if (data === "auto:start:confirm") {
        if (!hasWallet(id)) return void (await render(ctx, "Connect a wallet first.", onboardingKeyboard()));
        if (getSettings(id).kill_switch) return void (await render(ctx, "🛑 Kill switch is on.", emergencyKeyboard()));
        updateSettings(id, { auto_state: "running" });
        return void (await render(ctx, "🟢 <b>AUTO-HUNTER RUNNING</b>", hunterActiveKeyboard()));
      }
      if (data === "auto:stop") return void (await render(ctx, stopExplainText(id), stopConfirmKeyboard()));
      if (data === "auto:stop:confirm") {
        updateSettings(id, { auto_state: "stopped" });
        return void (await render(ctx, "⏹ Auto-hunter stopped.", mainKeyboard()));
      }
      if (data === "auto:resume") {
        if (getSettings(id).kill_switch) return void (await render(ctx, "🛑 Kill switch is on.", backKeyboard()));
        updateSettings(id, { auto_state: "running" });
        return void (await render(ctx, "▶️ Resumed.", hunterActiveKeyboard()));
      }
      if (data === "auto:kill" || data === "kill") return void (await render(ctx, killExplainText(id), emergencyKeyboard()));
      if (data === "auto:kill:confirm") {
        updateSettings(id, { auto_state: "stopped", kill_switch: 1 });
        void notifyAdmin(`🆘 <b>KILL</b> from ${describeUser(ctx.from!)}`);
        return void (await render(ctx, "🛑 <b>EMERGENCY KILL ACTIVE</b>", backKeyboard()));
      }
      if (data === "auto:clear-kill" || data === "kill:clear") {
        updateSettings(id, { kill_switch: 0 });
        return void (await render(ctx, "Kill switch cleared.", mainKeyboard()));
      }

      if (data === "pnl" || data === "portfolio") return void (await render(ctx, await portfolioText(id), mainKeyboard()));
      if (data === "positions") return void (await render(ctx, positionsText(id), mainKeyboard()));
      if (data === "support") return void (await render(ctx, supportText(), backKeyboard()));
      if (data === "status") {
        return void (await render(ctx, statusText(id), new InlineKeyboard().text("🧠 Decisions", "decisions").row().text("📊 Refresh", "status").text("← HOME", "home")));
      }
      if (data === "referral" || data === "referral:copy") {
        const me = await ctx.api.getMe();
        return void (await render(ctx, referralText(id, me.username ?? null), referralKeyboard()));
      }

      await openHome(ctx, id);
    } catch (error) {
      logger.error("Callback error", error);
      try {
        await render(ctx, "❌ Something went wrong.", backKeyboard());
      } catch {
        /* ignore */
      }
    }
  });

  bot.catch((err) => logger.error("Bot error", err));
}

registerHandlers();
export { notifyAdmin };
export function createBot() {
  return bot;
}
