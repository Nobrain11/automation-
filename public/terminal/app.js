/** PUMP AUTO terminal — polished welcome + real data only */

let state = {
  tab: "home",
  dash: null,
  pulse: null,
  trending: null,
  trendCat: "movers",
  menuView: null
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) {
    showGate();
    throw new Error("unauthorized");
  }
  return res.json();
}

function showGate() {
  document.getElementById("gate").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}
function showApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function short(a) {
  if (!a || a.length < 10) return a || "—";
  return a.slice(0, 4) + "…" + a.slice(-4);
}
function fmtNum(n, d = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(d);
}
function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.0001) return "$" + v.toFixed(4);
  return "$" + v.toExponential(2);
}
function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function hunterLabel(s) {
  if (!s) return "● CONNECTING";
  if (s.state === "hunting") return "● HUNTING";
  if (s.state === "paused") return "● PAUSED";
  if (s.state === "stopped_kill") return "● STOPPED";
  return "● READY";
}

function systemStatus(d) {
  if (!d) return { text: "● CONNECTING", cls: "connecting" };
  if (d.hunter?.state === "hunting") return { text: "● HUNTING", cls: "ready" };
  if (d.hunter?.state === "stopped_kill") return { text: "● STOPPED", cls: "off" };
  if (d.wallet?.connected) return { text: "● SYSTEM READY", cls: "ready" };
  return { text: "● CONNECTING", cls: "connecting" };
}

function updateTopbar(d) {
  if (!d) {
    document.getElementById("solMetric").textContent = "SOL —";
    document.getElementById("balMetric").textContent = "Bal —";
    document.getElementById("huntMetric").textContent = "● CONNECTING";
    return;
  }
  document.getElementById("solMetric").textContent =
    d.sol && d.sol.price != null ? `SOL $${d.sol.price.toFixed(2)}` : "SOL —";
  document.getElementById("balMetric").textContent =
    d.wallet.balanceSol == null
      ? "Bal —"
      : `Bal ${d.wallet.balanceSol.toFixed(4)}`;
  document.getElementById("huntMetric").textContent = hunterLabel(d.hunter);
}

function gradeClass(g) {
  if (g === "A" || g === "B") return "grade-good";
  if (g === "C") return "grade-mid";
  return "grade-bad";
}

