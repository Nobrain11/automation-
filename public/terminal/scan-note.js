/** Prefill trade mint from SCAN analyze buttons + filter note */
(function () {
  document.addEventListener(
    "click",
    (e) => {
      const trade = e.target.closest?.(".tok-buy");
      if (trade) {
        const mint = trade.closest(".token")?.dataset.mint;
        if (mint) window.__prefillMint = mint;
      }
    },
    true
  );
})();
