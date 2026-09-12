/** Multi-chain registry — Solana is live; others are staged for Phase 2. */

export type ChainId = "solana" | "base" | "ethereum" | "robinhood";

export type ChainKind = "svm" | "evm" | "brokerage";

export type ChainStatus = "live" | "coming_soon" | "disabled";

export interface ChainDefinition {
  id: ChainId;
  label: string;
  short: string;
  kind: ChainKind;
  status: ChainStatus;
  nativeSymbol: string;
  /** Explorer base for addresses/tx when on-chain */
  explorerUrl?: string;
  /** Optional RPC env key (not secret value) */
  rpcEnvKey?: string;
  note?: string;
}

export const CHAINS: Record<ChainId, ChainDefinition> = {
  solana: {
    id: "solana",
    label: "Solana",
    short: "SOL",
    kind: "svm",
    status: "live",
    nativeSymbol: "SOL",
    explorerUrl: "https://solscan.io",
    rpcEnvKey: "SOLANA_RPC_URL",
    note: "pump.fun · live"
  },
  base: {
    id: "base",
    label: "Base",
    short: "BASE",
    kind: "evm",
    status: "coming_soon",
    nativeSymbol: "ETH",
    explorerUrl: "https://basescan.org",
    rpcEnvKey: "BASE_RPC_URL",
    note: "EVM · staged"
  },
  ethereum: {
    id: "ethereum",
    label: "Ethereum",
    short: "ETH",
    kind: "evm",
    status: "coming_soon",
    nativeSymbol: "ETH",
    explorerUrl: "https://etherscan.io",
    rpcEnvKey: "ETH_RPC_URL",
    note: "EVM · staged"
  },
  robinhood: {
    id: "robinhood",
    label: "Robinhood",
    short: "RH",
    kind: "brokerage",
    status: "coming_soon",
    nativeSymbol: "USD",
    note: "Brokerage · separate module"
  }
};

export const DEFAULT_CHAIN: ChainId = "solana";

export function listChains(): ChainDefinition[] {
  return Object.values(CHAINS);
}

export function getChain(id: string | null | undefined): ChainDefinition {
  if (id && id in CHAINS) return CHAINS[id as ChainId];
  return CHAINS[DEFAULT_CHAIN];
}

export function isChainLive(id: ChainId): boolean {
  return CHAINS[id]?.status === "live";
}
