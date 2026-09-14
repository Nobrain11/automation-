import { db } from "./sqlite.js";

/** Realized SOL PnL from closed positions since timestamp (exit - entry). */
export function realizedSolSince(telegramId: number, sinceMs: number): number {
  try {
    const rows = db
      .prepare(
        `
        SELECT entry_sol, exit_sol FROM positions
        WHERE telegram_id = ?
          AND status = 'closed'
          AND closed_at IS NOT NULL
          AND closed_at >= ?
          AND exit_sol IS NOT NULL
      `
      )
      .all(telegramId, sinceMs) as Array<{ entry_sol: number; exit_sol: number }>;

    let sum = 0;
    for (const r of rows) {
      sum += Number(r.exit_sol) - Number(r.entry_sol);
    }
    return sum;
  } catch {
    return 0;
  }
}

export function realizedSolToday(telegramId: number): number {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return realizedSolSince(telegramId, start.getTime());
}
