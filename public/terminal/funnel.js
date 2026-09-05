/**
 * Soft onboarding only — NEVER blocks bottom nav or freezes the terminal.
 * Wallet create stays in Telegram. If API already has a wallet, skip gates.
 */

const FUNNEL_KEY = "pa_funnel_v2";

function funnelState() {
  try {
    return JSON.parse(localStorage.getItem(FUNNEL_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFunnel(patch) {
  const next = { ...funnelState(), ...patch };
  localStorage.setItem(FUNNEL_KEY, JSON.stringify(next));
  return next;
}

async function softBoot() {
  // Migrate old blocking funnel keys → completed
  try {
    const old = localStorage.getItem("pa_funnel_v1");
    if (old) {
      saveFunnel({ introDone: true, termsAccepted: true, fundDone: true, pathSeen: true });
      localStorage.removeItem("pa_funnel_v1");
    }
  } catch {
    /* ignore */
  }

  let d = null;
  try {
    if (typeof api === "function") {
      d = await api("/api/dashboard");
      window.__lastDash = d;
      if (typeof updateTopbar === "function") updateTopbar(d);
    }
  } catch (e) {
    console.warn("dashboard", e);
  }

  // If wallet is connected, mark funnel complete so we never trap the user
  if (d?.wallet?.connected) {
    saveFunnel({
      introDone: true,
      termsAccepted: true,
      fundDone: true,
      pathSeen: true,
      walletOk: true
    });
  }

  const fs = funnelState();

  // Optional one-time terms banner (non-blocking) — skip if already accepted
  if (!fs.termsAccepted && d?.wallet?.connected) {
    saveFunnel({ termsAccepted: true, introDone: true, pathSeen: true, fundDone: true });
  }

  // Render home immediately — never hijack forever
  if (typeof setTab === "function") {
    setTab("home");
  }

  // Soft banner only if no wallet (user can still use SCAN)
  if (d && !d.wallet?.connected) {
    const ws = document.getElementById("workspace");
    if (ws) {
      const banner = document.createElement("div");
      banner.className = "panel";
      banner.id = "walletBanner";
      banner.innerHTML = `
        <div class="funnel-kicker">WALLET</div>
        <p class="muted">No wallet linked to <b>this</b> Telegram login.</p>
        <p class="muted">In Telegram: create or import once, then open <b>WEB TERMINAL</b> again from the bot (same account).</p>
        <div class="row" style="margin-top:8px">
          <button type="button" class="action primary" id="btnDashRefresh">REFRESH</button>
          <button type="button" class="action ghost" data-go="trending">USE SCAN ANYWAY</button>
        </div>`;
      // prepend if home empty content was rendered — after setTab
      setTimeout(() => {
        const workspace = document.getElementById("workspace");
        if (workspace && !document.getElementById("walletBanner")) {
          workspace.insertBefore(banner, workspace.firstChild);
          document.getElementById("btnDashRefresh")?.addEventListener("click", () => {
            location.reload();
          });
          document.querySelectorAll("[data-go]").forEach((el) => {
            el.onclick = () => {
              if (typeof setTab === "function") setTab(el.getAttribute("data-go"));
            };
          });
        }
      }, 200);
    }
  }
}

function startSoftBoot() {
  const app = document.getElementById("app");
  if (!app || app.classList.contains("hidden")) {
    setTimeout(startSoftBoot, 300);
    return;
  }
  void softBoot();
}

// Do NOT override showApp in a way that blocks navigation
setTimeout(startSoftBoot, 100);
setTimeout(startSoftBoot, 800);

window.resetFunnel = function () {
  localStorage.removeItem(FUNNEL_KEY);
  localStorage.removeItem("pa_funnel_v1");
  location.reload();
};
