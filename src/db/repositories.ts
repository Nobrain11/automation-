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
  db.prepare(
    `INSERT OR IGNORE INTO sessions (telegram_id, awaiting_input, updated_at) VALUES (?, NULL, ?)`
  ).run(id, now);
  db.prepare(
    `INSERT OR IGNORE INTO auto_settings (telegram_id, updated_at) VALUES (?, ?)`
  ).run(id, now);
}

export interface WalletRow {
  id: number;
  telegram_id: number;
  label: string;
  public_key: string;
  encrypted_secret: string;
  is_active: number;
}

/** Active wallet, or any wallet if none marked active */
export function getWallet(telegramId: number): WalletRecord | undefined {
  const active = db
    .prepare(
      `
    SELECT telegram_id, public_key, encrypted_secret
    FROM wallets
    WHERE telegram_id = ? AND is_active = 1
    ORDER BY id DESC LIMIT 1
  `
    )
    .get(telegramId) as WalletRecord | undefined;

  if (active) return active;

  // Repair: if wallets exist but none active, promote latest
  const any = db
    .prepare(
      `
    SELECT id, telegram_id, public_key, encrypted_secret
    FROM wallets
    WHERE telegram_id = ?
    ORDER BY id DESC LIMIT 1
  `
    )
    .get(telegramId) as
    | (WalletRecord & { id: number })
    | undefined;

  if (any) {
    db.prepare(`UPDATE wallets SET is_active = 1 WHERE id = ?`).run(any.id);
    return {
      telegram_id: any.telegram_id,
      public_key: any.public_key,
      encrypted_secret: any.encrypted_secret
    };
  }
  return undefined;
}

export function countAllWallets(): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM wallets`).get() as {
      c: number;
    };
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

export function saveWallet(
  telegramId: number,
  publicKey: string,
  encryptedSecret: string
): void {
  const now = Date.now();
  const existingCount = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM wallets WHERE telegram_id = ?`)
      .get(telegramId) as { count: number }
  ).count;

  db.prepare(`UPDATE wallets SET is_active = 0 WHERE telegram_id = ?`).run(
    telegramId
  );

  db.prepare(
    `
    INSERT INTO wallets (
      telegram_id, label, public_key, encrypted_secret, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
  `
  ).run(
    telegramId,
    `Wallet ${existingCount + 1}`,
    publicKey,
    encryptedSecret,
    now,
    now
  );
}

export function deleteWallet(telegramId: number): void {
  db.prepare(`DELETE FROM wallets WHERE telegram_id = ?`).run(telegramId);
}

export function listWallets(telegramId: number): WalletRow[] {
  return db
    .prepare(
      `
    SELECT id, telegram_id, label, public_key, encrypted_secret, is_active
    FROM wallets WHERE telegram_id = ? ORDER BY id ASC
  `
    )
    .all(telegramId) as WalletRow[];
}

export function setActiveWallet(telegramId: number, walletId: number): void {
  db.prepare(`UPDATE wallets SET is_active = 0 WHERE telegram_id = ?`).run(
    telegramId
  );
  db.prepare(
    `UPDATE wallets SET is_active = 1 WHERE id = ? AND telegram_id = ?`
  ).run(walletId, telegramId);
}

export function deleteWalletById(telegramId: number, walletId: number): void {
  const wallet = db
    .prepare(`SELECT is_active FROM wallets WHERE id = ? AND telegram_id = ?`)
    .get(walletId, telegramId) as { is_active: number } | undefined;
  if (!wallet) return;
  db.prepare(`DELETE FROM wallets WHERE id = ? AND telegram_id = ?`).run(
    walletId,
    telegramId
  );
  if (wallet.is_active) {
    const next = db
      .prepare(
        `SELECT id FROM wallets WHERE telegram_id = ? ORDER BY id ASC LIMIT 1`
      )
      .get(telegramId) as { id: number } | undefined;
    if (next) setActiveWallet(telegramId, next.id);
  }
}

