/**
 * Product funnel (client):
 * intro → terms → wallet/fund gate → home
 * Real data only. Wallet create/import stays Telegram (non-custodial).
 */

const FUNNEL_KEY = "pa_funnel_v1";

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

function renderFunnelScreen(html) {
  const ws = document.getElementById("workspace");
  if (!ws) return;
  ws.innerHTML = html;
}

function introHtml() {
  return `
    <div class="funnel panel">
      <div class="funnel-kicker">WELCOME</div>
      <h1 class="funnel-title">AUTO-HUNTER</h1>
      <p class="funnel-lead">Intelligent Solana trading, built for speed.</p>
      <div class="funnel-steps">
        <div>1 · Find opportunities</div>
        <div>2 · Analyze risk</div>
        <div>3 · Execute trades</div>
        <div>4 · Manage positions</div>
      </div>
      <button type="button" class="action primary full" id="fnNextIntro">CONTINUE</button>
      <button type="button" class="action ghost full" id="fnLearn" style="margin-top:8px">LEARN HOW IT WORKS</button>
    </div>`;
}

function termsHtml() {
  return `
    <div class="funnel panel">
      <div class="funnel-kicker">LEGAL</div>
      <h1 class="funnel-title">TERMS + RISK</h1>
      <div class="funnel-legal">
        <p><b>High risk.</b> Memecoins and automated trading can result in total loss of funds.</p>
        <p>PUMP AUTO / Auto-Hunter is non-custodial software. You control your keys. We do not hold your funds.</p>
        <p>Past performance is not indicative of future results. Smart filters and hunter scores are tools, not guarantees.</p>
        <p>You are solely responsible for trades, tax, and compliance in your jurisdiction.</p>
        <p>Emergency stop halts automation only — it does not auto-withdraw or force-sell unless you configure exits.</p>
      </div>
      <label class="funnel-check">
        <input type="checkbox" id="fnAccept" />
        I understand the risks and accept the terms
      </label>
      <button type="button" class="action primary full" id="fnNextTerms" disabled>I AGREE — CONTINUE</button>
    </div>`;
}

function walletNeededHtml() {
  return `
    <div class="funnel panel">
      <div class="funnel-kicker">WALLET</div>
      <h1 class="funnel-title">CONNECT WALLET</h1>
      <p class="muted">Create or import in Telegram. Keys stay encrypted on your server volume — never shown in this web session after setup.</p>
      <div class="funnel-steps">
        <div>Open the Telegram bot</div>
        <div>Create wallet <b>or</b> Import private key</div>
        <div>Tap <b>WEB TERMINAL</b> again</div>
      </div>
      <div class="empty">No wallet linked to this login yet</div>
      <button type="button" class="action primary full" id="fnRefreshWallet">I CREATED A WALLET — REFRESH</button>
      <button type="button" class="action ghost full" id="fnSkipLearn" style="margin-top:8px">HOW IT WORKS</button>
    </div>`;
}

function fundHtml(d) {
  const addr = d.wallet?.address || "—";
  return `
    <div class="funnel panel">
      <div class="funnel-kicker">FUND</div>
      <h1 class="funnel-title">FUND WALLET</h1>
      <p class="muted">Send SOL on Solana mainnet to your address. Start small.</p>
      <div class="funnel-addr"><code>${addr}</code></div>
      <button type="button" class="action" id="fnCopyAddr">COPY ADDRESS</button>
      <div class="ws-meta" style="margin-top:12px">Balance: ${d.wallet?.balanceSol == null ? "—" : d.wallet.balanceSol.toFixed(4) + " SOL"}</div>
      <button type="button" class="action primary full" id="fnFundDone" style="margin-top:12px">I FUNDED — CONTINUE</button>
      <button type="button" class="action ghost full" id="fnFundSkip" style="margin-top:8px">SKIP FOR NOW</button>
    </div>`;
}

function pathHtml() {
  return `
    <div class="funnel panel">
      <div class="funnel-kicker">START</div>
      <h1 class="funnel-title">CHOOSE PATH</h1>
      <p class="muted">Discover → Analyze → Risk check → Execute → Monitor → Record.</p>
      <button type="button" class="action primary full" id="fnManual">⚡ MANUAL TRADE</button>
      <button type="button" class="action full" id="fnAuto" style="margin-top:8px">◎ AUTO-HUNTER</button>
      <button type="button" class="action ghost full" id="fnScan" style="margin-top:8px">🔎 DISCOVER / SCANNER</button>
    </div>`;
}

function learnHtml() {
  return `
    <div class="funnel panel">
      <h1 class="funnel-title">HOW IT WORKS</h1>
      <div class="funnel-steps">
        <div><b>DISCOVER</b> — Scanner + pump.fun movers</div>
        <div><b>ANALYZE</b> — Token terminal + filter milestones</div>
        <div><b>RISK CHECK</b> — Your max buy, SL, caps, kill switch</div>
        <div><b>EXECUTE</b> — Jupiter swap when a route exists</div>
        <div><b>MONITOR</b> — Positions + 30s exit engine</div>
        <div><b>RECORD</b> — Trades & portfolio activity</div>
      </div>
      <button type="button" class="action primary full" id="fnLearnBack">BACK</button>
    </div>`;
}

