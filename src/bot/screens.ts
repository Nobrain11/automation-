// src/bot/screens.ts — REPLACE existing file

import {
  getSettings
} from "../db/repositories.js";

import {
  getAddress,
  getBalance
} from "../services/wallet.js";

import {
  scanner
} from "../scanner/scanner-instance.js";

export async function homeText(
  telegramId: number
): Promise<string> {
  const s =
    getSettings(telegramId);

  const address =
    getAddress(telegramId);

  let balance = "unavailable";

  if (address) {
    try {
      balance =
        `${(
          await getBalance(telegramId)
        ).toFixed(4)} SOL`;
    } catch {
      balance = "unavailable";
    }
  }

  const stats =
    scanner.getStats();

  const tradingLabel =
    s.kill_switch
      ? "🛑 KILL SWITCH ACTIVE"
      : s.auto_state === "running"
        ? "🟢 RUNNING"
        : s.auto_state === "paused"
          ? "🟡 PAUSED"
          : "🔴 STOPPED";

  return `
🚀 <b>PUMP AUTO</b>

Button-driven Solana automation.

Wallet:
<code>${address ?? "not connected"}</code>
Balance: ${balance}

Scanner: ${
    stats.running
      ? "🟢 ACTIVE"
      : "🔴 NOT ACTIVE"
  }
Discovered: ${stats.discovered} · Evaluated: ${stats.evaluated}

Trading: ${tradingLabel}
`.trim();
}

export function walletCreatedText(
  address: string,
  privateKey: string
) {
  return `
💰 <b>WALLET CREATED</b>

Address:
<code>${address}</code>

⚠️ <b>SAVE THIS PRIVATE KEY NOW.</b>

<code>${privateKey}</code>

We will not automatically show this private key again.
`.trim();
}

export function walletImportedText(
  address: string
) {
  return `
✅ <b>WALLET IMPORTED</b>

Address:
<code>${address}</code>
`.trim();
}

export function settingsText(
  telegramId: number
) {
  const s =
    getSettings(telegramId);

  const tp =
    JSON.parse(s.tp_tiers);

  const tpText = tp
    .map(
      (tier: any) =>
        `+${tier.profit}% → sell ${tier.sellPercent}%`
    )
    .join("\n");

  return `
⚙️ <b>AUTO SETTINGS</b>

Tap any parameter below to adjust it.

💰 Max Buy: <b>${s.max_buy} SOL</b>
📉 Slippage: <b>${s.slippage}%</b>

🎯 Take Profit:
${tpText}

🛑 Stop Loss: <b>-${s.stop_loss}%</b>
📈 Trailing After: <b>+${s.trailing_after}%</b>
↘️ Trailing Pullback: <b>${s.trailing_pullback}%</b>
⏱ Time Stop: <b>${s.time_stop_minutes} min</b>

💥 Daily Loss Cap: <b>${s.daily_loss_cap} SOL</b>
⚡ Max Trades: <b>${s.max_trades_hour}/hour · ${s.max_trades_day}/day</b>

🧠 Smart Money Boost: <b>${
    s.smart_money_boost ? "ON" : "OFF"
  }</b>
`.trim();
}

export function statusText(
  telegramId: number
) {
  const s =
    getSettings(telegramId);

  const stats =
    scanner.getStats();

  return `
📊 <b>STATUS</b>

Bot:
${s.auto_state === "running"
    ? "🟢 RUNNING"
    : s.auto_state === "paused"
      ? "🟡 PAUSED"
      : "🔴 STOPPED"}

Scanner:
${
  stats.running
    ? "🟢 Active"
    : "⚪ Not active"
}
Discovered: ${stats.discovered}
Evaluated: ${stats.evaluated}
Passed: ${stats.passed}
Reconnects: ${stats.websocketReconnects}

Open positions:
0

Today's realized PnL:
0 SOL

Daily Loss Cap:
${s.daily_loss_cap} SOL

Max Trades:
${s.max_trades_hour}/hour
${s.max_trades_day}/day

Smart Money:
${s.smart_money_boost ? "ON" : "OFF"}

Kill Switch:
${s.kill_switch ? "🔴 ACTIVE" : "🟢 OFF"}
`.trim();
}
