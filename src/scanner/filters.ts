import { TokenCandidate } from "./types.js";
import { getSettings } from "../db/repositories.js";

export interface FilterMilestone {
  id: string;
  label: string;
  status: "pass" | "fail" | "skip";
  detail: string;
  hard?: boolean;
}

export interface FilterResult {
  passed: boolean;
  reasons: string[];
  milestones: FilterMilestone[];
}

/** Max age for soft freshness pass */
const MAX_AGE_SECONDS = 30 * 60;
/** User request: avoid dead microcaps — soft floor on 1m volume USD */
const MIN_VOLUME_1M_USD = 1000;
/** Min curve liquidity in SOL */
const MIN_CURVE_LIQ_SOL = 0.5;
/** Soft market-cap floor when provided (USD) — skip junk under ~5k */
const MIN_MCAP_USD = 5_000;

export function buildFilterMilestones(
  token: Partial<TokenCandidate> & {
    isBondingCurve?: boolean;
    mintAuthorityRevoked?: boolean;
    freezeAuthorityRevoked?: boolean;
    ageSeconds?: number;
    curveLiquiditySol?: number | null;
    top10Percent?: number | null;
    volume1mUsd?: number | null;
    marketCapUsd?: number | null;
    creatorDumping?: boolean;
    smartMoneyOverride?: boolean;
  }
): FilterMilestone[] {
  const milestones: FilterMilestone[] = [];

  if (token.isBondingCurve === true) {
    milestones.push({
      id: "bonding_curve",
      label: "Bonding curve",
      status: "pass",
      detail: "On pump.fun bonding curve",
      hard: true
    });
  } else if (token.isBondingCurve === false) {
    milestones.push({
      id: "bonding_curve",
      label: "Bonding curve",
      status: "fail",
      detail: "Not on bonding curve",
      hard: true
    });
  } else {
    milestones.push({
      id: "bonding_curve",
      label: "Bonding curve",
      status: "skip",
      detail: "No data",
      hard: true
    });
  }

  if (token.mintAuthorityRevoked === true) {
    milestones.push({
      id: "mint_authority",
      label: "Mint authority",
      status: "pass",
      detail: "Revoked / locked",
      hard: true
    });
  } else if (token.mintAuthorityRevoked === false) {
    milestones.push({
      id: "mint_authority",
      label: "Mint authority",
      status: "fail",
      detail: "Still active",
      hard: true
    });
  } else {
    milestones.push({
      id: "mint_authority",
      label: "Mint authority",
      status: "skip",
      detail: "No data",
      hard: true
    });
  }

  if (token.freezeAuthorityRevoked === true) {
    milestones.push({
      id: "freeze_authority",
      label: "Freeze authority",
      status: "pass",
      detail: "Revoked / locked",
      hard: true
    });
  } else if (token.freezeAuthorityRevoked === false) {
    milestones.push({
      id: "freeze_authority",
      label: "Freeze authority",
      status: "fail",
      detail: "Still active",
      hard: true
    });
  } else {
    milestones.push({
      id: "freeze_authority",
      label: "Freeze authority",
      status: "skip",
      detail: "No data",
      hard: true
    });
  }

  if (typeof token.ageSeconds === "number") {
    if (token.ageSeconds <= MAX_AGE_SECONDS) {
      milestones.push({
        id: "age",
        label: "Freshness",
        status: "pass",
        detail: `${token.ageSeconds}s old · under ${MAX_AGE_SECONDS}s`
      });
    } else {
      milestones.push({
        id: "age",
        label: "Freshness",
        status: "fail",
        detail: `${token.ageSeconds}s old · over ${MAX_AGE_SECONDS}s`
      });
    }
  } else {
    milestones.push({
      id: "age",
      label: "Freshness",
      status: "skip",
      detail: "No age data"
    });
  }

  if (token.curveLiquiditySol != null && Number.isFinite(token.curveLiquiditySol)) {
    if (token.curveLiquiditySol >= MIN_CURVE_LIQ_SOL) {
      milestones.push({
        id: "liquidity",
        label: "Curve liquidity",
        status: "pass",
        detail: `${token.curveLiquiditySol.toFixed(3)} SOL · min ${MIN_CURVE_LIQ_SOL}`
      });
    } else {
      milestones.push({
        id: "liquidity",
        label: "Curve liquidity",
        status: "fail",
        detail: `${token.curveLiquiditySol.toFixed(3)} SOL · below ${MIN_CURVE_LIQ_SOL}`
      });
    }
  } else {
    milestones.push({
      id: "liquidity",
      label: "Curve liquidity",
      status: "skip",
      detail: "No liquidity reading"
    });
  }

  if (token.top10Percent != null && Number.isFinite(token.top10Percent)) {
    if (token.top10Percent < 35) {
      milestones.push({
        id: "holders",
        label: "Top 10 holders",
        status: "pass",
        detail: `${token.top10Percent.toFixed(1)}% · under 35%`
      });
    } else {
      milestones.push({
        id: "holders",
        label: "Top 10 holders",
        status: "fail",
        detail: `${token.top10Percent.toFixed(1)}% · over 35%`
      });
    }
  } else {
    milestones.push({
      id: "holders",
      label: "Top 10 holders",
      status: "skip",
      detail: "No holder distribution"
    });
  }

  if (token.volume1mUsd != null && Number.isFinite(token.volume1mUsd)) {
    if (token.volume1mUsd >= MIN_VOLUME_1M_USD) {
      milestones.push({
        id: "volume",
        label: "1m volume",
        status: "pass",
        detail: `$${token.volume1mUsd.toFixed(0)} · min $${MIN_VOLUME_1M_USD}`
      });
    } else {
      milestones.push({
        id: "volume",
        label: "1m volume",
        status: "fail",
        detail: `$${token.volume1mUsd.toFixed(0)} · below $${MIN_VOLUME_1M_USD}`
      });
    }
  } else {
    milestones.push({
      id: "volume",
      label: "1m volume",
      status: "skip",
      detail: "No volume reading"
    });
  }

  if (token.marketCapUsd != null && Number.isFinite(token.marketCapUsd)) {
    if (token.marketCapUsd >= MIN_MCAP_USD) {
      milestones.push({
        id: "mcap",
        label: "Market cap",
        status: "pass",
        detail: `$${token.marketCapUsd.toFixed(0)} · min $${MIN_MCAP_USD}`
      });
    } else {
      milestones.push({
        id: "mcap",
        label: "Market cap",
        status: "fail",
        detail: `$${token.marketCapUsd.toFixed(0)} · below $${MIN_MCAP_USD}`
      });
    }
  } else {
    milestones.push({
      id: "mcap",
      label: "Market cap",
      status: "skip",
      detail: "No mcap reading"
    });
  }

  if (token.creatorDumping === true) {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "fail",
      detail: "Creator dumping detected",
      hard: true
    });
  } else if (token.creatorDumping === false) {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "pass",
      detail: "No dump flag"
    });
  } else {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "skip",
      detail: "No data"
    });
  }

  if (token.smartMoneyOverride) {
    milestones.push({
      id: "smart_money",
      label: "Smart money",
      status: "pass",
      detail: "Override active"
    });
  } else {
    milestones.push({
      id: "smart_money",
      label: "Smart money",
      status: "skip",
      detail: "No override"
    });
  }

  return milestones;
}

