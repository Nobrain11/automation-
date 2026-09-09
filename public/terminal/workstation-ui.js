/** Visual-only status strip updates from existing dashboard payload */

function updateWorkstationStatus(d) {
  const el = document.getElementById("wsStatus");
  if (!el || !d) return;

  const sc = d.scanner || {};
  const h = d.hunter || {};
  const w = d.wallet || {};
  const tr = window.state && window.state.trending;

  const net = tr && tr.online === false ? "MARKET OFFLINE" : "MAINNET";
  const scan = sc.running ? "SCAN ON" : "SCAN OFF";
  const hunt =
    h.state === "hunting"
      ? "HUNTER ON"
      : h.killSwitch
        ? "KILL"
        : "HUNTER OFF";
  const passed = sc.passed != null ? sc.passed : "—";
  const bal =
    w.balanceSol == null ? "—" : Number(w.balanceSol).toFixed(3) + " SOL";
  const t = new Date();
  const ts =
    t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  el.innerHTML =
    '<span class="ws-st-item"><i class="ws-dot ' +
    (tr && tr.online === false ? "off" : "on") +
    '"></i>' +
    net +
    "</span>" +
    '<span class="ws-st-item">' +
    scan +
    " · passed " +
    passed +
    "</span>" +
    '<span class="ws-st-item">' +
    hunt +
    "</span>" +
    '<span class="ws-st-item">BAL " +
    bal +
    "</span>" +
    '<span class="ws-st-item ws-st-right">' +
    ts +
    "</span>";
}

(function () {
  // Hook after dashboard renders without changing app.js business logic
  const wrap = function () {
    if (window.__lastDash) updateWorkstationStatus(window.__lastDash);
  };

  // Observe workspace + top metrics mutations as a soft signal that UI refreshed
  const obs = new MutationObserver(function () {
    wrap();
  });

  function arm() {
    const app = document.getElementById("app");
    const ws = document.getElementById("workspace");
    if (ws) obs.observe(ws, { childList: true, subtree: true });
    if (app) obs.observe(app, { attributes: true, attributeFilter: ["class"] });
    wrap();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arm);
  } else {
    arm();
  }

  setInterval(wrap, 5000);
})();
