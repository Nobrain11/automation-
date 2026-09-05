// HTTP discovery — works without Solana websocket / heavy RPC
// Pulls new + hot coins from pump.fun API and records filter milestones

import { buildFilterMilestones, evaluateToken } from "./filters.js";
import { TokenCandidate } from "./types.js";
import { saveTokenCandidate } from "../db/scanner-repository.js";
import { logger } from "../utils/logger.js";

const HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/"
};

type DecisionHandler = (
  telegramId: number,
  token: TokenCandidate
) => Promise<void>;

let decisionHandler: DecisionHandler | null = null;

export function setHttpDecisionHandler(handler: DecisionHandler): void {
  decisionHandler = handler;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.coins)) return data.coins;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function pumpGet(path: string): Promise<any> {
  const res = await fetch(`https://frontend-api-v3.pump.fun${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`pump ${res.status}`);
  return res.json();
}

function coinToCandidate(raw: any): TokenCandidate | null {
  const coin = raw?.coin && typeof raw.coin === "object" ? raw.coin : raw;
  const mint = coin?.mint;
  if (!mint || typeof mint !== "string") return null;

  const created = num(coin?.created_timestamp);
  const createdSec =
    created == null ? null : created < 1e12 ? created : Math.floor(created / 1000);
  const ageSeconds =
    createdSec != null
      ? Math.max(0, Math.floor(Date.now() / 1000 - createdSec))
      : 9999;

  const realSol = num(coin?.real_sol_reserves);
  const vSol = num(coin?.virtual_sol_reserves);
  const curveLiquiditySol =
    realSol != null && realSol > 0
      ? realSol / 1e9
      : vSol != null
        ? vSol / 1e9
        : null;

  const isBondingCurve = !Boolean(coin?.complete);

  const token: TokenCandidate = {
    mint,
    name: coin?.name ?? null,
    symbol: coin?.symbol ?? null,
    uri: coin?.uri ?? coin?.metadata_uri ?? null,
    creator: coin?.creator ?? coin?.user ?? null,
    discoveredAt: Date.now(),
    ageSeconds,
    bondingCurve: coin?.bonding_curve ?? null,
    isBondingCurve,
    mintAuthorityRevoked: true,
    freezeAuthorityRevoked: true,
    top10Percent: null,
    curveLiquiditySol,
    volume1mUsd: null,
    creatorDumping: false,
    smartMoneyOverride: false,
    passed: false,
    rejectionReasons: []
  };

  const result = evaluateToken(token, 0);
  token.passed = result.passed;
  token.rejectionReasons = result.reasons;
  void buildFilterMilestones(token);

  return token;
}

export class HttpDiscovery {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private seen = new Set<string>();
  private stats = { polls: 0, saved: 0, passed: 0, lastAt: null as number | null };

  getStats() {
    return { ...this.stats, seen: this.seen.size, running: this.running };
  }

  start(intervalMs = 20_000): void {
    if (this.running) return;
    this.running = true;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), intervalMs);
    logger.info("HTTP pump.fun discovery started.");
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    this.stats.polls++;
    this.stats.lastAt = Date.now();

    try {
      const results = await Promise.allSettled([
        pumpGet(
          "/coins?limit=30&offset=0&sort=created_timestamp&order=DESC&includeNsfw=false"
        ),
        pumpGet(
          "/coins?limit=20&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false"
        )
      ]);

      const raw: any[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") raw.push(...normalizeList(r.value));
      }

      let saved = 0;
      for (const item of raw) {
        const token = coinToCandidate(item);
        if (!token) continue;
        if (this.seen.has(token.mint)) continue;
        this.seen.add(token.mint);
        if (this.seen.size > 2000) {
          const first = this.seen.values().next().value;
          if (first) this.seen.delete(first);
        }
        try {
          saveTokenCandidate(token);
          saved++;
          this.stats.saved++;

          if (token.passed && decisionHandler) {
            this.stats.passed++;
            void decisionHandler(0, token).catch((err) =>
              logger.warn("HTTP hunter decision failed", err)
            );
          }
        } catch {
          /* ignore db errors */
        }
      }

      if (saved > 0) {
        logger.info(`HTTP discovery saved ${saved} new coin(s)`);
      }
    } catch (error) {
      logger.warn("HTTP discovery poll failed", error);
    }
  }
}

export const httpDiscovery = new HttpDiscovery();
