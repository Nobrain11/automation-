/** PUMP AUTO terminal — production UI */

let state = {
  tab: "home",
  dash: null,
  pulse: null,
  trending: null,
  trendCat: "trending",
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

function ageLabel(sec) {
  if (sec == null) return "—";
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  return Math.floor(sec / 3600) + "h";
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
  const sign = v >= 0 ? "+" : "";
  return sign + v.toFixed(1) + "%";
}

function hunterLabel(s) {
  if (!s) return "● READY";
  if (s.state === "hunting") return "● HUNTING";
  if (s.state === "paused") return "● PAUSED";
  if (s.state === "stopped_kill") return "● STOPPED";
  return "● READY";
}

function updateTopbar(d) {
  if (!d) return;
  document.getElementById("solMetric").textContent =
    d.sol && d.sol.price != null ? `SOL $${d.sol.price.toFixed(2)}` : "SOL —";
  document.getElementById("balMetric").textContent =
    d.wallet.balanceSol == null
      ? "Bal —"
      : `Bal ${d.wallet.balanceSol.toFixed(4)}`;
  document.getElementById("huntMetric").textContent = hunterLabel(d.hunter);
}

function tokenCard(t) {
  const mint = t.mint || "";
  const sym = (t.symbol || "???").replace(/[<>"']/g, "");
  const name = (t.name || "").replace(/[<>"']/g, "");
  const price = t.priceUsd != null ? fmtUsd(t.priceUsd) : "—";
  const mcap = t.marketCap != null ? fmtUsd(t.marketCap) : "—";
  const liqUsd = t.liquidityUsd != null ? fmtUsd(t.liquidityUsd) : null;
  const liqSol =
    t.liquiditySol != null ? fmtNum(t.liquiditySol, 3) + " SOL" : null;
  const liq = liqUsd || liqSol || "—";
  const vol = t.volume24h != null ? fmtUsd(t.volume24h) : "—";
  const chg = t.priceChange24h != null ? fmtPct(t.priceChange24h) : "—";
  const chgClass =
    t.priceChange24h == null ? "" : t.priceChange24h >= 0 ? "ok" : "bad";
  const mom =
    t.priceChange5m != null
      ? fmtPct(t.priceChange5m) + " 5m"
      : t.priceChange1h != null
        ? fmtPct(t.priceChange1h) + " 1h"
        : "—";
  const reasons =
    t.reasons && t.reasons.length
      ? `<div class="reasons">${t.reasons.slice(0, 2).join(" · ")}</div>`
      : "";

  return `
    <div class="token" data-mint="${mint}" data-symbol="${sym}">
      <div class="token-top">
        <div class="sym">$${sym}<span>${name}</span></div>
        <div class="age ${chgClass}">${chg}</div>
      </div>
      <div class="metrics">
        <div>price <b>${price}</b></div>
        <div>mcap <b>${mcap}</b></div>
        <div>liq <b>${liq}</b></div>
        <div>vol 24h <b>${vol}</b></div>
        <div>mom <b>${mom}</b></div>
        <div>age <b>${ageLabel(t.ageSeconds)}</b></div>
      </div>
      ${reasons}
      <div class="mint">${mint}</div>
      <div class="token-actions">
        <button type="button" class="action ghost copy-ca">Copy CA</button>
        <button type="button" class="action primary buy-btn">BUY</button>
      </div>
    </div>`;
}

function bindTokenActions(root) {
  root.querySelectorAll(".copy-ca").forEach((btn) => {
    btn.onclick = async () => {
      const mint = btn.closest(".token")?.dataset.mint;
      if (!mint) return;
      try {
        await navigator.clipboard.writeText(mint);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy CA"), 1200);
      } catch {
        alert(mint);
      }
    };
  });
  root.querySelectorAll(".buy-btn").forEach((btn) => {
    btn.onclick = async () => {
      const card = btn.closest(".token");
      const mint = card?.dataset.mint;
      const symbol = card?.dataset.symbol;
      if (!mint) return;
      const size =
        Number(document.getElementById("inMaxBuy")?.value) ||
        state.dash?.settings?.maxBuy ||
        0.1;
      if (!confirm(`Buy $${symbol} with ${size} SOL?`)) return;
      btn.disabled = true;
      btn.textContent = "…";
      try {
        const r = await api("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify({ mint, amountSol: size, symbol })
        });
        if (r.ok) {
          alert("Submitted: " + (r.signature || "ok"));
          await refresh();
        } else alert(r.error || "Buy failed");
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        btn.disabled = false;
        btn.textContent = "BUY";
      }
    };
  });
}

function renderHome(d) {
  const sc = d.scanner || {};
  const h = d.hunter || {};
  return `
    <div class="panel">
      <h1>COMMAND CENTER</h1>
      <div class="mono">${hunterLabel(h)}
Scanner: ${sc.running ? "LIVE" : "OFF"}
Discovered ${sc.discovered ?? 0} · Evaluated ${sc.evaluated ?? 0}
Passed ${sc.passed ?? 0} · Rejected ${sc.rejected ?? 0}
Open positions: ${(d.positions || []).length}
Wallet: ${d.wallet?.connected ? short(d.wallet.address) : "Not connected"}
Balance: ${d.wallet?.balanceSol == null ? "—" : d.wallet.balanceSol.toFixed(4) + " SOL"}</div>
      <div class="row">
        <button type="button" class="action primary" data-go="automation">Automation</button>
        <button type="button" class="action" data-go="trending">Trending</button>
        <button type="button" class="action" data-go="positions">Positions</button>
      </div>
    </div>
    <div class="panel">
      <h2>PIPELINE</h2>
      <div class="pipeline">
        <span>DISCOVER</span><span class="arrow">↓</span>
        <span>FILTER</span><span class="arrow">↓</span>
        <span>ANALYZE</span><span class="arrow">↓</span>
        <span>SCORE</span><span class="arrow">↓</span>
        <span>RISK</span><span class="arrow">↓</span>
        <span>ENTRY</span><span class="arrow">↓</span>
        <span>MONITOR</span><span class="arrow">↓</span>
        <span>EXIT</span>
      </div>
      <p class="muted">Trending does not auto-trade. Automation only enters after filters + risk.</p>
    </div>`;
}

function trendListForCat(tr) {
  if (!tr) return [];
  const cat = state.trendCat;
  if (cat === "momentum") return tr.momentum || [];
  if (cat === "gainers") return tr.gainers || [];
  if (cat === "liquidity") return tr.liquidity || [];
  if (cat === "new") return tr.newPairs || [];
  if (cat === "passed") return tr.passed || [];
  return tr.trending || [];
}

function renderTrending(d, tr) {
  const cat = state.trendCat;
  const items = trendListForCat(tr);
  const offline = !tr || !tr.online;
  const list = items.length
    ? items.map((t) => tokenCard(t)).join("")
    : `<div class="empty">No tokens in this category right now.</div>`;

  return `
    <div class="panel">
      <h1>TRENDING</h1>
      <p class="muted">LIVE MARKET DISCOVERY · DexScreener + pump scanner.</p>
      ${offline ? `<div class="offline-banner">MARKET DATA OFFLINE${tr?.error ? " — " + tr.error : ""}</div>` : `<div class="muted">Source: ${tr?.source || "—"}</div>`}
      <div class="chips">
        <button type="button" class="chip ${cat === "trending" ? "active" : ""}" data-cat="trending">🔥 TRENDING</button>
        <button type="button" class="chip ${cat === "momentum" ? "active" : ""}" data-cat="momentum">⚡ MOMENTUM</button>
        <button type="button" class="chip ${cat === "gainers" ? "active" : ""}" data-cat="gainers">📈 GAINERS</button>
        <button type="button" class="chip ${cat === "new" ? "active" : ""}" data-cat="new">🆕 NEW</button>
        <button type="button" class="chip ${cat === "liquidity" ? "active" : ""}" data-cat="liquidity">💧 LIQUIDITY</button>
        <button type="button" class="chip ${cat === "passed" ? "active" : ""}" data-cat="passed">✓ QUALIFIED</button>
      </div>
    </div>
    <div class="panel">
      <h2>${cat.toUpperCase()} · ${items.length}</h2>
      <div id="trendList">${list}</div>
    </div>`;
}

function renderAutomation(d) {
  const sc = d.scanner || {};
  const s = d.settings || {};
  const h = d.hunter || {};
  const hunting = h.state === "hunting";

  return `
    <div class="panel">
      <h1>AUTOMATION</h1>
      <p class="muted">AUTO-HUNTER</p>
      <div class="mono">${hunterLabel(h)}
Scanner: ${sc.running ? "LIVE" : "OFF"}
Tokens scanned: ${sc.evaluated ?? 0}
Qualified: ${sc.passed ?? 0}
Open positions: ${(d.positions || []).length}
Daily loss cap: ${s.dailyLossCap ?? "—"} SOL
Strategy: filter pass → Jupiter · monitor exits</div>
      <div class="row">
        ${
          hunting
            ? `<button type="button" class="action warn" id="btnStopHunt">PAUSE AUTOMATION</button>`
            : `<button type="button" class="action primary" id="btnStartHunt">START AUTOMATION</button>`
        }
        <button type="button" class="action danger" id="btnKillHunt">EMERGENCY STOP</button>
        ${h.killSwitch ? `<button type="button" class="action ghost" id="btnClearKill">Clear Kill</button>` : ""}
      </div>
    </div>

    <div class="panel">
      <h2>PIPELINE</h2>
      <div class="pipeline">
        <span>DISCOVER</span><span class="arrow">↓</span>
        <span>FILTER</span><span class="arrow">↓</span>
        <span>ANALYZE</span><span class="arrow">↓</span>
        <span>SCORE</span><span class="arrow">↓</span>
        <span>RISK CHECK</span><span class="arrow">↓</span>
        <span>ENTRY</span><span class="arrow">↓</span>
        <span>MONITOR</span><span class="arrow">↓</span>
        <span>EXIT</span>
      </div>
    </div>

    <div class="panel">
      <h2>SETTINGS</h2>
      <div class="setting-row"><span>Buy amount</span><b>${s.maxBuy} SOL</b></div>
      <div class="setting-row"><span>Slippage</span><b>${s.slippage}%</b></div>
      <div class="setting-row"><span>Stop loss</span><b>-${s.stopLoss}%</b></div>
      <div class="setting-row"><span>Trailing after</span><b>+${s.trailingAfter}%</b></div>
      <div class="setting-row"><span>Trailing pullback</span><b>${s.trailingPullback}%</b></div>
      <div class="setting-row"><span>Time stop</span><b>${s.timeStopMinutes} min</b></div>
      <div class="setting-row"><span>Daily loss cap</span><b>${s.dailyLossCap} SOL</b></div>
      <div class="setting-row"><span>Max trades / hour</span><b>${s.maxTradesHour}</b></div>
      <div class="setting-row"><span>Max trades / day</span><b>${s.maxTradesDay}</b></div>
      <div class="setting-row"><span>Smart money boost</span><b>${s.smartMoneyBoost ? "ON" : "OFF"}</b></div>
    </div>

    <div class="panel">
      <h2>ACTIVITY</h2>
      <div id="autoActivity"></div>
    </div>`;
}

function renderTrade(d) {
  const s = d.settings || {};
  return `
    <div class="panel">
      <h1>TRADE</h1>
      <label class="field">Buy size (SOL)
        <input id="inMaxBuy" type="number" step="0.01" min="0.01" value="${s.maxBuy ?? 0.1}" />
      </label>
      <label class="field">Slippage %
        <input id="inSlip" type="number" step="1" min="1" value="${s.slippage ?? 20}" />
      </label>
      <label class="field">Stop loss %
        <input id="inSl" type="number" step="1" value="${s.stopLoss ?? 20}" />
      </label>
      <label class="field">Daily cap (SOL)
        <input id="inCap" type="number" step="0.05" min="0" value="${s.dailyLossCap ?? 0.5}" />
      </label>
      <button type="button" class="action primary" id="btnSaveSettings">Save</button>
    </div>`;
}

function renderPositions(d) {
  const positions = d.positions || [];
  if (!positions.length) {
    return `<div class="panel"><h1>POSITIONS</h1><div class="empty">No open positions</div></div>`;
  }
  return `
    <div class="panel">
      <h1>POSITIONS</h1>
      ${positions
        .map(
          (p) => `
        <div class="pos-card" data-id="${p.id}">
          <div class="pos-top">$${p.symbol || short(p.mint)}</div>
          <div class="pos-meta">${p.entrySol} SOL · ${short(p.signature)}\n${p.mint}</div>
          <button type="button" class="action danger sell-btn">SELL 100%</button>
        </div>`
        )
        .join("")}
    </div>`;
}

function renderMenu(d) {
  if (state.menuView === "status") {
    const sc = d.scanner || {};
    return `
      <div class="panel">
        <h1>STATUS</h1>
        <div class="mono">${hunterLabel(d.hunter)}
Scanner ${sc.running ? "LIVE" : "OFF"}
Disc ${sc.discovered} · Eval ${sc.evaluated} · Pass ${sc.passed}
Kill: ${d.hunter?.killSwitch ? "ON" : "OFF"}</div>
        <button type="button" class="action ghost" data-menu-back>← Menu</button>
      </div>`;
  }
  if (state.menuView === "wallet") {
    return `
      <div class="panel">
        <h1>WALLET</h1>
        <div class="mono">${d.wallet?.connected ? d.wallet.address : "Not connected"}
Balance: ${d.wallet?.balanceSol == null ? "—" : d.wallet.balanceSol.toFixed(4) + " SOL"}</div>
        <button type="button" class="action ghost" data-menu-back>← Menu</button>
      </div>`;
  }
  if (state.menuView === "pnl") {
    return `
      <div class="panel">
        <h1>PNL</h1>
        <div class="mono">${d.pnl?.note || "No trades yet"}</div>
        <button type="button" class="action ghost" data-menu-back>← Menu</button>
      </div>`;
  }
  return `
    <div class="panel">
      <h1>MENU</h1>
      <div class="menu-list">
        <button type="button" class="action" data-menu="wallet">Wallet</button>
        <button type="button" class="action" data-menu="pnl">PnL</button>
        <button type="button" class="action" data-menu="status">Status</button>
        <button type="button" class="action" data-go="trade">Trade params</button>
        <button type="button" class="action" data-go="automation">Automation</button>
        <button type="button" class="action danger" id="btnMenuKill">Emergency Stop</button>
        <button type="button" class="action ghost" id="btnLogout">Logout</button>
      </div>
    </div>`;
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
            const label =
              t.status === "submitted"
                ? `${t.side.toUpperCase()} ${t.status}`
                : `${t.side.toUpperCase()} ${t.status}`;
            return `<div class="feed-line"><b>${tms}</b> · ${label} · ${short(t.mint)} · ${t.amountSol} SOL${t.error ? " · " + t.error : ""}</div>`;
          })
          .join("");
      } else {
        const rows = (state.pulse?.newPairs || []).slice(0, 12);
        if (!rows.length) act.innerHTML = `<div class="empty">No activity yet</div>`;
        else
          act.innerHTML = rows
            .map((t) => {
              const tms = t.discoveredAt
                ? new Date(t.discoveredAt).toLocaleTimeString()
                : "—";
              const res = t.passed ? "FILTER PASSED" : "FILTER SKIP";
              return `<div class="feed-line"><b>${tms}</b> · ${res} · $${t.symbol || short(t.mint)}</div>`;
            })
            .join("");
      }
    }
  }

  bindWorkspaceEvents();
  bindTokenActions(ws);
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
  if (start)
    start.onclick = async () => {
      const r = await api("/api/hunter/start", { method: "POST" });
      if (!r.ok) alert(r.error || "Failed");
      await refresh();
    };
  const stop = document.getElementById("btnStopHunt");
  if (stop)
    stop.onclick = async () => {
      await api("/api/hunter/stop", { method: "POST" });
      await refresh();
    };
  const kill = document.getElementById("btnKillHunt");
  if (kill)
    kill.onclick = async () => {
      if (!confirm("Emergency stop blocks new auto entries.")) return;
      await api("/api/hunter/kill", { method: "POST" });
      await refresh();
    };
  const clear = document.getElementById("btnClearKill");
  if (clear)
    clear.onclick = async () => {
      await api("/api/hunter/clear-kill", { method: "POST" });
      await refresh();
    };
  const menuKill = document.getElementById("btnMenuKill");
  if (menuKill)
    menuKill.onclick = async () => {
      if (!confirm("Emergency stop?")) return;
      await api("/api/hunter/kill", { method: "POST" });
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

  document.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest(".pos-card")?.dataset.id);
      if (!id) return;
      if (!confirm("Sell 100% via Jupiter?")) return;
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
}

async function refresh() {
  try {
    state.dash = await api("/api/dashboard");
    state.pulse = await api("/api/pulse");
    if (state.tab === "trending" || !state.trending) {
      state.trending = await api("/api/trending");
    }
    render();
  } catch {
    /* gate */
  }
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
}, 8000);
