import { db } from "./sqlite.js";

import {
  TokenCandidate
} from "../scanner/types.js";

export function saveTokenCandidate(
  token: TokenCandidate
): void {
  db.prepare(`
    INSERT INTO discovered_tokens (
      mint,
      name,
      symbol,
      uri,
      creator,
      discovered_at,
      age_seconds,
      bonding_curve,
      is_bonding_curve,
      mint_authority_revoked,
      freeze_authority_revoked,
      top10_percent,
      curve_liquidity_sol,
      volume_1m_usd,
      creator_dumping,
      smart_money_override,
      passed,
      rejection_reasons
    )
    VALUES (
      @mint,
      @name,
      @symbol,
      @uri,
      @creator,
      @discoveredAt,
      @ageSeconds,
      @bondingCurve,
      @isBondingCurve,
      @mintAuthorityRevoked,
      @freezeAuthorityRevoked,
      @top10Percent,
      @curveLiquiditySol,
      @volume1mUsd,
      @creatorDumping,
      @smartMoneyOverride,
      @passed,
      @rejectionReasons
    )

    ON CONFLICT(mint)
    DO UPDATE SET
      name = excluded.name,
      symbol = excluded.symbol,
      uri = excluded.uri,
      creator = excluded.creator,
      age_seconds = excluded.age_seconds,
      bonding_curve = excluded.bonding_curve,
      is_bonding_curve = excluded.is_bonding_curve,
      mint_authority_revoked =
        excluded.mint_authority_revoked,
      freeze_authority_revoked =
        excluded.freeze_authority_revoked,
      top10_percent =
        excluded.top10_percent,
      curve_liquidity_sol =
        excluded.curve_liquidity_sol,
      volume_1m_usd =
        excluded.volume_1m_usd,
      creator_dumping =
        excluded.creator_dumping,
      smart_money_override =
        excluded.smart_money_override,
      passed =
        excluded.passed,
      rejection_reasons =
        excluded.rejection_reasons
  `).run({
    mint: token.mint,

    name: token.name,
    symbol: token.symbol,
    uri: token.uri,

    creator: token.creator,

    discoveredAt:
      token.discoveredAt,

    ageSeconds:
      token.ageSeconds,

    bondingCurve:
      token.bondingCurve,

    isBondingCurve:
      token.isBondingCurve ? 1 : 0,

    mintAuthorityRevoked:
      token.mintAuthorityRevoked
        ? 1
        : 0,

    freezeAuthorityRevoked:
      token.freezeAuthorityRevoked
        ? 1
        : 0,

    top10Percent:
      token.top10Percent,

    curveLiquiditySol:
      token.curveLiquiditySol,

    volume1mUsd:
      token.volume1mUsd,

    creatorDumping:
      token.creatorDumping
        ? 1
        : 0,

    smartMoneyOverride:
      token.smartMoneyOverride
        ? 1
        : 0,

    passed:
      token.passed ? 1 : 0,

    rejectionReasons:
      JSON.stringify(
        token.rejectionReasons
      )
  });
}

export function getRecentTokens(
  limit = 20
) {
  return db.prepare(`
    SELECT *
    FROM discovered_tokens
    ORDER BY discovered_at DESC
    LIMIT ?
  `).all(limit);
}

export function getScannerCounts() {
  return db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) AS rejected
    FROM discovered_tokens
  `).get() as {
    total: number;
    passed: number;
    rejected: number;
  };
}
