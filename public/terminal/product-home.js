/** Product home — command center with live activity strip */

function renderHome(d) {
  window.__lastDash = d;
  const h = d.hunter || {};
  const s = d.settings || {};
  const sc = d.scanner || {};
  const posCount = (d.positions || []).length;
  const huntOn = h.state === "hunting";
  const bal =
    d.wallet?.balanceSol == null ? "—" : d.wallet.balanceSol.toFixed(4) + " SOL";
  const balUsd =
    d.wallet?.balanceUsd != null
      ? "≈ $" + Number(d.wallet.balanceUsd).toFixed(2)
      : "";
  const huntLabel = huntOn ? "ON" : h.killSwitch ? "KILLED" : "OFF";
  const pnlNote = d.pnl?.note || "No closed PnL yet";

  const trades = d.trades || [];
  const actHtml = trades.length
    ? trades
        .slice(0, 6)
        .map((t) => {
          const tms = new Date(t.createdAt).toLocaleTimeString();
          const cls = t.status === "failed" ? "bad" : t.side === "buy" ? "ok" : "";
          return `<div class="feed-line ${cls}"><b>${tms}</b> · ${String(t.side).toUpperCase()} ${t.status} · ${short(t.mint)} · ${t.amountSol} SOL</div>`;
        })
        .join("")
    : `<div class="empty">No trades yet</div>`;

  const walletBlock = d.wallet?.connected
    ? `<div class="panel ah-wallet">
        <div class="ah-wallet-top">
          <div>
            <div class="ah-label">WALLET</div>
            <div class="ah-bal">${bal}</div>
            <div class="muted">${balUsd || short(d.wallet.address || "")}</div>
          </div>
          <div class="ah-hunt ${huntOn ? "on" : ""}">Hunter: ${huntLabel}</div>
        </div>
        <div class="ah-stats">
          <div><span>POSITIONS</span><b>${posCount}</b></div>
          <div><span>PASSED</span><b>${sc.passed ?? 0}</b></div>
          <div><span>SCAN</span><b>${sc.running ? "LIVE" : "OFF"}</b></div>
        </div>
      </div>`
    : `<div class="panel">
        <h1>AUTO-HUNTER</h1>
        <div class="empty">No wallet — create/import in Telegram</div>
      </div>`;

  const autoBtn = huntOn
    ? `<button type="button" class="action danger full" id="btnHomeStopHunt">STOP HUNTING</button>`
    : `<button type="button" class="action primary full" id="btnHomeStartHunt">🟢 START HUNTING</button>`;

  const killBtn = h.killSwitch
    ? `<button type="button" class="action" id="btnClearKill">CLEAR KILL</button>`
    : `<button type="button" class="action danger" id="btnEmergency">EMERGENCY STOP</button>`;

  return `
    <div class="ah-hero panel">
      <div class="ah-hero-title">COMMAND</div>
      <div class="ah-hero-sub">Discover · Trade · Manage positions</div>
      <div class="ah-hero-lines muted">${pnlNote}</div>
    </div>
    ${walletBlock}
    <div class="panel">
      <h2>AUTO-HUNTER</h2>
      ${autoBtn}
      <div class="row" style="margin-top:8px">${killBtn}</div>
      <div class="ws-meta" style="margin-top:10px">Max ${s.maxBuy ?? "—"} SOL · SL ${s.stopLoss ?? "—"}% · Trail ${s.trailingAfter ?? "—"}%
${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day · Cap ${s.dailyLossCap ?? "—"} SOL</div>
    </div>
    <div class="panel">
      <h2>GO</h2>
      <div class="ah-grid lean-3">
        <button type="button" class="action" data-go="trending">🔎 SCAN</button>
        <button type="button" class="action" data-go="trade">⚡ TRADE</button>
        <button type="button" class="action" data-go="positions">📊 POS</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button type="button" class="action ghost" data-menu="risk">⚙ SETTINGS</button>
        <button type="button" class="action ghost" data-menu="activity">ACTIVITY</button>
        <button type="button" class="action ghost" data-menu="wallet">WALLETS</button>
      </div>
    </div>
    <div class="panel">
      <h2>RECENT ACTIVITY</h2>
      ${actHtml}
    </div>`;
}

function renderMenu(d) {
  window.__lastDash = d;
  if (state.menuView === "wallet" || state.menuView === "wallets") {
    const wallets = d.wallets || [];
    const lines = wallets.length
      ? wallets
          .map(
            (w) =>
              `<div class="pos-card">
            <div class="pos-top">${w.active ? "●" : "○"} ${w.label || "Wallet"}</div>
            <div class="pos-meta">${w.address}</div>
          </div>`
          )
          .join("")
      : `<div class="empty">No wallets — create/import in Telegram</div>`;
    return `<div class="panel"><h1>MY WALLETS</h1>${lines}
      <button type="button" class="action ghost" data-go="home">← Home</button></div>`;
  }
  if (state.menuView === "activity") {
    const trades = d.trades || [];
    const lines = trades.length
      ? trades
          .slice(0, 25)
          .map((t) => {
            const tms = new Date(t.createdAt).toLocaleTimeString();
            return `<div class="feed-line"><b>${tms}</b> · ${t.side} ${t.status} · ${short(t.mint)} · ${t.amountSol} SOL</div>`;
          })
          .join("")
      : `<div class="empty">No activity</div>`;
    return `<div class="panel"><h1>ACTIVITY</h1>${lines}
      <button type="button" class="action ghost" data-go="home">← Home</button></div>`;
  }
  if (state.menuView === "risk" || state.menuView === "settings") {
    const s = d.settings || {};
    return `<div class="panel"><h1>SETTINGS</h1>
      <h2>Trading</h2>
      <div class="ws-meta">Size ${s.maxBuy ?? "—"} SOL · Slip ${s.slippage ?? "—"}%
SL ${s.stopLoss ?? "—"}% · Cap ${s.dailyLossCap ?? "—"} SOL
Trades ${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day</div>
      <h2>Automation</h2>
      <div class="ws-meta">Hunter ${d.hunter?.state === "hunting" ? "ON" : "OFF"}
Trail ${s.trailingAfter ?? "—"}% / ${s.trailingPullback ?? "—"}%
Time stop ${s.timeStopMinutes ?? "—"} min</div>
      <h2>Security</h2>
      <div class="ws-meta">Kill ${d.hunter?.killSwitch ? "ACTIVE" : "READY"}</div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="action" data-go="trade">Edit sizes in Trade</button>
        <button type="button" class="action ghost" data-go="home">← Home</button>
      </div></div>`;
  }
  if (state.menuView === "pnl") {
    return `<div class="panel"><h1>PNL</h1><div class="ws-meta">${d.pnl?.note || "No data"}</div>
      <button type="button" class="action ghost" data-go="home">← Home</button></div>`;
  }
  return `<div class="panel"><h1>MORE</h1>
    <div class="menu-list">
      <button type="button" class="action" data-menu="risk">Settings</button>
      <button type="button" class="action" data-menu="wallet">Wallets</button>
      <button type="button" class="action" data-menu="activity">Activity</button>
      <button type="button" class="action" data-menu="pnl">PnL</button>
      <button type="button" class="action ghost" data-go="home">← Home</button>
    </div></div>`;
}
