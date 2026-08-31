// src/bot/keyboards.ts

import { InlineKeyboard } from "grammy";

export function onboardingKeyboard() {
  return new InlineKeyboard()
    .text("💰 Create Wallet", "wallet:create")
    .row()
    .text("🔑 Import Wallet", "wallet:import")
    .row()
    .text("📄 Help", "help");
}

export function mainKeyboard() {
  return new InlineKeyboard()
    .text("▶️ Start Auto Bot", "auto:start")
    .row()
    .text("⏹ Stop", "auto:stop")
    .text("⚙️ Settings", "settings")
    .row()
    .text("📊 Status", "status")
    .text("💼 Wallet", "wallet:menu")
    .row()
    .text("📈 PnL", "pnl")
    .text("📂 Positions", "positions")
    .row()
    .text("🆘 Emergency Kill", "auto:kill")
    .row()
    .text("📚 Learn", "help")
    .text("🛟 Support", "support");
}

export function backKeyboard() {
  return new InlineKeyboard().text("↩️ Back", "home");
}

export function settingsKeyboard(settings: any) {
  const tp = JSON.parse(settings.tp_tiers);
  const tpText = tp
    .map((tier: any) => `+${tier.profit}/${tier.sellPercent}`)
    .join(" · ");

  return new InlineKeyboard()
    .text(`💰 Max Buy: ${settings.max_buy}`, "setting:max_buy")
    .text(`📉 Slippage: ${settings.slippage}%`, "setting:slippage")
    .row()
    .text(`🎯 TP: ${tpText}`, "setting:tp")
    .row()
    .text(`🛑 SL: -${settings.stop_loss}%`, "setting:stop_loss")
    .text(`📈 Trail: +${settings.trailing_after}%`, "setting:trailing_after")
    .row()
    .text(`↘️ Pullback: ${settings.trailing_pullback}%`, "setting:trailing_pullback")
    .text(`⏱ Time Stop: ${settings.time_stop_minutes}m`, "setting:time_stop_minutes")
    .row()
    .text(`💥 Loss Cap: ${settings.daily_loss_cap}`, "setting:daily_loss_cap")
    .text(
      `🧠 Smart$: ${settings.smart_money_boost ? "ON" : "OFF"}`,
      "setting:smart_money"
    )
    .row()
    .text(`⚡ Max/Hr: ${settings.max_trades_hour}`, "setting:max_trades_hour")
    .text(`📅 Max/Day: ${settings.max_trades_day}`, "setting:max_trades_day")
    .row()
    .text("↩️ Back", "home");
}

export function editSettingKeyboard(field: string) {
  return new InlineKeyboard()
    .text("−", `adjust:${field}:minus`)
    .text("+", `adjust:${field}:plus`)
    .row()
    .text("✏️ Custom", `custom:${field}`)
    .row()
    .text("↩️ Back", "settings");
}

export function startConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Confirm Start", "auto:start:confirm")
    .row()
    .text("❌ Cancel", "home");
}

export function emergencyKeyboard() {
  return new InlineKeyboard()
    .text("🛑 Confirm Kill", "auto:kill:confirm")
    .row()
    .text("❌ Cancel", "home");
}

export function walletKeyboard() {
  return new InlineKeyboard()
    .text("📤 Export Private Key", "wallet:export")
    .row()
    .text("📥 Copy Address", "wallet:copy")
    .row()
    .text("🚪 Logout", "wallet:logout")
    .row()
    .text("↩️ Back", "home");
}

export function eduHomeKeyboard() {
  return new InlineKeyboard()
    .text("ℹ️ How It Works", "edu:how")
    .text("⚠️ Risks", "edu:risks")
    .row()
    .text("📊 Live Performance", "pnl")
    .text("🤖 Strategy", "edu:strategy")
    .row()
    .text("❓ FAQ", "edu:faq")
    .text("🔒 Security", "edu:security")
    .row()
    .text("💬 Support", "support")
    .text("↩️ Back", "home");
}

export function eduHowKeyboard() {
  return new InlineKeyboard()
    .text("📊 Status", "status")
    .text("🤖 Strategy", "edu:strategy")
    .row()
    .text("↩️ Back", "help");
}

export function eduRisksKeyboard() {
  return new InlineKeyboard()
    .text("⚙️ Risk Settings", "settings")
    .text("📊 Status", "status")
    .row()
    .text("↩️ Back", "help");
}

export function eduStrategyKeyboard() {
  return new InlineKeyboard()
    .text("⚙️ Change Strategy", "settings")
    .text("↩️ Back", "help");
}

export function eduSecurityKeyboard() {
  return new InlineKeyboard()
    .text("💼 Wallet", "wallet:menu")
    .text("↩️ Back", "help");
}

export function eduFaqListKeyboard() {
  return new InlineKeyboard()
    .text("1. What does it do?", "faq:1")
    .row()
    .text("2. Guarantee profit?", "faq:2")
    .row()
    .text("3. When does it buy?", "faq:3")
    .row()
    .text("4. Why reject a token?", "faq:4")
    .row()
    .text("5. Stop immediately?", "faq:5")
    .row()
    .text("6. Open positions on stop?", "faq:6")
    .row()
    .text("7. How much SOL?", "faq:7")
    .row()
    .text("8. Where are trades?", "faq:8")
    .row()
    .text("9. Can it withdraw?", "faq:9")
    .row()
    .text("10. Failed transaction?", "faq:10")
    .row()
    .text("↩️ Back", "help");
}

export function faqAnswerKeyboard() {
  return new InlineKeyboard()
    .text("← Questions", "edu:faq")
    .text("↩️ Back", "help");
}

export function stopConfirmKeyboard() {
  return new InlineKeyboard()
    .text("⏹ Confirm Stop", "auto:stop:confirm")
    .row()
    .text("❌ Cancel", "home");
}
