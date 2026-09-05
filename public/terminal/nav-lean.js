/** Lean desk: settings via top gear; AUTO lives on HOME */

(function () {
  function openSettings() {
    if (typeof state === "object") state.menuView = "risk";
    if (typeof setTab === "function") setTab("menu");
    else {
      const b = document.querySelector('.nav-btn[data-tab="menu"]');
      // menu tab removed — call setTab directly via app state
      if (typeof window.setTab === "function") window.setTab("menu");
    }
  }

  function bindGear() {
    const g = document.getElementById("btnTopSettings");
    if (!g || g.dataset.bound) return;
    g.dataset.bound = "1";
    g.addEventListener("click", openSettings);
  }

  // If something still navigates to automation, keep it working
  const origSetTab = window.setTab;
  function hook() {
    if (typeof window.setTab !== "function") return;
    if (window.setTab.__lean) return;
    const orig = window.setTab;
    window.setTab = function (tab) {
      // automation is not a primary tab — still allow deep link from HOME buttons
      return orig.apply(this, arguments);
    };
    window.setTab.__lean = true;
  }

  bindGear();
  hook();
  setInterval(() => {
    bindGear();
    hook();
  }, 2000);
})();
