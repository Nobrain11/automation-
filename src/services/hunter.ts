// Auto-Hunter: when a token passes filters, try buy for every hunting user

import { TokenCandidate } from "../scanner/types.js";
import { getSettings } from "../db/repositories.js";
import { listHuntingUserIds, countTradesSince } from "../db/hunter-users.js";
import { listOpenPositions } from "../db/positions.js";
import { getBalance } from "./wallet.js";
import { buyToken } from "./trade.js";
import { logger } from "../utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Min seconds between auto-buys per user */
const BUY_COOLDOWN_MS = 45_000;
const lastBuyAt = new Map<number, number>();

export async function onTokenDecision(
  _telegramId: number,
  token: TokenCandidate
): Promise<void> {
  if (!token.passed || !token.mint) return;

  const hunters = listHuntingUserIds();
  if (!hunters.length) return;

  for (const userId of hunters) {
    try {
      const s = getSettings(userId);
      if (s.kill_switch || s.auto_state !== "running") continue;

      const last = lastBuyAt.get(userId) ?? 0;
      if (Date.now() - last < BUY_COOLDOWN_MS) {
        logger.info(`Hunter skip ${userId}: cooldown`);
        continue;
      }

      const open = listOpenPositions(userId);
      if (open.length >= 5) {
        logger.info(`Hunter skip ${userId}: max open positions`);
        continue;
      }

      const hourCount = countTradesSince(userId, Date.now() - HOUR_MS);
      if (hourCount >= s.max_trades_hour) {
        logger.info(`Hunter skip ${userId}: hour cap`);
        continue;
      }

      const dayCount = countTradesSince(userId, Date.now() - DAY_MS);
      if (dayCount >= s.max_trades_day) {
        logger.info(`Hunter skip ${userId}: day cap`);
        continue;
      }

      if (open.some((p) => p.mint === token.mint)) continue;

      let amount = s.max_buy;
      if (s.smart_money_boost && token.smartMoneyOverride) {
        amount = Math.min(1, amount + 0.1);
      }

      try {
        const bal = await getBalance(userId);
        if (bal < amount + 0.01) {
          logger.info(
            `Hunter skip ${userId}: balance ${bal.toFixed(4)} < need ${amount + 0.01}`
          );
          continue;
        }
      } catch {
        logger.info(`Hunter skip ${userId}: balance unavailable`);
        continue;
      }

      const result = await buyToken({
        telegramId: userId,
        mint: token.mint,
        amountSol: amount,
        symbol: token.symbol
      });

      if (result.ok) {
        lastBuyAt.set(userId, Date.now());
        logger.info(
          `Hunter BUY user=${userId} $${token.symbol} mint=${token.mint} sig=${result.signature}`
        );
      } else {
        logger.warn(
          `Hunter BUY failed user=${userId} $${token.symbol}: ${result.error}`
        );
      }
    } catch (error) {
      logger.error(`Hunter error for user ${userId}`, error);
    }
  }
}
