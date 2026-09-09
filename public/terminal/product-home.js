/**
 * HOME — market-first trading desk (not a settings page).
 * Rank-ready surface: pulse → opportunities → actions → risk strip.
 */

function homeMovers(limit) {
  const tr = window.state?.trending || window.__lastDash?.trending || null;
  const list =
    tr?.movers ||
    tr?.trending ||
    tr?.scored ||
    [];
  return Array.isArray(list) ? list.slice(0, limit) : [];
}

function homeTickerHtml() {
  const items = homeMovers(10);
  if (!items.length) {
    return `<div class="scan-ticker"><span>Loading pump.fun movers…</span></div>`;
  }
  return `<div class="scan-ticker">${items
    .map((t) => {
      const c = t.priceChange5m ?? t.priceChange24h;
      const cls = c == null ? "" : c >= 0 ? "up" : "down";
      const pct =
        typeof fmtPct === "function" && c != null
          ? fmtPct(c)
          : c != null
            ? (c >= 0 ? "+" : "") + Number(c).toFixed(1) + "%"
            : "—";
      return `<span class="${cls}">${t.symbol || short(t.mint)} ${pct}</span>`;
    })
    .join("")}</div>`;
}

function homeCard(t) {
  if (typeof tokenCard === "function") return tokenCard(t);
  const price =
    t.priceUsd != null && typeof fmtUsd === "function"
      ? fmtUsd(t.priceUsd)
      : t.priceUsd != null
        ? "$" + Number(t.priceUsd).toPrecision(4)
        : "—";
  const mcap =
    t.marketCap != null && typeof fmtUsd === "function"
      ? fmtUsd(t.marketCap)
      : "—";
  return `<article class="desk-card token" data-mint="${t.mint}">
    <div class="desk-card-top">
      <div class="desk-avatar">${(t.symbol || "??").slice(0, 2)}</div>
      <div style="flex:1;min-width:0">
        <div class="desk-name-row">
          <span class="desk-name">${t.name || t.symbol || "Token"}</span>
          <span class="desk-sym">${t.symbol || ""}</span>
        </div>
        <div class="desk-ca">${short(t.mint)}</div>
      </div>
      <div class="desk-price-col">
        <div class="desk-price">${price}</div>
        <div class="desk-chg">MC ${mcap}</div>
      </div>
    </div>
    <div class="desk-actions" style="margin-top:10px">
      <button type="button" class="desk-quick tok-buy">Quick Buy</button>
      <button type="button" class="desk-icon-btn tok-open">◎</button>
    </div>
  </article>`;
}

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
      : Number(d.wallet.balanceSol).toFixed(3);
  const sol =
    d.sol?.price != null ? "$" + Number(d.sol.price).toFixed(2) : "—";
  const solChg =
    d.sol?.change24h != null
      ? (d.sol.change24h >= 0 ? "+" : "") +
        Number(d.sol.change24h).toFixed(1) +
        "%"
      : "";

  const movers = homeMovers(4);
  const online = Boolean(window.state?.trending?.online ?? movers.length);

  const moverHtml = movers.length
    ? movers.map(homeCard).join("")
    : `<div class="empty">Fetching pump.fun movers…</div>`;

  const huntChip = huntOn
    ? `<span class="home-chip on">HUNTER ON</span>`
    : h.killSwitch
      ? `<span class="home-chip kill">KILL</span>`
      : `<span class="home-chip">HUNTER OFF</span>`;

  const autoBtn = huntOn
    ? `<button type="button" class="action danger" id="btnHomeStopHunt">STOP</button>`
    : `<button type="button" class="action primary" id="btnHomeStartHunt">START HUNTER</button>`;

  const killBtn = h.killSwitch
    ? `<button type="button" class="action ghost" id="btnClearKill">CLEAR KILL</button>`
    : `<button type="button" class="action ghost" id="btnEmergency">KILL</button>`;

  return `
    <div class="home-desk">
      ${homeTickerHtml()}

      <div class="home-status">
        <div class="home-status-left">
          <span class="dot ${online ? "on" : ""}"></span>
          <span>${online ? "LIVE" : "…"}</span>
          <span class="dim">pump.fun</span>
          ${huntChip}
        </div>
        <div class="home-status-right">
          <span>SOL ${sol} ${solChg}</span>
          <span>${connected ? bal + " SOL" : "No wallet"}</span>
        </div>
      </div>

      <div class="home-metrics">
        <div><span>OPEN</span><b>${posCount}</b></div>
        <div><span>PASSED</span><b>${sc.passed ?? 0}</b></div>
        <div><span>SIZE</span><b>${s.maxBuy ?? "—"}</b></div>
        <div><span>SL</span><b>${s.stopLoss ?? "—"}%</b></div>
      </div>

      <div class="home-section-head">
        <h2>Opportunities</h2>
        <button type="button" class="action ghost" data-go="trending">View all</button>
      </div>
      ${moverHtml}

      <div class="panel home-hunter">
        <div class="home-hunter-row">
          <div>
            <div class="home-hunter-title">Auto-Hunter</div>
            <div class="muted" style="font-size:11px">${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day · cap ${s.dailyLossCap ?? "—"} SOL</div>
          </div>
          <div class="home-hunter-actions">${autoBtn}${killBtn}</div>
        </div>
      </div>

      <div class="home-quick-row">
        <button type="button" class="action" data-go="trade">Trade</button>
        <button type="button" class="action" data-go="positions">Positions</button>
        <button type="button" class="action ghost" data-menu="pnl">Portfolio</button>
        <button type="button" class="action ghost" data-menu="risk">Settings</button>
      </div>
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
