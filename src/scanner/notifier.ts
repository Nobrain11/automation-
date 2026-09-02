// src/scanner/notifier.ts

import { Bot } from "grammy";

import {
  TokenCandidate
} from "./types.js";

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
  const reasons =
    token.rejectionReasons.length > 0
      ? token.rejectionReasons.map((r) => `• ${r}`).join("\n")
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
