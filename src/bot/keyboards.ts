// src/bot/keyboards.ts — PUMP AUTO terminal UI

import { InlineKeyboard } from "grammy";

export function onboardingKeyboard() {
  return new InlineKeyboard()
    .text("🆕 CREATE WALLET", "wallet:create")
    .row()
    .text("🔑 IMPORT WALLET", "wallet:import")
    .row()
    .text("📚 HOW IT WORKS", "edu:how")
    .text("🔒 SECURITY", "edu:security");
}

export function mainKeyboard() {
  return new InlineKeyboard()
    .text("🤖 START HUNTING", "auto:start")
    .row()
    .text("🖥 WEB TERMINAL", "web:terminal")
    .row()
    .text("⚡ BUY TOKEN", "buy:start")
    .text("📉 SELL", "sell:menu")
    .row()
    .text("🔎 SCANNER", "scanner")
    .text("📊 POSITIONS", "positions")
    .row()
    .text("💰 PNL", "pnl")
    .text("👛 WALLET", "wallet:menu")
    .row()
    .text("⚙️ SETTINGS", "settings")
    .text("📡 ACTIVITY", "activity")
    .row()
    .text("📡 STATUS", "status")
    .text("📚 LEARN", "help")
    .row()
    .text("🎁 REFERRAL", "referral")
    .text("🆘 SUPPORT", "support")
    .row()
    .text("🚨 EMERGENCY STOP", "auto:kill");
}

export function backKeyboard() {
  return new InlineKeyboard().text("← HOME", "home");
}

export function settingsKeyboard(settings: any) {
  const tp = JSON.parse(settings.tp_tiers);
  const tpText = tp
    .map((tier: any) => `+${tier.profit}/${tier.sellPercent}`)
    .join(" · ");

  return new InlineKeyboard()
    .text(`💰 Buy: ${settings.max_buy} SOL`, "setting:max_buy")
    .text(`📉 Slip: ${settings.slippage}%`, "setting:slippage")
    .row()
    .text(`🎯 TP: ${tpText}`, "setting:tp")
    .row()
    .text(`🛑 SL: -${settings.stop_loss}%`, "setting:stop_loss")
    .text(`📈 Trail: +${settings.trailing_after}%`, "setting:trailing_after")
    .row()
    .text(`↘️ Pull: ${settings.trailing_pullback}%`, "setting:trailing_pullback")
    .text(`⏱ Time: ${settings.time_stop_minutes}m`, "setting:time_stop_minutes")
    .row()
    .text(`💥 Cap: ${settings.daily_loss_cap} SOL`, "setting:daily_loss_cap")
    .text(
      `🧠 Smart$: ${settings.smart_money_boost ? "ON" : "OFF"}`,
      "setting:smart_money"
    )
    .row()
    .text(`⚡ /Hr: ${settings.max_trades_hour}`, "setting:max_trades_hour")
    .text(`📅 /Day: ${settings.max_trades_day}`, "setting:max_trades_day")
    .row()
    .text("← HOME", "home");
}

export function editSettingKeyboard(field: string) {
  return new InlineKeyboard()
    .text("−", `adjust:${field}:minus`)
    .text("+", `adjust:${field}:plus`)
    .row()
    .text("✏️ CUSTOM", `custom:${field}`)
    .row()
    .text("← SETTINGS", "settings");
}

export function startConfirmKeyboard() {
  return new InlineKeyboard()
    .text("▶️ CONFIRM START", "auto:start:confirm")
    .row()
    .text("⚙️ CHANGE SETTINGS", "settings")
    .row()
    .text("← BACK", "home");
}

export function hunterActiveKeyboard() {
  return new InlineKeyboard()
    .text("⏸ PAUSE", "auto:stop")
    .row()
    .text("🔎 SCANNER", "scanner")
    .text("📊 POSITIONS", "positions")
    .row()
    .text("📡 ACTIVITY", "activity")
    .row()
    .text("🛑 STOP HUNTER", "auto:stop")
    .row()
    .text("← HOME", "home");
}

export function emergencyKeyboard() {
  return new InlineKeyboard()
    .text("🚨 CONFIRM STOP", "auto:kill:confirm")
    .row()
    .text("✕ CANCEL", "home");
}

export function walletKeyboard() {
  return new InlineKeyboard()
    .text("📋 COPY ADDRESS", "wallet:copy")
    .row()
    .text("💳 TRANSACTIONS", "wallet:tx")
    .row()
    .text("🔄 SWITCH WALLET", "wallet:list")
    .text("➕ ADD WALLET", "wallet:add")
    .row()
    .text("🔐 SECURITY", "edu:security")
    .row()
    .text("🚪 LOGOUT", "wallet:logout")
    .row()
    .text("← HOME", "home");
}

export function walletsListKeyboard(
  wallets: { id: number; label: string; is_active: number }[]
) {
  const kb = new InlineKeyboard();
  for (const w of wallets) {
    const marker = w.is_active ? "✅ " : "";
    kb.text(`${marker}${w.label}`, `wallet:switch:${w.id}`).row();
  }
  kb.text("➕ ADD WALLET", "wallet:add").row();
  kb.text("← WALLET", "wallet:menu");
  return kb;
}

