/**
 * Chain switcher — Solana live; Base shows real RPC probe when selected.
 */
(function () {
  var STORAGE_KEY = "pa_chain_v1";

  var CHAINS = [
    { id: "solana", label: "Solana", short: "SOL", status: "live", note: "pump.fun · live" },
    { id: "base", label: "Base", short: "BASE", status: "coming_soon", note: "EVM · Phase 1" },
    { id: "ethereum", label: "Ethereum", short: "ETH", status: "coming_soon", note: "EVM · staged" },
    { id: "robinhood", label: "Robinhood", short: "RH", status: "coming_soon", note: "Brokerage · staged" }
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

    if (chain.id === "base") {
      ws.innerHTML =
        '<div class="panel cmd-hero">' +
        '<div class="cmd-kicker">BASE · PHASE 1</div>' +
        '<div class="cmd-title">Base network</div>' +
        '<p class="cmd-sub">RPC probe and chain registry are live. Wallet connect and swaps are not enabled yet — Solana remains the execution venue.</p>' +
        '<div id="baseProbe" class="cmd-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px">' +
        '<div class="cmd-stat"><span>RPC</span><b>…</b></div>' +
        '<div class="cmd-stat"><span>BLOCK</span><b>…</b></div>' +
        '<div class="cmd-stat"><span>WALLET</span><b>OFF</b></div>' +
        '<div class="cmd-stat"><span>SWAP</span><b>OFF</b></div>' +
        "</div>" +
        '<div class="row" style="margin-top:14px">' +
        '<button type="button" class="action primary" id="chainBackSol">Back to Solana</button>' +
        '<button type="button" class="action ghost" id="baseRefresh">Refresh probe</button>' +
        "</div>" +
        '<p class="muted" style="margin-top:12px;font-size:11px">Optional: set BASE_RPC_URL on Railway for a dedicated endpoint.</p>' +
        "</div>";

      function loadProbe() {
        var box = document.getElementById("baseProbe");
        if (!box) return;
        fetch("/api/chains", { credentials: "same-origin" })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            var b = d && d.base;
            var p = b && b.probe;
            var rpc = b && b.rpcHost ? b.rpcHost : "—";
            var block =
              p && p.ok && p.blockNumber != null
                ? String(p.blockNumber)
                : p && p.error
                  ? "ERR"
                  : "—";
            var lat = p && p.latencyMs != null ? p.latencyMs + "ms" : "";
            box.innerHTML =
              '<div class="cmd-stat"><span>RPC</span><b style="font-size:11px">' +
              rpc +
              "</b></div>" +
              '<div class="cmd-stat"><span>BLOCK</span><b>' +
              block +
              (lat ? " <small style=\"color:var(--dim)\">" + lat + "</small>" : "") +
              "</b></div>" +
              '<div class="cmd-stat"><span>WALLET</span><b>OFF</b></div>' +
              '<div class="cmd-stat"><span>SWAP</span><b>OFF</b></div>';
          })
          .catch(function () {
            box.innerHTML =
              '<div class="cmd-stat"><span>RPC</span><b>UNAVAILABLE</b></div>' +
              '<div class="cmd-stat"><span>BLOCK</span><b>—</b></div>' +
              '<div class="cmd-stat"><span>WALLET</span><b>OFF</b></div>' +
              '<div class="cmd-stat"><span>SWAP</span><b>OFF</b></div>';
          });
      }

      loadProbe();
      var ref = document.getElementById("baseRefresh");
      if (ref) ref.onclick = loadProbe;
      var back = document.getElementById("chainBackSol");
      if (back) {
        back.onclick = function () {
          selectChain("solana");
          if (typeof setTab === "function") setTab("home");
          else if (typeof render === "function") render();
        };
      }
      return;
    }

    var title =
      chain.id === "robinhood" ? "Robinhood module" : chain.label + " chain";
    ws.innerHTML =
      '<div class="panel cmd-hero">' +
      '<div class="cmd-kicker">MULTI-CHAIN</div>' +
      '<div class="cmd-title">' +
      title +
      "</div>" +
      '<p class="cmd-sub">Staged. Solana remains the live execution venue for pump.fun discovery, wallet, and trades.</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<button type="button" class="action primary" id="chainBackSol">Back to Solana</button>' +
      "</div></div>";

    var back2 = document.getElementById("chainBackSol");
    if (back2) {
      back2.onclick = function () {
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
