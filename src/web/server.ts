// src/web/server.ts

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

import { config } from "../config.js";
import { countAllWallets } from "../db/repositories.js";
import { getResolvedDatabasePath } from "../db/sqlite.js";
import { httpDiscovery } from "../scanner/http-discovery.js";
import { scanner } from "../scanner/scanner-instance.js";
import { logger } from "../utils/logger.js";
import {
  createSession,
  destroySession,
  parseCookies,
  resolveSession,
  verifyLoginToken
} from "./auth.js";
import { fetchSpark } from "../services/spark.js";
import {
  buildActivity,
  buildDashboard,
  buildPulse,
  buildTrending,
  clearKill,
  emergencyStop,
  executeBuy,
  executeSell,
  getTokenTerminal,
  patchSettings,
  startHunter,
  stopHunter
} from "./api.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2"
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(data);
}

function sendText(res: ServerResponse, status: number, body: string, type: string) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function requireAuth(req: IncomingMessage, res: ServerResponse): number | null {
  const cookies = parseCookies(req.headers.cookie);
  const telegramId = resolveSession(cookies.sid);
  if (!telegramId) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return null;
  }
  return telegramId;
}

function staticRoots(): string[] {
  return [
    join(process.cwd(), "dist", "public", "terminal"),
    join(process.cwd(), "public", "terminal"),
    join(process.cwd(), "dist", "public"),
    join(process.cwd(), "public")
  ];
}

async function tryStatic(pathname: string): Promise<{ data: Buffer; type: string } | null> {
  const rel = pathname === "/" || pathname === "" ? "/index.html" : pathname;
  const clean = rel.replace(/\.\./g, "");
  for (const root of staticRoots()) {
    try {
      const filePath = join(root, clean.replace(/^\//, ""));
      const data = await readFile(filePath);
      const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
      return { data, type };
    } catch {
      /* try next root */
    }
  }
  for (const root of staticRoots()) {
    try {
      const data = await readFile(join(root, "index.html"));
      return { data, type: MIME[".html"] };
    } catch {
      /* next */
    }
  }
  return null;
}

export async function handleWebRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const path = url.pathname;

    if (path === "/health" || path === "/api/health") {
      const dbPath = getResolvedDatabasePath();
      const persistent =
        dbPath.startsWith("/data") ||
        (dbPath.includes("bot.sqlite") && !dbPath.includes("/tmp"));
      let scannerStats: Record<string, unknown> = {};
      let httpStats: Record<string, unknown> = {};
      try {
        scannerStats = scanner.getStats() as unknown as Record<string, unknown>;
      } catch {
        scannerStats = { error: "unavailable" };
      }
      try {
        httpStats = httpDiscovery.getStats() as Record<string, unknown>;
      } catch {
        httpStats = { error: "unavailable" };
      }

      const botTokenOk = Boolean(config.botToken);
      const keyOk = Boolean(config.walletEncryptionKey);
      const rpcOk = Boolean(config.rpcUrl);

      sendJson(res, 200, {
        ok: true,
        phase1: {
          db: !String(dbPath).includes("memory"),
          telegram: botTokenOk,
          encryption: keyOk,
          rpc: rpcOk,
          persistentVolume: persistent
        },
        dbPath,
        walletRows: countAllWallets(),
        persistentVolume: persistent,
        rpcHost: (() => {
          try {
            return new URL(config.rpcUrl).host;
          } catch {
            return "unknown";
          }
        })(),
        webBaseUrl: config.webBaseUrl || null,
        scanner: scannerStats,
        httpDiscovery: httpStats,
        chain: "solana",
        hint: persistent
          ? "Volume OK — wallets stored"
          : "Mount persistent disk at /data or set DATABASE_PATH to a durable path"
      });
      return;
    }

    if ((path === "/auth/telegram" || path === "/auth/callback") && req.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const verified = verifyLoginToken(token);
      if (!verified) {
        sendText(
          res,
          401,
          "Invalid or expired link. Open WEB TERMINAL again from the Telegram bot.",
          "text/plain"
        );
        return;
      }
      const sid = createSession(verified);
      res.writeHead(302, {
        Location: "/",
        "Set-Cookie": `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
      res.end();
      return;
    }

    if (path === "/api/me" && req.method === "GET") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, { ok: true, telegramId: id });
      return;
    }

    if (path === "/api/dashboard" && req.method === "GET") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await buildDashboard(id));
      return;
    }

    if (path === "/api/activity" && req.method === "GET") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await buildActivity(id));
      return;
    }

    if (path === "/api/pulse" && req.method === "GET") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await buildPulse(id));
      return;
    }

    if (path === "/api/trending" && req.method === "GET") {
      const cookies = parseCookies(req.headers.cookie);
      const id = resolveSession(cookies.sid);
      sendJson(res, 200, await buildTrending());
      return;
    }

    if (path === "/api/decisions" && req.method === "GET") {
      const { buildDecisions } = await import("./api-decisions.js");
      const limit = Number(url.searchParams.get("limit") || 40);
      sendJson(res, 200, buildDecisions(limit));
      return;
    }

    if (path === "/api/token" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";
      const cookies = parseCookies(req.headers.cookie);
      const id = resolveSession(cookies.sid) ?? 0;
      sendJson(res, 200, await getTokenTerminal(id, mint));
      return;
    }

    if (path === "/api/spark" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";
      sendJson(res, 200, await fetchSpark(mint));
      return;
    }

    if (path === "/api/trade/buy" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      const body = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, await executeBuy(id, body));
      return;
    }

    if (path === "/api/trade/sell" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      const body = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, await executeSell(id, body));
      return;
    }

    if (path === "/api/settings" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      const body = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, await patchSettings(id, body));
      return;
    }

    if (path === "/api/hunter/start" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await startHunter(id));
      return;
    }

    if (path === "/api/hunter/stop" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await stopHunter(id));
      return;
    }

    if (path === "/api/hunter/kill" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await emergencyStop(id));
      return;
    }

    if (path === "/api/hunter/clear-kill" && req.method === "POST") {
      const id = requireAuth(req, res);
      if (!id) return;
      sendJson(res, 200, await clearKill(id));
      return;
    }

    if (path === "/api/logout" && req.method === "POST") {
      const cookies = parseCookies(req.headers.cookie);
      destroySession(cookies.sid || "");
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": "sid=; Path=/; Max-Age=0"
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const asset = await tryStatic(
      path.startsWith("/terminal") ? path.replace(/^\/terminal/, "") || "/" : path
    );
    if (asset) {
      res.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-cache" });
      res.end(asset.data);
      return;
    }

    sendText(res, 404, "Not found", "text/plain");
  } catch (error) {
    logger.error("Web request failed", error);
    if (!res.headersSent) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "server_error"
      });
    }
  }
}

export function startWebServer() {
  const server = createServer((req, res) => {
    void handleWebRequest(req, res);
  });
  const port = config.webPort;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`Web terminal listening on 0.0.0.0:${port}`);
  });
  return server;
}
