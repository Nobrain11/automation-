/** Token Terminal — /api/token + filter milestones + ANALYZE hook */

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
  ws.innerHTML = `<div class="panel"><div class="empty">Loading token…</div></div>`;

  let data;
  try {
    data = await apiCall("/api/token?mint=" + encodeURIComponent(mint));
  } catch (e) {
    ws.innerHTML = `<div class="panel"><div class="empty">Failed to load token</div>
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
  const milestones = data.filterMilestones || [];
  const summary = data.filterSummary;
  const img = t.imageUrl
    ? `<img class="tt-logo" src="${t.imageUrl}" alt="" onerror="this.style.display='none'" />`
    : `<div class="tt-logo ph">$</div>`;

  const checksHtml = checks
    .map(
      (c) =>
        `<div class="tt-check ${checkClass(c.status)}">
          <span class="mk">${checkMark(c.status)}</span>
          <span class="lb">${c.label}</span>
          <span class="dt">${c.detail}</span>
        </div>`
    )
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
    : `<div class="empty">Not evaluated by scanner yet</div>`;

  const msHead = summary
    ? `FILTER MILESTONES · ${summary.pass} pass · ${summary.fail} fail`
    : "FILTER MILESTONES";

  const posHtml = pos.open
    ? pos.positions
        .map(
          (p) =>
            `<div class="pos-card" data-id="${p.id}">
              <div class="pos-top">Entry ${p.entrySol} SOL</div>
              <div class="pos-meta">${shortLocal(p.signature)}\n${new Date(p.createdAt).toLocaleString()}</div>
              <button type="button" class="action danger sell-btn">SELL 100%</button>
            </div>`
        )
        .join("")
    : `<div class="empty">No open position in this token</div>`;

  ws.innerHTML = `
    <div class="tt">
      <div class="tt-top">
        <button type="button" class="action ghost" data-go="${backTab}">← Back</button>
        <div class="tt-brand">PUMP AUTO</div>
        <a class="action ghost" href="${t.pairUrl}" target="_blank" rel="noopener">pump.fun</a>
      </div>
      <div class="panel tt-head">
        <div class="tt-id">
          ${img}
          <div>
            <div class="tt-sym">$${t.symbol || "???"}</div>
            <div class="tt-name">${t.name || "—"}</div>
            <div class="badge-row">
              <span class="badge pump">SOLANA</span>
              ${t.complete ? '<span class="badge">GRADUATED</span>' : '<span class="badge">ON CURVE</span>'}
              ${t.live ? '<span class="badge pump">● LIVE</span>' : ""}
              ${data.scannerPassed === true ? '<span class="badge pump">FILTER PASS</span>' : ""}
              ${data.scannerPassed === false ? '<span class="badge">FILTER FAIL</span>' : ""}
            </div>
          </div>
        </div>
        <div class="tt-price">
          <div class="px">${fmtUsdLocal(m.priceUsd)}</div>
          <div class="muted">${m.priceSol != null ? m.priceSol.toExponential(3) + " SOL" : "Curve price when available"}</div>
        </div>
        <div class="tt-ca">
          <code>${t.mint}</code>
          <button type="button" class="action ghost" id="ttCopy">COPY CA</button>
          <a class="action ghost" href="${t.explorerUrl}" target="_blank" rel="noopener">EXPLORER</a>
        </div>
      </div>
      <div class="panel">
        <h2>${msHead}</h2>
        <div class="tt-checks">${msHtml}</div>
      </div>
      <div class="panel">
        <h2>CHART</h2>
        <div class="empty">${data.chart?.note || "Chart data not available"}</div>
      </div>
      <div class="panel">
        <h2>MARKET</h2>
        <div class="tt-grid">
          <div><span>Market Cap</span><b>${fmtUsdLocal(m.marketCapUsd)}</b></div>
          <div><span>Liquidity</span><b>${m.liquiditySol != null ? m.liquiditySol.toFixed(2) + " SOL" : "—"}</b></div>
          <div><span>24H Volume</span><b>${m.volume24h != null ? fmtUsdLocal(m.volume24h) : "—"}</b></div>
          <div><span>Holders</span><b>${m.holders != null ? m.holders : "—"}</b></div>
        </div>
      </div>
      <div class="panel">
        <h2>TOKEN CHECKS</h2>
        <div class="tt-checks">${checksHtml}</div>
      </div>
      <div class="panel">
        <h2>AUTOMATION ANALYSIS</h2>
        <div class="tt-grid">
          <div><span>Hunter Score</span><b>${auto.hunterScore ?? "—"}</b></div>
          <div><span>Strategy Fit</span><b>${auto.strategyFit ?? "—"}</b></div>
          <div><span>Risk</span><b>${auto.risk ?? "—"}</b></div>
          <div><span>Momentum</span><b>${auto.momentum ?? "—"}</b></div>
        </div>
      </div>
      <div class="panel">
        <h2>YOUR POSITION</h2>
        ${posHtml}
      </div>
      <div class="tt-actions">
        <button type="button" class="action primary" id="ttBuy">BUY</button>
        <button type="button" class="action danger" id="ttSell" ${pos.open ? "" : "disabled"}>SELL</button>
      </div>
    </div>`;

  wireBack(ws);

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
    if (!confirm(`Buy $${t.symbol || shortLocal(t.mint)} with Max Buy?`)) return;
    const btn = document.getElementById("ttBuy");
    if (btn) btn.disabled = true;
    try {
      const r = await apiCall("/api/trade/buy", {
        method: "POST",
        body: JSON.stringify({ mint: t.mint, symbol: t.symbol })
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

  document.getElementById("ttSell")?.addEventListener("click", async () => {
    const first = pos.positions?.[0];
    if (!first) return;
    if (!confirm("Sell 100% of this position?")) return;
    try {
      const r = await apiCall("/api/trade/sell", {
        method: "POST",
        body: JSON.stringify({ positionId: first.id })
      });
      if (r.ok) {
        alert("Sell submitted: " + (r.signature || "ok"));
        openTokenTerminal(t.mint, { backTab });
      } else alert(r.error || "Sell failed");
    } catch (e) {
      alert(String(e.message || e));
    }
  });

  ws.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest(".pos-card")?.dataset.id);
      if (!id) return;
      if (!confirm("Sell 100%?")) return;
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
