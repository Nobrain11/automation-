// src/db/repositories.ts

import { db } from "./sqlite.js";

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
  dca_enabled: number;
  dca_amount_sol: number;
  dca_interval_minutes: number;
  dca_max_orders: number;
  updated_at: number;
}

export function userExists(telegramId: number): boolean {
  const row = db
    .prepare(`SELECT 1 FROM users WHERE telegram_id = ?`)
    .get(telegramId);
  return row !== undefined;
}

export function ensureUser(
  id: number,
  from: { username?: string; first_name?: string; last_name?: string }
): void {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO users (telegram_id, username, first_name, last_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = excluded.updated_at
  `
  ).run(
    id,
    from.username ?? null,
    from.first_name ?? null,
    from.last_name ?? null,
    now,
    now
  );
}

export interface WalletRow {
  id: number;
  telegram_id: number;
  label: string;
  public_key: string;
  encrypted_secret: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export function getWallet(telegramId: number): WalletRecord | undefined {
  const row = db
    .prepare(
      `
    SELECT telegram_id, public_key, encrypted_secret
    FROM wallets
    WHERE telegram_id = ? AND is_active = 1
    ORDER BY id DESC
    LIMIT 1
  `
    )
    .get(telegramId) as
    | { telegram_id: number; public_key: string; encrypted_secret: string }
    | undefined;
  if (!row) {
    const legacy = db
      .prepare(
        `
      SELECT telegram_id, wallet_address as public_key, encrypted_private_key as encrypted_secret
      FROM users
      WHERE telegram_id = ? AND wallet_address IS NOT NULL AND encrypted_private_key IS NOT NULL
    `
      )
      .get(telegramId) as WalletRecord | undefined;
    return legacy;
  }
  return row;
}

export function countAllWallets(): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM wallets`).get() as {
    c: number;
  };
  return row.c;
}

export function saveWallet(
  telegramId: number,
  publicKey: string,
  encryptedSecret: string,
  label = "Wallet 1"
): void {
  const now = Date.now();
  db.prepare(`UPDATE wallets SET is_active = 0 WHERE telegram_id = ?`).run(
    telegramId
  );
  db.prepare(
    `
    INSERT INTO wallets (telegram_id, label, public_key, encrypted_secret, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `
  ).run(telegramId, label, publicKey, encryptedSecret, now, now);
  db.prepare(
    `
    UPDATE users SET wallet_address = ?, encrypted_private_key = ?, updated_at = ?
    WHERE telegram_id = ?
  `
  ).run(publicKey, encryptedSecret, now, telegramId);
}

export function deleteWallet(telegramId: number): void {
  db.prepare(`DELETE FROM wallets WHERE telegram_id = ?`).run(telegramId);
  db.prepare(
    `UPDATE users SET wallet_address = NULL, encrypted_private_key = NULL, updated_at = ? WHERE telegram_id = ?`
  ).run(Date.now(), telegramId);
}

export function listWallets(telegramId: number): WalletRow[] {
  return db
    .prepare(
      `SELECT * FROM wallets WHERE telegram_id = ? ORDER BY is_active DESC, id ASC`
    )
    .all(telegramId) as WalletRow[];
}

export function setActiveWallet(telegramId: number, walletId: number): void {
  const now = Date.now();
  db.prepare(`UPDATE wallets SET is_active = 0, updated_at = ? WHERE telegram_id = ?`).run(
    now,
    telegramId
  );
  db.prepare(
    `UPDATE wallets SET is_active = 1, updated_at = ? WHERE id = ? AND telegram_id = ?`
  ).run(now, walletId, telegramId);
  const w = db
    .prepare(`SELECT public_key, encrypted_secret FROM wallets WHERE id = ?`)
    .get(walletId) as { public_key: string; encrypted_secret: string } | undefined;
  if (w) {
    db.prepare(
      `UPDATE users SET wallet_address = ?, encrypted_private_key = ?, updated_at = ? WHERE telegram_id = ?`
    ).run(w.public_key, w.encrypted_secret, now, telegramId);
  }
}

