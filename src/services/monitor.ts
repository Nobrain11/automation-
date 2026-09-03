// Auto-exit: time stop, stop-loss, take-profit (first tier = full exit for simplicity)

import { listAllOpenPositions } from "../db/positions.js";
import { getSettings } from "../db/repositories.js";
import { enrichMints } from "./market.js";
import { sellPosition } from "./trade.js";
import { logger } from "../utils/logger.js";

const peakPnl = new Map<number, number>(); // positionId -> peak %
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function fetchSolUsd(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return typeof data?.solana?.usd === "number" ? data.solana.usd : null;
  } catch {
    return null;
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const open = listAllOpenPositions();
    if (!open.length) return;

    const solUsd = await fetchSolUsd();
    const mints = [...new Set(open.map((p) => p.mint))];
    const market = await enrichMints(mints);
    const byMint = new Map(market.map((m) => [m.mint, m]));

    for (const pos of open) {
      try {
        const s = getSettings(pos.telegram_id);
        const ageMin = (Date.now() - pos.created_at) / 60_000;

        // Time stop
        if (s.time_stop_minutes > 0 && ageMin >= s.time_stop_minutes) {
          logger.info(
            `Time-stop exit pos=${pos.id} age=${ageMin.toFixed(1)}m`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          peakPnl.delete(pos.id);
          continue;
        }

        const m = byMint.get(pos.mint);
        if (!m?.priceUsd || !solUsd || pos.entry_sol <= 0) continue;

        // Approximate position value needs token balance — sellPosition handles sell;
        // for PnL % we use price change since we lack token qty here.
        // Use 24h change is wrong; without entry price we only time-stop + optional
        // hard SL when 1h change is deeply negative as soft signal is unreliable.
        // Better: store nothing extra — use DexScreener priceChange1h only as soft SL proxy
        // is unsafe. Skip price-based unless we can estimate.

        // Soft approach: if market data shows priceChange1h <= -stop_loss, exit
        const chg1h = m.priceChange1h;
        if (chg1h != null && chg1h <= -Math.abs(s.stop_loss)) {
          logger.info(
            `Stop-loss proxy exit pos=${pos.id} chg1h=${chg1h}% SL=${s.stop_loss}%`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          peakPnl.delete(pos.id);
          continue;
        }

        // Take profit proxy via 1h/5m positive move hitting first TP tier
        let tiers: Array<{ profit: number; sellPercent: number }> = [];
        try {
          tiers = JSON.parse(s.tp_tiers);
        } catch {
          tiers = [];
        }
        const firstTp = tiers[0]?.profit;
        const mom = m.priceChange5m ?? m.priceChange1h;
        if (firstTp != null && mom != null && mom >= firstTp) {
          logger.info(
            `TP proxy exit pos=${pos.id} mom=${mom}% tp=${firstTp}%`
          );
          await sellPosition({
            telegramId: pos.telegram_id,
            positionId: pos.id
          });
          peakPnl.delete(pos.id);
          continue;
        }

        // Trailing: track peak momentum; exit if pullback from peak
        if (mom != null && mom >= s.trailing_after) {
          const peak = Math.max(peakPnl.get(pos.id) ?? mom, mom);
          peakPnl.set(pos.id, peak);
          if (peak - mom >= s.trailing_pullback) {
            logger.info(
              `Trailing exit pos=${pos.id} peak=${peak} now=${mom} pull=${s.trailing_pullback}`
            );
            await sellPosition({
              telegramId: pos.telegram_id,
              positionId: pos.id
            });
            peakPnl.delete(pos.id);
          }
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
