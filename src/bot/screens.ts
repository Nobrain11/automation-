// src/bot/screens.ts — PUMP AUTO terminal screens (real data only)

import { getSettings, getReferralStats } from "../db/repositories.js";
import { getRecentTokens } from "../db/scanner-repository.js";
import { getAddress, getBalance } from "../services/wallet.js";
import { scanner } from "../scanner/scanner-instance.js";

function shortAddr(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export async function homeText(telegramId: number): Promise<string> {
  const s = getSettings(telegramId);
  const address = getAddress(telegramId);

  let balanceStr = "—";
  if (address) {
    try {
      const balanceNum = await getBalance(telegramId);
      balanceStr = `${balanceNum.toFixed(4)} SOL`;
    } catch {
      balanceStr = "unavailable";
    }
  }

  const stats = scanner.getStats();

  const hunterState = s.kill_switch
    ? "● STOPPED (KILL)"
    : s.auto_state === "running"
      ? "● HUNTING"
      : s.auto_state === "paused"
        ? "● PAUSED"
        : "● READY";

  const scannerLabel = stats.running ? "LIVE" : "OFF";
  const qualified = stats.passed;
  const evaluated = stats.evaluated;
  const discovered = stats.discovered;

  return `
⚡ <b>PUMP AUTO</b>
SOLANA TRADING TERMINAL
━━━━━━━━━━━━━━━━━━━━
<b>WALLET</b>
${address ? shortAddr(address) : "not connected"}
${balanceStr}
━━━━━━━━━━━━━━━━━━━━
🤖 <b>AUTO-HUNTER</b>
${hunterState}
Scanner             ${scannerLabel}
Discovered          ${discovered}
Evaluated           ${evaluated}
Qualified           ${qualified}
Open Positions      0
Today's PnL         No data
━━━━━━━━━━━━━━━━━━━━
🔥 <b>MARKET</b>
${discovered} tokens discovered
${qualified} passed filters
${evaluated} fully evaluated
━━━━━━━━━━━━━━━━━━━━
`.trim();
}

export function walletCreatedText(address: string, privateKey: string) {
  return `
✓ <b>WALLET CREATED</b>

Address:
<code>${address}</code>

Your recovery information is shown
<b>only during this secure setup flow</b>.

⚠️ Never share your private key or
recovery phrase with anyone.

<code>${privateKey}</code>

We will not show this key again automatically.
`.trim();
}

export function walletImportedText(address: string) {
  return `
✓ <b>WALLET READY</b>

Address:
<code>${address}</code>

Your wallet is now connected.
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
⚙️ <b>SETTINGS</b>
Configure your trading engine.
━━━━━━━━━━━━━━━━━━━━
💰 Max Buy: <b>${s.max_buy} SOL</b>
📉 Slippage: <b>${s.slippage}%</b>

🎯 Take Profit:
${tpText}

🛑 Stop Loss: <b>-${s.stop_loss}%</b>
📈 Trailing After: <b>+${s.trailing_after}%</b>
↘️ Pullback: <b>${s.trailing_pullback}%</b>
⏱ Time Stop: <b>${s.time_stop_minutes} min</b>

💥 Daily Loss Cap: <b>${s.daily_loss_cap} SOL</b>
⚡ Max Trades: <b>${s.max_trades_hour}/hr · ${s.max_trades_day}/day</b>
🧠 Smart Money: <b>${s.smart_money_boost ? "ON" : "OFF"}</b>
`.trim();
}

export function pnlText(telegramId: number) {
  void telegramId;
  return `
💰 <b>PERFORMANCE</b>

No completed trades yet.

Your PnL will appear here after
the first completed trade.

No mock data.
`.trim();
}

export function positionsText(telegramId: number) {
  void telegramId;
  return `
📊 <b>POSITIONS</b>

No open positions.

There are currently no open trades.
`.trim();
}

export function supportText() {
  return `
🆘 <b>SUPPORT</b>

What do you need help with?

Use Learn / FAQ for common questions.
Never send private keys or recovery
phrases to support.
`.trim();
}

export function statusText(telegramId: number) {
  const s = getSettings(telegramId);
  const address = getAddress(telegramId);
  const stats = scanner.getStats();

  const hunter = s.kill_switch
    ? "● STOPPED"
    : s.auto_state === "running"
      ? "● HUNTING"
      : "● READY";

  return `
📡 <b>SYSTEM STATUS</b>
Bot                 ● ONLINE
Solana RPC          ● configured
Scanner             ${stats.running ? "● LIVE" : "● OFF"}
Trading Engine      ${hunter}
Wallet              ${address ? "● CONNECTED" : "● NONE"}
━━━━━━━━━━━━━━━━━━━━
Discovered: ${stats.discovered}
Evaluated:  ${stats.evaluated}
Passed:     ${stats.passed}
Rejected:   ${stats.rejected}
Reconnects: ${stats.websocketReconnects}
━━━━━━━━━━━━━━━━━━━━
AUTO-HUNTER
${hunter}
Last event: ${
    stats.lastEventAt
      ? `${Math.max(0, Math.floor((Date.now() - stats.lastEventAt) / 1000))}s ago`
      : "No data"
  }
`.trim();
}

export function helpHomeText() {
  return `
📚 <b>PUMP AUTO GUIDE</b>

Learn exactly what PUMP AUTO does
before turning automation on.
`.trim();
}

export function howItWorksText(telegramId: number) {
  const stats = scanner.getStats();
  void telegramId;
  return `
ℹ️ <b>HOW IT WORKS</b>

1. Fetch new tokens
2. Apply your filters
3. Analyze the opportunity
4. Score the signal
5. Enter when conditions qualify
6. Manage the position
7. Exit using your rules
8. Record the result

SCAN → FILTER → ENTER
→ MANAGE → EXIT

Current scanner:
${stats.running ? "LIVE" : "OFF"}
Discovered ${stats.discovered} · Evaluated ${stats.evaluated}
`.trim();
}

export function risksText(telegramId: number) {
  const s = getSettings(telegramId);
  return `
⚠️ <b>RISKS</b>

• Automated trading can lose money.
• Memecoins can be extremely volatile.
• Slippage and execution failures are possible.
• Daily loss limits reduce exposure but do not guarantee protection.
• PUMP AUTO is not financial advice.

Your current risk controls:
Daily loss cap: ${s.daily_loss_cap} SOL
Stop loss: -${s.stop_loss}%
Max trades: ${s.max_trades_hour}/hr · ${s.max_trades_day}/day
`.trim();
}

export function strategyText(telegramId: number) {
  const s = getSettings(telegramId);
  const tp = JSON.parse(s.tp_tiers);
  const tpText = tp
    .map((t: any) => `+${t.profit}% sell ${t.sellPercent}%`)
    .join(", ");
  return `
🤖 <b>STRATEGY</b>

Max buy: ${s.max_buy} SOL
Slippage: ${s.slippage}%
Take profit: ${tpText}
Stop loss: -${s.stop_loss}%
Trailing after: +${s.trailing_after}%
Pullback: ${s.trailing_pullback}%
Time stop: ${s.time_stop_minutes} min
Smart money: ${s.smart_money_boost ? "ON" : "OFF"}
`.trim();
}

export function securityText() {
  return `
🔒 <b>SECURITY</b>

Wallet credentials are protected
using secure encryption.

Never send private keys or recovery
phrases to support.
Never share wallet secrets with anyone.
`.trim();
}

export const FAQ_ANSWERS: Record<string, string> = {
  "1": "Auto-Hunter watches new Pump.fun launches, runs your filters, and only enters when checks pass.",
  "2": "No. There is no profit guarantee. You can lose money.",
  "3": "It buys only when a token passes your configured filters and risk limits.",
  "4": "Open Decisions or Scanner for the real filter reasons.",
  "5": "Yes. Use Stop Hunter or Emergency Stop. Existing positions are not auto-sold.",
  "6": "Open positions stay open. Emergency Stop blocks new automated entries only.",
  "7": "Use Max Buy and Daily Loss Cap in Settings. Start small.",
  "8": "PnL and Positions show real trades once execution is recorded.",
  "9": "Keys are encrypted locally. Never share them. The bot cannot withdraw to arbitrary addresses beyond trading.",
  "10": "Check balance, slippage, RPC, and Activity. Failed txs do not create positions."
};

export function faqListText() {
  return `
❓ <b>FAQ</b>

Tap a question for a short answer.
`.trim();
}

export function startExplainText(telegramId: number) {
  const s = getSettings(telegramId);
  return `
🤖 <b>START AUTO-HUNTER</b>

Buy size: ${s.max_buy} SOL
Stop loss: -${s.stop_loss}%
Take profit: configured tiers
Daily loss cap: ${s.daily_loss_cap} SOL

The bot will automatically:
• scan new tokens
• apply your filters
• evaluate signals
• enter qualified trades
• manage exits using your rules

Automation can lose money.
`.trim();
}

export function stopExplainText(telegramId: number) {
  void telegramId;
  return `
⏹ <b>STOP HUNTER</b>

This pauses automated entries.
Open positions are unchanged.
`.trim();
}

export function killExplainText(telegramId: number) {
  void telegramId;
  return `
🚨 <b>EMERGENCY STOP</b>

This will immediately:
• stop Auto-Hunter
• block new automated entries
• stop automated scanning/trading actions

It will NOT:
• sell existing positions
• withdraw funds
• delete your wallet

Your existing positions remain unchanged.
`.trim();
}

export function trendingText() {
  return `
🔥 <b>TRENDING</b>

Live pump.fun stream is available
via the external link.

No mock trending list is shown here.
`.trim();
}

export async function solPriceText(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
    );
    if (!res.ok) throw new Error("price api");
    const data: any = await res.json();
    const price = data?.solana?.usd;
    const change = data?.solana?.usd_24h_change;
    if (typeof price !== "number") throw new Error("no price");
    const arrow = typeof change === "number" && change >= 0 ? "▲" : "▼";
    const ch =
      typeof change === "number" ? `${arrow} ${Math.abs(change).toFixed(2)}%` : "";
    return `
◎ <b>SOL PRICE</b>

$${price.toFixed(2)} ${ch}

Source: CoinGecko (live)
`.trim();
  } catch {
    return `
◎ <b>SOL PRICE</b>

Price temporarily unavailable.
`.trim();
  }
}

