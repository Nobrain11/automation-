async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) {
    showGate();
    throw new Error("unauthorized");
  }
  return res.json();
}

function showGate() {
  document.getElementById("gate").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function showApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function shortAddr(a) {
  if (!a || a.length < 10) return a || "—";
  return a.slice(0, 4) + "..." + a.slice(-4);
}

function hunterLabel(state) {
  if (state === "hunting") return "● HUNTING";
  if (state === "paused") return "● PAUSED";
  if (state === "stopped_kill") return "● STOPPED (KILL)";
  return "● READY";
}

async function loadDashboard() {
  const d = await api("/api/dashboard");
  const bal =
    d.wallet.balanceSol == null
      ? "unavailable"
      : d.wallet.balanceSol.toFixed(4) + " SOL";
  const usd =
    d.wallet.balanceUsd != null ? ` · $${d.wallet.balanceUsd}` : "";
  const solLine =
    d.sol && d.sol.price != null
      ? `SOL $${d.sol.price.toFixed(2)}` +
        (d.sol.change24h != null
          ? ` ${d.sol.change24h >= 0 ? "▲" : "▼"} ${Math.abs(d.sol.change24h).toFixed(2)}%`
          : "")
      : "SOL price unavailable";

  document.getElementById("walletBox").textContent =
    (d.wallet.connected ? "CONNECTED\n" : "NOT CONNECTED\n") +
    shortAddr(d.wallet.address) +
    "\n" +
    bal +
    usd +
    "\n" +
    solLine;

  document.getElementById("hunterBox").textContent =
    hunterLabel(d.hunter.state) +
    (d.hunter.killSwitch ? "\nKill switch: ON" : "");

  const clearBtn = document.getElementById("btnClearKill");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !d.hunter.killSwitch);
  }

  document.getElementById("scannerBox").textContent =
    (d.scanner.running ? "● LIVE" : "● OFF") +
    `\nDiscovered  ${d.scanner.discovered}` +
    `\nEvaluated   ${d.scanner.evaluated}` +
    `\nPassed      ${d.scanner.passed}` +
    `\nRejected    ${d.scanner.rejected}`;

  const s = d.settings;
  document.getElementById("settingsBox").textContent =
    `Max buy     ${s.maxBuy} SOL\n` +
    `Slippage    ${s.slippage}%\n` +
    `Stop loss   ${s.stopLoss}%\n` +
    `Trail after +${s.trailingAfter}%\n` +
    `Daily cap   ${s.dailyLossCap} SOL\n` +
    `Smart $     ${s.smartMoneyBoost ? "ON" : "OFF"}`;

  // fill quick-edit inputs if present
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v;
  };
  setVal("inMaxBuy", s.maxBuy);
  setVal("inSlip", s.slippage);
  setVal("inSl", s.stopLoss);
  setVal("inCap", s.dailyLossCap);

  document.getElementById("posBox").textContent =
    d.positions.length === 0
      ? "No open positions"
      : JSON.stringify(d.positions, null, 2);

  document.getElementById("pnlBox").textContent = d.pnl.note || "No data";
}

async function loadActivity() {
  const a = await api("/api/activity");
  if (!a.items.length) {
    document.getElementById("activityBox").textContent =
      (a.scannerRunning ? "● LIVE\n\n" : "● IDLE\n\n") +
      "No evaluated tokens yet.";
    return;
  }
  const lines = a.items.map((t) => {
    const tag = t.passed ? "PASS" : "SKIP";
    const sym = t.symbol || (t.mint || "").slice(0, 6);
    const why =
      t.reasons && t.reasons.length ? t.reasons.slice(0, 2).join("; ") : "";
    return `${tag} $${sym}${why ? " — " + why : ""}`;
  });
  document.getElementById("activityBox").textContent = lines.join("\n");
}

async function boot() {
  try {
    await api("/api/me");
    showApp();
    await loadDashboard();
    await loadActivity();
  } catch {
    showGate();
  }
}

document.getElementById("btnRefresh").addEventListener("click", async () => {
  await loadDashboard();
  await loadActivity();
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showGate();
});

document.getElementById("btnStart").addEventListener("click", async () => {
  const r = await api("/api/hunter/start", { method: "POST" });
  if (!r.ok) alert(r.error || "Could not start");
  await loadDashboard();
});

document.getElementById("btnStop").addEventListener("click", async () => {
  await api("/api/hunter/stop", { method: "POST" });
  await loadDashboard();
});

document.getElementById("btnKill").addEventListener("click", async () => {
  if (!confirm("Emergency stop blocks new automated entries. Positions are not sold.")) return;
  await api("/api/hunter/kill", { method: "POST" });
  await loadDashboard();
});

const clearKillBtn = document.getElementById("btnClearKill");
if (clearKillBtn) {
  clearKillBtn.addEventListener("click", async () => {
    await api("/api/hunter/clear-kill", { method: "POST" });
    await loadDashboard();
  });
}

const saveBtn = document.getElementById("btnSaveSettings");
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const body = {
      max_buy: Number(document.getElementById("inMaxBuy").value),
      slippage: Number(document.getElementById("inSlip").value),
      stop_loss: Number(document.getElementById("inSl").value),
      daily_loss_cap: Number(document.getElementById("inCap").value)
    };
    const r = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!r.ok) alert(r.error || "Save failed");
    await loadDashboard();
  });
}

boot();
setInterval(() => {
  if (document.getElementById("app").classList.contains("hidden")) return;
  loadDashboard().catch(() => {});
  loadActivity().catch(() => {});
}, 8000);
