/** POSITIONS — product shell */

function renderPositions(d) {
  window.__lastDash = d;
  const positions = d.positions || [];
  const note = d.portfolio?.note || d.pnl?.note || "";

  if (!positions.length) {
    return `
      <div class="panel cmd-hero">
        <div class="cmd-kicker">POSITIONS</div>
        <div class="cmd-title">Open book</div>
        <p class="cmd-sub">Buys from SCAN or TRADE appear here. Sells close 100%.</p>
      </div>
      <div class="panel"><div class="empty">No open positions</div>
        <div class="row" style="margin-top:10px">
          <button type="button" class="action" data-go="trending">SCAN</button>
          <button type="button" class="action" data-go="trade">TRADE</button>
        </div>
      </div>`;
  }

  return `
    <div class="panel cmd-hero">
      <div class="cmd-kicker">POSITIONS</div>
      <div class="cmd-title">Open book</div>
      <p class="cmd-sub">${positions.length} open · ${note}</p>
    </div>
    <div class="panel">
      ${positions
        .map((p) => {
          const pnl = p.pnlPct;
          const pnlCls = pnl == null ? "" : pnl >= 0 ? "ok" : "bad";
          const pnlStr =
            pnl == null
              ? "PnL —"
              : (pnl >= 0 ? "+" : "") + Number(pnl).toFixed(2) + "%";
          return `<div class="pos-card" data-id="${p.id}">
            <div class="pos-top">$${p.symbol || short(p.mint)} · <span class="${pnlCls}">${pnlStr}</span></div>
            <div class="pos-meta">Entry ${p.entrySol} SOL
Entry px ${p.entryPriceUsd != null ? "$" + Number(p.entryPriceUsd).toExponential(3) : "—"}
Now ${p.currentPriceUsd != null ? "$" + Number(p.currentPriceUsd).toExponential(3) : "—"}
Peak ${p.peakPnlPct != null ? Number(p.peakPnlPct).toFixed(1) + "%" : "—"}
${p.mint}</div>
            <button type="button" class="action danger sell-btn">SELL 100%</button>
          </div>`;
        })
        .join("")}
    </div>`;
}
