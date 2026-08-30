import {
  getSettings
} from "../db/repositories.js";

export function homeText() {
  return `
🚀 <b>PUMP AUTO</b>

Button-driven Solana automation.

Scanner: NOT ACTIVE
Trading: NOT ACTIVE
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

  return `
⚙️ <b>AUTO SETTINGS</b>

Tap any parameter to adjust it.
`.trim();
}

export function statusText(
  telegramId: number
) {
  const s =
    getSettings(telegramId);

  return `
📊 <b>STATUS</b>

Bot:
${s.auto_state === "running"
    ? "🟢 RUNNING"
    : s.auto_state === "paused"
      ? "🟡 PAUSED"
      : "🔴 STOPPED"}

Scanner:
⚪ Not active yet

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
