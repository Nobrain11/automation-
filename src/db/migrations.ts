db.exec(`
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
