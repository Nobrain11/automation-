/** Portfolio / PnL — real closed data only */

function renderPortfolio(d) {
  window.__lastDash = d;
  const p = d.portfolio || {};
  const positions = d.positions || [];
  const closed = d.closedPositions || [];
  const trades = d.trades || [];

  const openHtml = positions.length
    ? positions
        .map((x) => {
          const pnl =
            x.pnlPct == null
              ? "—"
              : (x.pnlPct >= 0 ? "+" : "") + x.pnlPct.toFixed(2) + "%";
          const cls = x.pnlPct == null ? "" : x.pnlPct >= 0 ? "ok" : "bad";
          return `<div class="pos-card" data-id="${x.id}">
            <div class="pos-top">$${x.symbol || short(x.mint)} · <span class="${cls}">${pnl}</span></div>
            <div class="pos-meta">Entry ${x.entrySol} SOL · ${short(x.mint)}</div>
            <button type="button" class="action danger sell-btn">SELL 100%</button>
          </div>`;
        })
        .join("")
    : `<div class="empty">No open positions</div>`;

  const closedHtml = closed.length
    ? closed
        .slice(0, 15)
        .map((x) => {
          const tms = x.closedAt
            ? new Date(x.closedAt).toLocaleString()
            : "";
          return `<div class="feed-line"><b>CLOSED</b> $${x.symbol || short(x.mint)} · in ${x.entrySol} SOL${x.exitSol != null ? " · out " + x.exitSol + " SOL" : ""} · ${tms}</div>`;
        })
        .join("")
    : `<div class="empty">No closed positions</div>`;

  const act = trades.length
    ? trades
        .slice(0, 12)
        .map((t) => {
          const tms = new Date(t.createdAt).toLocaleTimeString();
          return `<div class="feed-line"><b>${tms}</b> · ${t.side} ${t.status} · ${t.amountSol} SOL · ${short(t.mint)}</div>`;
        })
        .join("")
    : `<div class="empty">No trades</div>`;

  return `
    <div class="panel">
      <h1>PORTFOLIO</h1>
      <div class="ws-meta">${p.note || d.pnl?.note || "No data"}
Open entry notional: ${p.openEntrySol != null ? p.openEntrySol + " SOL" : "—"}
Realized: ${p.realizedSol == null ? "n/a" : (p.realizedSol >= 0 ? "+" : "") + p.realizedSol + " SOL"}</div>
    </div>
    <div class="panel">
      <h2>OPEN</h2>
      ${openHtml}
    </div>
    <div class="panel">
      <h2>CLOSED</h2>
      ${closedHtml}
    </div>
    <div class="panel">
      <h2>ACTIVITY</h2>
      ${act}
    </div>`;
}

// Hook menu pnl / portfolio
(function () {
  const orig = window.renderMenu;
  if (typeof orig === "function") {
    window.renderMenu = function (d) {
      if (state?.menuView === "pnl" || state?.menuView === "portfolio") {
        return renderPortfolio(d);
      }
      return orig.apply(this, arguments);
    };
  }
})();
