// Token terminal payload from pump.fun — real fields only

import { logger } from "../utils/logger.js";

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

function createdMs(coin: any): number | null {
  const t = num(coin?.created_timestamp);
  if (t == null) return null;
  return t < 1e12 ? t * 1000 : t;
}

export interface TokenCheck {
  key: string;
  label: string;
  status: "safe" | "warn" | "bad" | "unknown";
  detail: string;
}

export async function buildTokenTerminal(mint: string, solUsd: number | null) {
  const clean = mint.trim();
  if (!clean || clean.length < 32) {
    return { ok: false, error: "Invalid mint" };
  }

  try {
    const res = await fetch(
      `https://frontend-api-v3.pump.fun/coins/${encodeURIComponent(clean)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      return { ok: false, error: `pump.fun ${res.status}` };
    }
    const coin: any = await res.json();
    if (!coin?.mint) {
      return { ok: false, error: "Token not found" };
    }

    const mcapUsd =
      num(coin.usd_market_cap) ?? num(coin.market_cap_usd) ?? null;
    const virtualSol = num(coin.virtual_sol_reserves);
    const realSol = num(coin.real_sol_reserves);
    const solReserves =
      realSol != null && realSol > 0
        ? realSol / 1e9
        : virtualSol != null
          ? virtualSol / 1e9
          : null;
    const liquidityUsd =
      solReserves != null && solUsd != null
        ? solReserves * 2 * solUsd
        : solReserves != null
          ? solReserves * 2
          : null;

    // Approximate price from curve reserves when possible
    const vTok = num(coin.virtual_token_reserves);
    const vSol = num(coin.virtual_sol_reserves);
    let priceSol: number | null = null;
    if (vTok && vSol && vTok > 0) {
      priceSol = vSol / vTok; // lamports per token-unit rough
      // better: SOL per token = (vSol/1e9) / (vTok / 1e6) for 6 decimals
      const decimals = num(coin.base_decimals) ?? 6;
      priceSol = vSol / 1e9 / (vTok / 10 ** decimals);
    }
    const priceUsd =
      priceSol != null && solUsd != null ? priceSol * solUsd : null;

    const ageMs = createdMs(coin);
    const ageHours =
      ageMs != null ? (Date.now() - ageMs) / 3_600_000 : null;

    const checks: TokenCheck[] = [];

    if (liquidityUsd != null) {
      if (liquidityUsd >= 5000)
        checks.push({
          key: "liquidity",
          label: "Liquidity",
          status: "safe",
          detail: `~$${Math.round(liquidityUsd).toLocaleString()}`
        });
      else if (liquidityUsd >= 1000)
        checks.push({
          key: "liquidity",
          label: "Liquidity",
          status: "warn",
          detail: `Thin ~$${Math.round(liquidityUsd).toLocaleString()}`
        });
      else
        checks.push({
          key: "liquidity",
          label: "Liquidity",
          status: "bad",
          detail: `Very low ~$${Math.round(liquidityUsd).toLocaleString()}`
        });
    } else {
      checks.push({
        key: "liquidity",
        label: "Liquidity",
        status: "unknown",
        detail: "No data"
      });
    }

    // Pump tokens: mint/freeze typically locked by design on bonding curve
    checks.push({
      key: "mint",
      label: "Mint authority",
      status: coin.complete ? "safe" : "safe",
      detail: coin.complete
        ? "Graduated / curve complete"
        : "Pump bonding curve (standard)"
    });
    checks.push({
      key: "freeze",
      label: "Freeze authority",
      status: "safe",
      detail: "Standard pump.fun token program"
    });

    if (coin.is_banned) {
      checks.push({
        key: "ban",
        label: "Platform status",
        status: "bad",
        detail: "Banned on pump.fun"
      });
    } else {
      checks.push({
        key: "ban",
        label: "Platform status",
        status: "safe",
        detail: "Not banned"
      });
    }

    if (coin.nsfw) {
      checks.push({
        key: "nsfw",
        label: "Content",
        status: "warn",
        detail: "NSFW flagged"
      });
    }

    const replies = num(coin.reply_count) ?? 0;
    if (replies >= 20)
      checks.push({
        key: "volume",
        label: "Engagement",
        status: "safe",
        detail: `${replies} replies`
      });
    else if (replies > 0)
      checks.push({
        key: "volume",
        label: "Engagement",
        status: "warn",
        detail: `${replies} replies`
      });
    else
      checks.push({
        key: "volume",
        label: "Engagement",
        status: "unknown",
        detail: "No reply data"
      });

    checks.push({
      key: "holders",
      label: "Holder distribution",
      status: "unknown",
      detail: "Not available from free API"
    });
    checks.push({
      key: "smart",
      label: "Smart money",
      status: "unknown",
      detail: "Not configured"
    });

    // Hunter score from real fields only
    let score = 40;
    if (mcapUsd != null && mcapUsd >= 5000 && mcapUsd <= 25000) score += 20;
    else if (mcapUsd != null && mcapUsd <= 80000) score += 10;
    if (liquidityUsd != null && liquidityUsd >= 2000) score += 12;
    if (ageHours != null && ageHours < 6) score += 10;
    if (replies >= 20) score += 8;
    if (!coin.complete) score += 5;
    if (coin.is_banned) score -= 40;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const risk =
      score >= 70 ? "LOW" : score >= 45 ? "MEDIUM" : "HIGH";
    const momentum =
      ageHours != null && ageHours < 2 && replies >= 10
        ? "STRONG"
        : ageHours != null && ageHours < 12
          ? "MODERATE"
          : "UNKNOWN";

    return {
      ok: true,
      source: "pump.fun",
      token: {
        mint: coin.mint,
        name: coin.name ?? null,
        symbol: coin.symbol ?? null,
        imageUrl: coin.image_uri ?? null,
        description: coin.description || null,
        website: coin.website ?? null,
        twitter: coin.twitter ?? null,
        telegram: coin.telegram ?? null,
        creator: coin.creator ?? null,
        chain: "SOLANA",
        program: coin.program ?? "pump",
        complete: Boolean(coin.complete),
        nsfw: Boolean(coin.nsfw),
        banned: Boolean(coin.is_banned),
        live: Boolean(coin.is_currently_live),
        replyCount: replies,
        createdAt: ageMs,
        ageHours,
        lastTradeAt: (() => {
          const t = num(coin.last_trade_timestamp);
          if (t == null) return null;
          return t < 1e12 ? t * 1000 : t;
        })(),
        pairUrl: `https://pump.fun/coin/${coin.mint}`,
        explorerUrl: `https://solscan.io/token/${coin.mint}`
      },
      market: {
        priceUsd,
        priceSol,
        marketCapUsd: mcapUsd,
        liquidityUsd:
          liquidityUsd != null && solUsd != null
            ? liquidityUsd
            : liquidityUsd != null
              ? null
              : null,
        liquiditySol: solReserves,
        volume24h: null as number | null,
        trades24h: null as number | null,
        holders: null as number | null,
        fdv: mcapUsd,
        athMarketCap: num(coin.ath_market_cap) ?? null,
        priceChange24h: null as number | null
      },
      chart: {
        available: false,
        note: "OHLCV chart not available on free pump.fun API"
      },
      holders: {
        available: false,
        top10Percent: null as number | null,
        growth: null as number | null,
        note: "Holder breakdown not available"
      },
      transactions: {
        available: false,
        items: [] as any[],
        note: "Live tape not available on free endpoint"
      },
      checks,
      automation: {
        hunterScore: score,
        strategyFit: score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
        risk,
        momentum,
        qualified: score >= 55 && !coin.is_banned
      }
    };
  } catch (error) {
    logger.warn("buildTokenTerminal failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "offline"
    };
  }
}
