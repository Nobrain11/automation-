import { db } from "./sqlite.js";

export interface PositionRow {
  id: number;
  telegram_id: number;
  mint: string;
  symbol: string | null;
  entry_sol: number;
  entry_signature: string | null;
  status: string;
  created_at: number;
  closed_at: number | null;
  exit_sol: number | null;
  exit_signature: string | null;
}

export function openPosition(input: {
  telegramId: number;
  mint: string;
  symbol?: string | null;
  entrySol: number;
  signature: string;
}): number {
  const now = Date.now();
  const result = db
    .prepare(
      `
    INSERT INTO positions (
      telegram_id, mint, symbol, entry_sol, entry_signature,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?)
  `
    )
    .run(
      input.telegramId,
      input.mint,
      input.symbol ?? null,
      input.entrySol,
      input.signature,
      now
    );
  return Number(result.lastInsertRowid);
}

export function getPosition(
  telegramId: number,
  positionId: number
): PositionRow | undefined {
  return db
    .prepare(
      `
    SELECT * FROM positions
    WHERE id = ? AND telegram_id = ?
  `
    )
    .get(positionId, telegramId) as PositionRow | undefined;
}

export function closePosition(input: {
  telegramId: number;
  positionId: number;
  exitSol?: number | null;
  signature?: string | null;
}): void {
  db.prepare(
    `
    UPDATE positions
    SET status = 'closed',
        closed_at = ?,
        exit_sol = ?,
        exit_signature = ?
    WHERE id = ? AND telegram_id = ? AND status = 'open'
  `
  ).run(
    Date.now(),
    input.exitSol ?? null,
    input.signature ?? null,
    input.positionId,
    input.telegramId
  );
}

export function listOpenPositions(telegramId: number): PositionRow[] {
  return db
    .prepare(
      `
    SELECT * FROM positions
    WHERE telegram_id = ? AND status = 'open'
    ORDER BY created_at DESC
  `
    )
    .all(telegramId) as PositionRow[];
}

export function listAllOpenPositions(): PositionRow[] {
  return db
    .prepare(
      `
    SELECT * FROM positions
    WHERE status = 'open'
    ORDER BY created_at ASC
  `
    )
    .all() as PositionRow[];
}

export function recordTrade(input: {
  telegramId: number;
  mint: string;
  side: "buy" | "sell";
  amountSol: number;
  signature?: string | null;
  status: string;
  error?: string | null;
}): void {
  db.prepare(
    `
    INSERT INTO trades (
      telegram_id, mint, side, amount_sol, signature, status, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    input.telegramId,
    input.mint,
    input.side,
    input.amountSol,
    input.signature ?? null,
    input.status,
    input.error ?? null,
    Date.now()
  );
}

export function listRecentTrades(telegramId: number, limit = 30) {
  return db
    .prepare(
      `
    SELECT * FROM trades
    WHERE telegram_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `
    )
    .all(telegramId, limit) as Array<{
    id: number;
    telegram_id: number;
    mint: string;
    side: string;
    amount_sol: number;
    signature: string | null;
    status: string;
    error: string | null;
    created_at: number;
  }>;
}