export function referralText(
  telegramId: number,
  botUsername: string | null
) {
  const stats = getReferralStats(telegramId);
  const code = stats?.code ?? `ref_${telegramId}`;
  const link = botUsername
    ? `https://t.me/${botUsername}?start=ref_${code}`
    : code;

  return `
🎁 <b>REFERRAL</b>

Referrals: ${stats?.referredCount ?? 0}
Rewards: ${stats?.totalEarnedSol ?? 0} SOL

Your referral link:
<code>${link}</code>
`.trim();
}

export async function portfolioText(telegramId: number): Promise<string> {
  const address = getAddress(telegramId);
  let bal = "unavailable";
  if (address) {
    try {
      bal = `${(await getBalance(telegramId)).toFixed(4)} SOL`;
    } catch {
      bal = "unavailable";
    }
  }
  return `
👛 <b>WALLET</b>
ACTIVE WALLET
${address ? `<code>${address}</code>` : "not connected"}
${bal}
`.trim();
}

export function ordersText(): string {
  return `📜 No open orders.`;
}

export function walletsListText(
  wallets: { id: number; label: string; is_active: number }[]
) {
  if (!wallets.length) return `No wallets yet.`;
  return wallets
    .map((w) => `${w.is_active ? "✅" : "○"} ${w.label}`)
    .join("\n");
}