function tokenCard(t) {
  const mint = t.mint || "";
  const sym = (t.symbol || "???").replace(/[<>"']/g, "");
  const name = (t.name || "").replace(/[<>"']/g, "");
  const price = t.priceUsd != null ? fmtUsd(t.priceUsd) : "—";
  const mcap = t.marketCap != null ? fmtUsd(t.marketCap) : "—";
  const liq =
    t.liquidityUsd != null
      ? fmtUsd(t.liquidityUsd)
      : t.liquiditySol != null
        ? fmtNum(t.liquiditySol, 3) + " SOL"
        : "—";
  const chg =
    t.priceChange5m != null
      ? fmtPct(t.priceChange5m)
      : t.priceChange24h != null
        ? fmtPct(t.priceChange24h)
        : "—";
  const chgClass =
    (t.priceChange5m ?? t.priceChange24h) == null
      ? ""
      : (t.priceChange5m ?? t.priceChange24h) >= 0
        ? "ok"
        : "bad";

  const rev = t.review;
  const grade = rev?.grade
    ? `<span class="grade ${gradeClass(rev.grade)}">${rev.grade} ${rev.score}</span>`
    : "";
  const badges = [];
  if (t.isPump) badges.push('<span class="badge pump">PUMP</span>');
  if (rev?.labels?.length)
    badges.push(
      ...rev.labels
        .slice(0, 2)
        .map((l) => `<span class="badge">${String(l).replace(/[<>]/g, "")}</span>`)
    );
  const riskLine =
    rev?.risks?.length
      ? `<div class="risks">⚠ ${rev.risks.slice(0, 2).join(" · ")}</div>`
      : "";
  const summary = rev?.summary
    ? `<div class="review-sum">${String(rev.summary).replace(/[<>]/g, "")}</div>`
    : "";

  const img = t.imageUrl
    ? `<img class="tok-img" src="${t.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="tok-img placeholder">$</div>`;

  return `
    <div class="token" data-mint="${mint}" data-symbol="${sym}">
      <div class="token-head">
        ${img}
        <div class="token-id">
          <div class="sym-row">
            <span class="sym">$${sym}</span>
            ${grade}
          </div>
          <div class="name-row">${name || "—"}</div>
          <div class="badge-row">${badges.join("")}</div>
        </div>
        <div class="age ${chgClass}">${chg}</div>
      </div>
      <div class="metrics">
        <div>price <b>${price}</b></div>
        <div>mcap <b>${mcap}</b></div>
        <div>liq <b>${liq}</b></div>
      </div>
      ${summary}
      ${riskLine}
      <div class="mint">${mint}</div>
      <div class="token-actions">
        <button type="button" class="action ghost tok-analyze">ANALYZE</button>
        <button type="button" class="action primary tok-buy">TRADE</button>
        <button type="button" class="action ghost tok-copy">COPY CA</button>
      </div>
    </div>`;
}

function previewTokens(tr) {
  if (!tr || !tr.online) {
    return `<div class="offline-banner">MARKET DATA OFFLINE${tr?.error ? " — " + tr.error : ""}</div>`;
  }
  const items = (tr.movers || tr.trending || []).slice(0, 3);
  if (!items.length) return `<div class="empty">No data available</div>`;
  return items.map((t) => tokenCard(t)).join("");
}

function renderHome(d) {
  const sys = systemStatus(d);
  const h = d.hunter || {};
  const s = d.settings || {};
  const posCount = (d.positions || []).length;
  const hunt = hunterLabel(h);
  const autoBtn =
    h.state === "hunting"
      ? `<button type="button" class="action danger" id="btnHomeStopHunt">STOP AUTOMATION</button>`
      : s.maxBuy != null
        ? `<button type="button" class="action primary" id="btnHomeStartHunt">START AUTOMATION</button>`
        : `<button type="button" class="action primary" data-go="automation">CONFIGURE AUTOMATION</button>`;

  return `
    <section class="welcome panel">
      <div class="welcome-mark">⚡ PUMP AUTO</div>
      <div class="welcome-sub">SOLANA TRADING TERMINAL</div>
      <p class="welcome-lead">Automated discovery, analysis and execution for Solana markets.</p>
      <div class="sys-status ${sys.cls}">${sys.text}</div>
      <p class="welcome-body">Welcome to PUMP AUTO.<br/>
      Your trading workspace for discovering opportunities, managing positions and running automated strategies from one place.</p>
      <div class="primary-actions">
        <button type="button" class="action primary" data-go="trending">🔎 EXPLORE TRENDING</button>
        <button type="button" class="action primary" data-go="automation">🤖 OPEN AUTOMATION</button>
      </div>
      <div class="secondary-actions">
        <button type="button" class="action" data-go="trade">⚡ TRADE</button>
        <button type="button" class="action" data-go="positions">📊 POSITIONS</button>
      </div>
    </section>

    <div class="workspace-grid">
      <div class="ws-card">
        <div class="label">TRENDING</div>
        <p>Discover tokens and market momentum.</p>
        <button type="button" class="action" data-go="trending">VIEW TRENDING</button>
      </div>
      <div class="ws-card">
        <div class="label">AUTOMATION</div>
        <p>Configure and monitor Auto-Hunter.</p>
        <div class="ws-meta">Status: ${hunt}</div>
        <button type="button" class="action" data-go="automation">OPEN AUTOMATION</button>
      </div>
      <div class="ws-card">
        <div class="label">PORTFOLIO</div>
        <p>View positions, balances and PnL.</p>
        <div class="ws-meta">Open: ${posCount}</div>
        <button type="button" class="action" data-go="positions">VIEW POSITIONS</button>
      </div>
    </div>

    <div class="panel">
      <h2>🤖 AUTO-HUNTER</h2>
      <p class="muted">Automated token discovery and strategy execution.</p>
      <div class="ws-meta">STATUS\n${hunt}\n\nSTRATEGY\nBalanced\n\nDAILY LOSS CAP\n${s.dailyLossCap != null ? s.dailyLossCap + " SOL" : "Not configured"}\n\nOPEN POSITIONS\n${posCount}</div>
      ${autoBtn}
    </div>

    <div class="panel">
      <h2>🔥 TRENDING</h2>
      <p class="muted">Solana opportunities from pump.fun market feeds.</p>
      ${previewTokens(state.trending)}
      <div class="row">
        <button type="button" class="action" data-go="trending">VIEW ALL TRENDING</button>
      </div>
    </div>`;
}

function trendListForCat(tr) {
  if (!tr) return [];
  const cat = state.trendCat;
  if (cat === "momentum") return tr.momentum || [];
  if (cat === "gainers") return tr.gainers || [];
  if (cat === "liquidity") return tr.liquidity || [];
  if (cat === "scored") return tr.scored || [];
  if (cat === "new") return tr.newPairs || [];
  if (cat === "passed") return tr.passed || [];
  if (cat === "movers") return tr.movers || tr.trending || [];
  return tr.trending || [];
}

function renderTrending(d, tr) {
  const items = trendListForCat(tr);
  const offline = !tr || !tr.online;
  const list = items.length
    ? items.map((t) => tokenCard(t)).join("")
    : `<div class="empty">No tokens in this category right now.</div>`;

  const cats = [
    ["movers", "MOVERS"],
    ["new", "NEW"],
    ["scored", "SCORED"],
    ["passed", "PASSED"]
  ];

  return `
    <div class="panel">
      <h1>TRENDING</h1>
      <p class="muted">pump.fun movers · micro-cap focus · real feeds only.</p>
      ${offline ? `<div class="offline-banner">MARKET DATA OFFLINE${tr?.error ? " — " + tr.error : ""}</div>` : `<div class="muted">Source: ${tr?.source || "pump.fun"}</div>`}
      <div class="chips">
        ${cats
          .map(
            ([id, label]) =>
              `<button type="button" class="chip${state.trendCat === id ? " active" : ""}" data-cat="${id}">${label}</button>`
          )
          .join("")}
      </div>
      ${list}
    </div>`;
}

function renderAutomation(d) {
  const h = d.hunter || {};
  const s = d.settings || {};
  const hunt = hunterLabel(h);
  const running = h.state === "hunting";
  return `
    <div class="panel">
      <h1>AUTOMATION</h1>
      <p class="muted">Auto-Hunter discovers and evaluates tokens against your risk settings.</p>
      <div class="ws-meta">STATUS\n${hunt}\n\nMAX BUY\n${s.maxBuy ?? "—"} SOL\nSLIPPAGE\n${s.slippage ?? "—"}%\nSTOP LOSS\n${s.stopLoss ?? "—"}%\nDAILY LOSS CAP\n${s.dailyLossCap ?? "—"} SOL\nOPEN POSITIONS\n${(d.positions || []).length}</div>
      <div class="row">
        ${running
          ? `<button type="button" class="action danger" id="btnStopHunt">STOP HUNTER</button>`
          : `<button type="button" class="action primary" id="btnStartHunt">START HUNTER</button>`}
        ${h.killSwitch
          ? `<button type="button" class="action" id="btnClearKill">CLEAR KILL</button>`
          : `<button type="button" class="action danger" id="btnKill">EMERGENCY STOP</button>`}
      </div>
    </div>
    <div class="panel">
      <h2>ACTIVITY</h2>
      <div id="autoActivity"><div class="empty">No trades yet</div></div>
    </div>`;
}

function renderTrade(d) {
  const s = d.settings || {};
  return `
    <div class="panel">
      <h1>TRADE</h1>
      <p class="muted">Manual buy by contract address. Amount uses your Max Buy setting unless overridden.</p>
      <label class="field">Mint / CA<input id="inMint" type="text" placeholder="Token mint address" autocomplete="off" /></label>
      <label class="field">Amount SOL (optional)<input id="inAmt" type="number" step="0.01" min="0" placeholder="${s.maxBuy ?? 0.1}" /></label>
      <button type="button" class="action primary" id="btnManualBuy">BUY</button>
    </div>
    <div class="panel">
      <h2>RISK DEFAULTS</h2>
      <label class="field">Max buy (SOL)<input id="inMaxBuy" type="number" step="0.01" min="0" value="${s.maxBuy ?? 0.1}" /></label>
      <label class="field">Slippage %<input id="inSlip" type="number" step="1" value="${s.slippage ?? 20}" /></label>
      <label class="field">Stop loss %<input id="inSl" type="number" step="1" value="${s.stopLoss ?? 20}" /></label>
      <label class="field">Daily cap (SOL)<input id="inCap" type="number" step="0.05" min="0" value="${s.dailyLossCap ?? 0.5}" /></label>
      <button type="button" class="action primary" id="btnSaveSettings">Save</button>
    </div>`;
}

function renderPositions(d) {
  const positions = d.positions || [];
  if (!positions.length)
    return `<div class="panel"><h1>POSITIONS</h1><div class="empty">No open positions</div></div>`;
  return `<div class="panel"><h1>POSITIONS</h1>${positions
    .map(
      (p) => `<div class="pos-card" data-id="${p.id}">
      <div class="pos-top">$${p.symbol || short(p.mint)}</div>
      <div class="pos-meta">${p.entrySol} SOL · ${short(p.signature)}\n${p.mint}</div>
      <button type="button" class="action danger sell-btn">SELL 100%</button>
    </div>`
    )
    .join("")}</div>`;
}

function renderMenu(d) {
  if (state.menuView === "status") {
    const sc = d.scanner || {};
    return `<div class="panel"><h1>STATUS</h1><div class="mono">${hunterLabel(d.hunter)}\nScanner ${sc.running ? "LIVE" : "OFF"}\nDisc ${sc.discovered ?? 0} · Pass ${sc.passed ?? 0}\nWallet ${d.wallet?.connected ? short(d.wallet.address) : "—"}</div>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "wallet") {
    return `<div class="panel"><h1>WALLET</h1><div class="mono">${d.wallet?.connected ? d.wallet.address : "Not connected"}\nBal ${d.wallet?.balanceSol == null ? "—" : d.wallet.balanceSol.toFixed(4) + " SOL"}</div>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "pnl") {
    return `<div class="panel"><h1>PNL</h1><div class="mono">${d.pnl?.note || "No data"}</div>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "risk") {
    const s = d.settings || {};
    return `<div class="panel"><h1>RISK CENTER</h1><div class="mono">Max buy ${s.maxBuy ?? "—"} SOL\nSlippage ${s.slippage ?? "—"}%\nStop loss ${s.stopLoss ?? "—"}%\nDaily cap ${s.dailyLossCap ?? "—"} SOL\nMax trades/hr ${s.maxTradesHour ?? "—"}\nMax trades/day ${s.maxTradesDay ?? "—"}</div>
      <button type="button" class="action" data-go="trade">Edit in Trade</button>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
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
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "learn") {
    return `<div class="panel"><h1>LEARN</h1><p class="muted">PUMP AUTO discovers early Solana tokens, scores them against your filters, and can execute buys/sells with your risk limits.</p>
      <p class="muted">Start with TRENDING for manual discovery, or AUTOMATION for Auto-Hunter.</p>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "referral") {
    const r = d.referral;
    return `<div class="panel"><h1>REFERRAL</h1><div class="mono">${r ? `Code ${r.code}\nReferred ${r.referredCount}\nEarned ${r.totalEarnedSol} SOL` : "Not configured"}</div>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }
  if (state.menuView === "support") {
    return `<div class="panel"><h1>SUPPORT</h1><p class="muted">Use Telegram bot commands for wallet export and emergency controls. Never share private keys.</p>
      <button type="button" class="action ghost" data-menu-back>← Menu</button></div>`;
  }

  return `<div class="panel"><h1>MENU</h1><div class="menu-list">
    <button type="button" class="action" data-menu="wallet">Wallet</button>
    <button type="button" class="action" data-menu="pnl">PnL</button>
    <button type="button" class="action" data-menu="risk">Risk Center</button>
    <button type="button" class="action" data-menu="activity">Activity</button>
    <button type="button" class="action" data-go="trade">Settings / Trade</button>
    <button type="button" class="action" data-menu="status">Status</button>
    <button type="button" class="action" data-menu="learn">Learn</button>
    <button type="button" class="action" data-menu="referral">Referral</button>
    <button type="button" class="action" data-menu="support">Support</button>
    <button type="button" class="action danger" id="btnMenuKill">Emergency Stop</button>
    <button type="button" class="action ghost" id="btnLogout">Logout</button>
  </div></div>`;
}

function render() {
  const d = state.dash || {
    wallet: {},
    hunter: {},
    scanner: {},
    settings: {},
    positions: [],
    trades: [],
    pnl: {}
  };
  const ws = document.getElementById("workspace");
  updateTopbar(state.dash);

  if (state.tab === "home") ws.innerHTML = renderHome(d);
  else if (state.tab === "trending")
    ws.innerHTML = renderTrending(d, state.trending);
  else if (state.tab === "automation") ws.innerHTML = renderAutomation(d);
  else if (state.tab === "trade") ws.innerHTML = renderTrade(d);
  else if (state.tab === "positions") ws.innerHTML = renderPositions(d);
  else if (state.tab === "menu") ws.innerHTML = renderMenu(d);

  if (state.tab === "automation") {
    const act = document.getElementById("autoActivity");
    if (act) {
      const trades = d.trades || [];
      if (trades.length) {
        act.innerHTML = trades
          .slice(0, 20)
          .map((t) => {
            const tms = new Date(t.createdAt).toLocaleTimeString();
            return `<div class="feed-line"><b>${tms}</b> · ${t.side.toUpperCase()} ${t.status} · ${short(t.mint)} · ${t.amountSol} SOL</div>`;
          })
          .join("");
      } else act.innerHTML = `<div class="empty">No trades yet</div>`;
    }
  }

  bindWorkspaceEvents();
  bindTokenActions(ws);
}

function bindTokenActions(root) {
  root.querySelectorAll(".tok-copy").forEach((btn) => {
    btn.onclick = async () => {
      const mint = btn.closest(".token")?.dataset.mint;
      if (!mint) return;
      try {
        await navigator.clipboard.writeText(mint);
        btn.textContent = "COPIED";
        setTimeout(() => (btn.textContent = "COPY CA"), 1200);
      } catch {
        prompt("Copy mint", mint);
      }
    };
  });
  root.querySelectorAll(".tok-analyze").forEach((btn) => {
    btn.onclick = () => {
      const mint = btn.closest(".token")?.dataset.mint;
      if (!mint) return;
      window.open(`https://pump.fun/coin/${mint}`, "_blank");
    };
  });
  root.querySelectorAll(".tok-buy").forEach((btn) => {
    btn.onclick = async () => {
      const card = btn.closest(".token");
      const mint = card?.dataset.mint;
      const symbol = card?.dataset.symbol;
      if (!mint) return;
      if (!confirm(`Buy ${symbol || short(mint)} with Max Buy?`)) return;
      btn.disabled = true;
      try {
        const r = await api("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify({ mint, symbol })
        });
        if (r.ok) {
          alert("Submitted: " + (r.signature || "ok"));
          await refresh();
        } else alert(r.error || "Buy failed");
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        btn.disabled = false;
      }
    };
  });
}

function bindWorkspaceEvents() {
  document.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => setTab(el.getAttribute("data-go"));
  });
  document.querySelectorAll("[data-cat]").forEach((el) => {
    el.onclick = () => {
      state.trendCat = el.getAttribute("data-cat");
      render();
    };
  });
  document.querySelectorAll("[data-menu]").forEach((el) => {
    el.onclick = () => {
      state.menuView = el.getAttribute("data-menu");
      render();
    };
  });
  document.querySelectorAll("[data-menu-back]").forEach((el) => {
    el.onclick = () => {
      state.menuView = null;
      render();
    };
  });

  const start = document.getElementById("btnStartHunt");
  const startHome = document.getElementById("btnHomeStartHunt");
  const stop = document.getElementById("btnStopHunt");
  const stopHome = document.getElementById("btnHomeStopHunt");
  const kill = document.getElementById("btnKill");
  const clearKill = document.getElementById("btnClearKill");
  const menuKill = document.getElementById("btnMenuKill");

  async function doStart() {
    const r = await api("/api/hunter/start", { method: "POST" });
    if (!r.ok) alert(r.error || "Failed");
    await refresh();
  }
  async function doStop() {
    await api("/api/hunter/stop", { method: "POST" });
    await refresh();
  }
  async function doKill() {
    if (!confirm("Emergency stop automation?")) return;
    await api("/api/hunter/kill", { method: "POST" });
    await refresh();
  }

  if (start) start.onclick = doStart;
  if (startHome) startHome.onclick = doStart;
  if (stop) stop.onclick = doStop;
  if (stopHome) stopHome.onclick = doStop;
  if (kill) kill.onclick = doKill;
  if (menuKill) menuKill.onclick = doKill;
  if (clearKill)
    clearKill.onclick = async () => {
      await api("/api/hunter/clear-kill", { method: "POST" });
      await refresh();
    };

  const logout = document.getElementById("btnLogout");
  if (logout)
    logout.onclick = async () => {
      await api("/api/logout", { method: "POST" });
      showGate();
    };

  const save = document.getElementById("btnSaveSettings");
  if (save)
    save.onclick = async () => {
      const body = {
        max_buy: Number(document.getElementById("inMaxBuy").value),
        slippage: Number(document.getElementById("inSlip").value),
        stop_loss: Number(document.getElementById("inSl").value),
        daily_loss_cap: Number(document.getElementById("inCap").value)
      };
      const r = await api("/api/settings", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!r.ok) alert(r.error || "Save failed");
      await refresh();
    };

  const buy = document.getElementById("btnManualBuy");
  if (buy)
    buy.onclick = async () => {
      const mint = document.getElementById("inMint").value.trim();
      const amtRaw = document.getElementById("inAmt").value;
      if (!mint) return alert("Mint required");
      const body = { mint };
      if (amtRaw) body.amountSol = Number(amtRaw);
      buy.disabled = true;
      try {
        const r = await api("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify(body)
        });
        if (r.ok) {
          alert("Submitted: " + (r.signature || "ok"));
          await refresh();
        } else alert(r.error || "Buy failed");
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        buy.disabled = false;
      }
    };

  document.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest(".pos-card")?.dataset.id);
      if (!id) return;
      if (!confirm("Sell 100%?")) return;
      btn.disabled = true;
      try {
        const r = await api("/api/trade/sell", {
          method: "POST",
          body: JSON.stringify({ positionId: id })
        });
        if (r.ok) {
          alert("Sell submitted: " + (r.signature || "ok"));
          await refresh();
        } else alert(r.error || "Sell failed");
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        btn.disabled = false;
      }
    };
  });
}

function setTab(tab) {
  state.tab = tab;
  if (tab !== "menu") state.menuView = null;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  render();
  if (tab === "trending" || tab === "home") {
    api("/api/trending")
      .then((t) => {
        state.trending = t;
        if (state.tab === tab) render();
      })
      .catch(() => {});
  }
}

async function refresh() {
  try {
    state.dash = await api("/api/dashboard");
    state.pulse = await api("/api/pulse");
    if (state.tab === "trending" || state.tab === "home" || !state.trending) {
      state.trending = await api("/api/trending");
    }
    render();
  } catch {}
}

async function boot() {
  try {
    await api("/api/me");
    showApp();
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.onclick = () => setTab(b.dataset.tab);
    });
    await refresh();
  } catch {
    showGate();
  }
}

boot();
setInterval(() => {
  if (document.getElementById("app").classList.contains("hidden")) return;
  refresh();
}, 12000);
