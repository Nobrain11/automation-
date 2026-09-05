/** Auto-Hunter Token Terminal — layout matches desk mockup, real data only */

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

function ageLabel(hours) {
  if (hours == null) return "—";
  if (hours < 1) return Math.max(1, Math.round(hours * 60)) + "m";
  if (hours < 24) return hours.toFixed(1) + "h";
  return (hours / 24).toFixed(1) + "d";
}

function checkClass(status) {
  if (status === "safe" || status === "pass") return "chk-safe";
  if (status === "warn" || status === "skip") return "chk-warn";
  if (status === "bad" || status === "fail") return "chk-bad";
  return "chk-unk";
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

window.openTokenTerminal = async function openTokenTerminal(mint, opts = {}) {
  const ws = document.getElementById("workspace");
  if (!ws || !mint) return;

  const backTab = opts.backTab || "trending";
  ws.innerHTML = `<div class="panel"><div class="empty">Loading terminal…</div></div>`;

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

  const t = data.token;
  const m = data.market || {};
  const auto = data.automation || {};
  const checks = data.checks || [];
  const pos = data.yourPosition || { open: false, positions: [] };
  const trades = data.yourTrades || [];
  const settings = data.settings || {};
  const milestones = data.filterMilestones || [];
  const summary = data.filterSummary;
  const solBal =
    data.sol && window.__lastDash?.wallet?.balanceSol != null
      ? Number(window.__lastDash.wallet.balanceSol).toFixed(2)
      : null;

  const img = t.imageUrl
    ? `<img class="tt-logo" src="${t.imageUrl}" alt="" onerror="this.style.display='none'" />`
    : `<div class="tt-logo ph">$</div>`;

  const score = auto.hunterScore ?? "—";
  const risk = auto.risk || "—";

  const insightLines = checks
    .filter((c) => c.status === "safe" || c.status === "warn" || c.status === "bad")
    .slice(0, 5)
    .map((c) => {
      const mark = checkMark(c.status);
      return `<div class="insight ${checkClass(c.status)}">${mark} ${c.label}: ${c.detail}</div>`;
    })
    .join("");

  const msHtml = milestones.length
    ? milestones
        .map(
          (c, i) =>
            `<div class="tt-check ${checkClass(c.status)}">
          <span class="mk">${i + 1}</span>
          <span class="lb">${checkMark(c.status)} ${c.label}</span>
          <span class="dt">${c.detail}</span>
        </div>`
        )
        .join("")
    : "";

  const posHtml = pos.open
    ? pos.positions
        .map(
          (p) =>
            `<div class="pos-card" data-id="${p.id}">
              <div class="ht-grid">
                <div><span>ENTRY</span><b>${p.entrySol} SOL</b></div>
                <div><span>SIZE</span><b>${p.entrySol} SOL</b></div>
                <div><span>TP</span><b>${settings.stopLoss != null ? "on" : "—"}</b></div>
                <div><span>SL</span><b>${settings.stopLoss != null ? settings.stopLoss + "%" : "—"}</b></div>
              </div>
              <div class="pos-meta">${shortLocal(p.signature)} · ${new Date(p.createdAt).toLocaleString()}</div>
              <button type="button" class="action danger sell-btn full">SELL POSITION</button>
            </div>`
        )
        .join("")
    : `<div class="empty">No open position</div>`;

  const actHtml = trades.length
    ? trades
        .slice(0, 12)
        .map((tr) => {
          const side = String(tr.side || "").toUpperCase();
          const ok = side === "BUY" ? "ok" : "bad";
          return `<div class="tape-row"><span class="${ok}">${side === "BUY" ? "🟢" : "🔴"} ${side}</span><span>${tr.amountSol ?? "—"} SOL</span><span class="muted">${tr.status || ""}</span></div>`;
        })
        .join("")
    : `<div class="empty">No activity yet</div>`;

  const maxBuy = settings.maxBuy ?? 0.1;

  ws.innerHTML = `
    <div class="ht">
      <div class="ht-bar">
        <button type="button" class="action ghost" data-go="${backTab}">←</button>
        <div class="ht-bar-mid">
          <div class="ht-title">AUTO-HUNTER</div>
          <div class="ht-live">● ${auto.qualified ? "READY" : "LIVE"}</div>
        </div>
        <div class="ht-bal">${solBal != null ? solBal + " SOL" : "—"}</div>
      </div>

      <div class="panel ht-search-wrap">
        <input id="htSearch" class="ht-search" type="text" placeholder="Search token / paste mint" value="${t.mint}" />
        <button type="button" class="action" id="htGo">GO</button>
      </div>

      <div class="panel ht-token">
        <div class="ht-token-top">
          ${img}
          <div class="ht-token-id">
            <div class="tt-sym">$${t.symbol || "???"}</div>
            <div class="tt-name">${t.name || "—"}</div>
          </div>
          <div class="ht-score">
            <div class="ht-score-n">${score}</div>
            <div class="ht-score-l">HUNTER</div>
          </div>
        </div>
        <div class="ht-metrics">
          <div><span>MC</span><b>${fmtUsdLocal(m.marketCapUsd)}</b></div>
          <div><span>LIQ</span><b>${m.liquidityUsd != null ? fmtUsdLocal(m.liquidityUsd) : m.liquiditySol != null ? m.liquiditySol.toFixed(2) + " SOL" : "—"}</b></div>
          <div><span>VOL</span><b>${m.volume24h != null ? fmtUsdLocal(m.volume24h) : "—"}</b></div>
          <div><span>AGE</span><b>${ageLabel(t.ageHours)}</b></div>
        </div>
        <div class="tt-price">
          <div class="px">${fmtUsdLocal(m.priceUsd)}</div>
          <div class="muted">${m.priceSol != null ? m.priceSol.toExponential(3) + " SOL" : ""}</div>
        </div>
      </div>

      <div class="panel">
        <h2>PRICE CHART</h2>
        <div class="empty">${data.chart?.note || "Chart not available"}</div>
        <div class="row" style="margin-top:8px">
          <a class="action ghost" href="${t.pairUrl}" target="_blank" rel="noopener">Open on pump.fun</a>
          <a class="action ghost" href="${t.explorerUrl}" target="_blank" rel="noopener">Explorer</a>
        </div>
      </div>

      <div class="panel ht-buy">
        <div class="ht-tabs">
          <button type="button" class="chip active" data-side="buy">BUY</button>
          <button type="button" class="chip" data-side="sell">SELL</button>
          <button type="button" class="chip" data-side="act">ACTIVITY</button>
        </div>
        <div id="htBuyPad">
          <div class="ht-presets">
            <button type="button" class="action ghost preset" data-amt="0.05">0.05</button>
            <button type="button" class="action ghost preset" data-amt="0.10">0.10</button>
            <button type="button" class="action ghost preset" data-amt="0.25">0.25</button>
            <button type="button" class="action ghost preset" data-amt="${maxBuy}">MAX</button>
          </div>
          <label class="field">CUSTOM AMOUNT (SOL)
            <input id="htAmt" type="number" step="0.01" min="0" value="${maxBuy}" />
          </label>
          <button type="button" class="action primary full" id="ttBuy">BUY $${t.symbol || shortLocal(t.mint)}</button>
        </div>
        <div id="htSellPad" class="hidden">
          ${posHtml}
        </div>
        <div id="htActPad" class="hidden">
          <div class="tape">${actHtml}</div>
        </div>
      </div>

      <div class="panel">
        <h2>HUNTER ANALYSIS</h2>
        <div class="ht-grid">
          <div><span>HUNTER SCORE</span><b>${score}/100</b></div>
          <div><span>MOMENTUM</span><b>${auto.momentum || "—"}</b></div>
          <div><span>STRATEGY FIT</span><b>${auto.strategyFit || "—"}</b></div>
          <div><span>RISK</span><b>${risk}</b></div>
        </div>
        <div class="insights">${insightLines || '<div class="empty">No signals</div>'}</div>
      </div>

      ${milestones.length ? `<div class="panel"><h2>FILTER MILESTONES${summary ? ` · ${summary.pass} pass · ${summary.fail} fail` : ""}</h2><div class="tt-checks">${msHtml}</div></div>` : ""}

      <div class="panel">
        <h2>POSITION</h2>
        <div class="ht-grid">
          <div><span>TP TRAIL AFTER</span><b>${settings.trailingAfter != null ? settings.trailingAfter + "%" : "—"}</b></div>
          <div><span>PULLBACK</span><b>${settings.trailingPullback != null ? settings.trailingPullback + "%" : "—"}</b></div>
          <div><span>STOP LOSS</span><b>${settings.stopLoss != null ? settings.stopLoss + "%" : "—"}</b></div>
          <div><span>MAX BUY</span><b>${settings.maxBuy != null ? settings.maxBuy + " SOL" : "—"}</b></div>
        </div>
        ${posHtml}
      </div>

      <div class="panel">
        <h2>LIVE ACTIVITY</h2>
        <div class="tape">${actHtml}</div>
      </div>

      <div class="tt-ca">
        <code>${t.mint}</code>
        <button type="button" class="action ghost" id="ttCopy">COPY CA</button>
      </div>
    </div>`;

  wireBack(ws);

  document.getElementById("htGo")?.addEventListener("click", () => {
    const v = document.getElementById("htSearch")?.value?.trim();
    if (v && v.length >= 32) openTokenTerminal(v, { backTab });
  });

  document.querySelectorAll("[data-side]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-side]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const side = btn.getAttribute("data-side");
      document.getElementById("htBuyPad")?.classList.toggle("hidden", side !== "buy");
      document.getElementById("htSellPad")?.classList.toggle("hidden", side !== "sell");
      document.getElementById("htActPad")?.classList.toggle("hidden", side !== "act");
    });
  });

  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const amt = btn.getAttribute("data-amt");
      const input = document.getElementById("htAmt");
      if (input && amt) input.value = amt;
    });
  });

  document.getElementById("ttCopy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(t.mint);
      const b = document.getElementById("ttCopy");
      if (b) {
        b.textContent = "COPIED";
        setTimeout(() => (b.textContent = "COPY CA"), 1200);
      }
    } catch {
      prompt("Copy mint", t.mint);
    }
  });

  document.getElementById("ttBuy")?.addEventListener("click", async () => {
    const amt = Number(document.getElementById("htAmt")?.value);
    const label = Number.isFinite(amt) && amt > 0 ? amt + " SOL" : "Max Buy";
    if (!confirm(`Buy $${t.symbol || shortLocal(t.mint)} for ${label}?`)) return;
    const btn = document.getElementById("ttBuy");
    if (btn) btn.disabled = true;
    try {
      const body = { mint: t.mint, symbol: t.symbol };
      if (Number.isFinite(amt) && amt > 0) body.amountSol = amt;
      const r = await apiCall("/api/trade/buy", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (r.ok) {
        alert("Submitted: " + (r.signature || "ok"));
        openTokenTerminal(t.mint, { backTab });
      } else alert(r.error || "Buy failed");
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  ws.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest(".pos-card")?.dataset.id);
      if (!id) return;
      if (!confirm("Sell 100% of this position?")) return;
      btn.disabled = true;
      try {
        const r = await apiCall("/api/trade/sell", {
          method: "POST",
          body: JSON.stringify({ positionId: id })
        });
        if (r.ok) {
          alert("Sell submitted: " + (r.signature || "ok"));
          openTokenTerminal(t.mint, { backTab });
        } else alert(r.error || "Sell failed");
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        btn.disabled = false;
      }
    };
  });
};

function wireBack(root) {
  root.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => {
      const tab = el.getAttribute("data-go");
      const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
      if (btn) btn.click();
    };
  });
}

function hookTokenButtons() {
  document.querySelectorAll(".tok-analyze").forEach((btn) => {
    if (btn.dataset.ttHooked) return;
    btn.dataset.ttHooked = "1";
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const mint = btn.closest(".token")?.dataset.mint;
        if (mint) openTokenTerminal(mint, { backTab: "trending" });
      },
      true
    );
  });
  document.querySelectorAll(".token-head").forEach((head) => {
    if (head.dataset.ttHooked) return;
    head.dataset.ttHooked = "1";
    head.style.cursor = "pointer";
    head.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const mint = head.closest(".token")?.dataset.mint;
      if (mint) openTokenTerminal(mint, { backTab: "trending" });
    });
  });
}

setInterval(hookTokenButtons, 800);
document.addEventListener("DOMContentLoaded", hookTokenButtons);
