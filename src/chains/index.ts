/** Solana-only product — multi-chain removed. */

export type ChainId = "solana";

export const DEFAULT_CHAIN: ChainId = "solana";

export function listChains() {
  return [
    {
      id: "solana" as const,
      label: "Solana",
      short: "SOL",
      kind: "svm" as const,
      status: "live" as const,
      nativeSymbol: "SOL"
    }
  ];
}
