/** Token Terminal v2 — polished detail + real OHLCV spark when available */

function fmtUsdLocal(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  if (v >= 1) return "$" + v.toFixed(4);
  if (v >= 0.0001) return "$" + v.toFixed(6);
  return "$" + v.toExponential(2);
}

function shortLocal(a) {
  if (!a || a.length < 10) return a || "—";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

function ageLabelHours(hours) {
  if (hours == null) return "—";
  if (hours < 1) return Math.max(1, Math.round(hours * 60)) + "m";
  if (hours < 24) return hours.toFixed(1) + "h";
  return (hours / 24).toFixed(1) + "d";
}

function checkClass(status) {
  if (status === "safe" || status === "pass") return "ok";
  if (status === "warn" || status === "skip") return "";
  if (status === "bad" || status === "fail") return "bad";
  return "";
}

function checkMark(status) {
  if (status === "safe" || status === "pass") return "✓";
  if (status === "warn") return "⚠";
  if (status === "skip") return "○";
  if (status === "bad" || status === "fail") return "✗";
  return "?";
}

async function apiCall(path, opts) {
  if (typeof window.api === "function") return window.api(path, opts);
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  if (res.status === 401) throw new Error("unauthorized");
  return res.json();
}

/** Real candles from GeckoTerminal (public). Not DexScreener movers. */
async function fetchSparkCloses(mint) {
  try {
    const poolsRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!poolsRes.ok) return null;
    const poolsJson = await poolsRes.json();
    const pool = poolsJson?.data?.[0];
    const poolId = pool?.id; // e.g. solana_xxx
    if (!poolId) return null;
    const addr = poolId.includes("_") ? poolId.split("_").slice(1).join("_") : poolId;
    const ohlcvRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${addr}/ohlcv/minute?aggregate=5&limit=48`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!ohlcvRes.ok) return null;
    const ohlcvJson = await ohlcvRes.json();
    // list of [ts, open, high, low, close, volume]
    const list = ohlcvJson?.data?.attributes?.ohlcv_list || [];
    if (!list.length) return null;
    const closes = list.map((row) => Number(row[4])).filter((n) => Number.isFinite(n) && n > 0);
    if (closes.length < 3) return null;
    return { closes, pool: addr, source: "geckoterminal" };
  } catch {
    return null;
  }
}

function svgSpark(closes, w = 320, h = 88) {
  if (!closes || closes.length < 2) return "";
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || max * 0.01 || 1;
  const pad = 4;
  const pts = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
    const y = h - pad - ((c - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "#1dff9a" : "#ff4d62";
  const fill = up ? "rgba(29,255,154,0.12)" : "rgba(255,77,98,0.12)";
  const area = `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`;
  return `<svg class="v2-spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="${area}" fill="${fill}" />
    <polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
  </svg>`;
}

function wireBack(ws) {
  ws.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => {
      if (typeof setTab === "function") setTab(el.getAttribute("data-go"));
    };
  });
}

window.openToken = function openToken(mint) {
  return window.openTokenTerminal(mint, { backTab: state?.tab || "trending" });
};

window.openTokenTerminal = async function openTokenTerminal(mint, opts = {}) {
  const ws = document.getElementById("workspace");
  if (!ws || !mint) return;

  const backTab = opts.backTab || state?.tab || "trending";
  ws.innerHTML = `<div class="panel"><div class="empty">Loading token…</div></div>`;

  let data;
  try {
    data = await apiCall("/api/token?mint=" + encodeURIComponent(mint));
  } catch (e) {
    ws.innerHTML = `<div class="panel"><div class="empty">Failed to load</div>
      <button type="button" class="action" data-go="${backTab}">← Back</button></div>`;
    wireBack(ws);
    return;
  }

  if (!data || !data.ok) {
    ws.innerHTML = `<div class="panel"><div class="empty">${(data && data.error) || "Token not found"}</div>
      <button type="button" class="action" data-go="${backTab}">← Back</button></div>`;
    wireBack(ws);
    return;
  }

  const t = data.token || {};
  const m = data.market || {};
  const auto = data.automation || {};
  const checks = data.checks || [];
  const pos = data.yourPosition || { open: false, positions: [] };
  const trades = data.yourTrades || [];
  const settings = data.settings || {};
  const milestones = data.filterMilestones || [];
  const maxBuy = settings.maxBuy ?? 0.1;

  const img = t.imageUrl
    ? `<img class="desk-avatar" src="${t.imageUrl}" alt="" onerror="this.outerHTML='<div class=\\'desk-avatar\\'>${(t.symbol || "??").slice(0, 2)}</div>'" />`
    : `<div class="desk-avatar">${(t.symbol || "??").slice(0, 2)}</div>`;

  const posHtml = pos.open
    ? pos.positions
        .map(
          (p) =>
            `<div class="pos-card" data-id="${p.id}">
              <div class="pos-top">Entry ${p.entrySol} SOL</div>
              <div class="pos-meta">${shortLocal(p.signature)} · ${new Date(p.createdAt).toLocaleString()}
SL ${settings.stopLoss != null ? settings.stopLoss + "%" : "—"}</div>
              <button type="button" class="action danger sell-btn full">SELL 100%</button>
            </div>`
        )
        .join("")
    : `<div class="empty">No open position on this token</div>`;

  const actHtml = trades.length
    ? trades
        .slice(0, 12)
        .map((tr) => {
          const side = String(tr.side || "").toUpperCase();
          const cls = side === "BUY" ? "ok" : "bad";
          return `<div class="feed-line"><span class="${cls}">${side}</span> · ${tr.amountSol ?? "—"} SOL · ${tr.status || ""}</div>`;
        })
        .join("")
    : `<div class="empty">No trades on this token yet</div>`;

  const msHtml = milestones.length
    ? milestones
        .map(
          (c) =>
            `<div class="feed-line ${checkClass(c.status)}">${checkMark(c.status)} ${c.label} — ${c.detail}</div>`
        )
        .join("")
    : `<div class="empty">No scanner milestones for this mint</div>`;

  const insightHtml = checks.length
    ? checks
        .slice(0, 8)
        .map(
          (c) =>
            `<div class="feed-line ${checkClass(c.status)}">${checkMark(c.status)} ${c.label}: ${c.detail}</div>`
        )
        .join("")
    : "";

  ws.innerHTML = `
    <div class="tt-v2">
      <div class="tt-topbar">
        <button type="button" class="action ghost" data-go="${backTab}">← Back</button>
        <div class="tt-top-title">TOKEN</div>
        <a class="action ghost" href="${t.pairUrl || "https://pump.fun/coin/" + mint}" target="_blank" rel="noopener">pump.fun</a>
      </div>

      <div class="panel">
        <div class="desk-card-top">
          ${img}
          <div style="flex:1;min-width:0">
            <div class="desk-name-row">
              <span class="desk-name">$${t.symbol || "???"}</span>
              <span class="desk-sym">${t.name || ""}</span>
            </div>
            <div class="desk-ca">${shortLocal(t.mint || mint)}
              <button type="button" class="action ghost desk-copy" data-ca="${t.mint || mint}" style="padding:2px 6px;font-size:9px">COPY</button>
            </div>
          </div>
          <div class="desk-price-col">
            <div class="desk-price">${fmtUsdLocal(m.priceUsd)}</div>
            <div class="muted" style="font-size:10px">${auto.hunterScore != null ? "HS " + auto.hunterScore : ""}</div>
          </div>
        </div>
        <div class="desk-metrics">
          <div><span>MCAP</span><b>${fmtUsdLocal(m.marketCapUsd)}</b></div>
          <div><span>LIQ</span><b>${m.liquidityUsd != null ? fmtUsdLocal(m.liquidityUsd) : m.liquiditySol != null ? Number(m.liquiditySol).toFixed(2) + " SOL" : "—"}</b></div>
          <div><span>VOL</span><b>${m.volume24h != null ? fmtUsdLocal(m.volume24h) : "—"}</b></div>
          <div><span>AGE</span><b>${ageLabelHours(t.ageHours)}</b></div>
        </div>
      </div>

      <div class="panel">
        <h2>Chart · 5m</h2>
        <div id="ttSpark"><div class="empty">Loading candles…</div></div>
        <div class="muted" id="ttSparkNote" style="font-size:10px;margin-top:6px"></div>
      </div>

      <div class="panel">
        <h2>Buy</h2>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <button type="button" class="action ghost tt-preset" data-amt="0.05">0.05</button>
          <button type="button" class="action ghost tt-preset" data-amt="0.1">0.10</button>
          <button type="button" class="action ghost tt-preset" data-amt="0.25">0.25</button>
          <button type="button" class="action ghost tt-preset" data-amt="${maxBuy}">DEF</button>
        </div>
        <label class="field">Amount SOL
          <input id="ttAmt" type="number" step="0.01" min="0" value="${maxBuy}" />
        </label>
        <button type="button" class="action primary full" id="ttBuy">BUY $${t.symbol || shortLocal(mint)}</button>
        <div id="ttStatus" class="muted" style="margin-top:8px;font-family:var(--v2-mono,monospace);font-size:11px"></div>
      </div>

      <div class="panel">
        <h2>Your position</h2>
        ${posHtml}
      </div>

      <div class="panel">
        <h2>Checks</h2>
        ${insightHtml || msHtml}
      </div>

      <div class="panel">
        <h2>Filter milestones</h2>
        ${msHtml}
      </div>

      <div class="panel">
        <h2>Activity</h2>
        ${actHtml}
      </div>

      <div class="row">
        <a class="action ghost" href="${t.explorerUrl || "https://solscan.io/token/" + mint}" target="_blank" rel="noopener">Explorer</a>
        <button type="button" class="action ghost" data-go="${backTab}">← Back</button>
      </div>
    </div>`;

  wireBack(ws);

  // copy
  ws.querySelectorAll(".desk-copy").forEach((btn) => {
    btn.onclick = () => {
      const ca = btn.getAttribute("data-ca");
      if (ca) navigator.clipboard?.writeText(ca).catch(() => prompt("CA", ca));
    };
  });

  // presets
  ws.querySelectorAll(".tt-preset").forEach((btn) => {
    btn.onclick = () => {
      const a = btn.getAttribute("data-amt");
      const input = document.getElementById("ttAmt");
      if (input && a) input.value = a;
    };
  });

  // buy
  const buyBtn = document.getElementById("ttBuy");
  if (buyBtn) {
    buyBtn.onclick = async () => {
      const amt = Number(document.getElementById("ttAmt")?.value);
      const st = document.getElementById("ttStatus");
      if (!(amt > 0)) {
        if (st) st.textContent = "Enter amount";
        return;
      }
      if (st) st.textContent = "Submitting…";
      try {
        const r = await apiCall("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify({ mint, amountSol: amt, symbol: t.symbol })
        });
        if (st) {
          st.textContent = r?.ok
            ? "OK " + (r.signature || "")
            : r?.error || "Failed";
          st.className = r?.ok ? "ok" : "bad";
        }
        if (r?.ok && typeof refresh === "function") refresh();
      } catch (e) {
        if (st) st.textContent = String(e.message || e);
      }
    };
  }

  // sell handlers use existing global sell-btn wiring from app.js via refresh
  ws.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest(".pos-card")?.dataset?.id);
      if (!id) return;
      btn.disabled = true;
      try {
        const r = await apiCall("/api/trade/sell", {
          method: "POST",
          body: JSON.stringify({ positionId: id })
        });
        const st = document.getElementById("ttStatus");
        if (st) {
          st.textContent = r?.ok ? "Sold " + (r.signature || "") : r?.error || "Sell failed";
          st.className = r?.ok ? "ok" : "bad";
        }
        if (r?.ok) openTokenTerminal(mint, opts);
      } catch (e) {
        btn.disabled = false;
      }
    };
  });

  // load real spark
  (async () => {
    const box = document.getElementById("ttSpark");
    const note = document.getElementById("ttSparkNote");
    const spark = await fetchSparkCloses(mint);
    if (!box) return;
    if (spark?.closes?.length) {
      box.innerHTML = svgSpark(spark.closes);
      if (note) {
        const first = spark.closes[0];
        const last = spark.closes[spark.closes.length - 1];
        const pct = first ? (((last - first) / first) * 100).toFixed(2) : "—";
        note.textContent = `Real 5m OHLCV · ${spark.closes.length} pts · ${pct}% · GeckoTerminal pool`;
      }
    } else {
      box.innerHTML = `<div class="empty">No candle data for this pool yet</div>`;
      if (note) note.textContent = "Chart appears when a pool has public OHLCV";
    }
  })();
};
