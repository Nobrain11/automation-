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

/** Max age for soft freshness pass (HTTP discovery rarely sees <90s) */
const MAX_AGE_SECONDS = 30 * 60;

export function buildFilterMilestones(
  token: Partial<TokenCandidate> & {
    isBondingCurve?: boolean;
    mintAuthorityRevoked?: boolean;
    freezeAuthorityRevoked?: boolean;
    ageSeconds?: number;
    curveLiquiditySol?: number | null;
    top10Percent?: number | null;
    volume1mUsd?: number | null;
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
    if (token.curveLiquiditySol >= 0.5) {
      milestones.push({
        id: "liquidity",
        label: "Curve liquidity",
        status: "pass",
        detail: `${token.curveLiquiditySol.toFixed(3)} SOL · min 0.5`
      });
    } else {
      milestones.push({
        id: "liquidity",
        label: "Curve liquidity",
        status: "fail",
        detail: `${token.curveLiquiditySol.toFixed(3)} SOL · below 0.5`
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
      detail: "No holder data"
    });
  }

  // Volume: missing = skip (do not fail the whole candidate)
  if (token.volume1mUsd != null && Number.isFinite(token.volume1mUsd)) {
    if (token.volume1mUsd >= 1000) {
      milestones.push({
        id: "volume",
        label: "1m volume",
        status: "pass",
        detail: `$${Math.round(token.volume1mUsd).toLocaleString()} · min $1k`
      });
    } else {
      milestones.push({
        id: "volume",
        label: "1m volume",
        status: "fail",
        detail: `$${Math.round(token.volume1mUsd).toLocaleString()} · below $1k`
      });
    }
  } else {
    milestones.push({
      id: "volume",
      label: "1m volume",
      status: "skip",
      detail: "Volume not measured yet"
    });
  }

  if (token.creatorDumping === true) {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "fail",
      detail: "Creator dumping detected"
    });
  } else if (token.creatorDumping === false) {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "pass",
      detail: "No dump signal"
    });
  } else {
    milestones.push({
      id: "creator",
      label: "Creator behavior",
      status: "skip",
      detail: "Not checked"
    });
  }

  if (token.smartMoneyOverride) {
    milestones.push({
      id: "smart_money",
      label: "Smart money",
      status: "pass",
      detail: "Override active · soft fails bypassed"
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
    else if (m.id === "liquidity") reasons.push("curve liquidity below 0.5 SOL");
    else if (m.id === "holders") reasons.push("top 10 holders above 35%");
    else if (m.id === "volume") reasons.push("1m volume below $1k");
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
