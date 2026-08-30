import { db } from "./sqlite.js";

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      telegram_id INTEGER PRIMARY KEY,
      public_key TEXT NOT NULL UNIQUE,
      encrypted_secret TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,

      FOREIGN KEY (telegram_id)
        REFERENCES users(telegram_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      telegram_id INTEGER PRIMARY KEY,
      awaiting_input TEXT,
      updated_at INTEGER NOT NULL,

      FOREIGN KEY (telegram_id)
        REFERENCES users(telegram_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auto_settings (
      telegram_id INTEGER PRIMARY KEY,

      max_buy REAL NOT NULL DEFAULT 0.1,

      slippage REAL NOT NULL DEFAULT 20,

      tp_tiers TEXT NOT NULL DEFAULT
        '[{"profit":40,"sellPercent":50},{"profit":100,"sellPercent":25},{"profit":200,"sellPercent":15}]',

      stop_loss REAL NOT NULL DEFAULT 20,

      trailing_after REAL NOT NULL DEFAULT 30,

      trailing_pullback REAL NOT NULL DEFAULT 15,

      time_stop_minutes INTEGER NOT NULL DEFAULT 30,

      daily_loss_cap REAL NOT NULL DEFAULT 0.5,

      max_trades_hour INTEGER NOT NULL DEFAULT 3,

      max_trades_day INTEGER NOT NULL DEFAULT 10,

      smart_money_boost INTEGER NOT NULL DEFAULT 1,

      auto_state TEXT NOT NULL DEFAULT 'stopped',

      kill_switch INTEGER NOT NULL DEFAULT 0,

      updated_at INTEGER NOT NULL,

      FOREIGN KEY (telegram_id)
        REFERENCES users(telegram_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_public_key
      ON wallets(public_key);

    CREATE INDEX IF NOT EXISTS idx_settings_state
      ON auto_settings(auto_state);
  `);
}
