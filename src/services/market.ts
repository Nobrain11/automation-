// Real market metrics via DexScreener public API — no fabricated data

import { logger } from "../utils/logger.js";

export interface MarketToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  marketCap: number | null;
  fdv: number | null;
  pairUrl: string | null;
  dexId: string | null;
  pairCreatedAt: number | null;
  boosts: number | null;
  source: "dexscreener" | "scanner";
}

let cacheBoosted: { at: number; tokens: MarketToken[] } | null = null;
const CACHE_MS = 45_000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapPair(pair: any): MarketToken | null {
  const mint =
    pair?.baseToken?.address ||
    pair?.tokenAddress ||
    null;
  if (!mint || typeof mint !== "string") return null;

  return {
    mint,
    name: pair?.baseToken?.name ?? pair?.name ?? null,
    symbol: pair?.baseToken?.symbol ?? pair?.symbol ?? null,
    priceUsd: num(pair?.priceUsd),
    priceChange24h: num(pair?.priceChange?.h24),
    priceChange5m: num(pair?.priceChange?.m5),
    priceChange1h: num(pair?.priceChange?.h1),
    liquidityUsd: num(pair?.liquidity?.usd),
    volume24h: num(pair?.volume?.h24),
    marketCap: num(pair?.marketCap),
    fdv: num(pair?.fdv),
    pairUrl: pair?.url ?? null,
    dexId: pair?.dexId ?? null,
    pairCreatedAt: num(pair?.pairCreatedAt),
    boosts: num(pair?.boosts?.active),
    source: "dexscreener"
  };
}

/** Solana boosted / promoted tokens from DexScreener */
export async function fetchBoostedSolana(): Promise<{
  online: boolean;
  tokens: MarketToken[];
  error?: string;
}> {
  if (cacheBoosted && Date.now() - cacheBoosted.at < CACHE_MS) {
    return { online: true, tokens: cacheBoosted.tokens };
  }

  try {
    const res = await fetch(
      "https://api.dexscreener.com/token-boosts/top/v1",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      return {
        online: false,
        tokens: [],
        error: `DexScreener ${res.status}`
      };
    }
    const data: any = await res.json();
    const list = Array.isArray(data) ? data : [];
    const solana = list.filter(
      (x) => (x.chainId || "").toLowerCase() === "solana"
    );

    // boosts endpoint is light — enrich via token pairs in batches
    const mints = solana
      .map((x) => x.tokenAddress)
      .filter(Boolean)
      .slice(0, 30) as string[];

    const enriched = await enrichMints(mints);
    cacheBoosted = { at: Date.now(), tokens: enriched };
    return { online: true, tokens: enriched };
  } catch (error) {
    logger.warn("DexScreener boosts failed", error);
    return {
      online: false,
      tokens: [],
      error: error instanceof Error ? error.message : "offline"
    };
  }
}

/** Enrich mint list with live pair metrics (batch of up to 30) */
export async function enrichMints(mints: string[]): Promise<MarketToken[]> {
  const unique = [...new Set(mints.filter(Boolean))].slice(0, 30);
  if (!unique.length) return [];

  const out: MarketToken[] = [];
  // DexScreener allows comma-separated addresses
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

      // best pair per mint (highest liquidity)
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
      logger.warn("DexScreener token enrich failed", error);
    }
  }
  return out;
}

export function sortByVolume(tokens: MarketToken[]): MarketToken[] {
  return [...tokens].sort(
    (a, b) => (b.volume24h || 0) - (a.volume24h || 0)
  );
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
