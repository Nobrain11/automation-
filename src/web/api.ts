// src/web/api.ts — terminal JSON API (real data only)

import { getSettings, updateSettings, getReferralStats } from "../db/repositories.js";
import { getRecentTokens } from "../db/scanner-repository.js";
import { getAddress, getBalance, hasWallet } from "../services/wallet.js";
import { scanner } from "../scanner/scanner-instance.js";

export async function buildDashboard(telegramId: number) {
  const s = getSettings(telegramId);
  const address = getAddress(telegramId);
  let balance: number | null = null;
  if (address) {
    try {
      balance = await getBalance(telegramId);
    } catch {
      balance = null;
    }
  }
  const stats = scanner.getStats();
  const ref = getReferralStats(telegramId);

  return {
    wallet: {
      connected: Boolean(address),
      address: address ?? null,
      balanceSol: balance
    },
    hunter: {
      state: s.kill_switch
        ? "stopped_kill"
        : s.auto_state === "running"
          ? "hunting"
          : s.auto_state === "paused"
            ? "paused"
            : "ready",
      killSwitch: Boolean(s.kill_switch)
    },
    scanner: {
      running: stats.running,
      discovered: stats.discovered,
      evaluated: stats.evaluated,
      passed: stats.passed,
      rejected: stats.rejected,
      reconnects: stats.websocketReconnects,
      lastEventAt: stats.lastEventAt
    },
    settings: {
      maxBuy: s.max_buy,
      slippage: s.slippage,
      stopLoss: s.stop_loss,
      trailingAfter: s.trailing_after,
      trailingPullback: s.trailing_pullback,
      timeStopMinutes: s.time_stop_minutes,
      dailyLossCap: s.daily_loss_cap,
      maxTradesHour: s.max_trades_hour,
      maxTradesDay: s.max_trades_day,
      smartMoneyBoost: Boolean(s.smart_money_boost),
      tpTiers: JSON.parse(s.tp_tiers)
    },
    referral: ref
      ? {
          code: ref.code,
          referredCount: ref.referredCount,
          totalEarnedSol: ref.totalEarnedSol
        }
      : null,
    positions: [],
    pnl: {
      todaySol: null as number | null,
      note: "No completed trades yet"
    }
  };
}

export function buildActivity(limit = 20) {
  const stats = scanner.getStats();
  const tokens = getRecentTokens(limit);
  return {
    scannerRunning: stats.running,
    items: tokens.map((t: any) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      passed: Boolean(t.passed),
      reasons: t.rejectionReasons ?? [],
      discoveredAt: t.discoveredAt
    }))
  };
}

export function startHunter(telegramId: number): { ok: boolean; error?: string } {
  if (!hasWallet(telegramId)) {
    return { ok: false, error: "Connect a wallet in Telegram first." };
  }
  const s = getSettings(telegramId);
  if (s.kill_switch) {
    return { ok: false, error: "Emergency stop is active. Clear it in Telegram." };
  }
  updateSettings(telegramId, { auto_state: "running" });
  return { ok: true };
}

export function stopHunter(telegramId: number): { ok: boolean } {
  updateSettings(telegramId, { auto_state: "stopped" });
  return { ok: true };
}

export function emergencyStop(telegramId: number): { ok: boolean } {
  updateSettings(telegramId, { auto_state: "stopped", kill_switch: 1 });
  return { ok: true };
}
