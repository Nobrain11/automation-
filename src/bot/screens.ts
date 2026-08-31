// src/bot/screens.ts — REPLACE existing file

import { getSettings } from "../db/repositories.js";
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
• The encryption secret comes from the environment (ENCRYPTION_SECRET).
• The bot can sign the trades you enable when automation is running.
• There is no separate "withdraw all" feature beyond configured trading actions.

If the host machine or encryption secret is compromised, funds can be lost. Use a dedicated low-balance wallet.
`.trim();
}

export const FAQ_ANSWERS: Record<string, string> = {
  "faq:1": `
<b>What does PUMP AUTO actually do?</b>

It manages an encrypted Solana wallet, runs a token scanner against your filters, and (when automation is running and the trading engine is enabled) can buy and sell according to your take-profit, stop-loss, trailing, and time-stop rules.

It does not invent trades or guarantee outcomes.
`.trim(),

  "faq:2": `
<b>Does it guarantee profit?</b>

No. Automated trading on Solana meme tokens is extremely high risk. Most tokens lose value. The bot only applies the rules you set.
`.trim(),

  "faq:3": `
<b>When does the bot buy?</b>

Only when:
• Automation is RUNNING
• Kill switch is OFF
• A token passes configured filters
• Risk limits (daily loss, max trades, etc.) allow it
• Wallet has sufficient balance

If any condition fails, no buy is attempted.
`.trim(),

  "faq:4": `
<b>Why did the bot reject a token?</b>

The scanner evaluates liquidity, holders, age, and other filters. Rejected tokens are counted in Status (Evaluated vs Passed). Detailed per-token rejection reasons are recorded when the scanner stores them.
`.trim(),

  "faq:5": `
<b>Can I stop the bot immediately?</b>

Yes.
• <b>Stop</b> — stops new automated activity.
• <b>Emergency Kill</b> — locks automation until you manually clear the kill switch / start again.
`.trim(),

  "faq:6": `
<b>What happens to open positions when automation stops?</b>

Stop disables new entries. Open positions are only exited by rules that are actually implemented. Emergency Kill locks automation; it does not force-sell positions unless that behavior is explicitly coded.
`.trim(),

  "faq:7": `
<b>How much SOL should I allocate?</b>

Only funds you can afford to lose completely. Prefer a dedicated hot wallet with a small balance. Per-trade size is limited by your Max Buy setting.
`.trim(),

  "faq:8": `
<b>Where can I see my trades?</b>

Use <b>PnL</b> and <b>Positions</b> on the main menu. They show real stored data only (currently empty until the trading engine records trades).
`.trim(),

  "faq:9": `
<b>Can the bot withdraw my SOL?</b>

The bot only signs the trading actions you configure. There is no separate withdrawal feature. Anyone with access to the host and the encryption secret can still access the key — treat the host as sensitive.
`.trim(),

  "faq:10": `
<b>What happens if a transaction fails?</b>

Failed transactions are not treated as success. Check wallet balance, slippage, RPC health, and Status. The bot does not invent completed trades.
`.trim(),
};

export function faqListText() {
  return `
❓ <b>FAQ</b>

Tap a question below to see the answer.
`.trim();
}

export function startExplainText(telegramId: number) {
  const s = getSettings(telegramId);
  const stats = scanner.getStats();
  const tp = JSON.parse(s.tp_tiers);
  const tpText = tp
    .map((t: any) => `+${t.profit}/${t.sellPercent}`)
    .join(" · ");

  return `
▶️ <b>START AUTO BOT</b>

Starting automation allows the scanner and trading controls to operate using your current rules.

<b>Current state</b>
• Trading: ${s.auto_state.toUpperCase()}
• Kill switch: ${s.kill_switch ? "ACTIVE" : "OFF"}
• Scanner: ${stats.running ? "ACTIVE" : "NOT ACTIVE"}

<b>Your rules</b>
• Max Buy: ${s.max_buy} SOL
• Slippage: ${s.slippage}%
• TP: ${tpText}
• SL: -${s.stop_loss}%
• Trail: +${s.trailing_after}% / ${s.trailing_pullback}%
• Time stop: ${s.time_stop_minutes} min
• Daily loss cap: ${s.daily_loss_cap} SOL
• Smart Money: ${s.smart_money_boost ? "ON" : "OFF"}

⚠️ Only use funds you can afford to lose.
`.trim();
}

export function stopExplainText(telegramId: number) {
  const s = getSettings(telegramId);

  return `
⏹ <b>STOP AUTOMATION</b>

This stops new automated activity.

Current state: <b>${s.auto_state.toUpperCase()}</b>
Kill switch: <b>${s.kill_switch ? "ACTIVE" : "OFF"}</b>

Open positions are not force-sold by this action unless a separate exit is implemented and triggered.
`.trim();
}

export function killExplainText(telegramId: number) {
  const s = getSettings(telegramId);

  return `
🆘 <b>EMERGENCY KILL</b>

Immediately disables automated operation and locks it behind the kill switch.

This does <b>not</b> automatically sell open positions.

Current automation: <b>${s.auto_state.toUpperCase()}</b>
Kill switch: <b>${s.kill_switch ? "ACTIVE" : "OFF"}</b>

Use this only when you need an instant hard stop.
`.trim();
}

/*
 * Trending is not yet wired to a live token feed. We show
 * this honestly rather than fabricating token data — no
 * fake tokens, prices, or volume.
 */
export function trendingText() {
  return `
🔥 <b>TRENDING</b>

Live trending feed isn't connected to a data source yet.

Once wired, this will show newly discovered tokens from the scanner. In the meantime, check <b>Status</b> for scanner activity.
`.trim();
}

/*
 * Real SOL/USD price pulled from a public price API.
 * Returns a real value or an honest "unavailable" state —
 * never a fabricated price.
 */
export async function solPriceText(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );

    if (!res.ok) {
      throw new Error(`Price API returned ${res.status}`);
    }

    const data = (await res.json()) as {
      solana?: { usd?: number };
    };

    const price = data.solana?.usd;

    if (typeof price !== "number") {
      throw new Error("Unexpected price response shape.");
    }

    return `
◎ <b>SOL PRICE</b>

$${price.toFixed(2)} USD

Source: CoinGecko
`.trim();
  } catch {
    return `
◎ <b>SOL PRICE</b>

Price is currently unavailable. Try again in a moment.
`.trim();
  }
}

/*
 * No referral system is implemented yet (no referral
 * codes, tracking, or rewards table exists). Honest
 * placeholder — never a fabricated referral link.
 */
export function referralText() {
  return `
🎁 <b>REFERRAL</b>

The referral program isn't live yet — no referral codes or rewards are tracked at this time.
`.trim();
}
