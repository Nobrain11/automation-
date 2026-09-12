/** Base chain support removed — Solana only. */

export function getBaseStatus() {
  return {
    id: "base" as const,
    status: "disabled" as const,
    rpcConfigured: false,
    rpcHost: null,
    chainId: 8453,
    nativeSymbol: "ETH" as const,
    note: "Removed — Solana only",
    features: { discovery: false, wallet: false, swap: false }
  };
}

export async function probeBaseRpc() {
  return { ok: false, error: "disabled" };
}
