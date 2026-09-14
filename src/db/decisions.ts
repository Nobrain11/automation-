import { db } from "./sqlite.js";

export interface DecisionRow {
  id: number;
  mint: string;
  symbol: string | null;
  passed: number;
  reasons: string;
  milestones: string;
  source: string;
  created_at: number;
}

export function ensureDecisionsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mint TEXT NOT NULL,
      symbol TEXT,
      passed INTEGER NOT NULL DEFAULT 0,
      reasons TEXT NOT NULL DEFAULT '[]',
      milestones TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'scanner',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_decisions_mint ON decisions(mint);
  `);
}

export function recordDecision(input: {
  mint: string;
  symbol?: string | null;
  passed: boolean;
  reasons: string[];
  milestones?: unknown;
  source?: string;
}): void {
  try {
    ensureDecisionsTable();
    db.prepare(
      `
      INSERT INTO decisions (mint, symbol, passed, reasons, milestones, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      input.mint,
      input.symbol ?? null,
      input.passed ? 1 : 0,
      JSON.stringify(input.reasons ?? []),
      JSON.stringify(input.milestones ?? []),
      input.source ?? "scanner",
      Date.now()
    );
  } catch {
    /* never break scanner on log failure */
  }
}

export function listDecisions(limit = 50): DecisionRow[] {
  try {
    ensureDecisionsTable();
    return db
      .prepare(
        `
        SELECT * FROM decisions
        ORDER BY created_at DESC
        LIMIT ?
      `
      )
      .all(Math.min(200, Math.max(1, limit))) as DecisionRow[];
  } catch {
    return [];
  }
}
