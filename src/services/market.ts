// pump.fun native market data (NO DexScreener)
// Sources: frontend-api-v3 top-runners, last trade, new launches, live

import { logger } from "../utils/logger.js";

export interface TokenReview {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  labels: string[];
  risks: string[];
  summary: string;
}

export interface MarketToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  description: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  volume1h: number | null;
  marketCap: number | null;
  fdv: number | null;
  pairUrl: string | null;
  dexId: string | null;
  pairCreatedAt: number | null;
  boosts: number | null;
  txnsBuys24h: number | null;
  txnsSells24h: number | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  isPump: boolean;
  review: TokenReview | null;
  source: "dexscreener" | "scanner" | "pump-movers" | "pump.fun";
  spikeScore?: number;
  complete?: boolean;
  replyCount?: number | null;
}

/** Movers list: exclude mcap at or below $5k */
const MOVERS_MCAP_MIN = 5_000;
const MOVERS_MCAP_MAX = 100_000;
const PREFERRED_MAX = 25_000;

let cacheMovers: { at: number; tokens: MarketToken[] } | null = null;
const CACHE_MS = 12_000;

let solUsdCache: { at: number; price: number } | null = null;

const HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/"
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function gradeFromScore(score: number): TokenReview["grade"] {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function usdMcap(coin: any): number | null {
  return num(coin?.usd_market_cap) ?? num(coin?.market_cap_usd) ?? null;
}

function createdMs(coin: any): number | null {
  const t = num(coin?.created_timestamp);
  if (t == null) return null;
  return t < 1e12 ? t * 1000 : t;
}

function lastTradeMs(coin: any): number | null {
  const t = num(coin?.last_trade_timestamp);
  if (t == null) return null;
  return t < 1e12 ? t * 1000 : t;
}

async function getSolUsd(): Promise<number> {
  if (solUsdCache && Date.now() - solUsdCache.at < 60_000) {
    return solUsdCache.price;
  }
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/sol-price", {
      headers: HEADERS,
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data: any = await res.json();
      const p = num(data?.solPrice ?? data?.price ?? data?.usd);
      if (p != null && p > 0) {
        solUsdCache = { at: Date.now(), price: p };
        return p;
      }
    }
  } catch {
    /* fallthrough */
  }
  return solUsdCache?.price ?? 150;
}

