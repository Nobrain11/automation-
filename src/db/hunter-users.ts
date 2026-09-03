import { db } from "./sqlite.js";

/** Users with Auto-Hunter running and kill switch off */
export function listHuntingUserIds(): number[] {
  const rows = db
    .prepare(
      `
    SELECT s.telegram_id
    FROM auto_settings s
    INNER JOIN wallets w
      ON w.telegram_id = s.telegram_id AND w.is_active = 1
    WHERE s.auto_state = 'running'
      AND s.kill_switch = 0
  `
    )
    .all() as { telegram_id: number }[];

  return rows.map((r) => r.telegram_id);
}

export function countTradesSince(
  telegramId: number,
  sinceMs: number
): number {
  const row = db
    .prepare(
      `
    SELECT COUNT(*) AS c
    FROM trades
    WHERE telegram_id = ?
      AND side = 'buy'
      AND status IN ('submitted', 'ok')
      AND created_at >= ?
  `
    )
    .get(telegramId, sinceMs) as { c: number };
  return row?.c ?? 0;
}
