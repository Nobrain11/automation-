// src/db/migrations.ts — REPLACE existing file

import { db } from "./sqlite.js";

export function runMigrations(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      wallet_address TEXT,
      encrypted_private_key TEXT,
      auto_enabled INTEGER NOT NULL DEFAULT 0,
      emergency_killed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      telegram_id INTEGER PRIMARY KEY,
      awaiting_input TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Wallet 1',
      public_key TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_wallets_telegram_id
      ON wallets(telegram_id);

    CREATE TABLE IF NOT EXISTS referrals (
      telegram_id INTEGER PRIMARY KEY,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by INTEGER,
      commission_rate REAL NOT NULL DEFAULT 10,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_referrals_code
      ON referrals(referral_code);

    CREATE INDEX IF NOT EXISTS
      idx_referrals_referred_by
      ON referrals(referred_by);

    /*
     * Populated once real trades exist (Phase 4/5 trading
     * engine). Schema is ready now so commission tracking
     * can plug in without another migration later.
     */
    CREATE TABLE IF NOT EXISTS referral_earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_telegram_id INTEGER NOT NULL,
      referred_telegram_id INTEGER NOT NULL,
      trade_amount_sol REAL NOT NULL,
      commission_sol REAL NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_referral_earnings_referrer
      ON referral_earnings(referrer_telegram_id);

    CREATE TABLE IF NOT EXISTS auto_settings (
      telegram_id INTEGER PRIMARY KEY,

      max_buy REAL NOT NULL DEFAULT 0.1,
      slippage REAL NOT NULL DEFAULT 20,

      tp_tiers TEXT NOT NULL
        DEFAULT '[{"profit":40,"sellPercent":50},{"profit":100,"sellPercent":25},{"profit":200,"sellPercent":15}]',

      stop_loss REAL NOT NULL DEFAULT -20,

      trailing_after REAL NOT NULL DEFAULT 30,
      trailing_pullback REAL NOT NULL DEFAULT 15,

      time_stop_minutes INTEGER NOT NULL DEFAULT 30,

      daily_loss_cap REAL NOT NULL DEFAULT 0.5,

      max_trades_hour INTEGER NOT NULL DEFAULT 3,
      max_trades_day INTEGER NOT NULL DEFAULT 10,

      smart_money_boost INTEGER NOT NULL DEFAULT 1,

      auto_state TEXT NOT NULL DEFAULT 'off',
      kill_switch INTEGER NOT NULL DEFAULT 0,

      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discovered_tokens (
      mint TEXT PRIMARY KEY,

      name TEXT,
      symbol TEXT,
      uri TEXT,

      creator TEXT,

      discovered_at INTEGER NOT NULL,
      age_seconds INTEGER NOT NULL,

      bonding_curve TEXT,
      is_bonding_curve INTEGER NOT NULL DEFAULT 0,

      mint_authority_revoked INTEGER NOT NULL DEFAULT 0,
      freeze_authority_revoked INTEGER NOT NULL DEFAULT 0,

      top10_percent REAL,

      curve_liquidity_sol REAL,

      volume_1m_usd REAL,

      creator_dumping INTEGER NOT NULL DEFAULT 0,

      smart_money_override INTEGER NOT NULL DEFAULT 0,

      passed INTEGER NOT NULL DEFAULT 0,

      rejection_reasons TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS
      idx_discovered_tokens_time
      ON discovered_tokens(discovered_at);

    CREATE INDEX IF NOT EXISTS
      idx_discovered_tokens_passed
      ON discovered_tokens(passed);

    CREATE INDEX IF NOT EXISTS
      idx_discovered_tokens_creator
      ON discovered_tokens(creator);
  `);

  // --- Self-healing column migrations ---
  addColumnIfMissing("users", "username", "TEXT");
  addColumnIfMissing("users", "first_name", "TEXT");
  addColumnIfMissing("users", "last_name", "TEXT");

  migrateWalletsToMultiWallet();
}

/*
 * The wallets table originally had telegram_id as its
 * PRIMARY KEY (one wallet per user). Multi-wallet support
 * requires an auto-increment id instead, with telegram_id
 * as a plain indexed column. CREATE TABLE IF NOT EXISTS
 * above only creates the new shape on a fresh database —
 * on an existing deploy with the old shape, this converts
 * the table in place and preserves every existing wallet
 * as that user's first, active wallet.
 */
function migrateWalletsToMultiWallet(): void {
  const columns = db
    .prepare(`PRAGMA table_info(wallets)`)
    .all() as { name: string }[];

  const alreadyMigrated = columns.some(
    (col) => col.name === "id"
  );

  if (alreadyMigrated) {
    return;
  }

  db.exec(`
    ALTER TABLE wallets RENAME TO wallets_old;

    CREATE TABLE wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Wallet 1',
      public_key TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_wallets_telegram_id
      ON wallets(telegram_id);

    INSERT INTO wallets (
      telegram_id, label, public_key,
      encrypted_secret, is_active,
      created_at, updated_at
    )
    SELECT
      telegram_id, 'Wallet 1', public_key,
      encrypted_secret, 1,
      created_at, updated_at
    FROM wallets_old;

    DROP TABLE wallets_old;
  `);

  console.log(
    "[migrations] Migrated wallets table to multi-wallet schema."
  );
}

function addColumnIfMissing(table: string, column: string, type: string): void {
  const existing = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];

  const hasColumn = existing.some((col) => col.name === column);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`[migrations] Added missing column ${table}.${column}`);
  }
}
