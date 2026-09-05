/**
 * Ensure nav always works even if other scripts error.
 * Also force-complete any stuck onboarding.
 */
(function () {
  // Clear stuck v1 funnel that blocked the app
  try {
    localStorage.removeItem("pa_funnel_v1");
  } catch {
    /* ignore */
  }

  function bindNav() {
    document.querySelectorAll(".nav-btn[data-tab], .side-btn[data-tab]").forEach((btn) => {
      if (btn.dataset.navFix) return;
      btn.dataset.navFix = "1";
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        if (btn.hasAttribute("data-menu")) {
          if (typeof state === "object") state.menuView = btn.getAttribute("data-menu") || "risk";
          if (typeof setTab === "function") setTab("menu");
          return;
        }
        if (typeof setTab === "function") {
          try {
            setTab(tab);
          } catch (e) {
            console.error(e);
          }
        }
      });
    });
  }

  bindNav();
  setInterval(bindNav, 2000);

  // Settings gear
  document.addEventListener("click", (e) => {
    const g = e.target.closest?.("#btnTopSettings");
    if (!g) return;
    if (typeof state === "object") state.menuView = "risk";
    if (typeof setTab === "function") setTab("menu");
  });
})();
