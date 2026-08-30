import {
  TokenCandidate
} from "./types.js";

import {
  getSettings
} from "../db/repositories.js";

export interface FilterResult {
  passed: boolean;
  reasons: string[];
}

export function evaluateToken(
  token: TokenCandidate,
  telegramId: number
): FilterResult {
  const settings =
    getSettings(telegramId);

  const reasons: string[] = [];

  /*
   * Bonding curve
   */

  if (!token.isBondingCurve) {
    reasons.push(
      "not on bonding curve"
    );
  }

  /*
   * Mint authority
   */

  if (
    !token.mintAuthorityRevoked
  ) {
    reasons.push(
      "mint authority active"
    );
  }

  /*
   * Freeze authority
   */

  if (
    !token.freezeAuthorityRevoked
  ) {
    reasons.push(
      "freeze authority active"
    );
  }

  /*
   * Age
   */

  if (
    token.ageSeconds >= 90
  ) {
    reasons.push(
      "older than 90 seconds"
    );
  }

  /*
   * Liquidity
   */

  if (
    token.curveLiquiditySol !== null &&
    token.curveLiquiditySol < 0.5
  ) {
    reasons.push(
      "curve liquidity below 0.5 SOL"
    );
  }

  /*
   * Top holders
   */

  if (
    token.top10Percent !== null &&
    token.top10Percent >= 35
  ) {
    reasons.push(
      "top 10 holders above 35%"
    );
  }

  /*
   * Volume
   */

  if (
    token.volume1mUsd !== null &&
    token.volume1mUsd < 5000
  ) {
    reasons.push(
      "1m volume below $5k"
    );
  }

  /*
   * Creator dumping
   */

  if (
    token.creatorDumping
  ) {
    reasons.push(
      "creator dumping"
    );
  }

  /*
   * Smart money override is deliberately
   * handled later.
   *
   * It does NOT override dangerous
   * structural checks such as an active
   * mint authority.
   */

  const hardFailure =
    reasons.some(
      (reason) =>
        reason ===
          "mint authority active" ||
        reason ===
          "freeze authority active" ||
        reason ===
          "not on bonding curve"
    );

  const softFailures =
    reasons.filter(
      (reason) =>
        reason !==
          "mint authority active" &&
        reason !==
          "freeze authority active" &&
        reason !==
          "not on bonding curve"
    );

  if (
    token.smartMoneyOverride &&
    !hardFailure
  ) {
    return {
      passed: true,
      reasons: []
    };
  }

  return {
    passed:
      !hardFailure &&
      softFailures.length === 0,

    reasons
  };
}