function buildReview(coin: any, mcap: number | null): TokenReview {
  let score = 40;
  const labels: string[] = [];
  const risks: string[] = [];

  if (mcap != null) {
    if (mcap > 5_000 && mcap <= 15_000) {
      score += 22;
      labels.push("Micro-cap ~10k");
    } else if (mcap <= 40_000) {
      score += 14;
      labels.push("Early mcap");
    } else if (mcap <= 100_000) {
      score += 6;
    } else {
      score -= 15;
      risks.push("Large for early mover");
    }
  }

  const ageH = createdMs(coin)
    ? (Date.now() - createdMs(coin)!) / 3_600_000
    : null;
  if (ageH != null) {
    if (ageH < 0.25) {
      score += 12;
      labels.push("Just launched");
    } else if (ageH < 2) {
      score += 8;
      labels.push("Fresh");
    } else if (ageH < 12) {
      score += 4;
      labels.push("Early");
    }
  }

  const replies = num(coin?.reply_count) ?? 0;
  if (replies >= 50) {
    score += 8;
    labels.push("Active chat");
  } else if (replies >= 10) score += 4;

  if (coin?.complete) {
    labels.push("Graduated");
    score -= 4;
  } else {
    labels.push("On curve");
    score += 6;
  }

  if (coin?.is_currently_live) {
    score += 5;
    labels.push("Live stream");
  }

  if (coin?.nsfw) risks.push("NSFW");
  if (coin?.is_banned) {
    score -= 40;
    risks.push("Banned");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFromScore(score);
  let summary = `Score ${score}/100 (${grade}).`;
  if (mcap != null) summary += ` Mcap ~$${Math.round(mcap).toLocaleString()}.`;
  if (ageH != null && ageH < 24)
    summary += ` Age ~${ageH < 1 ? Math.round(ageH * 60) + "m" : ageH.toFixed(1) + "h"}.`;
  if (risks.length) summary += ` Risks: ${risks.slice(0, 2).join("; ")}.`;

  return {
    score,
    grade,
    labels: labels.slice(0, 5),
    risks: risks.slice(0, 4),
    summary
  };
}

function spikeScore(coin: any, mcap: number | null): number {
  let s = 0;
  if (mcap != null) {
    if (mcap > 5_000 && mcap <= 15_000) s += 40;
    else if (mcap <= 30_000) s += 28;
    else if (mcap <= 80_000) s += 12;
    else if (mcap > 200_000) s -= 30;
  }
  const ageH = createdMs(coin)
    ? (Date.now() - createdMs(coin)!) / 3_600_000
    : 99;
  if (ageH < 0.5) s += 25;
  else if (ageH < 2) s += 15;
  else if (ageH < 8) s += 8;

  const last = lastTradeMs(coin);
  if (last && Date.now() - last < 60_000) s += 20;
  else if (last && Date.now() - last < 5 * 60_000) s += 10;

  s += Math.min(15, (num(coin?.reply_count) ?? 0) / 10);
  if (!coin?.complete) s += 10;
  return s;
}

function mapPumpCoin(raw: any, solUsd: number): MarketToken | null {
  const coin = raw?.coin && typeof raw.coin === "object" ? raw.coin : raw;
  const mint = coin?.mint;
  if (!mint || typeof mint !== "string") return null;
  if (coin?.is_banned) return null;

  const mcap = usdMcap(coin);
  const created = createdMs(coin);

  const vSol = num(coin?.virtual_sol_reserves);
  const vTok = num(coin?.virtual_token_reserves);
  const realSol = num(coin?.real_sol_reserves);
  const decimals = num(coin?.base_decimals) ?? 6;

  let priceUsd: number | null = null;
  if (vSol != null && vTok != null && vTok > 0) {
    const priceSol = vSol / 1e9 / (vTok / 10 ** decimals);
    if (Number.isFinite(priceSol) && priceSol > 0) {
      priceUsd = priceSol * solUsd;
    }
  }

  const solReserves =
    realSol != null && realSol > 0
      ? realSol / 1e9
      : vSol != null
        ? vSol / 1e9
        : null;
  const liquidityUsd =
    solReserves != null ? solReserves * 2 * solUsd : null;

  const replies = num(coin?.reply_count) ?? 0;
  const volumeProxy =
    mcap != null && replies > 0
      ? Math.min(mcap * 2, replies * 80)
      : replies > 0
        ? replies * 80
        : null;

  return {
    mint,
    name: coin?.name ?? null,
    symbol: coin?.symbol ?? null,
    imageUrl: coin?.image_uri ?? null,
    description: (raw?.description || coin?.description || null) as
      | string
      | null,
    priceUsd,
    priceChange24h: null,
    priceChange5m: null,
    priceChange1h: null,
    liquidityUsd,
    volume24h: volumeProxy,
    volume1h: null,
    marketCap: mcap,
    fdv: mcap,
    pairUrl: `https://pump.fun/coin/${mint}`,
    dexId: "pump.fun",
    pairCreatedAt: created,
    boosts: null,
    txnsBuys24h: null,
    txnsSells24h: null,
    website: coin?.website ?? null,
    twitter: coin?.twitter ?? null,
    telegram: coin?.telegram ?? null,
    isPump: true,
    review: buildReview(coin, mcap),
    source: "pump.fun",
    spikeScore: spikeScore(coin, mcap),
    complete: Boolean(coin?.complete),
    replyCount: replies
  };
}

async function pumpGet(path: string): Promise<any> {
  const url = path.startsWith("http")
    ? path
    : `https://frontend-api-v3.pump.fun${path}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    throw new Error(`pump ${res.status} ${path}`);
  }
  return res.json();
}

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.coins)) return data.coins;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchPumpMovers(): Promise<{
  online: boolean;
  tokens: MarketToken[];
  error?: string;
}> {
  if (cacheMovers && Date.now() - cacheMovers.at < CACHE_MS) {
    return { online: true, tokens: cacheMovers.tokens };
  }

  const started = Date.now();
  try {
    const solUsd = await getSolUsd();
    const results = await Promise.allSettled([
      pumpGet("/coins/top-runners"),
      pumpGet(
        "/coins?limit=50&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false"
      ),
      pumpGet(
        "/coins?limit=40&offset=0&sort=created_timestamp&order=DESC&includeNsfw=false"
      ),
      pumpGet("/coins/currently-live?limit=20&offset=0&includeNsfw=false")
    ]);

    const allRaw: any[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") allRaw.push(...normalizeList(r.value));
    }

    const byMint = new Map<string, MarketToken>();
    for (const raw of allRaw) {
      const t = mapPumpCoin(raw, solUsd);
      if (!t) continue;
      const prev = byMint.get(t.mint);
      if (!prev || (t.spikeScore || 0) > (prev.spikeScore || 0)) {
        byMint.set(t.mint, t);
      }
    }

    // Hard rule for movers: mcap must be ABOVE $5k and <= $100k
    let tokens = [...byMint.values()].filter((t) => {
      const m = t.marketCap;
      return m != null && m > MOVERS_MCAP_MIN && m <= MOVERS_MCAP_MAX;
    });

    tokens.sort((a, b) => {
      const score = (t: MarketToken) => {
        const m = t.marketCap ?? 0;
        let s = t.spikeScore || 0;
        if (m > 5_000 && m <= PREFERRED_MAX) s += 20;
        return s;
      };
      return score(b) - score(a);
    });

    const top = tokens.slice(0, 40);
    cacheMovers = { at: Date.now(), tokens: top };
    logger.info(
      `pump.fun movers: ${top.length} tokens (mcap > $${MOVERS_MCAP_MIN}) in ${Date.now() - started}ms`
    );
    return { online: top.length > 0, tokens: top };
  } catch (error) {
    logger.warn("fetchPumpMovers (pump.fun) failed", error);
    return {
      online: false,
      tokens: [],
      error: error instanceof Error ? error.message : "offline"
    };
  }
}

export async function fetchBoostedSolana(): Promise<{
  online: boolean;
  tokens: MarketToken[];
  error?: string;
}> {
  return fetchPumpMovers();
}

export async function enrichMints(mints: string[]): Promise<MarketToken[]> {
  const unique = [...new Set(mints.filter(Boolean))].slice(0, 20);
  if (!unique.length) return [];
  const solUsd = await getSolUsd();
  const out: MarketToken[] = [];

  await Promise.all(
    unique.map(async (mint) => {
      try {
        const data = await pumpGet(`/coins/${mint}`);
        const mapped = mapPumpCoin(data, solUsd);
        if (mapped) out.push(mapped);
      } catch {
        // ignore single failures
      }
    })
  );

  return out;
}

export function sortByVolume(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.volume24h || 0) - (a.volume24h || 0)
  );
}
export function sortByChange(tokens: MarketToken[]): MarketToken[] {
  return sortBySpike(tokens);
}
export function sortByMomentum(tokens: MarketToken[]): MarketToken[] {
  return sortBySpike(tokens);
}
export function sortByLiquidity(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.liquidityUsd || 0) - (a.liquidityUsd || 0)
  );
}
export function sortByScore(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.review?.score || 0) - (a.review?.score || 0)
  );
}
export function sortBySpike(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort((a, b) => (b.spikeScore || 0) - (a.spikeScore || 0));
}
