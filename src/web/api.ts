// src/web/api.ts — terminal JSON API (real data only)

import { getSettings, updateSettings, getReferralStats } from "../db/repositories.js";
import { getRecentTokens } from "../db/scanner-repository.js";
import { getAddress, getBalance, hasWallet } from "../services/wallet.js";
import { updateSetting } from "../services/settings.js";
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
  const sol = await fetchSolPrice();

  return {
    wallet: {
      connected: Boolean(address),
      address: address ?? null,
      balanceSol: balance,
      balanceUsd:
        balance != null && sol.price != null
          ? Number((balance * sol.price).toFixed(2))
          : null
    },
    sol,
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

async function fetchSolPrice(): Promise<{
  price: number | null;
  change24h: number | null;
}> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return { price: null, change24h: null };
    const data: any = await res.json();
    const price = data?.solana?.usd;
    const change24h = data?.solana?.usd_24h_change;
    return {
      price: typeof price === "number" ? price : null,
      change24h: typeof change24h === "number" ? change24h : null
    };
  } catch {
    return { price: null, change24h: null };
  }
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
    return {
      ok: false,
      error: "Emergency stop is active. Use Clear Kill in web or Telegram."
    };
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

export function clearKill(telegramId: number): { ok: boolean } {
  updateSettings(telegramId, { kill_switch: 0 });
  return { ok: true };
}

const SETTING_FIELDS = new Set([
  "max_buy",
  "slippage",
  "stop_loss",
  "trailing_after",
  "trailing_pullback",
  "time_stop_minutes",
  "daily_loss_cap",
  "max_trades_hour",
  "max_trades_day"
]);

export function patchSettings(
  telegramId: number,
  body: Record<string, unknown>
): { ok: boolean; error?: string } {
  try {
    if (typeof body.smart_money_boost === "boolean") {
      updateSettings(telegramId, {
        smart_money_boost: body.smart_money_boost ? 1 : 0
      });
    }
    for (const [key, value] of Object.entries(body)) {
      if (key === "smart_money_boost") continue;
      if (!SETTING_FIELDS.has(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, error: `Invalid number for ${key}` };
      }
      updateSetting(telegramId, key, value);
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid settings"
    };
  }
}
