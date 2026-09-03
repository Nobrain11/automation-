// DexScreener only — fast parallel micro-cap spike movers

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
  source: "dexscreener" | "scanner" | "pump-movers";
  spikeScore?: number;
}

const MCAP_MIN = 3_000;
const MCAP_MAX = 80_000;
const SPIKE_5M = 25;
const SPIKE_1H = 40;
const HARD_SPIKE_5M = 50;

let cacheMovers: { at: number; tokens: MarketToken[] } | null = null;
let cacheBoosted: { at: number; tokens: MarketToken[] } | null = null;
const CACHE_MS = 20_000;

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

export function buildTokenReview(t: {
  liquidityUsd: number | null;
  volume24h: number | null;
  volume1h: number | null;
  marketCap: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  pairCreatedAt: number | null;
  txnsBuys24h: number | null;
  txnsSells24h: number | null;
  isPump: boolean;
  boosts: number | null;
}): TokenReview {
  let score = 35;
  const labels: string[] = [];
  const risks: string[] = [];
  const liq = t.liquidityUsd ?? 0;
  const vol1h = t.volume1h ?? 0;
  const mcap = t.marketCap ?? 0;
  const chg5 = t.priceChange5m;
  const chg1 = t.priceChange1h;
  const ageH =
    t.pairCreatedAt != null
      ? (Date.now() - t.pairCreatedAt) / 3_600_000
      : null;

  if (mcap > 0 && mcap <= 15_000) {
    score += 16;
    labels.push("Micro-cap ~10k");
  } else if (mcap <= 40_000) {
    score += 10;
    labels.push("Small-cap");
  } else if (mcap <= 80_000) score += 4;
  else if (mcap > 500_000) {
    score -= 20;
    risks.push("Too large");
  }

  if (chg5 != null && chg5 >= HARD_SPIKE_5M) {
    score += 22;
    labels.push(`Spike +${Math.round(chg5)}% 5m`);
  } else if (chg5 != null && chg5 >= SPIKE_5M) {
    score += 14;
    labels.push(`Hot +${Math.round(chg5)}% 5m`);
  } else if (chg5 != null && chg5 > 10) {
    score += 6;
    labels.push("Building heat");
  }

  if (chg1 != null && chg1 >= SPIKE_1H) {
    score += 10;
    labels.push(`+${Math.round(chg1)}% 1h`);
  }

  if (vol1h >= 5_000) {
    score += 10;
    labels.push("1h volume");
  } else if (vol1h >= 1_000) score += 5;

  if (liq >= 2_000 && liq <= 25_000) {
    score += 8;
    labels.push("Early liquidity");
  } else if (liq < 800) {
    score -= 10;
    risks.push("Illiquid");
  }

  if (ageH != null) {
    if (ageH < 1) {
      score += 8;
      labels.push("Fresh launch");
    } else if (ageH < 6) {
      score += 4;
      labels.push("Early pair");
    }
  }

  if (t.isPump) {
    score += 5;
    labels.push("Pump route");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFromScore(score);
  let summary = `Score ${score}/100 (${grade}).`;
  if (mcap > 0) summary += ` Mcap ~$${Math.round(mcap).toLocaleString()}.`;
  if (chg5 != null && chg5 >= 20)
    summary += ` 5m ${chg5 >= 0 ? "+" : ""}${chg5.toFixed(0)}%.`;
  if (risks.length) summary += ` Risks: ${risks.slice(0, 2).join("; ")}.`;

  return {
    score,
    grade,
    labels: labels.slice(0, 5),
    risks: risks.slice(0, 4),
    summary
  };
}

function isPumpPair(pair: any): boolean {
  const dex = String(pair?.dexId || "").toLowerCase();
  if (dex.includes("pump")) return true;
  const base = String(pair?.baseToken?.address || "");
  return base.toLowerCase().endsWith("pump");
}

function spikeRank(t: {
  marketCap: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  volume1h: number | null;
  pairCreatedAt: number | null;
}): number {
  const mcap = t.marketCap ?? 0;
  const c5 = t.priceChange5m ?? 0;
  const c1 = t.priceChange1h ?? 0;
  const v1 = t.volume1h ?? 0;
  const ageH =
    t.pairCreatedAt != null
      ? (Date.now() - t.pairCreatedAt) / 3_600_000
      : 99;
  let s = 0;
  if (mcap >= 5_000 && mcap <= 15_000) s += 40;
  else if (mcap <= 30_000) s += 28;
  else if (mcap <= 60_000) s += 12;
  else if (mcap > 200_000) s -= 40;
  if (c5 >= 50) s += 50;
  else if (c5 >= 25) s += 30;
  else if (c5 >= 10) s += 12;
  else if (c5 < 0) s -= 15;
  if (c1 >= 40) s += 18;
  if (v1 >= 2_000) s += 10;
  if (ageH < 2) s += 15;
  else if (ageH < 8) s += 8;
  return s;
}

function mapPair(
  pair: any,
  source: MarketToken["source"] = "dexscreener"
): MarketToken | null {
  const mint = pair?.baseToken?.address;
  if (!mint || typeof mint !== "string") return null;
  if ((pair?.chainId || "").toLowerCase() !== "solana") return null;

  const socials = Array.isArray(pair?.info?.socials) ? pair.info.socials : [];
  const websites = Array.isArray(pair?.info?.websites) ? pair.info.websites : [];
  const isPump = isPumpPair(pair);
  const base = {
    liquidityUsd: num(pair?.liquidity?.usd),
    volume24h: num(pair?.volume?.h24),
    volume1h: num(pair?.volume?.h1),
    marketCap: num(pair?.marketCap),
    priceChange5m: num(pair?.priceChange?.m5),
    priceChange1h: num(pair?.priceChange?.h1),
    priceChange24h: num(pair?.priceChange?.h24),
    pairCreatedAt: num(pair?.pairCreatedAt),
    txnsBuys24h: num(pair?.txns?.h24?.buys),
    txnsSells24h: num(pair?.txns?.h24?.sells),
    isPump,
    boosts: num(pair?.boosts?.active)
  };

  const token: MarketToken = {
    mint,
    name: pair?.baseToken?.name ?? null,
    symbol: pair?.baseToken?.symbol ?? null,
    imageUrl: pair?.info?.imageUrl ?? null,
    description: null,
    priceUsd: num(pair?.priceUsd),
    priceChange24h: base.priceChange24h,
    priceChange5m: base.priceChange5m,
    priceChange1h: base.priceChange1h,
    liquidityUsd: base.liquidityUsd,
    volume24h: base.volume24h,
    volume1h: base.volume1h,
    marketCap: base.marketCap,
    fdv: num(pair?.fdv),
    pairUrl: pair?.url ?? null,
    dexId: pair?.dexId ?? null,
    pairCreatedAt: base.pairCreatedAt,
    boosts: base.boosts,
    txnsBuys24h: base.txnsBuys24h,
    txnsSells24h: base.txnsSells24h,
    website: websites[0]?.url || null,
    twitter:
      socials.find((s: any) => String(s.type || "").toLowerCase() === "twitter")
        ?.url || null,
    telegram:
      socials.find((s: any) => String(s.type || "").toLowerCase() === "telegram")
        ?.url || null,
    isPump,
    review: null,
    source,
    spikeScore: spikeRank(base)
  };
  token.review = buildTokenReview(base);
  return token;
}

function isMicroCapSpike(t: MarketToken): boolean {
  const mcap = t.marketCap;
  if (mcap == null || mcap < MCAP_MIN || mcap > MCAP_MAX) return false;
  const c5 = t.priceChange5m ?? 0;
  const c1 = t.priceChange1h ?? 0;
  if (c5 >= SPIKE_5M) return true;
  if (c5 >= 15 && c1 >= SPIKE_1H) return true;
  if (c1 >= 60 && mcap <= 40_000) return true;
  return false;
}

async function searchPairs(q: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return Array.isArray(data?.pairs) ? data.pairs : [];
  } catch {
    return [];
  }
}

