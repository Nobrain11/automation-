/** Real OHLCV closes via GeckoTerminal (server-side, no CORS). */

export type SparkResult = {
  ok: boolean;
  closes?: number[];
  pool?: string;
  source?: string;
  error?: string;
};

export async function fetchSpark(mint: string): Promise<SparkResult> {
  if (!mint || mint.length < 32) {
    return { ok: false, error: "invalid mint" };
  }

  try {
    const poolsRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000)
      }
    );
    if (!poolsRes.ok) {
      return { ok: false, error: `pools ${poolsRes.status}` };
    }
    const poolsJson: any = await poolsRes.json();
    const pool = poolsJson?.data?.[0];
    const poolId: string | undefined = pool?.id;
    if (!poolId) return { ok: false, error: "no pool" };

    const addr = poolId.includes("_")
      ? poolId.split("_").slice(1).join("_")
      : poolId;

    const ohlcvRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(addr)}/ohlcv/minute?aggregate=5&limit=48`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000)
      }
    );
    if (!ohlcvRes.ok) {
      return { ok: false, error: `ohlcv ${ohlcvRes.status}` };
    }
    const ohlcvJson: any = await ohlcvRes.json();
    const list: unknown[] = ohlcvJson?.data?.attributes?.ohlcv_list || [];
    const closes = list
      .map((row) => Number(Array.isArray(row) ? row[4] : NaN))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (closes.length < 3) {
      return { ok: false, error: "not enough candles", pool: addr };
    }

    return {
      ok: true,
      closes,
      pool: addr,
      source: "geckoterminal"
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "spark failed"
    };
  }
}
