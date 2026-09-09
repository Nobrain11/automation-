/** Referral program — real codes from API only */

function renderReferral(d) {
  window.__lastDash = d;
  const r = d.referral;
  if (!r || !r.code) {
    return `<div class="panel cmd-hero">
      <div class="cmd-kicker">REFERRAL</div>
      <div class="cmd-title">Invite</div>
      <p class="cmd-sub">Your code is created when you open the terminal from Telegram.</p>
      <div class="empty">No referral record yet</div>
      <button type="button" class="action ghost" data-go="home">← Home</button>
    </div>`;
  }

  const link =
    r.link ||
    (r.code ? "https://t.me/share/url?url=" + encodeURIComponent(r.code) : "");
  const tgDeep =
    r.telegramLink ||
    (r.botUsername
      ? "https://t.me/" + r.botUsername + "?start=ref_" + r.code
      : null);

  const share = tgDeep || link;

  return `
    <div class="panel cmd-hero">
      <div class="cmd-kicker">REFERRAL</div>
      <div class="cmd-title">Invite</div>
      <p class="cmd-sub">Share your link. Friends who start the bot with your code count as referrals.</p>
      <div class="cmd-grid">
        <div class="cmd-stat"><span>REFERRED</span><b>${r.referredCount ?? 0}</b></div>
        <div class="cmd-stat"><span>EARNED</span><b>${Number(r.totalEarnedSol || 0).toFixed(4)} SOL</b></div>
        <div class="cmd-stat"><span>RATE</span><b>${r.commissionRate ?? 10}%</b></div>
        <div class="cmd-stat"><span>CODE</span><b style="font-size:12px">${r.code}</b></div>
      </div>
    </div>

    <div class="panel">
      <h2>Your link</h2>
      <div class="ws-meta" id="refLinkText" style="word-break:break-all">${share || r.code}</div>
      <div class="row" style="margin-top:10px">
        <button type="button" class="action primary" id="btnCopyRef">COPY LINK</button>
        <button type="button" class="action ghost" data-go="home">← Home</button>
      </div>
      <p class="muted" style="font-size:11px;margin-top:10px">Commission only posts when the bot records a paid event into referral_earnings. Count is live; earned may stay 0 until payouts are wired to trades.</p>
    </div>`;
}

(function () {
  const origMenu = window.renderMenu;
  window.renderMenu = function (d) {
    if (state?.menuView === "referral") return renderReferral(d);
    if (typeof origMenu === "function") return origMenu.apply(this, arguments);
    return renderReferral(d);
  };

  document.addEventListener("click", (e) => {
    if (e.target?.id !== "btnCopyRef") return;
    const text =
      document.getElementById("refLinkText")?.textContent?.trim() ||
      window.__lastDash?.referral?.code;
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => {
        e.target.textContent = "COPIED";
        setTimeout(() => {
          e.target.textContent = "COPY LINK";
        }, 1200);
      },
      () => prompt("Referral", text)
    );
  });
})();
