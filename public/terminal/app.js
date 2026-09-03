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

function short(a) {
  if (!a || a.length < 10) return a || "—";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

function ageLabel(sec) {
  if (sec == null) return "—";
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  return Math.floor(sec / 3600) + "h";
}

function fmtNum(n, d = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(d);
}

let lastBuySize = 0.1;

function tokenCard(t) {
  const liq = fmtNum(t.liquiditySol, 3);
  const top = t.top10 != null ? fmtNum(t.top10, 1) + "%" : "—";
  const mintOk = t.mintRevoked
    ? "<span class=\"ok\">mint✓</span>"
    : "<span class=\"bad\">mint✗</span>";
  const frzOk = t.freezeRevoked
    ? "<span class=\"ok\">frz✓</span>"
    : "<span class=\"bad\">frz✗</span>";
  const reasons =
    t.reasons && t.reasons.length
      ? `<div class="reasons">${t.reasons.slice(0, 2).join(" · ")}</div>`
      : "";
  const mint = t.mint || "";
  const sym = (t.symbol || "???").replace(/[<>"']/g, "");
  return `
    <div class="token" data-mint="${mint}" data-symbol="${sym}">
      <div class="token-top">
        <div class="sym">$${sym}<span>${t.name || ""}</span></div>
        <div class="age">${ageLabel(t.ageSeconds)}</div>
      </div>
      <div class="metrics">
        <div>liq <b>${liq}</b> SOL</div>
        <div>top10 <b>${top}</b></div>
        <div>${mintOk}</div>
        <div>${frzOk}</div>
      </div>
      ${reasons}
      <div class="mint">${short(mint)}</div>
      <button class="buy-btn" type="button">BUY</button>
    </div>`;
}

function fillCol(el, list, emptyMsg) {
  if (!list.length) {
    el.innerHTML = `<div class="empty">${emptyMsg}</div>`;
    return;
  }
  el.innerHTML = list.map(tokenCard).join("");
  el.querySelectorAll(".buy-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const card = btn.closest(".token");
      const mint = card?.dataset.mint;
      const symbol = card?.dataset.symbol;
      if (!mint) return;
      const size =
        Number(document.getElementById("inMaxBuy").value) || lastBuySize;
      if (!confirm(`Buy $${symbol} with ${size} SOL via Jupiter?`)) return;
      btn.disabled = true;
      btn.textContent = "…";
      try {
        const r = await api("/api/trade/buy", {
          method: "POST",
          body: JSON.stringify({ mint, amountSol: size, symbol })
        });
        if (r.ok) {
          btn.textContent = "SENT";
          alert("Submitted: " + (r.signature || "ok"));
          await loadDashboard();
        } else {
          btn.textContent = "BUY";
          alert(r.error || "Buy failed");
        }
      } catch (err) {
        btn.textContent = "BUY";
        alert(String(err.message || err));
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function renderPositions(positions) {
  const box = document.getElementById("posBox");
  if (!positions.length) {
    box.innerHTML = `<div class="empty-pos">No open positions</div>`;
    return;
  }
  box.innerHTML = positions
    .map(
      (p) => `
    <div class="pos-card" data-id="${p.id}">
      <div class="pos-top">$${p.symbol || short(p.mint)}</div>
      <div class="pos-meta">${p.entrySol} SOL · ${short(p.signature)}</div>
      <button type="button" class="sell-btn">SELL 100%</button>
    </div>`
    )
    .join("");

  box.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".pos-card");
      const id = Number(card?.dataset.id);
      if (!id) return;
      if (!confirm("Sell 100% of this position via Jupiter?")) return;
      btn.disabled = true;
      btn.textContent = "…";
      try {
        const r = await api("/api/trade/sell", {
          method: "POST",
          body: JSON.stringify({ positionId: id })
        });
        if (r.ok) {
          alert("Sell submitted: " + (r.signature || "ok"));
          await loadDashboard();
        } else {
          alert(r.error || "Sell failed");
          btn.textContent = "SELL 100%";
          btn.disabled = false;
        }
      } catch (e) {
        alert(String(e.message || e));
        btn.textContent = "SELL 100%";
        btn.disabled = false;
      }
    });
  });
}

async function loadDashboard() {
  const d = await api("/api/dashboard");

  const sol =
    d.sol && d.sol.price != null
      ? `SOL <strong>$${d.sol.price.toFixed(2)}</strong>` +
        (d.sol.change24h != null
          ? ` ${d.sol.change24h >= 0 ? "▲" : "▼"}${Math.abs(d.sol.change24h).toFixed(1)}%`
          : "")
      : "SOL <strong>—</strong>";
  document.getElementById("solMetric").innerHTML = sol;

  const bal =
    d.wallet.balanceSol == null
      ? "Bal <strong>—</strong>"
      : `Bal <strong>${d.wallet.balanceSol.toFixed(4)}</strong>` +
        (d.wallet.balanceUsd != null ? ` ($${d.wallet.balanceUsd})` : "");
  document.getElementById("balMetric").innerHTML = bal;

  const hs =
    d.hunter.state === "hunting"
      ? "● HUNTING"
      : d.hunter.state === "stopped_kill"
        ? "● KILL"
        : "● READY";
  document.getElementById("huntMetric").textContent = hs;
  document.getElementById("hunterState").textContent =
    hs +
    (d.hunter.killSwitch ? "\nKill switch ON" : "") +
    "\nAuto-buys on PASS";

  document.getElementById("scanPill").classList.toggle("on", d.scanner.running);
  document.getElementById("scanPill").textContent = d.scanner.running
    ? "LIVE"
    : "OFF";

  document.getElementById("statsBox").textContent =
    `Disc  ${d.scanner.discovered}\n` +
    `Eval  ${d.scanner.evaluated}\n` +
    `Pass  ${d.scanner.passed}\n` +
    `Skip  ${d.scanner.rejected}`;

  renderPositions(d.positions || []);

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v;
  };
  setVal("inMaxBuy", d.settings.maxBuy);
  setVal("inSlip", d.settings.slippage);
  setVal("inSl", d.settings.stopLoss);
  setVal("inCap", d.settings.dailyLossCap);
  lastBuySize = d.settings.maxBuy;

  document
    .getElementById("btnClearKill")
    .classList.toggle("hidden", !d.hunter.killSwitch);
}

