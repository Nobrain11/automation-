/** Inject movers filter caption when SCAN renders */
(function () {
  setInterval(() => {
    const ws = document.getElementById("workspace");
    if (!ws) return;
    if (ws.querySelector("#scanFilterNote")) return;
    const h = ws.querySelector("h1");
    if (!h) return;
    const title = (h.textContent || "").toUpperCase();
    if (!title.includes("TREND") && !title.includes("SCAN") && !title.includes("MOVER")) {
      // also match panels that say MOVERS
      const body = (ws.textContent || "").slice(0, 200);
      if (!/mover|trend|scan/i.test(body)) return;
    }
    const note = document.createElement("div");
    note.id = "scanFilterNote";
    note.className = "muted";
    note.style.cssText = "font-family:var(--mono);font-size:10px;margin:-4px 0 10px;letter-spacing:0.04em";
    note.textContent = "FILTER · mcap > $5k · ≤ $100k · liq ≥ $2k when known";
    h.insertAdjacentElement("afterend", note);
  }, 800);
})();
