// Auto-exit: time stop, stop-loss, take-profit, trailing (entry_price based)

import {
  listAllOpenPositions,
  updatePositionPeak
} from "../db/positions.js";
import { getSettings } from "../db/repositories.js";
import { enrichMints } from "./market.js";
import { sellPosition } from "./trade.js";
import { logger } from "../utils/logger.js";

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const open = listAllOpenPositions();
    if (!open.length) return;

    const mints = [...new Set(open.map((p) => p.mint))];
    const market = await enrichMints(mints);
    const byMint = new Map(market.map((m) => [m.mint, m]));

    for (const pos of open) {
      try {
        const s = getSettings(pos.telegram_id);
        const ageMin = (Date.now() - pos.created_at) / 60_000;

        // Time stop always works without price
        if (s.time_stop_minutes > 0 && ageMin >= s.time_stop_minutes) {
          logger.info(
            `Time-stop exit pos=${pos.id} age=${ageMin.toFixed(1)}m`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          continue;
        }

        const m = byMint.get(pos.mint);
        const entryPx = pos.entry_price_usd;
        const nowPx = m?.priceUsd ?? null;

        if (entryPx == null || entryPx <= 0 || nowPx == null || nowPx <= 0) {
          // no reliable price path — only time-stop applies
          continue;
        }

        const pnlPct = ((nowPx - entryPx) / entryPx) * 100;

        // Track peak for trailing
        const prevPeak = pos.peak_pnl_pct ?? 0;
        if (pnlPct > prevPeak) {
          updatePositionPeak(pos.id, pnlPct);
        }
        const peak = Math.max(prevPeak, pnlPct);

        // Stop loss
        if (pnlPct <= -Math.abs(s.stop_loss)) {
          logger.info(
            `Stop-loss exit pos=${pos.id} pnl=${pnlPct.toFixed(1)}% SL=${s.stop_loss}%`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          continue;
        }

        // Take profit — first tier full exit (simple, reliable)
        let tiers: Array<{ profit: number; sellPercent: number }> = [];
        try {
          tiers = JSON.parse(s.tp_tiers);
        } catch {
          tiers = [];
        }
        const firstTp = tiers[0]?.profit;
        if (firstTp != null && pnlPct >= firstTp) {
          logger.info(
            `TP exit pos=${pos.id} pnl=${pnlPct.toFixed(1)}% tp=${firstTp}%`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          continue;
        }

        // Trailing after peak
        if (peak >= s.trailing_after && peak - pnlPct >= s.trailing_pullback) {
          logger.info(
            `Trailing exit pos=${pos.id} peak=${peak.toFixed(1)} now=${pnlPct.toFixed(1)} pull=${s.trailing_pullback}`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
        }
      } catch (error) {
        logger.warn(`Monitor pos ${pos.id} error`, error);
      }
    }
  } finally {
    running = false;
  }
}

export function startPositionMonitor(): void {
  if (timer) return;
  logger.info("Position monitor started (30s interval).");
  void tick();
  timer = setInterval(() => {
    void tick();
  }, 30_000);
}

export function stopPositionMonitor(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
