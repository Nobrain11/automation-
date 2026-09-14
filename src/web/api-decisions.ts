import { listDecisions } from "../db/decisions.js";

export function buildDecisions(limit = 40) {
  const rows = listDecisions(limit);
  return {
    ok: true,
    count: rows.length,
    items: rows.map((r) => {
      let reasons: string[] = [];
      let milestones: unknown[] = [];
      try {
        reasons = JSON.parse(r.reasons || "[]");
      } catch {
        reasons = [];
      }
      try {
        milestones = JSON.parse(r.milestones || "[]");
      } catch {
        milestones = [];
      }
      return {
        id: r.id,
        mint: r.mint,
        symbol: r.symbol,
        passed: Boolean(r.passed),
        reasons,
        milestones,
        source: r.source,
        at: r.created_at
      };
    })
  };
}