export function deleteWalletById(telegramId: number, walletId: number): void {
  db.prepare(`DELETE FROM wallets WHERE id = ? AND telegram_id = ?`).run(
    walletId,
    telegramId
  );
}

export function hasReferralRecord(telegramId: number): boolean {
  return (
    db.prepare(`SELECT 1 FROM referrals WHERE telegram_id = ?`).get(telegramId) !==
    undefined
  );
}

export function ensureReferral(
  telegramId: number,
  referredByCode: string | null = null
): void {
  if (hasReferralRecord(telegramId)) return;
  const now = Date.now();
  const code = `ref_${telegramId}`;
  let referredBy: number | null = null;
  if (referredByCode) {
    const row = db
      .prepare(`SELECT telegram_id FROM referrals WHERE referral_code = ?`)
      .get(referredByCode) as { telegram_id: number } | undefined;
    if (row && row.telegram_id !== telegramId) referredBy = row.telegram_id;
  }
  db.prepare(
    `
    INSERT OR IGNORE INTO referrals (telegram_id, referral_code, referred_by, created_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(telegramId, code, referredBy, now);
}

export function getReferralStats(telegramId: number): {
  code: string;
  referredCount: number;
  totalEarnedSol: number;
} {
  ensureReferral(telegramId, null);
  const row = db
    .prepare(`SELECT referral_code as code FROM referrals WHERE telegram_id = ?`)
    .get(telegramId) as { code: string };
  const countRow = db
    .prepare(`SELECT COUNT(*) as c FROM referrals WHERE referred_by = ?`)
    .get(telegramId) as { c: number };
  const earnRow = db
    .prepare(
      `SELECT COALESCE(SUM(commission_sol), 0) as s FROM referral_earnings WHERE referrer_telegram_id = ?`
    )
    .get(telegramId) as { s: number };
  return {
    code: row.code,
    referredCount: countRow.c,
    totalEarnedSol: Number(earnRow.s) || 0
  };
}

function normalizeSettings(row: AutoSettings): AutoSettings {
  return {
    ...row,
    dca_enabled: Number((row as any).dca_enabled ?? 0),
    dca_amount_sol: Number((row as any).dca_amount_sol ?? 0.05),
    dca_interval_minutes: Number((row as any).dca_interval_minutes ?? 60),
    dca_max_orders: Number((row as any).dca_max_orders ?? 5)
  };
}

export function getSettings(telegramId: number): AutoSettings {
  ensureUser(telegramId, {});
  const row = db
    .prepare(`SELECT * FROM auto_settings WHERE telegram_id = ?`)
    .get(telegramId) as AutoSettings | undefined;
  if (row) return normalizeSettings(row);

  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO auto_settings (telegram_id, updated_at) VALUES (?, ?)`
  ).run(telegramId, now);

  return normalizeSettings(
    db
      .prepare(`SELECT * FROM auto_settings WHERE telegram_id = ?`)
      .get(telegramId) as AutoSettings
  );
}

export function updateSettings(
  telegramId: number,
  patch: Partial<AutoSettings>
): void {
  const current = getSettings(telegramId);
  const next = { ...current, ...patch, updated_at: Date.now() };
  const keys = Object.keys(next).filter((k) => k !== "telegram_id") as (keyof AutoSettings)[];
  const sets = keys.map((k) => `${k} = @${k}`).join(", ");
  const params: Record<string, unknown> = { telegram_id: telegramId };
  for (const k of keys) params[k] = next[k];
  db.prepare(
    `UPDATE auto_settings SET ${sets} WHERE telegram_id = @telegram_id`
  ).run(params);
}

export function setAwaitingInput(
  telegramId: number,
  value: string | null
): void {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO sessions (telegram_id, awaiting_input, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      awaiting_input = excluded.awaiting_input,
      updated_at = excluded.updated_at
  `
  ).run(telegramId, value, now);
}

export function getAwaitingInput(telegramId: number): string | null {
  const row = db
    .prepare(`SELECT awaiting_input FROM sessions WHERE telegram_id = ?`)
    .get(telegramId) as { awaiting_input: string | null } | undefined;
  return row?.awaiting_input ?? null;
}
