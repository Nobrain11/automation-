/** Quick Buy confirm sheet — real size presets, no mock quotes */

(function () {
  function sheetHtml(mint, symbol, defaultAmt) {
    return `<div class="qb-sheet" id="qbSheet">
      <div class="qb-backdrop" data-qb-close></div>
      <div class="qb-panel">
        <div class="qb-title">QUICK BUY</div>
        <div class="qb-sub">$${symbol || "TOKEN"}</div>
        <div class="qb-ca"><code>${mint}</code></div>
        <div class="qb-presets">
          <button type="button" class="action ghost qb-amt" data-a="0.05">0.05</button>
          <button type="button" class="action ghost qb-amt" data-a="0.1">0.10</button>
          <button type="button" class="action ghost qb-amt" data-a="0.25">0.25</button>
          <button type="button" class="action ghost qb-amt" data-a="${defaultAmt}">DEF</button>
        </div>
        <label class="field">Amount SOL
          <input id="qbAmt" type="number" step="0.01" min="0.01" value="${defaultAmt}" />
        </label>
        <p class="muted" style="font-size:11px">Executes via PumpPortal → Jupiter fallback. Real mainnet.</p>
        <button type="button" class="desk-quick full" id="qbConfirm">CONFIRM BUY</button>
        <button type="button" class="action ghost full" data-qb-close style="margin-top:8px">CANCEL</button>
        <div id="qbStatus" class="muted" style="margin-top:8px;font-family:var(--mono);font-size:11px"></div>
      </div>
    </div>`;
  }

  function closeSheet() {
    document.getElementById("qbSheet")?.remove();
  }

  function openSheet(mint, symbol) {
    closeSheet();
    const def =
      window.__lastDash?.settings?.maxBuy != null
        ? window.__lastDash.settings.maxBuy
        : 0.1;
    document.body.insertAdjacentHTML("beforeend", sheetHtml(mint, symbol, def));
    const root = document.getElementById("qbSheet");
    root?.querySelectorAll("[data-qb-close]").forEach((el) => {
      el.addEventListener("click", closeSheet);
    });
    root?.querySelectorAll(".qb-amt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.getAttribute("data-a");
        const input = document.getElementById("qbAmt");
        if (input && a) input.value = a;
      });
    });
    document.getElementById("qbConfirm")?.addEventListener("click", async () => {
      const amt = Number(document.getElementById("qbAmt")?.value);
      const st = document.getElementById("qbStatus");
      if (!(amt > 0)) {
        if (st) st.textContent = "Enter amount";
        return;
      }
      if (st) st.textContent = "Submitting…";
      try {
        const r = await api("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify({ mint, amountSol: amt, symbol })
        });
        if (r?.ok) {
          if (st) st.textContent = "OK " + (r.signature || "");
          setTimeout(closeSheet, 900);
          if (typeof refresh === "function") refresh();
        } else if (st) st.textContent = r?.error || "Failed";
      } catch (e) {
        if (st) st.textContent = String(e.message || e);
      }
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest?.(".tok-buy, .desk-quick");
      if (!btn || btn.id === "qbConfirm") return;
      if (btn.closest?.("#qbSheet")) return;
      const card = btn.closest?.(".token, .desk-card");
      const mint = card?.dataset?.mint || window.__prefillMint;
      if (!mint) return;
      e.preventDefault();
      e.stopPropagation();
      const sym =
        card?.querySelector?.(".desk-sym")?.textContent ||
        card?.querySelector?.(".desk-name")?.textContent ||
        "";
      openSheet(mint, sym);
    },
    true
  );

  // styles
  if (!document.getElementById("qbStyles")) {
    const s = document.createElement("style");
    s.id = "qbStyles";
    s.textContent = `
.qb-sheet{position:fixed;inset:0;z-index:80;display:grid;place-items:end center}
.qb-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.qb-panel{position:relative;width:min(100%,440px);background:#0b1017;border:1px solid #1a2433;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));}
.qb-title{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:#7a8b9e}
.qb-sub{font-size:18px;font-weight:800;margin:4px 0}
.qb-ca{font-size:11px;color:#4d5d70;margin-bottom:12px;word-break:break-all}
.qb-presets{display:flex;gap:8px;margin-bottom:10px}
.desk-quick.full,.action.full{width:100%}
`;
    document.head.appendChild(s);
  }
})();
