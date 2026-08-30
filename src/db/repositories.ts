import { db } from "./sqlite.js";

export interface UserInfo {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface WalletRecord {
  telegram_id: number;
  public_key: string;
  encrypted_secret: string;
}

export interface AutoSettings {
  telegram_id: number;

  max_buy: number;
  slippage: number;

  tp_tiers: string;

  stop_loss: number;

  trailing_after: number;
  trailing_pullback: number;

  time_stop_minutes: number;

  daily_loss_cap: number;

  max_trades_hour: number;
  max_trades_day: number;

  smart_money_boost: number;

  auto_state: string;
  kill_switch: number;

  updated_at: number;
}

export function ensureUser(
  id: number,
  from: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): void {
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (
      telegram_id,
      username,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)

    ON CONFLICT(telegram_id)
    DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = excluded.updated_at
  `).run(
    id,
    from.username ?? null,
    from.first_name ?? null,
    from.last_name ?? null,
    now,
    now
  );

  db.prepare(`
    INSERT OR IGNORE INTO sessions (
      telegram_id,
      awaiting_input,
      updated_at
    )
    VALUES (?, NULL, ?)
  `).run(id, now);

  db.prepare(`
    INSERT OR IGNORE INTO auto_settings (
      telegram_id,
      updated_at
    )
    VALUES (?, ?)
  `).run(id, now);
}

export function getWallet(
  telegramId: number
): WalletRecord | undefined {
  return db.prepare(`
    SELECT
      telegram_id,
      public_key,
      encrypted_secret
    FROM wallets
    WHERE telegram_id = ?
  `).get(telegramId) as WalletRecord | undefined;
}

export function saveWallet(
  telegramId: number,
  publicKey: string,
  encryptedSecret: string
): void {
  const now = Date.now();

  db.prepare(`
    INSERT INTO wallets (
      telegram_id,
      public_key,
      encrypted_secret,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)

    ON CONFLICT(telegram_id)
    DO UPDATE SET
      public_key = excluded.public_key,
      encrypted_secret = excluded.encrypted_secret,
      updated_at = excluded.updated_at
  `).run(
    telegramId,
    publicKey,
    encryptedSecret,
    now,
    now
  );
}

export function deleteWallet(
  telegramId: number
): void {
  db.prepare(`
    DELETE FROM wallets
    WHERE telegram_id = ?
  `).run(telegramId);
}

export function getSettings(
  telegramId: number
): AutoSettings {
  const row = db.prepare(`
    SELECT *
    FROM auto_settings
    WHERE telegram_id = ?
  `).get(telegramId) as AutoSettings | undefined;

  if (!row) {
    ensureUser(telegramId, {});
    return db.prepare(`
      SELECT *
      FROM auto_settings
      WHERE telegram_id = ?
    `).get(telegramId) as AutoSettings;
  }

  return row;
}

export function updateSettings(
  telegramId: number,
  patch: Partial<AutoSettings>
): void {
  const current = getSettings(telegramId);

  const next = {
    ...current,
    ...patch
  };

  db.prepare(`
    UPDATE auto_settings
    SET
      max_buy = ?,
      slippage = ?,
      tp_tiers = ?,
      stop_loss = ?,
      trailing_after = ?,
      trailing_pullback = ?,
      time_stop_minutes = ?,
      daily_loss_cap = ?,
      max_trades_hour = ?,
      max_trades_day = ?,
      smart_money_boost = ?,
      auto_state = ?,
      kill_switch = ?,
      updated_at = ?
    WHERE telegram_id = ?
  `).run(
    next.max_buy,
    next.slippage,
    next.tp_tiers,
    next.stop_loss,
    next.trailing_after,
    next.trailing_pullback,
    next.time_stop_minutes,
    next.daily_loss_cap,
    next.max_trades_hour,
    next.max_trades_day,
    next.smart_money_boost,
    next.auto_state,
    next.kill_switch,
    Date.now(),
    telegramId
  );
}

export function setAwaitingInput(
  telegramId: number,
  value: string | null
): void {
  db.prepare(`
    UPDATE sessions
    SET
      awaiting_input = ?,
      updated_at = ?
    WHERE telegram_id = ?
  `).run(
    value,
    Date.now(),
    telegramId
  );
}

export function getAwaitingInput(
  telegramId: number
): string | null {
  const row = db.prepare(`
    SELECT awaiting_input
    FROM sessions
    WHERE telegram_id = ?
  `).get(telegramId) as
    | { awaiting_input: string | null }
    | undefined;

  return row?.awaiting_input ?? null;
}
