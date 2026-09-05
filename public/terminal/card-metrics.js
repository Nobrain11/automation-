/** Richer coin cards + intro (overrides tokenCard after app.js) */

function tokenCard(t) {
  const mint = t.mint || "";
  const sym = String(t.symbol || "???").replace(/[<>"']/g, "");
  const name = String(t.name || "").replace(/[<>"']/g, "");
  const price = t.priceUsd != null ? fmtUsd(t.priceUsd) : "—";
  const mcap = t.marketCap != null ? fmtUsd(t.marketCap) : "—";
  const liq =
    t.liquidityUsd != null
      ? fmtUsd(t.liquidityUsd)
      : t.liquiditySol != null
        ? fmtNum(t.liquiditySol, 3) + " SOL"
        : "—";
  const vol =
    t.volume24h != null
      ? fmtUsd(t.volume24h)
      : t.volume1h != null
        ? fmtUsd(t.volume1h)
        : t.volume1mUsd != null
          ? fmtUsd(t.volume1mUsd)
          : "—";
  const chg =
    t.priceChange5m != null
      ? fmtPct(t.priceChange5m)
      : t.priceChange24h != null
        ? fmtPct(t.priceChange24h)
        : "—";
  const chgClass =
    (t.priceChange5m ?? t.priceChange24h) == null
      ? ""
      : (t.priceChange5m ?? t.priceChange24h) >= 0
        ? "ok"
        : "bad";

  const rev = t.review;
  const grade = rev?.grade
    ? `<span class="grade ${gradeClass(rev.grade)}">${rev.grade} ${rev.score}</span>`
    : "";
  const badges = [];
  if (t.isPump) badges.push('<span class="badge pump">PUMP</span>');
  if (t.passed) badges.push('<span class="badge pump">PASS</span>');
  if (rev?.labels?.length) {
    for (const l of rev.labels.slice(0, 2)) {
      badges.push(`<span class="badge">${String(l).replace(/[<>]/g, "")}</span>`);
    }
  }

  const riskLine =
    rev?.risks?.length
      ? `<div class="risks">⚠ ${rev.risks.slice(0, 2).join(" · ")}</div>`
      : "";
  const summary = rev?.summary
    ? `<div class="review-sum">${String(rev.summary).replace(/[<>]/g, "")}</div>`
    : "";

  const initials = sym.slice(0, 2).toUpperCase();
  const img = t.imageUrl
    ? `<img class="tok-img" src="${t.imageUrl}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\'tok-img placeholder\'>${initials}</div>'" />`
    : `<div class="tok-img placeholder">${initials}</div>`;

  const ms = t.milestoneSummary;
  const msLine = ms
    ? `<div class="tok-ms">${ms.pass}/${ms.total} filters · ${ms.fail} fail</div>`
    : "";

  return `
    <div class="token" data-mint="${mint}" data-symbol="${sym}">
      <div class="token-head">
        ${img}
        <div class="token-id">
          <div class="sym-row"><span class="sym">$${sym}</span>${grade}</div>
          <div class="name-row">${name || "—"}</div>
          <div class="badge-row">${badges.join("")}</div>
        </div>
        <div class="age ${chgClass}">${chg}</div>
      </div>
      <div class="metrics metrics-4">
        <div><span>PRICE</span><b>${price}</b></div>
        <div><span>MCAP</span><b>${mcap}</b></div>
        <div><span>LIQ</span><b>${liq}</b></div>
        <div><span>VOL</span><b>${vol}</b></div>
      </div>
      ${msLine}
      ${summary}
      ${riskLine}
      <div class="mint">${mint}</div>
      <div class="token-actions">
        <button type="button" class="action ghost tok-analyze">ANALYZE</button>
        <button type="button" class="action primary tok-buy">TRADE</button>
        <button type="button" class="action ghost tok-copy">COPY</button>
      </div>
    </div>`;
}

function playIntro() {
  if (sessionStorage.getItem("pa_intro")) return;
  sessionStorage.setItem("pa_intro", "1");
  const el = document.getElementById("intro");
  if (!el) return;
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("hide");
    setTimeout(() => el.classList.add("hidden"), 500);
  }, 1600);
}

const _showApp = showApp;
showApp = function () {
  playIntro();
  _showApp();
};
