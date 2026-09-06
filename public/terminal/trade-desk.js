/** Stronger TRADE screen: status line, last result, presets */

function renderTrade(d) {
  window.__lastDash = d;
  const s = d.settings || {};
  const w = d.wallet || {};
  const bal =
    w.balanceSol == null ? "—" : Number(w.balanceSol).toFixed(4) + " SOL";
  const last = window.__lastTradeResult;
  const lastHtml = last
    ? `<div class="panel"><h2>LAST RESULT</h2>
        <div class="ws-meta ${last.ok ? "ok" : "bad"}">${last.ok ? "OK" : "FAILED"}
${last.route ? "Route: " + last.route : ""}
${last.signature ? "Sig: " + last.signature : ""}
${last.error || ""}</div>
        ${last.signature ? `<a class="action ghost" href="https://solscan.io/tx/${last.signature}" target="_blank" rel="noopener">View on Solscan</a>` : ""}
      </div>`
    : "";

  return `
    <div class="panel">
      <h1>TRADE</h1>
      <div class="ws-meta">Wallet ${w.connected ? short(w.address || "") : "not linked"}
Balance ${bal}
Default size ${s.maxBuy ?? "—"} SOL · Slip ${s.slippage ?? "—"}%</div>
    </div>
    <div class="panel">
      <h2>BUY BY MINT</h2>
      <label class="field">Mint / CA<input id="inMint" type="text" placeholder="Token mint address" autocomplete="off" /></label>
      <div class="ht-presets">
        <button type="button" class="action ghost t-preset" data-amt="0.05">0.05</button>
        <button type="button" class="action ghost t-preset" data-amt="0.1">0.10</button>
        <button type="button" class="action ghost t-preset" data-amt="0.25">0.25</button>
        <button type="button" class="action ghost t-preset" data-amt="${s.maxBuy ?? 0.1}">MAX</button>
      </div>
      <label class="field">Amount SOL<input id="inAmt" type="number" step="0.01" min="0" value="${s.maxBuy ?? 0.1}" /></label>
      <button type="button" class="action primary full" id="btnManualBuy">BUY</button>
      <div id="tradeStatus" class="muted" style="margin-top:8px;font-family:var(--mono);font-size:11px"></div>
    </div>
    ${lastHtml}
    <div class="panel">
      <h2>RISK DEFAULTS</h2>
      <label class="field">Max buy (SOL)<input id="inMaxBuy" type="number" step="0.01" min="0" value="${s.maxBuy ?? 0.1}" /></label>
      <label class="field">Slippage %<input id="inSlip" type="number" step="1" value="${s.slippage ?? 20}" /></label>
      <label class="field">Stop loss %<input id="inSl" type="number" step="1" value="${s.stopLoss ?? 20}" /></label>
      <label class="field">Trailing after %<input id="inTrail" type="number" step="1" value="${s.trailingAfter ?? 30}" /></label>
      <label class="field">Daily cap (SOL)<input id="inCap" type="number" step="0.05" min="0" value="${s.dailyLossCap ?? 0.5}" /></label>
      <button type="button" class="action primary" id="btnSaveSettings">SAVE DEFAULTS</button>
    </div>`;
}

// Enhance buy handler after render
(function () {
  const origAfter = window.afterRender;
  // Hook via interval on trade tab buttons
  setInterval(() => {
    document.querySelectorAll(".t-preset").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const a = btn.getAttribute("data-amt");
        const input = document.getElementById("inAmt");
        if (input && a) input.value = a;
      });
    });

    const buy = document.getElementById("btnManualBuy");
    if (buy && !buy.dataset.deskBound) {
      buy.dataset.deskBound = "1";
      buy.addEventListener(
        "click",
        async (e) => {
          // Let original also fire if present — we capture result by wrapping api later
        },
        true
      );
    }
  }, 500);

  // Wrap api for trade result capture
  function hookApi() {
    if (typeof window.api !== "function" || window.api.__tradeHook) return;
    const orig = window.api;
    window.api = async function (path, opts) {
      const res = await orig.apply(this, arguments);
      if (path === "/api/trade/buy" || path === "/api/trade/sell") {
        window.__lastTradeResult = {
          ok: Boolean(res?.ok),
          signature: res?.signature,
          error: res?.error,
          route: res?.route,
          at: Date.now()
        };
        const st = document.getElementById("tradeStatus");
        if (st) {
          st.textContent = res?.ok
            ? "Submitted: " + (res.signature || "ok")
            : res?.error || "Failed";
          st.className = res?.ok ? "ok" : "bad";
        }
      }
      return res;
    };
    window.api.__tradeHook = true;
  }
  hookApi();
  setInterval(hookApi, 2000);
})();
