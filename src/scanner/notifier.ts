import { Bot } from "grammy";

import {
  TokenCandidate
} from "./types.js";

export async function notifyQualifiedToken(
  bot: Bot,
  telegramId: number,
  token: TokenCandidate
): Promise<void> {
  const ticker =
    token.symbol
      ? `$${token.symbol}`
      : token.mint.slice(0, 6);

  const smartMoney =
    token.smartMoneyOverride
      ? " smart money override."
      : "";

  await bot.api.sendMessage(
    telegramId,
    `🟢 ${ticker} passed filters — ${token.ageSeconds}s old, ${token.curveLiquiditySol ?? 0} SOL curve.${smartMoney}\n<code>${token.mint}</code>`,
    {
      parse_mode: "HTML"
    }
  );
}