/** Fast parallel DexScreener → micro-cap spikes only */
export async function fetchPumpMovers(): Promise<{
  online: boolean;
  tokens: MarketToken[];
  error?: string;
}> {
  if (cacheMovers && Date.now() - cacheMovers.at < CACHE_MS) {
    return { online: true, tokens: cacheMovers.tokens };
  }

  try {
    const started = Date.now();
    // Parallel — not sequential
    const batches = await Promise.all([
      searchPairs("pump"),
      searchPairs("pumpswap"),
      searchPairs("sol")
    ]);
    const allPairs = batches.flat();

    const solPairs = allPairs.filter(
      (p) => (p.chainId || "").toLowerCase() === "solana"
    );

    const best = new Map<string, any>();
    for (const p of solPairs) {
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const mcap = num(p.marketCap) ?? 0;
      if (mcap > MCAP_MAX * 3) continue;

      const prev = best.get(mint);
      const score =
        (num(p.priceChange?.m5) || 0) * 2 + (num(p.volume?.h1) || 0) / 1000;
      const prevScore = prev
        ? (num(prev.priceChange?.m5) || 0) * 2 +
          (num(prev.volume?.h1) || 0) / 1000
        : -1e9;
      if (!prev || score > prevScore) best.set(mint, p);
    }

    let tokens = [...best.values()]
      .map((p) => mapPair(p, "pump-movers"))
      .filter(Boolean) as MarketToken[];

    const pumpTokens = tokens.filter((t) => t.isPump);
    if (pumpTokens.length >= 5) tokens = pumpTokens;

    let spikes = tokens.filter(isMicroCapSpike);
    if (spikes.length < 5) {
      spikes = tokens
        .filter((t) => {
          const m = t.marketCap ?? 0;
          return m >= MCAP_MIN && m <= MCAP_MAX;
        })
        .sort((a, b) => (b.spikeScore || 0) - (a.spikeScore || 0))
        .slice(0, 25);
    } else {
      spikes.sort((a, b) => (b.spikeScore || 0) - (a.spikeScore || 0));
    }

    const top = spikes.slice(0, 30);
    cacheMovers = { at: Date.now(), tokens: top };
    logger.info(
      `DexScreener movers: ${top.length} tokens in ${Date.now() - started}ms`
    );
    return { online: top.length > 0, tokens: top };
  } catch (error) {
    logger.warn("fetchPumpMovers failed", error);
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
  if (cacheBoosted && Date.now() - cacheBoosted.at < CACHE_MS) {
    return { online: true, tokens: cacheBoosted.tokens };
  }
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return { online: false, tokens: [], error: `boosts ${res.status}` };
    }
    const data: any = await res.json();
    const list = Array.isArray(data) ? data : [];
    const solana = list.filter(
      (x) => (x.chainId || "").toLowerCase() === "solana"
    );
    const mints = solana
      .map((x) => x.tokenAddress)
      .filter(Boolean)
      .slice(0, 20) as string[];
    const enriched = await enrichMints(mints);
    const filtered = enriched.filter((t) => {
      const m = t.marketCap;
      return m == null || (m >= MCAP_MIN && m <= 150_000);
    });
    cacheBoosted = { at: Date.now(), tokens: filtered };
    return { online: true, tokens: filtered };
  } catch (error) {
    return {
      online: false,
      tokens: [],
      error: error instanceof Error ? error.message : "offline"
    };
  }
}

export async function enrichMints(mints: string[]): Promise<MarketToken[]> {
  const unique = [...new Set(mints.filter(Boolean))].slice(0, 20);
  if (!unique.length) return [];
  const out: MarketToken[] = [];
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${unique.join(",")}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
    const best = new Map<string, any>();
    for (const p of pairs) {
      if ((p.chainId || "").toLowerCase() !== "solana") continue;
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const prev = best.get(mint);
      const liq = num(p.liquidity?.usd) || 0;
      const prevLiq = prev ? num(prev.liquidity?.usd) || 0 : -1;
      if (!prev || liq > prevLiq) best.set(mint, p);
    }
    for (const p of best.values()) {
      const mapped = mapPair(p);
      if (mapped) out.push(mapped);
    }
  } catch (error) {
    logger.warn("enrichMints failed", error);
  }
  return out;
}

export function sortByVolume(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
}
export function sortByChange(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.priceChange5m || 0) - (a.priceChange5m || 0)
  );
}
export function sortByMomentum(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort((a, b) => {
    const ma = (a.priceChange5m || 0) * 3 + (a.priceChange1h || 0);
    const mb = (b.priceChange5m || 0) * 3 + (b.priceChange1h || 0);
    return mb - ma;
  });
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
