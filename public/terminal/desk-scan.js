/**
 * Discover / SCAN surface — dense pro terminal cards (real data only).
 * Overrides tokenCard + renderTrending from app.js.
 */

function ageLabel(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const age = Date.now() - ms;
  if (age < 0) return "—";
  const m = Math.floor(age / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "h";
  return Math.floor(h / 24) + "d";
}

function pressurePct(t) {
  // engagement proxy until true buy/sell counts exist
  const score = t.review?.score ?? t.spikeScore ?? 40;
  return Math.max(8, Math.min(92, Math.round(Number(score))));
}

function tokenCard(t) {
  const sym = t.symbol || "???";
  const name = t.name || sym;
  const mint = t.mint || "";
  const price = t.priceUsd != null ? fmtUsd(t.priceUsd) : "—";
  const mcap = t.marketCap != null ? fmtUsd(t.marketCap) : "—";
  const liq =
    t.liquidityUsd != null
      ? fmtUsd(t.liquidityUsd)
      : t.liquiditySol != null
        ? Number(t.liquiditySol).toFixed(2) + " SOL"
        : "—";
  const vol =
    t.volume24h != null
      ? fmtUsd(t.volume24h)
      : t.volume1mUsd != null
        ? fmtUsd(t.volume1mUsd)
        : "—";
  const chgRaw =
    t.priceChange5m != null
      ? t.priceChange5m
      : t.priceChange1h != null
        ? t.priceChange1h
        : t.priceChange24h;
  const chg =
    chgRaw != null ? fmtPct(chgRaw) : t.spikeScore != null ? "SCR " + Math.round(t.spikeScore) : "—";
  const chgCls =
    chgRaw == null ? "" : chgRaw >= 0 ? "up" : "down";
  const age = ageLabel(t.pairCreatedAt ?? (t.discoveredAt ? Number(t.discoveredAt) : null));
  const badge = t.complete ? "GRAD" : "PUMP";
  const initials = (sym || "??").slice(0, 2).toUpperCase();
  const img = t.imageUrl
    ? `<img class="desk-avatar" src="${t.imageUrl}" alt="" onerror="this.outerHTML='<div class=\\'desk-avatar\\'>${initials}</div>'" />`
    : `<div class="desk-avatar">${initials}</div>`;
  const p = pressurePct(t);

  return `<article class="desk-card token" data-mint="${mint}">
    <div class="desk-card-top">
      ${img}
      <div style="min-width:0;flex:1">
        <div class="desk-name-row">
          <span class="desk-name">${name}</span>
          <span class="desk-sym">${sym}</span>
          <span class="desk-badge">${badge}</span>
        </div>
        <div class="desk-ca">${short(mint)} <button type="button" class="action ghost desk-copy" data-ca="${mint}" style="padding:2px 6px;font-size:9px">COPY</button></div>
      </div>
      <div class="desk-price-col">
        <div class="desk-price">${price}</div>
        <div class="desk-chg ${chgCls}">${chgRaw != null && chgRaw >= 0 ? "↗ " : chgRaw != null ? "↘ " : ""}${chg}</div>
      </div>
    </div>
    <div class="desk-spark"><div class="desk-spark-note">APPROX · NOT LIVE OHLC</div></div>
    <div class="desk-metrics">
      <div><span>MCAP</span><b>${mcap}</b></div>
      <div><span>LIQ</span><b>${liq}</b></div>
      <div><span>VOL</span><b>${vol}</b></div>
      <div><span>AGE</span><b>${age}</b></div>
    </div>
    <div class="desk-pressure">
      <div class="desk-pressure-meta"><span>Signal ${p}</span><span>score / activity</span></div>
      <div class="desk-pressure-bar"><i style="width:${p}%"></i></div>
    </div>
    <div class="desk-actions">
      <button type="button" class="desk-quick tok-buy">🛒 Quick Buy</button>
      <button type="button" class="desk-icon-btn tok-open" title="Analyze">◎</button>
      <button type="button" class="desk-icon-btn desk-copy" data-ca="${mint}" title="Copy CA">⎘</button>
    </div>
  </article>`;
}

function renderTrending(d, tr) {
  const items = typeof trendListForCat === "function" ? trendListForCat(tr) : tr?.movers || [];
  const q = (window.__scanQ || "").trim().toLowerCase();
  const filtered = q
    ? items.filter((t) => {
        const hay = `${t.symbol || ""} ${t.name || ""} ${t.mint || ""}`.toLowerCase();
        return hay.includes(q);
      })
    : items;

  const online = Boolean(tr?.online);
  const tickerSrc = (tr?.movers || items || []).slice(0, 12);
  const ticker = tickerSrc.length
    ? tickerSrc
        .map((t) => {
          const c = t.priceChange5m ?? t.priceChange24h;
          const cls = c == null ? "" : c >= 0 ? "up" : "down";
          const pct = c != null ? fmtPct(c) : "—";
          return `<span class="${cls}">${t.symbol || short(t.mint)} ${pct}</span>`;
        })
        .join("")
    : `<span>Waiting for pump.fun movers…</span>`;

  const cats = [
    ["movers", "🔥 Trending"],
    ["new", "✨ New"],
    ["scored", "📊 Scored"],
    ["passed", "✓ Passed"]
  ];

  const list = filtered.length
    ? filtered.map((t) => tokenCard(t)).join("")
    : `<div class="empty">No tokens match this filter right now.</div>`;

  return `
    <div class="scan-desk">
      <div class="scan-ticker">${ticker}</div>
      <div class="scan-live">
        <span class="dot ${online ? "on" : ""}"></span>
        <span>${online ? "LIVE" : "OFFLINE"}</span>
        <span>·</span>
        <span>pump.fun</span>
        <span class="scan-pill">${filtered.length} shown</span>
        <span>· mcap &gt; $5k</span>
      </div>
      <div class="scan-tabs">
        ${cats
          .map(
            ([id, label]) =>
              `<button type="button" class="scan-tab${state.trendCat === id ? " active" : ""}" data-cat="${id}">${label}</button>`
          )
          .join("")}
      </div>
      <input class="scan-search" id="scanSearch" type="search" placeholder="Search name, symbol or paste CA…" value="${window.__scanQ || ""}" />
      ${list}
    </div>`;
}

(function bindDeskScan() {
  document.addEventListener("input", (e) => {
    if (e.target?.id !== "scanSearch") return;
    window.__scanQ = e.target.value || "";
    // soft re-render current trending if available
    if (state?.tab === "trending" && typeof setTab === "function") {
      clearTimeout(window.__scanQTimer);
      window.__scanQTimer = setTimeout(() => setTab("trending"), 180);
    }
  });

  document.addEventListener("click", (e) => {
    const copy = e.target.closest?.(".desk-copy");
    if (copy) {
      const ca = copy.getAttribute("data-ca");
      if (ca) {
        navigator.clipboard?.writeText(ca).then(
          () => {},
          () => prompt("CA", ca)
        );
      }
    }
    const open = e.target.closest?.(".tok-open");
    if (open) {
      const mint = open.closest(".token")?.dataset.mint;
      if (mint && typeof openToken === "function") openToken(mint);
      else if (mint) {
        window.__prefillMint = mint;
        if (typeof setTab === "function") setTab("trade");
      }
    }
  });
})();
