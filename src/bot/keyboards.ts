// src/bot/keyboards.ts — professional trading terminal UI

import { InlineKeyboard } from "grammy";

export function onboardingKeyboard() {
  return new InlineKeyboard()
    .text("🆕 CREATE WALLET", "wallet:create")
    .row()
    .text("🔑 IMPORT WALLET", "wallet:import")
    .row()
    .text("ℹ️ HOW IT WORKS", "edu:how")
    .text("🔒 SECURITY", "edu:security");
}

export function mainKeyboard() {
  return new InlineKeyboard()
    .text("🤖 START HUNTER", "auto:start")
    .text("⏹ STOP", "auto:stop")
    .row()
    .text("🔎 SCANNER", "scanner")
    .text("📊 POSITIONS", "positions")
    .row()
    .text("⚡ BUY", "buy:start")
    .text("📉 SELL", "sell:menu")
    .text("💰 PNL", "pnl")
    .row()
    .text("👛 WALLET", "wallet:menu")
    .text("⚙️ SETTINGS", "settings")
    .row()
    .text("📅 DCA", "dca")
    .text("📡 ACTIVITY", "activity")
    .row()
    .text("🎁 REFERRAL", "referral")
    .text("📚 HELP", "help")
    .text("🆘 SUPPORT", "support")
    .row()
    .text("🖥 WEB TERMINAL", "web:terminal")
    .row()
    .text("🚨 EMERGENCY KILL", "auto:kill");
}

export function backKeyboard() {
  return new InlineKeyboard().text("← HOME", "home");
}

export function settingsKeyboard(settings: any) {
  const tp = JSON.parse(settings.tp_tiers || "[]");
  const tpText =
    Array.isArray(tp) && tp.length
      ? tp.map((t: any) => `+${t.profit}/${t.sellPercent}`).join(" · ")
      : "none";
  const dcaOn = Number(settings.dca_enabled) === 1;

  return new InlineKeyboard()
    .text(`💰 Buy ${settings.max_buy} SOL`, "setting:max_buy")
    .text(`📉 Slip ${settings.slippage}%`, "setting:slippage")
    .row()
    .text(`🎯 TP ${tpText}`, "setting:tp")
    .row()
    .text(`🛑 SL -${settings.stop_loss}%`, "setting:stop_loss")
    .text(`📈 Trail +${settings.trailing_after}%`, "setting:trailing_after")
    .row()
    .text(`↘️ Pull ${settings.trailing_pullback}%`, "setting:trailing_pullback")
    .text(`⏱ Time ${settings.time_stop_minutes}m`, "setting:time_stop_minutes")
    .row()
    .text(`💥 Cap ${settings.daily_loss_cap} SOL`, "setting:daily_loss_cap")
    .text(`🧠 SM ${settings.smart_money_boost ? "ON" : "OFF"}`, "setting:smart_money")
    .row()
    .text(`⚡ ${settings.max_trades_hour}/hr`, "setting:max_trades_hour")
    .text(`📅 ${settings.max_trades_day}/day`, "setting:max_trades_day")
    .row()
    .text(`📅 DCA ${dcaOn ? "ON" : "OFF"}`, "dca")
    .row()
    .text("← HOME", "home");
}

export function dcaKeyboard(settings: any) {
  const on = Number(settings.dca_enabled) === 1;
  return new InlineKeyboard()
    .text(on ? "🟢 DCA ON · TAP OFF" : "🔴 DCA OFF · TAP ON", "dca:toggle")
    .row()
    .text(`💵 Amount ${settings.dca_amount_sol ?? 0.05} SOL`, "setting:dca_amount_sol")
    .row()
    .text(`⏱ Every ${settings.dca_interval_minutes ?? 60} min`, "setting:dca_interval_minutes")
    .row()
    .text(`📦 Max orders ${settings.dca_max_orders ?? 5}`, "setting:dca_max_orders")
    .row()
    .text("⚙️ SETTINGS", "settings")
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
    .text("⚙️ SETTINGS", "settings")
    .text("📅 DCA", "dca")
    .row()
    .text("← HOME", "home");
}

export function stopConfirmKeyboard() {
  return new InlineKeyboard()
    .text("⏹ CONFIRM STOP", "auto:stop:confirm")
    .row()
    .text("← HOME", "home");
}

