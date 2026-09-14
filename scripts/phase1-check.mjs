#!/usr/bin/env node
/**
 * Phase 1 smoke check against a running PUMP AUTO instance.
 * Usage: node scripts/phase1-check.mjs https://your-host
 */

const base = (process.argv[2] || process.env.WEB_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

async function main() {
  const results = [];

  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`OK   ${name}`);
    } catch (e) {
      results.push({ name, ok: false, error: String(e.message || e) });
      console.log(`FAIL ${name}: ${e.message || e}`);
    }
  }

  await check("health", async () => {
    const r = await fetch(`${base}/health`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error(JSON.stringify(j));
    if (j.walletRows === undefined) throw new Error("missing walletRows");
  });

  await check("trending", async () => {
    const r = await fetch(`${base}/api/trending`);
    // may be 401 without session — still proves route is up if not 404/500
    if (r.status === 404) throw new Error("404");
    if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
  });

  await check("terminal_static", async () => {
    const r = await fetch(`${base}/`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const t = await r.text();
    if (!t.includes("html") && !t.includes("PUMP") && t.length < 20) {
      throw new Error("empty shell");
    }
  });

  const failed = results.filter((x) => !x.ok);
  console.log("\n---");
  console.log(`Passed ${results.length - failed.length}/${results.length}`);
  process.exit(failed.length ? 1 : 0);
}

main();
