/**
 * Base (EVM) staging layer.
 * No live swaps yet — RPC probe + status only until wallet + router land.
 */

export type BaseStatus = {
  id: "base";
  status: "live" | "configured" | "unconfigured" | "error";
  rpcConfigured: boolean;
  rpcHost: string | null;
  chainId: number;
  nativeSymbol: "ETH";
  note: string;
  features: {
    discovery: boolean;
    wallet: boolean;
    swap: boolean;
  };
};

const BASE_CHAIN_ID = 8453;

function baseRpcUrl(): string | null {
  const v = process.env.BASE_RPC_URL?.trim();
  if (v && /^https?:\/\//i.test(v)) return v;
  // public fallback for readiness checks only (rate-limited)
  return "https://mainnet.base.org";
}

export function getBaseStatus(): BaseStatus {
  const envSet = Boolean(process.env.BASE_RPC_URL?.trim());
  const rpc = baseRpcUrl();
  let host: string | null = null;
  try {
    host = rpc ? new URL(rpc).host : null;
  } catch {
    host = null;
  }

  return {
    id: "base",
    status: envSet ? "configured" : "unconfigured",
    rpcConfigured: envSet,
    rpcHost: host,
    chainId: BASE_CHAIN_ID,
    nativeSymbol: "ETH",
    note: envSet
      ? "Base RPC configured — wallet + swap not enabled yet"
      : "Set BASE_RPC_URL to use a dedicated Base endpoint",
    features: {
      discovery: false,
      wallet: false,
      swap: false
    }
  };
}

/** Lightweight JSON-RPC ping — never throws. */
export async function probeBaseRpc(): Promise<{
  ok: boolean;
  blockNumber?: number;
  error?: string;
  latencyMs?: number;
}> {
  const rpc = baseRpcUrl();
  if (!rpc) return { ok: false, error: "no rpc" };
  const t0 = Date.now();
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: []
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    const json: any = await res.json();
    const hex = json?.result;
    const blockNumber =
      typeof hex === "string" ? parseInt(hex, 16) : undefined;
    return {
      ok: Number.isFinite(blockNumber),
      blockNumber,
      latencyMs: Date.now() - t0
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "probe failed",
      latencyMs: Date.now() - t0
    };
  }
}