export function hunterActiveKeyboard() {
  return new InlineKeyboard()
    .text("⏸ PAUSE", "auto:stop")
    .row()
    .text("🔎 SCANNER", "scanner")
    .text("📊 POSITIONS", "positions")
    .row()
    .text("📡 ACTIVITY", "activity")
    .text("⚙️ SETTINGS", "settings")
    .row()
    .text("← HOME", "home");
}

export function emergencyKeyboard() {
  return new InlineKeyboard()
    .text("🚨 CONFIRM KILL", "auto:kill:confirm")
    .row()
    .text("✕ CANCEL", "home");
}

export function walletKeyboard() {
  return new InlineKeyboard()
    .text("📋 COPY ADDRESS", "wallet:copy")
    .text("🔄 REFRESH", "wallet:refresh")
    .row()
    .text("🔐 EXPORT KEY", "wallet:export")
    .row()
    .text("🔄 SWITCH", "wallet:list")
    .text("➕ ADD", "wallet:add")
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
    kb.text(`${w.is_active ? "✅ " : "○ "}${w.label}`, `wallet:switch:${w.id}`).row();
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
    .text("🔐 BACKUP KEY", "wallet:export")
    .row()
    .text("✓ I SAVED IT", "wallet:saved");
}

export function scannerKeyboard() {
  return new InlineKeyboard()
    .text("🔥 QUALIFIED", "scanner:passed")
    .text("🚫 REJECTED", "scanner:rejected")
    .row()
    .text("🧠 DECISIONS", "decisions")
    .text("⚙️ FILTERS", "settings")
    .row()
    .text("🔄 REFRESH", "scanner")
    .text("← HOME", "home");
}

export function activityKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "activity")
    .text("🧠 DECISIONS", "decisions")
    .row()
    .text("← HOME", "home");
}

export function decisionsKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "decisions")
    .text("🔎 SCANNER", "scanner")
    .row()
    .text("← HOME", "home");
}

export function positionsKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "positions")
    .text("📉 SELL", "sell:menu")
    .row()
    .text("💰 PNL", "pnl")
    .text("← HOME", "home");
}

export function buyPromptKeyboard() {
  return new InlineKeyboard().text("← CANCEL", "home");
}

export function referralKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "referral")
    .row()
    .text("← HOME", "home");
}

export function streamKeyboard() {
  return new InlineKeyboard()
    .url("🔥 PUMP.FUN", "https://pump.fun")
    .row()
    .text("🔎 SCANNER", "scanner")
    .text("← HOME", "home");
}

export function solPriceKeyboard() {
  return new InlineKeyboard()
    .text("🔄 REFRESH", "sol")
    .text("← HOME", "home");
}

export function eduHomeKeyboard() {
  return new InlineKeyboard()
    .text("ℹ️ HOW IT WORKS", "edu:how")
    .row()
    .text("⚠️ RISKS", "edu:risks")
    .text("🤖 STRATEGY", "edu:strategy")
    .row()
    .text("🔒 SECURITY", "edu:security")
    .text("❓ FAQ", "edu:faq")
    .row()
    .text("📅 DCA HELP", "edu:dca")
    .row()
    .text("← HOME", "home");
}

export function eduHowKeyboard() {
  return new InlineKeyboard().text("← HELP", "help");
}
export function eduRisksKeyboard() {
  return new InlineKeyboard().text("← HELP", "help");
}
export function eduStrategyKeyboard() {
  return new InlineKeyboard().text("← HELP", "help");
}
export function eduSecurityKeyboard() {
  return new InlineKeyboard().text("← HELP", "help");
}
export function eduFaqListKeyboard() {
  return new InlineKeyboard()
    .text("What is Auto-Hunter?", "faq:1")
    .row()
    .text("Guaranteed profit?", "faq:2")
    .row()
    .text("When does it buy?", "faq:3")
    .row()
    .text("Why skipped a token?", "faq:4")
    .row()
    .text("How to stop?", "faq:5")
    .row()
    .text("Does kill sell positions?", "faq:6")
    .row()
    .text("How to limit risk?", "faq:7")
    .row()
    .text("Where is PnL?", "faq:8")
    .row()
    .text("Are keys safe?", "faq:9")
    .row()
    .text("Failed transaction?", "faq:10")
    .row()
    .text("What is DCA?", "faq:11")
    .row()
    .text("← HELP", "help");
}
export function faqAnswerKeyboard() {
  return new InlineKeyboard().text("← FAQ", "edu:faq").text("← HOME", "home");
}
