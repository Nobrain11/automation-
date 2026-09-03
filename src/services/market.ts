// Live market: DexScreener pump movers + metadata + professional token review
// (pump.fun frontend API is Cloudflare-blocked; we use public DexScreener)

import { logger } from "../utils/logger.js";

export interface TokenReview {
  score: number; // 0–100
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
}

let cacheMovers: { at: number; tokens: MarketToken[] } | null = null;
let cacheBoosted: { at: number; tokens: MarketToken[] } | null = null;
const CACHE_MS = 40_000;

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

/** Deterministic review from real market fields only */
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
  let score = 40;
  const labels: string[] = [];
  const risks: string[] = [];

  const liq = t.liquidityUsd ?? 0;
  const vol = t.volume24h ?? 0;
  const mcap = t.marketCap ?? 0;
  const ageH =
    t.pairCreatedAt != null
      ? (Date.now() - t.pairCreatedAt) / 3_600_000
      : null;

  if (liq >= 50_000) {
    score += 18;
    labels.push("Deep liquidity");
  } else if (liq >= 15_000) {
    score += 12;
    labels.push("Solid liquidity");
  } else if (liq >= 5_000) {
    score += 6;
    labels.push("Thin liquidity");
  } else {
    score -= 8;
    risks.push("Very low liquidity");
  }

  if (vol >= 100_000) {
    score += 14;
    labels.push("High volume");
  } else if (vol >= 25_000) {
    score += 8;
    labels.push("Active volume");
  } else if (vol < 2_000) {
    score -= 6;
    risks.push("Low volume");
  }

  if (mcap > 0 && liq > 0) {
    const ratio = liq / mcap;
    if (ratio >= 0.15) {
      score += 8;
      labels.push("Healthy liq/mcap");
    } else if (ratio < 0.03) {
      score -= 10;
      risks.push("Weak liq vs mcap");
    }
  }

  const sells = t.txnsSells24h ?? 0;
  const buys = t.txnsBuys24h ?? 0;
  if (buys + sells > 50) {
    const sellShare = sells / (buys + sells);
    if (sellShare > 0.65) {
      score -= 12;
      risks.push("Sell-heavy flow");
    } else if (sellShare < 0.4) {
      score += 6;
      labels.push("Buy-leaning flow");
    }
  }

  const chg5 = t.priceChange5m;
  const chg1 = t.priceChange1h;
  if (chg5 != null && Math.abs(chg5) > 40) {
    score -= 8;
    risks.push("Extreme 5m volatility");
    labels.push("High momentum");
  } else if (chg5 != null && chg5 > 8) {
    score += 4;
    labels.push("Short-term strength");
  }
  if (chg1 != null && chg1 < -25) {
    score -= 10;
    risks.push("Sharp 1h drawdown");
  }

  if (ageH != null) {
    if (ageH < 0.5) {
      score -= 6;
      risks.push("Brand new pair");
      labels.push("Fresh launch");
    } else if (ageH < 6) {
      labels.push("Early pair");
    } else if (ageH > 72) {
      score += 4;
      labels.push("Seasoned pair");
    }
  }

  if (t.isPump) labels.push("Pump route");
  if ((t.boosts ?? 0) > 0) {
    score += 3;
    labels.push("Boosted");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFromScore(score);

  let summary = `Score ${score}/100 (${grade}).`;
  if (risks.length) summary += ` Risks: ${risks.slice(0, 2).join("; ")}.`;
  else if (labels.length) summary += ` ${labels.slice(0, 2).join(" · ")}.`;

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
  if (base.toLowerCase().endsWith("pump")) return true;
  const url = String(pair?.url || "");
  if (url.includes("pump")) return true;
  return false;
}

