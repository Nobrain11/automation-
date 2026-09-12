/**
 * Chain switcher UI — Solana is the only live execution chain.
 * Base / Ethereum / Robinhood are visible but staged (no fake trading).
 */
(function () {
  var STORAGE_KEY = "pa_chain_v1";

  var CHAINS = [
    {
      id: "solana",
      label: "Solana",
      short: "SOL",
      status: "live",
      note: "pump.fun · live"
    },
    {
      id: "base",
      label: "Base",
      short: "BASE",
      status: "coming_soon",
      note: "EVM swaps · coming soon"
    },
    {
      id: "ethereum",
      label: "Ethereum",
      short: "ETH",
      status: "coming_soon",
      note: "EVM swaps · coming soon"
    },
    {
      id: "robinhood",
      label: "Robinhood",
      short: "RH",
      status: "coming_soon",
      note: "Brokerage module · coming soon"
    }
  ];

  function loadChain() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v && CHAINS.some(function (c) { return c.id === v; })) return v;
    } catch (e) {}
    return "solana";
  }

  function saveChain(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
  }

  function getChain(id) {
    for (var i = 0; i < CHAINS.length; i++) {
      if (CHAINS[i].id === id) return CHAINS[i];
    }
    return CHAINS[0];
  }

  window.__paChain = loadChain();
  window.__paChains = CHAINS;
  window.getPaChain = function () {
    return getChain(window.__paChain);
  };

  function renderSwitcher() {
    var host = document.getElementById("chainSwitcher");
    if (!host) return;
    var cur = getChain(window.__paChain);
    host.innerHTML =
      '<button type="button" class="chain-btn" id="chainBtn" title="Select network">' +
      '<span class="chain-dot ' +
      (cur.status === "live" ? "on" : "") +
      '"></span>' +
      '<span class="chain-label">' +
      cur.short +
      "</span>" +
      '<span class="chain-caret">▾</span></button>' +
      '<div class="chain-menu hidden" id="chainMenu" role="listbox"></div>';

    var menu = document.getElementById("chainMenu");
    if (!menu) return;
    menu.innerHTML = CHAINS.map(function (c) {
      var active = c.id === window.__paChain ? " active" : "";
      var badge =
        c.status === "live"
          ? '<span class="chain-badge live">LIVE</span>'
          : '<span class="chain-badge">SOON</span>';
      return (
        '<button type="button" class="chain-item' +
        active +
        '" data-chain="' +
        c.id +
        '" role="option">' +
        "<span><b>" +
        c.label +
        "</b><small>" +
        c.note +
        "</small></span>" +
        badge +
        "</button>"
      );
    }).join("");
  }

  function showComingSoon(chain) {
    var ws = document.getElementById("workspace");
    if (!ws) return;
    var title =
      chain.id === "robinhood" ? "Robinhood module" : chain.label + " chain";
    ws.innerHTML =
      '<div class="panel cmd-hero">' +
      '<div class="cmd-kicker">MULTI-CHAIN</div>' +
      '<div class="cmd-title">' +
      title +
      "</div>" +
      '<p class="cmd-sub">This network is staged. Solana remains the live execution venue for pump.fun discovery, wallet, and trades.</p>' +
      '<div class="cmd-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px">' +
      '<div class="cmd-stat"><span>STATUS</span><b>COMING SOON</b></div>' +
      '<div class="cmd-stat"><span>ACTIVE</span><b>SOLANA</b></div>' +
      "</div>" +
      '<div class="row" style="margin-top:14px">' +
      '<button type="button" class="action primary" id="chainBackSol">Back to Solana</button>' +
      "</div>" +
      '<p class="muted" style="margin-top:12px;font-size:11px">Robinhood is a brokerage path (stocks / limited crypto), not a DEX. Base/Ethereum will use separate RPCs and swap routers when enabled.</p>' +
      "</div>";

    var back = document.getElementById("chainBackSol");
    if (back) {
      back.onclick = function () {
        selectChain("solana");
        if (typeof setTab === "function") setTab("home");
        else if (typeof render === "function") render();
      };
    }
  }

  function selectChain(id) {
    var chain = getChain(id);
    window.__paChain = chain.id;
    saveChain(chain.id);
    renderSwitcher();
    closeMenu();

    var st = document.getElementById("wsStatus");
    if (st && chain.status === "live") {
      /* status bar kept by workstation-ui */
    }

    if (chain.status !== "live") {
      showComingSoon(chain);
      return;
    }
    if (typeof setTab === "function" && window.state) {
      setTab(window.state.tab || "home");
    } else if (typeof render === "function") {
      render();
    }
  }

  function closeMenu() {
    var menu = document.getElementById("chainMenu");
    if (menu) menu.classList.add("hidden");
  }

  function openMenu() {
    var menu = document.getElementById("chainMenu");
    if (menu) menu.classList.toggle("hidden");
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === "chainBtn" || (t.closest && t.closest("#chainBtn"))) {
      openMenu();
      return;
    }
    var item = t.closest && t.closest("[data-chain]");
    if (item) {
      selectChain(item.getAttribute("data-chain"));
      return;
    }
    if (!t.closest || !t.closest("#chainSwitcher")) closeMenu();
  });

  function boot() {
    renderSwitcher();
    var cur = getChain(window.__paChain);
    if (cur.status !== "live") {
      // Always boot into live Solana for trading; remember preference only for UI
      window.__paChain = "solana";
      renderSwitcher();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.selectPaChain = selectChain;
})();