async function loadPulse() {
  const p = await api("/api/pulse");
  document.getElementById("cntNew").textContent = String(p.newPairs.length);
  document.getElementById("cntPass").textContent = String(p.passed.length);
  document.getElementById("cntSkip").textContent = String(p.rejected.length);

  document.getElementById("pulseMeta").textContent = p.scannerRunning
    ? "Scanner LIVE · BUY / auto-hunter use Jupiter"
    : "Scanner idle · showing last saved tokens";

  fillCol(
    document.getElementById("colNew"),
    p.newPairs,
    "No tokens discovered yet"
  );
  fillCol(
    document.getElementById("colPass"),
    p.passed,
    "No tokens passed filters"
  );
  fillCol(
    document.getElementById("colSkip"),
    p.rejected,
    "No rejections yet"
  );
}

async function boot() {
  try {
    await api("/api/me");
    showApp();
    await loadDashboard();
    await loadPulse();
  } catch {
    showGate();
  }
}

document.getElementById("btnRefresh").onclick = async () => {
  await loadDashboard();
  await loadPulse();
};
document.getElementById("btnLogout").onclick = async () => {
  await api("/api/logout", { method: "POST" });
  showGate();
};
document.getElementById("btnStart").onclick = async () => {
  const r = await api("/api/hunter/start", { method: "POST" });
  if (!r.ok) alert(r.error || "Could not start");
  await loadDashboard();
};
document.getElementById("btnStop").onclick = async () => {
  await api("/api/hunter/stop", { method: "POST" });
  await loadDashboard();
};
document.getElementById("btnKill").onclick = async () => {
  if (
    !confirm(
      "Emergency stop blocks new auto entries. Does not sell positions."
    )
  )
    return;
  await api("/api/hunter/kill", { method: "POST" });
  await loadDashboard();
};
document.getElementById("btnClearKill").onclick = async () => {
  await api("/api/hunter/clear-kill", { method: "POST" });
  await loadDashboard();
};
document.getElementById("btnSaveSettings").onclick = async () => {
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
};

boot();
setInterval(() => {
  if (document.getElementById("app").classList.contains("hidden")) return;
  loadDashboard().catch(() => {});
  loadPulse().catch(() => {});
}, 5000);
