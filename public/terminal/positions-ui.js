/** Richer positions list with PnL when API provides it */

function renderPositions(d) {
  window.__lastDash = d;
  const positions = d.positions || [];
  if (!positions.length) {
    return `<div class="panel"><h1>POSITIONS</h1><div class="empty">No open positions</div>
      <p class="muted">Buys from Terminal or Auto-Hunter appear here.</p></div>`;
  }
  return `<div class="panel"><h1>POSITIONS</h1><p class="muted">Open only · sell closes 100%</p>${positions
    .map((p) => {
      const pnl = p.pnlPct;
      const pnlCls = pnl == null ? "" : pnl >= 0 ? "ok" : "bad";
      const pnlStr =
        pnl == null ? "PnL —" : (pnl >= 0 ? "+" : "") + pnl.toFixed(2) + "%";
      return `<div class="pos-card" data-id="${p.id}">
      <div class="pos-top">$${p.symbol || short(p.mint)} · <span class="${pnlCls}">${pnlStr}</span></div>
      <div class="pos-meta">Entry ${p.entrySol} SOL
Entry px ${p.entryPriceUsd != null ? "$" + Number(p.entryPriceUsd).toExponential(3) : "—"}
Now ${p.currentPriceUsd != null ? "$" + Number(p.currentPriceUsd).toExponential(3) : "—"}
Peak ${p.peakPnlPct != null ? p.peakPnlPct.toFixed(1) + "%" : "—"}
${p.mint}</div>
      <button type="button" class="action danger sell-btn">SELL 100%</button>
    </div>`;
    })
    .join("")}</div>`;
}
