import { db } from "./sqlite.js";

export interface PositionRow {
  id: number;
  telegram_id: number;
  mint: string;
  symbol: string | null;
  entry_sol: number;
  entry_signature: string | null;
  entry_price_usd: number | null;
  peak_pnl_pct: number | null;
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
  entryPriceUsd?: number | null;
}): number {
  const now = Date.now();
  const result = db
    .prepare(
      `
    INSERT INTO positions (
      telegram_id, mint, symbol, entry_sol, entry_signature,
      entry_price_usd, peak_pnl_pct, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'open', ?)
  `
    )
    .run(
      input.telegramId,
      input.mint,
      input.symbol ?? null,
      input.entrySol,
      input.signature,
      input.entryPriceUsd ?? null,
      now
    );
  return Number(result.lastInsertRowid);
}

export function updatePositionPeak(positionId: number, peakPnlPct: number): void {
  db.prepare(
    `
    UPDATE positions SET peak_pnl_pct = ?
    WHERE id = ? AND status = 'open'
      AND (peak_pnl_pct IS NULL OR peak_pnl_pct < ?)
  `
  ).run(peakPnlPct, positionId, peakPnlPct);
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

export function listClosedPositions(
  telegramId: number,
  limit = 50
): PositionRow[] {
  return db
    .prepare(
      `
    SELECT * FROM positions
    WHERE telegram_id = ? AND status = 'closed'
    ORDER BY closed_at DESC
    LIMIT ?
  `
    )
    .all(telegramId, limit) as PositionRow[];
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

/** Real closed PnL only when exit_sol is recorded */
export function portfolioSummary(telegramId: number): {
  openCount: number;
  closedCount: number;
  realizedSol: number | null;
  openEntrySol: number;
  note: string;
} {
  const open = listOpenPositions(telegramId);
  const closed = listClosedPositions(telegramId, 200);
  const openEntrySol = open.reduce((s, p) => s + (p.entry_sol || 0), 0);

  const withExit = closed.filter(
    (p) => p.exit_sol != null && Number.isFinite(p.exit_sol)
  );
  let realizedSol: number | null = null;
  if (withExit.length) {
    realizedSol = withExit.reduce(
      (s, p) => s + ((p.exit_sol as number) - p.entry_sol),
      0
    );
    realizedSol = Number(realizedSol.toFixed(6));
  }

  const note = !closed.length
    ? open.length
      ? `${open.length} open · no closed trades yet`
      : "No positions yet"
    : realizedSol != null
      ? `${open.length} open · ${closed.length} closed · realized ${realizedSol >= 0 ? "+" : ""}${realizedSol} SOL`
      : `${open.length} open · ${closed.length} closed · realized PnL needs exit size (not all sells store SOL out yet)`;

  return {
    openCount: open.length,
    closedCount: closed.length,
    realizedSol,
    openEntrySol: Number(openEntrySol.toFixed(6)),
    note
  };
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
