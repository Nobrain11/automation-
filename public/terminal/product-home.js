/** Unified command home — one clean product surface */

function renderHome(d) {
  window.__lastDash = d;
  const h = d.hunter || {};
  const s = d.settings || {};
  const sc = d.scanner || {};
  const posCount = (d.positions || []).length;
  const huntOn = h.state === "hunting";
  const connected = Boolean(d.wallet?.connected);
  const bal =
    d.wallet?.balanceSol == null
      ? "—"
      : Number(d.wallet.balanceSol).toFixed(4) + " SOL";
  const balUsd =
    d.wallet?.balanceUsd != null
      ? "$" + Number(d.wallet.balanceUsd).toFixed(2)
      : "";
  const sol =
    d.sol?.price != null ? "$" + Number(d.sol.price).toFixed(2) : "—";
  const pnlNote = d.portfolio?.note || d.pnl?.note || "No positions yet";

  const walletLine = connected
    ? short(d.wallet.address || "")
    : "Not linked — open Telegram bot to create/import";

  const autoBtn = huntOn
    ? `<button type="button" class="action danger full" id="btnHomeStopHunt">STOP HUNTER</button>`
    : `<button type="button" class="action primary full" id="btnHomeStartHunt">START HUNTER</button>`;

  const killBtn = h.killSwitch
    ? `<button type="button" class="action" id="btnClearKill">CLEAR KILL</button>`
    : `<button type="button" class="action danger" id="btnEmergency">EMERGENCY STOP</button>`;

  const trades = d.trades || [];
  const act = trades.length
    ? trades
        .slice(0, 5)
        .map((t) => {
          const tms = new Date(t.createdAt).toLocaleTimeString();
          return `<div class="feed-line"><b>${tms}</b> · ${String(t.side).toUpperCase()} ${t.status} · ${t.amountSol} SOL · ${short(t.mint)}</div>`;
        })
        .join("")
    : `<div class="empty">No trades yet — use SCAN or TRADE</div>`;

  return `
    <div class="panel cmd-hero">
      <div class="cmd-kicker">PUMP AUTO</div>
      <div class="cmd-title">Command</div>
      <p class="cmd-sub">Discover pump.fun movers, execute with risk limits, manage positions from one desk.</p>
      <div class="cmd-grid">
        <div class="cmd-stat"><span>SOL</span><b>${sol}</b></div>
        <div class="cmd-stat"><span>BALANCE</span><b>${bal}</b></div>
        <div class="cmd-stat"><span>HUNTER</span><b>${huntOn ? "ON" : h.killSwitch ? "KILL" : "OFF"}</b></div>
        <div class="cmd-stat"><span>OPEN</span><b>${posCount}</b></div>
      </div>
    </div>

    <div class="panel">
      <h2>Wallet</h2>
      <div class="ws-meta">${walletLine}
${balUsd ? "≈ " + balUsd : ""}</div>
    </div>

    <div class="panel">
      <h2>Auto-Hunter</h2>
      ${autoBtn}
      <div class="row" style="margin-top:8px">${killBtn}</div>
      <div class="ws-meta" style="margin-top:10px">Size ${s.maxBuy ?? "—"} SOL · SL ${s.stopLoss ?? "—"}% · Trail ${s.trailingAfter ?? "—"}%
${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day · Cap ${s.dailyLossCap ?? "—"} SOL
Scanner ${sc.running ? "live" : "off"} · passed ${sc.passed ?? 0}</div>
    </div>

    <div class="panel">
      <h2>Go</h2>
      <div class="cmd-grid">
        <button type="button" class="action" data-go="trending">SCAN</button>
        <button type="button" class="action" data-go="trade">TRADE</button>
        <button type="button" class="action" data-go="positions">POSITIONS</button>
        <button type="button" class="action ghost" data-menu="pnl">PORTFOLIO</button>
      </div>
    </div>

    <div class="panel">
      <h2>Portfolio note</h2>
      <div class="ws-meta">${pnlNote}</div>
    </div>

    <div class="panel">
      <h2>Recent activity</h2>
      ${act}
    </div>`;
}

function renderMenu(d) {
  window.__lastDash = d;
  if (state.menuView === "pnl" || state.menuView === "portfolio") {
    if (typeof renderPortfolio === "function") return renderPortfolio(d);
  }
  if (state.menuView === "wallet" || state.menuView === "wallets") {
    const wallets = d.wallets || [];
    const lines = wallets.length
      ? wallets
          .map(
            (w) =>
              `<div class="pos-card"><div class="pos-top">${w.active ? "●" : "○"} ${w.label || "Wallet"}</div><div class="pos-meta">${w.address}</div></div>`
          )
          .join("")
      : `<div class="empty">No wallets linked</div>`;
    return `<div class="panel"><h1>Wallets</h1>${lines}<button type="button" class="action ghost" data-go="home">← Back</button></div>`;
  }
  if (state.menuView === "activity") {
    const trades = d.trades || [];
    const lines = trades.length
      ? trades
          .slice(0, 30)
          .map((t) => {
            const tms = new Date(t.createdAt).toLocaleTimeString();
            return `<div class="feed-line"><b>${tms}</b> · ${t.side} ${t.status} · ${t.amountSol} SOL · ${short(t.mint)}</div>`;
          })
          .join("")
      : `<div class="empty">No activity</div>`;
    return `<div class="panel"><h1>Activity</h1>${lines}<button type="button" class="action ghost" data-go="home">← Back</button></div>`;
  }
  if (state.menuView === "risk" || state.menuView === "settings") {
    const s = d.settings || {};
    return `<div class="panel"><h1>Settings</h1>
      <div class="ws-meta">Edit live defaults on TRADE.

Max buy ${s.maxBuy ?? "—"} SOL
Slippage ${s.slippage ?? "—"}%
Stop loss ${s.stopLoss ?? "—"}%
Trail ${s.trailingAfter ?? "—"}% / ${s.trailingPullback ?? "—"}%
Time stop ${s.timeStopMinutes ?? "—"} min
Daily cap ${s.dailyLossCap ?? "—"} SOL
Trades ${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day</div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="action primary" data-go="trade">Open TRADE</button>
        <button type="button" class="action ghost" data-go="home">← Back</button>
      </div></div>`;
  }
  return `<div class="panel"><h1>More</h1>
    <div class="menu-list">
      <button type="button" class="action" data-menu="risk">Settings</button>
      <button type="button" class="action" data-menu="wallet">Wallets</button>
      <button type="button" class="action" data-menu="activity">Activity</button>
      <button type="button" class="action" data-menu="pnl">Portfolio</button>
      <button type="button" class="action ghost" data-go="home">← Home</button>
    </div></div>`;
}
