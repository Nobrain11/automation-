export interface TokenCandidate {
  mint: string;

  name: string | null;
  symbol: string | null;
  uri: string | null;

  creator: string | null;

  discoveredAt: number;

  ageSeconds: number;

  bondingCurve: string | null;

  isBondingCurve: boolean;

  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;

  top10Percent: number | null;

  curveLiquiditySol: number | null;

  volume1mUsd: number | null;

  creatorDumping: boolean;

  smartMoneyOverride: boolean;

  passed: boolean;

  rejectionReasons: string[];
}

export interface ScannerStats {
  running: boolean;

  discovered: number;
  evaluated: number;
  passed: number;
  rejected: number;

  lastEventAt: number | null;
  lastCandidateAt: number | null;

  websocketReconnects: number;
}
