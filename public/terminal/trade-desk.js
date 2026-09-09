/** TRADE — product shell */

function renderTrade(d) {
  window.__lastDash = d;
  const s = d.settings || {};
  const w = d.wallet || {};
  const bal =
    w.balanceSol == null ? "—" : Number(w.balanceSol).toFixed(4) + " SOL";
  const last = window.__lastTradeResult;
  const prefill =
    (typeof location !== "undefined" &&
      new URLSearchParams(location.search).get("mint")) ||
    window.__prefillMint ||
    "";

  const lastHtml = last
    ? `<div class="panel">
        <h2>Last result</h2>
        <div class="ws-meta ${last.ok ? "ok" : "bad"}">${last.ok ? "Submitted" : "Failed"}
${last.route ? "Route · " + last.route : ""}
${last.signature || last.error || ""}</div>
        ${
          last.signature
            ? `<a class="action ghost" href="https://solscan.io/tx/${last.signature}" target="_blank" rel="noopener">Solscan</a>`
            : ""
        }
      </div>`
    : "";

  return `
    <div class="panel cmd-hero">
      <div class="cmd-kicker">EXECUTE</div>
      <div class="cmd-title">Trade</div>
      <p class="cmd-sub">Manual buy by mint. PumpPortal first, Jupiter fallback. Mainnet only.</p>
      <div class="cmd-grid">
        <div class="cmd-stat"><span>BALANCE</span><b>${bal}</b></div>
        <div class="cmd-stat"><span>DEFAULT</span><b>${s.maxBuy ?? "—"} SOL</b></div>
      </div>
    </div>

    <div class="panel">
      <h2>Buy</h2>
      <label class="field">Mint / CA
        <input id="inMint" type="text" placeholder="Token mint" autocomplete="off" value="${prefill}" />
      </label>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <button type="button" class="action ghost t-preset" data-amt="0.05">0.05</button>
        <button type="button" class="action ghost t-preset" data-amt="0.1">0.10</button>
        <button type="button" class="action ghost t-preset" data-amt="0.25">0.25</button>
        <button type="button" class="action ghost t-preset" data-amt="${s.maxBuy ?? 0.1}">DEF</button>
      </div>
      <label class="field">Amount SOL
        <input id="inAmt" type="number" step="0.01" min="0" value="${s.maxBuy ?? 0.1}" />
      </label>
      <button type="button" class="action primary full" id="btnManualBuy">BUY</button>
      <div id="tradeStatus" class="muted" style="margin-top:8px;font-family:var(--mono);font-size:11px"></div>
    </div>

    ${lastHtml}

    <div class="panel">
      <h2>Risk defaults</h2>
      <label class="field">Max buy (SOL)<input id="inMaxBuy" type="number" step="0.01" min="0" value="${s.maxBuy ?? 0.1}" /></label>
      <label class="field">Slippage %<input id="inSlip" type="number" step="1" value="${s.slippage ?? 20}" /></label>
      <label class="field">Stop loss %<input id="inSl" type="number" step="1" value="${s.stopLoss ?? 20}" /></label>
      <label class="field">Trailing after %<input id="inTrail" type="number" step="1" value="${s.trailingAfter ?? 30}" /></label>
      <label class="field">Trailing pullback %<input id="inPull" type="number" step="1" value="${s.trailingPullback ?? 15}" /></label>
      <label class="field">Time stop (min, 0=off)<input id="inTime" type="number" step="1" value="${s.timeStopMinutes ?? 30}" /></label>
      <label class="field">Daily cap (SOL)<input id="inCap" type="number" step="0.05" min="0" value="${s.dailyLossCap ?? 0.5}" /></label>
      <button type="button" class="action primary" id="btnSaveSettings">SAVE DEFAULTS</button>
    </div>`;
}

(function () {
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

    const save = document.getElementById("btnSaveSettings");
    if (save && !save.dataset.trailBound) {
      save.dataset.trailBound = "1";
      save.addEventListener("click", async () => {
        const body = {
          max_buy: Number(document.getElementById("inMaxBuy")?.value),
          slippage: Number(document.getElementById("inSlip")?.value),
          stop_loss: Number(document.getElementById("inSl")?.value),
          trailing_after: Number(document.getElementById("inTrail")?.value),
          trailing_pullback: Number(document.getElementById("inPull")?.value),
          time_stop_minutes: Number(document.getElementById("inTime")?.value),
          daily_loss_cap: Number(document.getElementById("inCap")?.value)
        };
        try {
          if (typeof api === "function") {
            const r = await api("/api/settings", {
              method: "POST",
              body: JSON.stringify(body)
            });
            const st = document.getElementById("tradeStatus");
            if (st) {
              st.textContent = r?.ok ? "Defaults saved" : r?.error || "Save failed";
              st.className = r?.ok ? "ok" : "bad";
            }
          }
        } catch (e) {
          console.warn(e);
        }
      });
    }
  }, 500);

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
