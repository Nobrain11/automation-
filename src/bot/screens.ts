// src/bot/screens.ts — REPLACE existing file

import { getSettings, getReferralStats } from "../db/repositories.js";
import { getRecentTokens } from "../db/scanner-repository.js";
import { getAddress, getBalance } from "../services/wallet.js";
import { scanner } from "../scanner/scanner-instance.js";

export async function homeText(
  telegramId: number
): Promise<string> {
  const s = getSettings(telegramId);
  const address = getAddress(telegramId);

  let balance = "unavailable";
  if (address) {
    try {
      balance = `${(await getBalance(telegramId)).toFixed(4)} SOL`;
    } catch {
      balance = "unavailable";
    }
  }

  const stats = scanner.getStats();

  const tradingLabel = s.kill_switch
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
    stats.running ? "🟢 ACTIVE" : "🔴 NOT ACTIVE"
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

export function walletImportedText(address: string) {
  return `
✅ <b>WALLET IMPORTED</b>

Address:
<code>${address}</code>
`.trim();
}

export function settingsText(telegramId: number) {
  const s = getSettings(telegramId);
  const tp = JSON.parse(s.tp_tiers);
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

export function pnlText(telegramId: number) {
  return `
📈 <b>LIVE PERFORMANCE</b>

Trades today: <b>0</b>
Total trades: <b>0</b>
Wins: <b>0</b> · Losses: <b>0</b>
Win rate: <b>—</b>

Realized PnL (today): <b>0 SOL</b>
Realized PnL (all-time): <b>0 SOL</b>
Unrealized PnL: <b>0 SOL</b>

No completed trades recorded yet.
`.trim();
}

export function positionsText(telegramId: number) {
  return `
📂 <b>OPEN POSITIONS</b>

No open positions.

Auto-trading entry is not active yet (or no positions are open).
`.trim();
}

export function supportText() {
  const contact = process.env.SUPPORT_CONTACT;

  if (!contact) {
    return `
🛟 <b>SUPPORT</b>

Need help with setup, trading configuration, scanner, transactions, or wallet issues?

Before contacting support, open <b>Status</b> for the latest system information.

Support contact is not configured on this instance yet.
`.trim();
  }

  return `
🛟 <b>SUPPORT</b>

Need help with setup, trading configuration, scanner, transactions, or wallet issues?

Before contacting support, open <b>Status</b> for the latest system information.

Reach out:
${contact}
`.trim();
}

export function statusText(telegramId: number) {
  const s = getSettings(telegramId);
  const stats = scanner.getStats();
  const address = getAddress(telegramId);

  const botState =
    s.kill_switch
      ? "🛑 KILL SWITCH ACTIVE"
      : s.auto_state === "running"
        ? "🟢 RUNNING"
        : s.auto_state === "paused"
          ? "🟡 PAUSED"
          : "🔴 STOPPED";

  return `
📡 <b>SYSTEM STATUS</b>

<b>Wallet</b>
• Connected: ${address ? "YES" : "NO"}
• Address: ${address ? `<code>${address.slice(0, 4)}…${address.slice(-4)}</code>` : "—"}

<b>Scanner</b>
• Status: ${stats.running ? "🟢 ACTIVE" : "🔴 NOT ACTIVE"}
• Discovered: ${stats.discovered}
• Evaluated: ${stats.evaluated}
• Passed: ${stats.passed}
• Reconnects: ${stats.websocketReconnects}

<b>Trading</b>
• Status: ${botState}
• Open positions: 0

<b>Protection</b>
• Daily loss cap: ${s.daily_loss_cap} SOL
• Emergency kill: ${s.kill_switch ? "ACTIVE" : "READY"}
• Max trades: ${s.max_trades_hour}/hr · ${s.max_trades_day}/day

<b>Smart Money</b>
• ${s.smart_money_boost ? "ON" : "OFF"}
`.trim();
}

export function helpHomeText() {
  return `
📚 <b>PUMP AUTO GUIDE</b>

Learn exactly what PUMP AUTO does before turning automation on.

Every section explains the feature, what the bot is doing, and what you should expect.
`.trim();
}

export function howItWorksText(telegramId: number) {
  const s = getSettings(telegramId);
  const stats = scanner.getStats();

  const scannerLabel = stats.running ? "ACTIVE" : "NOT ACTIVE";
  const tradingLabel = s.kill_switch
    ? "KILL SWITCH"
    : s.auto_state === "running"
      ? "RUNNING"
      : s.auto_state === "paused"
        ? "PAUSED"
        : "STOPPED";

  return `
ℹ️ <b>HOW PUMP AUTO WORKS</b>

1. 🔎 <b>Discover</b>
The scanner watches for tokens from configured data sources.

2. 🧪 <b>Evaluate</b>
Each discovered token is checked against your current filters.

3. 🛡️ <b>Risk Check</b>
Tokens that fail safety requirements are rejected.

4. 🎯 <b>Entry Decision</b>
Only tokens that satisfy entry conditions become candidates.

5. 💰 <b>Execute</b>
If automation is active and conditions pass, the engine can buy using your Max Buy and slippage rules.

6. 👁️ <b>Monitor</b>
Open positions are tracked against market data.

7. 🚪 <b>Exit</b>
Take-profit tiers, stop-loss, trailing, or time-stop rules determine exits.

────────
Scanner: <b>${scannerLabel}</b>
Trading: <b>${tradingLabel}</b>
Discovered: ${stats.discovered} · Evaluated: ${stats.evaluated} · Passed: ${stats.passed}
`.trim();
}

export function risksText(telegramId: number) {
  const s = getSettings(telegramId);

  return `
⚠️ <b>TRADING RISKS</b>

Automated trading does not guarantee profit.

Solana tokens can experience extreme volatility, low liquidity, failed transactions, slippage, smart-contract risks, and rapid price moves.

PUMP AUTO can limit exposure using the rules you configure, but it cannot eliminate market risk.

────────
<b>Your current protections</b>
• Daily loss cap: <b>${s.daily_loss_cap} SOL</b>
• Max buy size: <b>${s.max_buy} SOL</b>
• Slippage: <b>${s.slippage}%</b>
• Stop-loss: <b>-${s.stop_loss}%</b>
• Max trades: <b>${s.max_trades_hour}/hr · ${s.max_trades_day}/day</b>
`.trim();
}

export function strategyText(telegramId: number) {
  const s = getSettings(telegramId);
  const tp = JSON.parse(s.tp_tiers);
  const tpText = tp
    .map(
      (tier: any) =>
        `+${tier.profit}% → sell ${tier.sellPercent}%`
    )
    .join("\n");

  return `
🤖 <b>CURRENT STRATEGY</b>

<b>ENTRY</b>
• Max buy: ${s.max_buy} SOL
• Slippage: ${s.slippage}%
• Smart Money Boost: ${s.smart_money_boost ? "ON" : "OFF"}
• Max trades/hour: ${s.max_trades_hour}
• Max trades/day: ${s.max_trades_day}

<b>EXIT</b>
• Take-profit:
${tpText}
• Stop-loss: -${s.stop_loss}%
• Trailing after: +${s.trailing_after}%
• Trailing pullback: ${s.trailing_pullback}%
• Time stop: ${s.time_stop_minutes} min

<b>RISK</b>
• Daily loss cap: ${s.daily_loss_cap} SOL
• Kill switch: ${s.kill_switch ? "ACTIVE" : "OFF"}

On-chain filters (liquidity, holders, age, etc.) are applied by the scanner when it is active.
`.trim();
}

export function securityText() {
  return `
🔒 <b>WALLET SECURITY</b>

Private keys are encrypted before being stored in the local database.

• Keys are never written to logs.
• A private key is shown only once at creation (or on explicit export after confirmation).
• The encryption secret comes from the environment (WALLET_ENCRYPTION_KEY).
• The bot can sign the trades you enable when automation is running.
• There is no separate "withdraw all" feature beyond configured trading actions.

If the host machine or encryption secret is compromised, funds can be lost. Use a dedicated low-balance wallet.
`.trim();
}

export const FAQ_ANSWERS: Record<string, string> = {
  "faq:1": `What does PUMP AUTO do? Manages wallet, scanner, filters, and auto rules. No guarantees.`,
  "faq:2": `No profit guarantee. High risk.`,
  "faq:3": `Buys only when auto is running, kill off, filters pass, limits allow.`,
  "faq:4": `Rejected by filters (liquidity, holders, age, authority). See Decisions.`,
  "faq:5": `Stop = no new activity. Emergency Kill = locks automation.`,
  "faq:6": `Stop does not force-sell open positions.`,
  "faq:7": `Only risk capital. Dedicated wallet. Limited by Max Buy.`,
  "faq:8": `PnL and Positions show real stored data only.`,
  "faq:9": `No separate withdraw. Host+encryption secret = key access risk.`,
  "faq:10": `Failed txs are not success. Check balance, slippage, RPC.`
};

export function faqListText() {
  return `❓ <b>FAQ</b>\n\nTap a question below.`.trim();
}

export function startExplainText(telegramId: number) {
  const s = getSettings(telegramId);
  return `▶️ <b>START AUTO BOT</b>\n\nState: ${s.auto_state}\nKill: ${s.kill_switch ? "ON" : "OFF"}\nMax Buy: ${s.max_buy} SOL`.trim();
}

export function stopExplainText(telegramId: number) {
  const s = getSettings(telegramId);
  return `⏹ <b>STOP</b>\n\nCurrent: ${s.auto_state}`.trim();
}

export function killExplainText(telegramId: number) {
  const s = getSettings(telegramId);
  return `🆘 <b>EMERGENCY KILL</b>\n\nLocks automation. Does not force-sell.`.trim();
}

export function trendingText() {
  return `🔥 <b>TRENDING</b>\n\nLive feed not connected yet. Check Status for scanner activity.`.trim();
}

export async function solPriceText(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { solana?: { usd?: number } };
    const price = data.solana?.usd;
    if (typeof price !== "number") throw new Error("bad shape");
    return `◎ <b>SOL PRICE</b>\n\n$${price.toFixed(2)} USD\n\nSource: CoinGecko`.trim();
  } catch {
    return `◎ <b>SOL PRICE</b>\n\nPrice unavailable. Try again.`.trim();
  }
}

export function referralText(
  telegramId: number,
  botUsername: string | null
) {
  const info = getReferralStats(telegramId);
  if (!info) {
    return `🎁 <b>REFERRAL</b>\n\nNot available yet.`.trim();
  }
  const link = botUsername
    ? `https://t.me/${botUsername}?start=ref_${info.code}`
    : info.code;
  return `🎁 <b>REFERRAL</b>\n\nCode: <code>${info.code}</code>\nLink: <code>${link}</code>\nReferred: <b>${info.referredCount}</b>\nEarned: <b>${info.totalEarnedSol} SOL</b>`.trim();
}

export function walletsListText(
  wallets: { label: string; is_active: number }[]
) {
  if (wallets.length === 0) {
    return `🗂 <b>MY WALLETS</b>\n\nNo wallets yet.`.trim();
  }
  const lines = wallets
    .map((w) => `${w.is_active ? "✅" : "▫️"} ${w.label}`)
    .join("\n");
  return `🗂 <b>MY WALLETS</b>\n\n${lines}`.trim();
}

export function decisionsText(): string {
  const rows = getRecentTokens(12) as any[];

  if (!rows || rows.length === 0) {
    return `🧠 <b>DECISIONS</b>\n\nNo tokens evaluated yet.\n\nWhen the scanner is active, every pass or skip is recorded here with the real filter reasons.\n\nNo mock data.`;
  }

  const lines = rows.map((row: any) => {
    const sym = row.symbol
      ? `$${row.symbol}`
      : String(row.mint || "").slice(0, 6) + "…";
    const passed = Number(row.passed) === 1;
    const mark = passed ? "🟢 PASS" : "🔴 SKIP";
    let reasons: string[] = [];
    try {
      reasons = JSON.parse(row.rejection_reasons || "[]");
    } catch {
      reasons = [];
    }
    const why = passed
      ? "filters cleared"
      : reasons.length
        ? reasons.slice(0, 3).join("; ")
        : "no reason stored";
    return `${mark} <b>${sym}</b>\n   ${why}`;
  });

  return `🧠 <b>DECISIONS</b>\n\nLast ${rows.length} evaluations (newest first):\n\n${lines.join("\n\n")}\n\nWhy this exists: so you always know what the bot decided and why.`;
}
