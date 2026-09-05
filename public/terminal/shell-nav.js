/** Wire desktop sidebar to the same tab system as bottom nav */

function syncSideNav(tab) {
  document.querySelectorAll(".side-btn[data-tab]").forEach((btn) => {
    const isSettings = btn.hasAttribute("data-menu");
    if (isSettings) {
      btn.classList.toggle("active", tab === "menu" && window.__menuRisk);
      return;
    }
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab && !window.__menuRisk);
  });
  document.querySelectorAll(".nav-btn[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });
}

function bindSideNav() {
  document.querySelectorAll(".side-btn[data-tab]").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (btn.getAttribute("data-menu") === "risk") {
        window.__menuRisk = true;
        // open menu then risk via existing menu system
        const menuBtn = document.querySelector('.nav-btn[data-tab="menu"]');
        if (menuBtn) menuBtn.click();
        setTimeout(() => {
          const risk = document.querySelector('[data-menu="risk"]');
          if (risk) risk.click();
        }, 50);
        syncSideNav("menu");
        return;
      }
      window.__menuRisk = false;
      const mobile = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
      if (mobile) mobile.click();
      else if (typeof window.setTab === "function") window.setTab(tab);
      syncSideNav(tab);
    });
  });
}

// Observe bottom nav clicks to keep sidebar in sync
document.addEventListener("click", (e) => {
  const nav = e.target.closest?.(".nav-btn[data-tab]");
  if (nav) {
    window.__menuRisk = false;
    syncSideNav(nav.getAttribute("data-tab"));
  }
});

bindSideNav();
setInterval(bindSideNav, 2000);