export interface ReferralInfo {
  telegram_id: number;
  referral_code: string;
  referred_by: number | null;
  commission_rate: number;
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function hasReferralRecord(telegramId: number): boolean {
  return (
    db.prepare(`SELECT 1 FROM referrals WHERE telegram_id = ?`).get(telegramId) !==
    undefined
  );
}

export function ensureReferral(
  telegramId: number,
  referredByCode: string | null
): ReferralInfo {
  const existing = db
    .prepare(`SELECT * FROM referrals WHERE telegram_id = ?`)
    .get(telegramId) as ReferralInfo | undefined;
  if (existing) return existing;

  let referredBy: number | null = null;
  if (referredByCode) {
    const referrer = db
      .prepare(`SELECT telegram_id FROM referrals WHERE referral_code = ?`)
      .get(referredByCode) as { telegram_id: number } | undefined;
    if (referrer && referrer.telegram_id !== telegramId)
      referredBy = referrer.telegram_id;
  }

  let code = generateReferralCode();
  while (
    db.prepare(`SELECT 1 FROM referrals WHERE referral_code = ?`).get(code)
  )
    code = generateReferralCode();

  db.prepare(
    `
    INSERT INTO referrals (telegram_id, referral_code, referred_by, commission_rate, created_at)
    VALUES (?, ?, ?, 10, ?)
  `
  ).run(telegramId, code, referredBy, Date.now());

  return {
    telegram_id: telegramId,
    referral_code: code,
    referred_by: referredBy,
    commission_rate: 10
  };
}

export function getReferralStats(telegramId: number): {
  code: string;
  commissionRate: number;
  referredCount: number;
  totalEarnedSol: number;
} | null {
  const info = db
    .prepare(`SELECT * FROM referrals WHERE telegram_id = ?`)
    .get(telegramId) as ReferralInfo | undefined;
  if (!info) return null;
  const referredCount = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM referrals WHERE referred_by = ?`)
      .get(telegramId) as { count: number }
  ).count;
  const totalEarnedSol = (
    db
      .prepare(
        `SELECT COALESCE(SUM(commission_sol), 0) AS total FROM referral_earnings WHERE referrer_telegram_id = ?`
      )
      .get(telegramId) as { total: number }
  ).total;
  return {
    code: info.referral_code,
    commissionRate: info.commission_rate,
    referredCount,
    totalEarnedSol
  };
}

export function getSettings(telegramId: number): AutoSettings {
  const row = db
    .prepare(`SELECT * FROM auto_settings WHERE telegram_id = ?`)
    .get(telegramId) as AutoSettings | undefined;
  if (!row) {
    ensureUser(telegramId, {});
    return db
      .prepare(`SELECT * FROM auto_settings WHERE telegram_id = ?`)
      .get(telegramId) as AutoSettings;
  }
  return row;
}

export function updateSettings(
  telegramId: number,
  patch: Partial<AutoSettings>
): void {
  const current = getSettings(telegramId);
  const next = { ...current, ...patch };
  db.prepare(
    `
    UPDATE auto_settings SET
      max_buy = ?, slippage = ?, tp_tiers = ?, stop_loss = ?,
      trailing_after = ?, trailing_pullback = ?, time_stop_minutes = ?,
      daily_loss_cap = ?, max_trades_hour = ?, max_trades_day = ?,
      smart_money_boost = ?, auto_state = ?, kill_switch = ?, updated_at = ?
    WHERE telegram_id = ?
  `
  ).run(
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
  db.prepare(
    `UPDATE sessions SET awaiting_input = ?, updated_at = ? WHERE telegram_id = ?`
  ).run(value, Date.now(), telegramId);
}

export function getAwaitingInput(telegramId: number): string | null {
  const row = db
    .prepare(`SELECT awaiting_input FROM sessions WHERE telegram_id = ?`)
    .get(telegramId) as { awaiting_input: string | null } | undefined;
  return row?.awaiting_input ?? null;
}