function mapPair(pair: any, source: MarketToken["source"] = "dexscreener"): MarketToken | null {
  const mint = pair?.baseToken?.address;
  if (!mint || typeof mint !== "string") return null;
  if ((pair?.chainId || "").toLowerCase() !== "solana") return null;

  const socials = Array.isArray(pair?.info?.socials) ? pair.info.socials : [];
  const websites = Array.isArray(pair?.info?.websites) ? pair.info.websites : [];
  const twitter =
    socials.find((s: any) => String(s.type || "").toLowerCase() === "twitter")
      ?.url || null;
  const telegram =
    socials.find((s: any) => String(s.type || "").toLowerCase() === "telegram")
      ?.url || null;
  const website = websites[0]?.url || null;

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
    website,
    twitter,
    telegram,
    isPump,
    review: null,
    source
  };
  token.review = buildTokenReview(base);
  return token;
}

async function searchPairs(q: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return Array.isArray(data?.pairs) ? data.pairs : [];
  } catch (e) {
    logger.warn(`Dex search failed for ${q}`, e);
    return [];
  }
}

/** Pump.fun-style movers: pump dex + *pump mints + high activity Solana */
export async function fetchPumpMovers(): Promise<{
  online: boolean;
  tokens: MarketToken[];
  error?: string;
}> {
  if (cacheMovers && Date.now() - cacheMovers.at < CACHE_MS) {
    return { online: true, tokens: cacheMovers.tokens };
  }

  try {
    const queries = ["pump", "pumpswap", "sol", "bonk", "meme"];
    const allPairs: any[] = [];
    for (const q of queries) {
      const pairs = await searchPairs(q);
      allPairs.push(...pairs);
    }

    const solPairs = allPairs.filter(
      (p) => (p.chainId || "").toLowerCase() === "solana"
    );

    // Prefer pump routes, then high volume
    const pumpFirst = solPairs.filter(isPumpPair);
    const pool = pumpFirst.length >= 8 ? pumpFirst : solPairs;

    const best = new Map<string, any>();
    for (const p of pool) {
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const prev = best.get(mint);
      const vol = num(p.volume?.h24) || 0;
      const prevVol = prev ? num(prev.volume?.h24) || 0 : -1;
      if (!prev || vol > prevVol) best.set(mint, p);
    }

    const tokens = [...best.values()]
      .map((p) => mapPair(p, "pump-movers"))
      .filter(Boolean) as MarketToken[];

    tokens.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    const top = tokens.slice(0, 40);
    cacheMovers = { at: Date.now(), tokens: top };
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
      signal: AbortSignal.timeout(8000)
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
      .slice(0, 30) as string[];
    const enriched = await enrichMints(mints);
    // attach boost descriptions if present
    const descBy = new Map(
      solana.map((x) => [x.tokenAddress, x.description || null])
    );
    const iconBy = new Map(solana.map((x) => [x.tokenAddress, x.icon || null]));
    for (const t of enriched) {
      if (!t.description) t.description = descBy.get(t.mint) || null;
      if (!t.imageUrl && iconBy.get(t.mint))
        t.imageUrl = String(iconBy.get(t.mint));
    }
    cacheBoosted = { at: Date.now(), tokens: enriched };
    return { online: true, tokens: enriched };
  } catch (error) {
    return {
      online: false,
      tokens: [],
      error: error instanceof Error ? error.message : "offline"
    };
  }
}

export async function enrichMints(mints: string[]): Promise<MarketToken[]> {
  const unique = [...new Set(mints.filter(Boolean))].slice(0, 30);
  if (!unique.length) return [];
  const out: MarketToken[] = [];
  const chunkSize = 15;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
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
      logger.warn("enrichMints chunk failed", error);
    }
  }
  return out;
}

export function sortByVolume(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
}

export function sortByChange(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0)
  );
}

export function sortByMomentum(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort((a, b) => {
    const ma = (a.priceChange5m || 0) * 2 + (a.priceChange1h || 0);
    const mb = (b.priceChange5m || 0) * 2 + (b.priceChange1h || 0);
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