export function evaluateToken(
  token: TokenCandidate,
  telegramId: number
): FilterResult {
  void getSettings(telegramId);

  const milestones = buildFilterMilestones(token);
  const reasons: string[] = [];

  for (const m of milestones) {
    if (m.status !== "fail") continue;
    if (m.id === "bonding_curve") reasons.push("not on bonding curve");
    else if (m.id === "mint_authority") reasons.push("mint authority active");
    else if (m.id === "freeze_authority") reasons.push("freeze authority active");
    else if (m.id === "age") reasons.push(`older than ${MAX_AGE_SECONDS} seconds`);
    else if (m.id === "liquidity") reasons.push(`curve liquidity below ${MIN_CURVE_LIQ_SOL} SOL`);
    else if (m.id === "holders") reasons.push("top 10 holders above 35%");
    else if (m.id === "volume") reasons.push(`1m volume below $${MIN_VOLUME_1M_USD}`);
    else if (m.id === "mcap") reasons.push(`market cap below $${MIN_MCAP_USD}`);
    else if (m.id === "creator") reasons.push("creator dumping");
  }

  const hardFailure = milestones.some((m) => m.hard && m.status === "fail");
  const softFailures = milestones.filter((m) => !m.hard && m.status === "fail");

  if (token.smartMoneyOverride && !hardFailure) {
    return { passed: true, reasons: [], milestones };
  }

  return {
    passed: !hardFailure && softFailures.length === 0,
    reasons,
    milestones
  };
}
