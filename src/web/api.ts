// src/web/api.ts — terminal JSON API (real data only)

import { getSettings, updateSettings, getReferralStats } from "../db/repositories.js";
import { getRecentTokens, getScannerCounts } from "../db/scanner-repository.js";
import { listOpenPositions } from "../db/positions.js";
import { getAddress, getBalance, hasWallet } from "../services/wallet.js";
import { buyToken, sellPosition } from "../services/trade.js";
import { updateSetting } from "../services/settings.js";
import { scanner } from "../scanner/scanner-instance.js";

function mapToken(t: any) {
  let reasons: string[] = [];
  try {
    reasons =
      typeof t.rejection_reasons === "string"
        ? JSON.parse(t.rejection_reasons || "[]")
        : t.rejectionReasons ?? [];
  } catch {
    reasons = [];
  }
  return {
    mint: t.mint,
    name: t.name,
    symbol: t.symbol,
    creator: t.creator,
    discoveredAt: t.discovered_at ?? t.discoveredAt,
    ageSeconds: t.age_seconds ?? t.ageSeconds,
    isBondingCurve: Boolean(t.is_bonding_curve ?? t.isBondingCurve),
    mintRevoked: Boolean(t.mint_authority_revoked ?? t.mintAuthorityRevoked),
    freezeRevoked: Boolean(
      t.freeze_authority_revoked ?? t.freezeAuthorityRevoked
    ),
    top10: t.top10_percent ?? t.top10Percent ?? null,
    liquiditySol: t.curve_liquidity_sol ?? t.curveLiquiditySol ?? null,
    passed: Boolean(t.passed),
    reasons
  };
}

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
  const dbCounts = getScannerCounts();
  const ref = getReferralStats(telegramId);
  const sol = await fetchSolPrice();
  const positions = listOpenPositions(telegramId).map((p) => ({
    id: p.id,
    mint: p.mint,
    symbol: p.symbol,
    entrySol: p.entry_sol,
    signature: p.entry_signature,
    createdAt: p.created_at
  }));

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
      discovered: stats.discovered || dbCounts.total || 0,
      evaluated: stats.evaluated || dbCounts.total || 0,
      passed: stats.passed || dbCounts.passed || 0,
      rejected: stats.rejected || dbCounts.rejected || 0,
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
    positions,
    pnl: {
      todaySol: null as number | null,
      note:
        positions.length === 0
          ? "No completed trades yet"
          : `${positions.length} open position(s)`
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

export function buildActivity(limit = 40) {
  const stats = scanner.getStats();
  const tokens = getRecentTokens(limit).map(mapToken);
  return {
    scannerRunning: stats.running,
    items: tokens
  };
}

export function buildPulse(limit = 30) {
  const all = getRecentTokens(80).map(mapToken);
  const newPairs = all.slice(0, limit);
  const passed = all.filter((t) => t.passed).slice(0, limit);
  const rejected = all.filter((t) => !t.passed).slice(0, limit);
  const stats = scanner.getStats();
  return {
    scannerRunning: stats.running,
    lastEventAt: stats.lastEventAt,
    newPairs,
    passed,
    rejected
  };
}

export async function executeBuy(
  telegramId: number,
  body: { mint?: string; amountSol?: number; symbol?: string }
) {
  if (!body.mint) return { ok: false, error: "mint required" };
  return buyToken({
    telegramId,
    mint: body.mint,
    amountSol: body.amountSol,
    symbol: body.symbol
  });
}

export async function executeSell(
  telegramId: number,
  body: { positionId?: number }
) {
  if (!body.positionId) return { ok: false, error: "positionId required" };
  return sellPosition({
    telegramId,
    positionId: body.positionId
  });
}

export function startHunter(telegramId: number): { ok: boolean; error?: string } {
  if (!hasWallet(telegramId)) {
    return { ok: false, error: "Connect a wallet in Telegram first." };
  }
  const s = getSettings(telegramId);
  if (s.kill_switch) {
    return {
      ok: false,
      error: "Emergency stop is active. Use Clear Kill."
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
