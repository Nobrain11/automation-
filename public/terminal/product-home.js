/** Product home + portfolio/settings layout (real data only) */

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

  const wallets = d.wallets || [];
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
          <div><span>TODAY PnL</span><b>${d.pnl?.todaySol != null ? (d.pnl.todaySol >= 0 ? "+" : "") + d.pnl.todaySol.toFixed(3) + " SOL" : "—"}</b></div>
          <div><span>SCANNER</span><b>${sc.running ? "LIVE" : "OFF"}</b></div>
        </div>
      </div>`
    : `<div class="panel">
        <h1>AUTO-HUNTER</h1>
        <p class="muted">Connect a wallet in Telegram to trade.</p>
        <div class="empty">No wallet linked to this session</div>
      </div>`;

  const autoBtn = huntOn
    ? `<button type="button" class="action danger full" id="btnHomeStopHunt">STOP HUNTING</button>`
    : `<button type="button" class="action primary full" id="btnHomeStartHunt">🟢 START HUNTING</button>`;

  return `
    <div class="ah-hero panel">
      <div class="ah-hero-title">AUTO-HUNTER</div>
      <div class="ah-hero-sub">Intelligent Solana trading, built for speed.</div>
      <div class="ah-hero-lines muted">
        Find opportunities · Analyze risk · Execute trades · Manage positions
      </div>
    </div>
    ${walletBlock}
    <div class="panel">
      ${autoBtn}
      <div class="ah-grid">
        <button type="button" class="action" data-go="trending">🔎 SCANNER</button>
        <button type="button" class="action" data-go="trade">⚡ TERMINAL</button>
        <button type="button" class="action" data-go="positions">📊 POSITIONS</button>
        <button type="button" class="action" data-go="menu">▤ PORTFOLIO</button>
        <button type="button" class="action" data-menu="wallet">👛 WALLETS</button>
        <button type="button" class="action" data-menu="risk">⚙️ SETTINGS</button>
      </div>
    </div>
    <div class="panel">
      <h2>LIMITS</h2>
      <div class="ws-meta">Max buy ${s.maxBuy ?? "—"} SOL · Slippage ${s.slippage ?? "—"}%
SL ${s.stopLoss ?? "—"}% · Trail after ${s.trailingAfter ?? "—"}%
Daily cap ${s.dailyLossCap ?? "—"} SOL · ${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day</div>
    </div>
    <div class="panel">
      <h2>SMART DEV FOLLOW</h2>
      <div class="empty">Not configured — no developer follows yet</div>
      <p class="muted" style="margin-top:8px">Phase 2 feature. Will use real tracked wallets only.</p>
    </div>
    <div class="panel">
      <h2>STATUS</h2>
      <div class="ws-meta">${pnlNote}
HTTP discovery active when service is healthy.
${wallets.length ? wallets.length + " wallet(s) on account" : ""}</div>
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
      <p class="muted">Add or switch wallets in Telegram → Wallet menu.</p>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "status") {
    const sc = d.scanner || {};
    return `<div class="panel"><h1>STATUS</h1><div class="ws-meta">${hunterLabel(d.hunter)}
Scanner ${sc.running ? "LIVE" : "OFF"}
Disc ${sc.discovered ?? 0} · Pass ${sc.passed ?? 0}</div>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "pnl") {
    return `<div class="panel"><h1>PNL</h1><div class="ws-meta">${d.pnl?.note || "No data"}</div>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "risk" || state.menuView === "settings") {
    const s = d.settings || {};
    return `<div class="panel"><h1>SETTINGS</h1>
      <h2>Trading</h2>
      <div class="ws-meta">Default size ${s.maxBuy ?? "—"} SOL
Slippage ${s.slippage ?? "—"}%
Stop loss ${s.stopLoss ?? "—"}%
Daily loss limit ${s.dailyLossCap ?? "—"} SOL
Max trades ${s.maxTradesHour ?? "—"}/hr · ${s.maxTradesDay ?? "—"}/day</div>
      <h2>Automation</h2>
      <div class="ws-meta">Auto-Hunter ${d.hunter?.state === "hunting" ? "ON" : "OFF"}
Trailing after ${s.trailingAfter ?? "—"}% · pullback ${s.trailingPullback ?? "—"}%
Time stop ${s.timeStopMinutes ?? "—"} min
Smart money boost ${s.smartMoneyBoost ? "ON" : "OFF"}</div>
      <h2>Security</h2>
      <div class="ws-meta">Emergency stop ${d.hunter?.killSwitch ? "ACTIVE" : "READY"}
Keys encrypted at rest · never logged in plaintext</div>
      <div class="row">
        <button type="button" class="action" data-go="trade">Edit trade defaults</button>
        <button type="button" class="action ghost" data-menu-back>← Back</button>
      </div></div>`;
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
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "learn") {
    return `<div class="panel"><h1>LEARN HOW IT WORKS</h1>
      <p class="muted">1. Connect wallet in Telegram<br/>2. Set risk limits<br/>3. Start hunter or trade manually<br/>4. Monitor positions · auto exits use TP/SL/trail/time</p>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "referral") {
    const r = d.referral;
    return `<div class="panel"><h1>REFERRAL</h1><div class="ws-meta">${r ? `Code ${r.code}\nReferred ${r.referredCount}\nEarned ${r.totalEarnedSol} SOL` : "Not configured"}</div>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "support") {
    return `<div class="panel"><h1>SUPPORT</h1><p class="muted">Use Telegram for wallet export. Never share private keys.</p>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }
  if (state.menuView === "dev") {
    return `<div class="panel"><h1>SMART DEV FOLLOW</h1>
      <div class="empty">Not configured</div>
      <p class="muted">No mock developers. This ships when real wallet tracking is enabled.</p>
      <button type="button" class="action ghost" data-menu-back>← Back</button></div>`;
  }

  return `<div class="panel"><h1>PORTFOLIO</h1>
    <div class="menu-list">
      <button type="button" class="action" data-menu="wallet">My Wallets</button>
      <button type="button" class="action" data-menu="pnl">PnL</button>
      <button type="button" class="action" data-menu="activity">Activity</button>
      <button type="button" class="action" data-menu="risk">Settings</button>
      <button type="button" class="action" data-menu="dev">Smart Dev Follow</button>
      <button type="button" class="action" data-menu="learn">Learn</button>
      <button type="button" class="action" data-menu="referral">Referral</button>
      <button type="button" class="action" data-menu="support">Support</button>
    </div></div>`;
}
