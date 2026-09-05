/**
 * Keep bottom nav + sidebar in sync; re-animate workspace on tab change.
 */

(function () {
  function pulseWorkspace() {
    const ws = document.getElementById("workspace");
    if (!ws) return;
    ws.style.animation = "none";
    // force reflow
    void ws.offsetHeight;
    ws.style.animation = "";
  }

  function syncNav(tab) {
    if (!tab) return;
    document.querySelectorAll(".nav-btn[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".side-btn[data-tab]").forEach((b) => {
      if (b.hasAttribute("data-menu")) return;
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    const hunt = document.getElementById("huntMetric");
    if (hunt && window.__lastDash?.hunter) {
      const h = window.__lastDash.hunter;
      const on = h.state === "hunting";
      hunt.textContent = on ? "● HUNT" : h.killSwitch ? "● KILL" : "● READY";
      hunt.classList.toggle("live", on);
    }
  }

  // Intercept nav clicks
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest?.(".nav-btn[data-tab], .side-btn[data-tab]");
      if (!btn) return;
      if (btn.hasAttribute("data-menu")) return;
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;
      // Let app.js handle setTab; we sync chrome
      setTimeout(() => {
        syncNav(tab);
        pulseWorkspace();
      }, 0);
    },
    true
  );

  // Wrap setTab if present
  function hookSetTab() {
    if (typeof window.setTab !== "function") return;
    if (window.setTab.__navPolished) return;
    const orig = window.setTab;
    window.setTab = function (tab) {
      const r = orig.apply(this, arguments);
      syncNav(tab);
      pulseWorkspace();
      return r;
    };
    window.setTab.__navPolished = true;
  }

  hookSetTab();
  setInterval(hookSetTab, 1500);

  // Active tab on load
  setTimeout(() => {
    const active = document.querySelector(".nav-btn.active");
    if (active) syncNav(active.getAttribute("data-tab"));
  }, 400);
})();