export function decisionsText(): string {
  const tokens = getRecentTokens(12);
  if (!tokens.length) {
    return `
🧠 <b>DECISIONS</b>

No tokens evaluated yet.

When the scanner is active, every pass
or skip is recorded here with the real
filter reasons.

No mock data.
`.trim();
  }

  const lines = tokens.map((t: any) => {
    const tag = t.passed ? "✅ PASS" : "⏭ SKIP";
    const sym = t.symbol || t.mint?.slice(0, 6) || "?";
    const reasons =
      Array.isArray(t.rejectionReasons) && t.rejectionReasons.length
        ? t.rejectionReasons.slice(0, 2).join("; ")
        : t.passed
          ? "passed filters"
          : "no reason stored";
    return `${tag} $${sym}\n${reasons}`;
  });

  return `
🧠 <b>DECISIONS</b>

${lines.join("\n\n")}
`.trim();
}

export function scannerText(): string {
  const stats = scanner.getStats();
  const tokens = getRecentTokens(8);
  const passed = tokens.filter((t: any) => t.passed).slice(0, 5);

  let qualifiedBlock = "No qualified tokens yet.";
  if (passed.length) {
    qualifiedBlock = passed
      .map((t: any) => {
        const sym = t.symbol || t.mint?.slice(0, 6);
        return `$${sym}\n${t.mint}`;
      })
      .join("\n\n");
  }

  return `
🔎 <b>SCANNER</b>
${stats.running ? "● LIVE" : "● OFF"}
Watching new Solana launches.
━━━━━━━━━━━━━━━━━━━━
Discovered ${stats.discovered} · Evaluated ${stats.evaluated}
Passed ${stats.passed} · Rejected ${stats.rejected}
━━━━━━━━━━━━━━━━━━━━
🔥 <b>QUALIFIED</b>
${qualifiedBlock}
`.trim();
}

export function activityText(): string {
  const stats = scanner.getStats();
  const tokens = getRecentTokens(10);

  if (!tokens.length) {
    return `
📡 <b>ACTIVITY</b>
${stats.running ? "● LIVE" : "● IDLE"}

No activity yet.
Once the scanner evaluates tokens,
events will appear here in real time.
`.trim();
  }

  const lines = tokens.map((t: any) => {
    const sym = t.symbol || t.mint?.slice(0, 6) || "?";
    const tag = t.passed ? "✓ qualified" : "⏭ skipped";
    return `🔎 $${sym} ${tag}`;
  });

  return `
📡 <b>ACTIVITY</b>
${stats.running ? "● LIVE" : "● IDLE"}

${lines.join("\n")}
`.trim();
}

export function buyPromptText(): string {
  return `
⚡ <b>BUY TOKEN</b>

Send the Solana token contract
address to analyze it.

Manual buy execution uses your
connected wallet and settings.

Trading is risky.
`.trim();
}

export function sellMenuText(): string {
  return `
📉 <b>SELL</b>

No open positions to sell.

Positions will appear here after
a real fill is recorded.
`.trim();
}
