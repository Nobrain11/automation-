// src/scanner/notifier.ts

import { Bot } from "grammy";

import { fetchPumpMovers, MarketToken } from "../services/market.js";
import { notifyScannerChannel } from "../services/telegram-notify.js";
import { logger } from "../utils/logger.js";
import { TokenCandidate } from "./types.js";

const spotted = new Map<string, { marketCap: number; spottedAt: number; symbol: string }>();
const spottedSent = new Set<string>();
const spottedInFlight = new Set<string>();
const milestoneSent = new Set<string>();
let trackerStarted = false;

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function identifier(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function scannerScore(token: TokenCandidate, market: MarketToken | undefined): number {
  return market?.review?.score ?? (token.passed ? 100 : 0);
}

function risk(token: TokenCandidate, market: MarketToken | undefined): string {
  if (market?.review?.labels?.some((label) => /high|risk/i.test(label))) return "HIGH RISK";
  return token.passed ? "LOW RISK" : "WATCH";
}

function startMilestoneTracker(): void {
  if (trackerStarted) return;
  trackerStarted = true;
  const timer = setInterval(() => {
    void checkMilestones();
  }, 60_000);
  timer.unref?.();
}

async function checkMilestones(): Promise<void> {
  if (spotted.size === 0) return;
  try {
    const result = await fetchPumpMovers();
    for (const [mint, record] of spotted) {
      if (milestoneSent.has(mint)) continue;
      const market = result.tokens.find((item) => item.mint === mint);
      const current = market?.marketCap;
      if (current == null || current < record.marketCap * 2) continue;
      milestoneSent.add(mint);
      await notifyScannerChannel([
        `PUMP AUTO · MILESTONE`,
        `${record.symbol}   2x since spotted`,
        `${money(record.marketCap)} mc ↗ ${money(current)} mc · within ${Math.max(1, Math.round((Date.now() - record.spottedAt) / 1000))}s`,
        `Suggestion: TP1 territory — consider taking partial profit.`,
        `[ Buy on PUMP AUTO ]`
      ].join("\n"));
    }
  } catch (error) {
    logger.warn("Scanner milestone check failed", error);
  }
}

export async function notifyScannerToken(token: TokenCandidate): Promise<void> {
  if (
    !token.passed ||
    spottedSent.has(token.mint) ||
    spottedInFlight.has(token.mint)
  ) {
    return;
  }

  // Claim before awaiting network work so repeated scanner callbacks cannot
  // send duplicate alerts concurrently.
  spottedInFlight.add(token.mint);
  try {
    const result = await fetchPumpMovers();
    const market = result.tokens.find((item) => item.mint === token.mint);
    const marketCap = market?.marketCap ?? null;
    const liquidity = market?.liquidityUsd ?? null;
    const symbol = token.symbol ? `$${token.symbol}` : identifier(token.mint);
    const score = scannerScore(token, market);
    const riskLabel = risk(token, market);

    await notifyScannerChannel([
      `PUMP AUTO · SPOTTED`,
      `${symbol}   ${riskLabel}`,
      `Score ${score} · MC ${money(marketCap)} · Liq ${money(liquidity)}`,
      identifier(token.mint),
      `━━━━━━━━━━━━━━━━━━━`,
      `Suggested strategy`,
      `TP1 +50% → sell 40%   TP2 +120% → sell 30%   TP3 +250% → sell 20%`,
      `Stop Loss −20%   Trail after +40% / 15%`,
      `[ Buy on PUMP AUTO ]`
    ].join("\n"));
    spottedSent.add(token.mint);

    if (marketCap != null && marketCap > 0) {
      spotted.set(token.mint, {
        marketCap,
        spottedAt: Date.now(),
        symbol
      });
      startMilestoneTracker();
    }
  } catch (error) {
    // Release only failed sends; successful sends stay deduped for this process.
    spottedSent.delete(token.mint);
    logger.warn("Scanner channel notification failed", error);
  } finally {
    spottedInFlight.delete(token.mint);
  }
}

function tickerOf(token: TokenCandidate): string {
  return token.symbol
    ? `$${token.symbol}`
    : token.mint.slice(0, 8) + "…";
}

/**
 * Decision transparency: every pass/skip explains WHY.
 * Reasons come from evaluateToken() — never invented.
 */
export async function notifyQualifiedToken(
  bot: Bot,
  telegramId: number,
  token: TokenCandidate
): Promise<void> {
  const ticker = tickerOf(token);
  const liq =
    token.curveLiquiditySol != null
      ? `${token.curveLiquiditySol.toFixed(2)} SOL curve`
      : "curve n/a";

  const lines = [
    `🟢 <b>PASSED — ${ticker}</b>`,
    "",
    "<b>Why it passed</b>",
    `• Age: ${token.ageSeconds}s`,
    `• Liquidity: ${liq}`,
    "• Mint authority: revoked",
    "• Freeze authority: revoked",
    "• On bonding curve: yes"
  ];

  if (token.smartMoneyOverride) {
    lines.push("• Smart money override: yes");
  }

  lines.push(
    "",
    `<code>${token.mint}</code>`,
    "",
    "Next: entry rules apply if auto-trading is on."
  );

  await bot.api.sendMessage(
    telegramId,
    lines.join("\n"),
    { parse_mode: "HTML" }
  );
}

export async function notifyRejectedToken(
  bot: Bot,
  telegramId: number,
  token: TokenCandidate
): Promise<void> {
  const ticker = tickerOf(token);
  const rejectionReasons = token.rejectionReasons ?? [];
  const reasons =
    rejectionReasons.length > 0
      ? rejectionReasons.map((r) => `• ${r}`).join("\n")
      : "• (no reason recorded)";

  await bot.api.sendMessage(
    telegramId,
    [
      `🔴 <b>SKIPPED — ${ticker}</b>`,
      "",
      "<b>Why it was skipped</b>",
      reasons,
      "",
      `Age: ${token.ageSeconds}s`,
      `<code>${token.mint}</code>`,
      "",
      "No buy was placed."
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}