async function refreshDash() {
  if (typeof api !== "function") return null;
  try {
    const d = await api("/api/dashboard");
    window.__lastDash = d;
    if (typeof updateTopbar === "function") updateTopbar(d);
    return d;
  } catch {
    return null;
  }
}

async function runFunnelIfNeeded() {
  const app = document.getElementById("app");
  if (!app || app.classList.contains("hidden")) return false;

  const fs = funnelState();

  // 1 Intro
  if (!fs.introDone) {
    renderFunnelScreen(introHtml());
    document.getElementById("fnNextIntro")?.addEventListener("click", () => {
      saveFunnel({ introDone: true });
      void runFunnelIfNeeded();
    });
    document.getElementById("fnLearn")?.addEventListener("click", () => {
      renderFunnelScreen(learnHtml());
      document.getElementById("fnLearnBack")?.addEventListener("click", () => {
        void runFunnelIfNeeded();
      });
    });
    return true;
  }

  // 2 Terms
  if (!fs.termsAccepted) {
    renderFunnelScreen(termsHtml());
    const box = document.getElementById("fnAccept");
    const btn = document.getElementById("fnNextTerms");
    box?.addEventListener("change", () => {
      if (btn) btn.disabled = !box.checked;
    });
    btn?.addEventListener("click", () => {
      if (!box?.checked) return;
      saveFunnel({ termsAccepted: true, termsAt: Date.now() });
      void runFunnelIfNeeded();
    });
    return true;
  }

  const d = (await refreshDash()) || window.__lastDash;

  // 3 Wallet
  if (!d?.wallet?.connected) {
    renderFunnelScreen(walletNeededHtml());
    document.getElementById("fnRefreshWallet")?.addEventListener("click", async () => {
      const nd = await refreshDash();
      if (nd?.wallet?.connected) void runFunnelIfNeeded();
      else alert("Still no wallet. Create/import in Telegram, then open Web Terminal again.");
    });
    document.getElementById("fnSkipLearn")?.addEventListener("click", () => {
      renderFunnelScreen(learnHtml());
      document.getElementById("fnLearnBack")?.addEventListener("click", () => void runFunnelIfNeeded());
    });
    return true;
  }

  // 4 Fund (if zero balance and not skipped)
  const bal = d.wallet.balanceSol;
  if (!fs.fundDone && (bal == null || bal < 0.01)) {
    renderFunnelScreen(fundHtml(d));
    document.getElementById("fnCopyAddr")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(d.wallet.address);
        alert("Address copied");
      } catch {
        prompt("Copy address", d.wallet.address);
      }
    });
    document.getElementById("fnFundDone")?.addEventListener("click", async () => {
      const nd = await refreshDash();
      if (nd?.wallet?.balanceSol != null && nd.wallet.balanceSol >= 0.01) {
        saveFunnel({ fundDone: true });
      } else {
        // allow continue even if not detected yet
        if (confirm("Balance still low or unavailable. Continue anyway?")) {
          saveFunnel({ fundDone: true });
        } else return;
      }
      void runFunnelIfNeeded();
    });
    document.getElementById("fnFundSkip")?.addEventListener("click", () => {
      saveFunnel({ fundDone: true });
      void runFunnelIfNeeded();
    });
    return true;
  }

  // 5 Path chooser once
  if (!fs.pathSeen) {
    renderFunnelScreen(pathHtml());
    document.getElementById("fnManual")?.addEventListener("click", () => {
      saveFunnel({ pathSeen: true, path: "manual" });
      if (typeof setTab === "function") setTab("trade");
    });
    document.getElementById("fnAuto")?.addEventListener("click", () => {
      saveFunnel({ pathSeen: true, path: "auto" });
      if (typeof setTab === "function") setTab("automation");
    });
    document.getElementById("fnScan")?.addEventListener("click", () => {
      saveFunnel({ pathSeen: true, path: "scan" });
      if (typeof setTab === "function") setTab("trending");
    });
    return true;
  }

  return false;
}

// Hook after app becomes visible
const _showApp = typeof showApp === "function" ? showApp : null;
if (_showApp) {
  showApp = function () {
    _showApp();
    setTimeout(() => {
      void runFunnelIfNeeded().then((blocked) => {
        if (!blocked && typeof setTab === "function") {
          // normal home
          if (state?.tab) setTab(state.tab);
          else setTab("home");
        }
      });
    }, 50);
  };
}

// Export reset for settings
window.resetFunnel = function () {
  localStorage.removeItem(FUNNEL_KEY);
  alert("Onboarding reset. Reload the page.");
};
