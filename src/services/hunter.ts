// Auto-Hunter: when a token passes filters, try buy for every hunting user

import { TokenCandidate } from "../scanner/types.js";
import { getSettings } from "../db/repositories.js";
import { listHuntingUserIds, countTradesSince } from "../db/hunter-users.js";
import { listOpenPositions } from "../db/positions.js";
import { realizedSolToday } from "../db/pnl.js";
import { recordDecision } from "../db/decisions.js";
import { getBalance } from "./wallet.js";
import { buyToken } from "./trade.js";
import { logger } from "../utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BUY_COOLDOWN_MS = 45_000;
const lastBuyAt = new Map<number, number>();

export async function onTokenDecision(
  _telegramId: number,
  token: TokenCandidate
): Promise<void> {
  recordDecision({
    mint: token.mint,
    symbol: token.symbol,
    passed: Boolean(token.passed),
    reasons: token.rejectionReasons ?? [],
    milestones: (token as { milestones?: unknown }).milestones,
    source: "hunter_intake"
  });

  if (!token.passed || !token.mint) return;

  const hunters = listHuntingUserIds();
  if (!hunters.length) return;

  for (const userId of hunters) {
    try {
      const s = getSettings(userId);
      if (s.kill_switch) {
        logger.info(`Hunter skip ${userId}: kill switch`);
        continue;
      }
      if (s.auto_state !== "running") continue;

      const last = lastBuyAt.get(userId) ?? 0;
      if (Date.now() - last < BUY_COOLDOWN_MS) {
        logger.info(`Hunter skip ${userId}: cooldown`);
        continue;
      }

      // Daily loss cap (realized only)
      if (s.daily_loss_cap > 0) {
        const dayPnl = realizedSolToday(userId);
        if (dayPnl <= -Math.abs(s.daily_loss_cap)) {
          logger.info(
            `Hunter skip ${userId}: daily loss cap hit pnl=${dayPnl.toFixed(4)} cap=${s.daily_loss_cap}`
          );
          continue;
        }
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

      if (result?.ok) {
        lastBuyAt.set(userId, Date.now());
        logger.info(
          `Hunter buy ok user=${userId} mint=${token.mint.slice(0, 8)}… amt=${amount}`
        );
      } else {
        logger.warn(
          `Hunter buy failed user=${userId} mint=${token.mint.slice(0, 8)}… ${result?.error || ""}`
        );
      }
    } catch (error) {
      logger.warn(`Hunter user ${userId} error`, error);
    }
  }
}