export function walletManageKeyboard(walletId: number) {
  return new InlineKeyboard()
    .text("✅ MAKE ACTIVE", `wallet:switch:${walletId}`)
    .row()
    .text("🗑 REMOVE", `wallet:remove:${walletId}`)
    .row()
    .text("← LIST", "wallet:list");
}

export function walletCreatedKeyboard() {
  return new InlineKeyboard()
    .text("📋 COPY ADDRESS", "wallet:copy")
    .row()
    .text("🔐 BACKUP WALLET", "wallet:export")
    .row()
    .text("✓ I'VE SAVED IT", "home");
}

export function scannerKeyboard() {
  return new InlineKeyboard()
    .text("🔥 QUALIFIED", "scanner:passed")
    .text("🚫 REJECTED", "scanner:rejected")
    .row()
    .text("📡 LIVE FEED", "decisions")
    .text("⚙️ FILTERS", "settings")
    .row()
    .text("🔄 REFRESH", "scanner")
    .text("← HOME", "home");
}

export function activityKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "activity")
    .row()
    .text("🧠 DECISIONS", "decisions")
    .text("📊 STATUS", "status")
    .row()
    .text("← HOME", "home");
}

export function eduHomeKeyboard() {
  return new InlineKeyboard()
    .text("ℹ️ HOW IT WORKS", "edu:how")
    .text("⚠️ RISKS", "edu:risks")
    .row()
    .text("📊 PERFORMANCE", "pnl")
    .text("🤖 STRATEGY", "edu:strategy")
    .row()
    .text("❓ FAQ", "edu:faq")
    .text("🔒 SECURITY", "edu:security")
    .row()
    .text("💬 SUPPORT", "support")
    .text("← HOME", "home");
}

export function eduHowKeyboard() {
  return new InlineKeyboard()
    .text("📡 STATUS", "status")
    .text("🤖 STRATEGY", "edu:strategy")
    .row()
    .text("← LEARN", "help");
}

export function eduRisksKeyboard() {
  return new InlineKeyboard()
    .text("⚙️ RISK SETTINGS", "settings")
    .text("📡 STATUS", "status")
    .row()
    .text("← LEARN", "help");
}

export function eduStrategyKeyboard() {
  return new InlineKeyboard()
    .text("⚙️ CHANGE STRATEGY", "settings")
    .text("← LEARN", "help");
}

export function eduSecurityKeyboard() {
  return new InlineKeyboard()
    .text("👛 WALLET", "wallet:menu")
    .text("← LEARN", "help");
}

export function eduFaqListKeyboard() {
  return new InlineKeyboard()
    .text("How does Auto-Hunter work?", "faq:1")
    .row()
    .text("Can I stop the bot?", "faq:5")
    .row()
    .text("How is my wallet protected?", "faq:9")
    .row()
    .text("What happens at loss cap?", "faq:7")
    .row()
    .text("Can the bot withdraw funds?", "faq:9")
    .row()
    .text("Why was a token rejected?", "faq:4")
    .row()
    .text("How are trades executed?", "faq:3")
    .row()
    .text("← LEARN", "help");
}

export function faqAnswerKeyboard() {
  return new InlineKeyboard()
    .text("← QUESTIONS", "edu:faq")
    .text("← LEARN", "help");
}

export function stopConfirmKeyboard() {
  return new InlineKeyboard()
    .text("⏹ CONFIRM STOP", "auto:stop:confirm")
    .row()
    .text("✕ CANCEL", "home");
}

export function streamKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "market:stream")
    .row()
    .url("Open pump.fun", "https://pump.fun")
    .row()
    .text("← HOME", "home");
}

export function solPriceKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "market:sol")
    .row()
    .text("← HOME", "home");
}

export function referralKeyboard() {
  return new InlineKeyboard()
    .text("📋 COPY LINK", "referral:copy")
    .row()
    .text("← HOME", "home");
}

export function decisionsKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "decisions")
    .row()
    .text("📡 STATUS", "status")
    .text("← HOME", "home");
}

export function buyPromptKeyboard() {
  return new InlineKeyboard().text("← CANCEL", "home");
}

export function sellEmptyKeyboard() {
  return new InlineKeyboard()
    .text("🔎 SCANNER", "scanner")
    .text("⚡ BUY TOKEN", "buy:start")
    .row()
    .text("← HOME", "home");
}

export function positionsEmptyKeyboard() {
  return new InlineKeyboard()
    .text("🔎 SCANNER", "scanner")
    .text("⚡ BUY TOKEN", "buy:start")
    .row()
    .text("← HOME", "home");
}

export function pnlEmptyKeyboard() {
  return new InlineKeyboard()
    .text("🤖 START HUNTING", "auto:start")
    .text("⚡ BUY TOKEN", "buy:start")
    .row()
    .text("← HOME", "home");
}
