const $ = (id) => document.getElementById(id);
const format = (value, digits = 4) => Number(value || 0).toFixed(digits);

function render(data) {
  const wallet = data.wallet || {};
  const portfolio = data.portfolio || {};
  const pnl = data.pnl || {};
  const positions = data.positions || [];
  $("balance").textContent = `${format(wallet.balance)} SOL`;
  const realized = Number(portfolio.realizedSol || pnl.todaySol || 0);
  const unrealized = positions.reduce((sum, position) => sum + Number(position.pnlSol || 0), 0);
  $("realized").textContent = format(realized);
  $("unrealized").textContent = format(unrealized);
  const total = realized + unrealized;
  const totalNode = $("total-pnl");
  totalNode.textContent = `${total >= 0 ? "+" : ""}${format(total)} SOL`;
  totalNode.className = total >= 0 ? "positive" : "negative";
  $("position-count").textContent = `(${positions.length})`;
  $("positions").outerHTML = positions.length
    ? `<div id="positions">${positions.map((position) => `<article class="position"><div class="position-row"><span class="position-symbol">$${position.symbol || "TOKEN"}</span><strong class="${Number(position.pnlPct || 0) >= 0 ? "positive" : "negative"}">${Number(position.pnlPct || 0) >= 0 ? "+" : ""}${format(position.pnlPct, 2)}%</strong></div><div class="position-meta">Entry ${format(position.entrySol)} SOL · ${position.mint || ""}</div></article>`).join("")}</div>`
    : `<div id="positions" class="empty">No open positions. Positions open after confirmed buys.</div>`;
}

async function load() {
  const error = $("error");
  error.classList.add("hidden");
  try {
    const response = await fetch("/api/dashboard", { credentials: "include" });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "Unauthorized");
    render(data);
  } catch (cause) {
    error.textContent = cause.message;
    error.classList.remove("hidden");
  }
}

$("refresh").addEventListener("click", load);
load();
