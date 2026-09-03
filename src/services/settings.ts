import {
  AutoSettings,
  getSettings,
  updateSettings
} from "../db/repositories.js";

export interface TakeProfitTier {
  profit: number;
  sellPercent: number;
}

export const DEFAULT_SETTINGS = {
  max_buy: 0.1,
  slippage: 20,
  tp_tiers: [
    { profit: 40, sellPercent: 50 },
    { profit: 100, sellPercent: 25 },
    { profit: 200, sellPercent: 15 }
  ],
  stop_loss: 20,
  trailing_after: 30,
  trailing_pullback: 15,
  time_stop_minutes: 30,
  daily_loss_cap: 0.5,
  max_trades_hour: 3,
  max_trades_day: 10,
  smart_money_boost: true
};

const NUMERIC_FIELDS = new Set([
  "max_buy",
  "slippage",
  "stop_loss",
  "trailing_after",
  "trailing_pullback",
  "time_stop_minutes",
  "daily_loss_cap",
  "max_trades_hour",
  "max_trades_day",
  "smart_money_boost",
  "kill_switch"
]);

export function parseTpTiers(value: string): TakeProfitTier[] {
  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("TP tiers must be an array.");
  }

  const tiers = parsed.map((tier) => {
    if (typeof tier !== "object" || tier === null) {
      throw new Error("Invalid TP tier.");
    }

    const item = tier as Record<string, unknown>;
    const profit = Number(item.profit);
    const sellPercent = Number(item.sellPercent);

    if (!Number.isFinite(profit) || !Number.isFinite(sellPercent)) {
      throw new Error("Invalid TP tier values.");
    }
    if (profit <= 0) {
      throw new Error("TP profit must be greater than 0.");
    }
    if (sellPercent <= 0 || sellPercent > 100) {
      throw new Error("TP sell percentage must be 1–100.");
    }

    return { profit, sellPercent };
  });

  tiers.sort((a, b) => a.profit - b.profit);

  const total = tiers.reduce((sum, tier) => sum + tier.sellPercent, 0);
  if (total > 100) {
    throw new Error("TP sell percentages cannot exceed 100%.");
  }

  return tiers;
}

export function serializeTpTiers(tiers: TakeProfitTier[]): string {
  return JSON.stringify(parseTpTiers(JSON.stringify(tiers)));
}

export function getUserSettings(telegramId: number): AutoSettings {
  return getSettings(telegramId);
}

export function updateSetting(
  telegramId: number,
  field: string,
  value: number | string | boolean
): void {
  const limits: Record<string, { min?: number; max?: number }> = {
    max_buy: { min: 0.01, max: 1 },
    slippage: { min: 10, max: 50 },
    stop_loss: { min: 5, max: 50 },
    trailing_after: { min: 10, max: 100 },
    trailing_pullback: { min: 5, max: 30 },
    time_stop_minutes: { min: 5, max: 120 },
    daily_loss_cap: { min: 0.1, max: 5 },
    max_trades_hour: { min: 1, max: 10 },
    max_trades_day: { min: 1, max: 50 }
  };

  if (field === "tp_tiers" && typeof value === "string") {
    const validated = parseTpTiers(value);
    updateSettings(telegramId, { tp_tiers: JSON.stringify(validated) });
    return;
  }

  if (field === "auto_state" && typeof value === "string") {
    updateSettings(telegramId, { auto_state: value });
    return;
  }

  if (!NUMERIC_FIELDS.has(field) && !limits[field]) {
    throw new Error(`Unknown setting: ${field}`);
  }

  const limit = limits[field];
  if (limit) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new Error("Invalid number.");
    }
    if (limit.min !== undefined && numeric < limit.min) {
      throw new Error(`Minimum is ${limit.min}.`);
    }
    if (limit.max !== undefined && numeric > limit.max) {
      throw new Error(`Maximum is ${limit.max}.`);
    }
    updateSettings(telegramId, {
      [field]: numeric
    } as Partial<AutoSettings>);
    return;
  }

  updateSettings(telegramId, {
    [field]: value
  } as Partial<AutoSettings>);
}
