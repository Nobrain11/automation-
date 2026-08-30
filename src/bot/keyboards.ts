// src/bot/keyboards.ts — REPLACE existing file

import { InlineKeyboard } from "grammy";

export function onboardingKeyboard() {
  return new InlineKeyboard()
    .text(
      "💰 Create Wallet",
      "wallet:create"
    )
    .row()
    .text(
      "🔑 Import Wallet",
      "wallet:import"
    )
    .row()
    .text(
      "📄 Help",
      "help"
    );
}

export function mainKeyboard() {
  return new InlineKeyboard()
    .text(
      "▶️ Start Auto Bot",
      "auto:start"
    )
    .row()
    .text(
      "⏹ Stop",
      "auto:stop"
    )
    .text(
      "⚙️ Settings",
      "settings"
    )
    .row()
    .text(
      "📊 Status",
      "status"
    )
    .text(
      "💼 Wallet",
      "wallet:menu"
    )
    .row()
    .text(
      "📈 PnL",
      "pnl"
    )
    .text(
      "📂 Positions",
      "positions"
    )
    .row()
    .text(
      "🆘 Emergency Kill",
      "auto:kill"
    )
    .row()
    .text(
      "🛟 Support",
      "support"
    );
}

export function backKeyboard() {
  return new InlineKeyboard()
    .text(
      "↩️ Back",
      "home"
    );
}

export function settingsKeyboard(
  settings: any
) {
  const tp = JSON.parse(
    settings.tp_tiers
  );

  const tpText = tp
    .map(
      (tier: any) =>
        `+${tier.profit}/${tier.sellPercent}`
    )
    .join(" · ");

  return new InlineKeyboard()
    .text(
      `💰 Max Buy: ${settings.max_buy}`,
      "setting:max_buy"
    )
    .text(
      `📉 Slippage: ${settings.slippage}%`,
      "setting:slippage"
    )
    .row()
    .text(
      `🎯 TP: ${tpText}`,
      "setting:tp"
    )
    .row()
    .text(
      `🛑 SL: -${settings.stop_loss}%`,
      "setting:stop_loss"
    )
    .text(
      `📈 Trail: +${settings.trailing_after}%`,
      "setting:trailing_after"
    )
    .row()
    .text(
      `↘️ Pullback: ${settings.trailing_pullback}%`,
      "setting:trailing_pullback"
    )
    .text(
      `⏱ Time Stop: ${settings.time_stop_minutes}m`,
      "setting:time_stop_minutes"
    )
    .row()
    .text(
      `💥 Loss Cap: ${settings.daily_loss_cap}`,
      "setting:daily_loss_cap"
    )
    .text(
      `🧠 Smart$: ${
        settings.smart_money_boost
          ? "ON"
          : "OFF"
      }`,
      "setting:smart_money"
    )
    .row()
    .text(
      `⚡ Max/Hr: ${settings.max_trades_hour}`,
      "setting:max_trades_hour"
    )
    .text(
      `📅 Max/Day: ${settings.max_trades_day}`,
      "setting:max_trades_day"
    )
    .row()
    .text(
      "↩️ Back",
      "home"
    );
}

export function editSettingKeyboard(
  field: string
) {
  return new InlineKeyboard()
    .text(
      "−",
      `adjust:${field}:minus`
    )
    .text(
      "＋",
      `adjust:${field}:plus`
    )
    .row()
    .text(
      "✏️ Custom",
      `custom:${field}`
    )
    .row()
    .text(
      "↩️ Back",
      "settings"
    );
}

export function startConfirmKeyboard() {
  return new InlineKeyboard()
    .text(
      "✅ Confirm Start",
      "auto:start:confirm"
    )
    .row()
    .text(
      "❌ Cancel",
      "home"
    );
}

export function emergencyKeyboard() {
  return new InlineKeyboard()
    .text(
      "⚠️ Confirm Emergency Kill",
      "auto:kill:confirm"
    )
    .row()
    .text(
      "❌ Cancel",
      "home"
    );
}

export function walletKeyboard() {
  return new InlineKeyboard()
    .text(
      "📤 Export Private Key",
      "wallet:export"
    )
    .row()
    .text(
      "📥 Copy Address",
      "wallet:copy"
    )
    .row()
    .text(
      "🚪 Logout",
      "wallet:logout"
    )
    .row()
    .text(
      "↩️ Back",
      "home"
    );
}
