/** Shared SVG spark + card mini charts via /api/spark */

function svgSparkLine(closes, w, h) {
  w = w || 320;
  h = h || 88;
  if (!closes || closes.length < 2) return "";
  const min = Math.min.apply(null, closes);
  const max = Math.max.apply(null, closes);
  const span = max - min || max * 0.01 || 1;
  const pad = 3;
  const pts = closes.map(function (c, i) {
    const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
    const y = h - pad - ((c - min) / span) * (h - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "#1dff9a" : "#ff4d62";
  const fill = up ? "rgba(29,255,154,0.12)" : "rgba(255,77,98,0.12)";
  const area =
    pad + "," + (h - pad) + " " + pts.join(" ") + " " + (w - pad) + "," + (h - pad);
  return (
    '<svg class="v2-spark" viewBox="0 0 ' +
    w +
    " " +
    h +
    '" width="100%" height="' +
    h +
    '" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon points="' +
    area +
    '" fill="' +
    fill +
    '" />' +
    '<polyline points="' +
    pts.join(" ") +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" /></svg>'
  );
}

window.__sparkCache = window.__sparkCache || {};

async function loadSpark(mint) {
  if (!mint) return null;
  if (window.__sparkCache[mint]) return window.__sparkCache[mint];
  try {
    const r =
      typeof api === "function"
        ? await api("/api/spark?mint=" + encodeURIComponent(mint))
        : await fetch("/api/spark?mint=" + encodeURIComponent(mint), {
            credentials: "same-origin"
          }).then(function (x) {
            return x.json();
          });
    if (r && r.ok && r.closes && r.closes.length >= 3) {
      window.__sparkCache[mint] = r;
      return r;
    }
  } catch (e) {}
  return null;
}

/** Fill #ttSpark if present; also mini .card-spark[data-mint] */
async function hydrateSparks(root) {
  root = root || document;
  const detail = root.querySelector && root.querySelector("#ttSpark");
  if (detail) {
    const mint =
      detail.getAttribute("data-mint") ||
      (window.__lastTokenMint || "");
    const note = root.querySelector("#ttSparkNote");
    const data = await loadSpark(mint);
    if (data && data.closes) {
      detail.innerHTML = svgSparkLine(data.closes, 320, 88);
      if (note) {
        var first = data.closes[0];
        var last = data.closes[data.closes.length - 1];
        var pct = first ? (((last - first) / first) * 100).toFixed(2) : "—";
        note.textContent =
          "Real 5m OHLCV · " +
          data.closes.length +
          " pts · " +
          pct +
          "% · " +
          (data.source || "gecko");
      }
    } else if (detail.innerHTML.indexOf("Loading") >= 0 || detail.querySelector(".empty")) {
      detail.innerHTML = '<div class="empty">No candle data for this pool yet</div>';
      if (note) note.textContent = "Chart appears when a pool has public OHLCV";
    }
  }

  var nodes = root.querySelectorAll
    ? root.querySelectorAll(".card-spark[data-mint]")
    : [];
  for (var i = 0; i < nodes.length; i++) {
    (function (el) {
      var mint = el.getAttribute("data-mint");
      if (!mint || el.dataset.loaded) return;
      el.dataset.loaded = "1";
      loadSpark(mint).then(function (data) {
        if (data && data.closes) {
          el.innerHTML = svgSparkLine(data.closes, 160, 36);
        } else {
          el.innerHTML = "";
        }
      });
    })(nodes[i]);
  }
}

// After each workspace render, hydrate sparks (throttled)
(function () {
  var t = null;
  var obs = new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () {
      var ws = document.getElementById("workspace");
      if (ws) hydrateSparks(ws);
    }, 200);
  });
  if (document.getElementById("workspace")) {
    obs.observe(document.getElementById("workspace"), {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      var ws = document.getElementById("workspace");
      if (ws)
        obs.observe(ws, { childList: true, subtree: true });
    });
  }
})();
