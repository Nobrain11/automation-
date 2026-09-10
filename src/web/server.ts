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

export function startWebServer() {
  const publicDir = join(process.cwd(), "public", "terminal");
  const rootPublic = join(process.cwd(), "public");

  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || "localhost";
      const url = new URL(req.url || "/", `http://${host}`);
      const path = url.pathname;

      if (path === "/health" || path === "/api/health") {
        const dbPath = getResolvedDatabasePath();
        sendJson(res, 200, {
          ok: true,
          dbPath,
          walletRows: countAllWallets(),
          persistentVolume: dbPath.startsWith("/data"),
          rpcHost: (() => {
            try {
              return new URL(config.rpcUrl).host;
            } catch {
              return "unknown";
            }
          })(),
          webBaseUrl: config.webBaseUrl,
          scanner: scanner.getStats(),
          httpDiscovery: httpDiscovery.getStats(),
          hint: dbPath.startsWith("/data")
            ? "Volume OK — wallets stored"
            : "Attach Railway volume at /data"
        });
        return;
      }

      if (path === "/auth/telegram" && req.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const verified = verifyLoginToken(token);
        if (!verified) {
          sendText(res, 401, "Invalid or expired link", "text/plain");
          return;
        }
        const sid = createSession(verified);
        res.writeHead(302, {
          Location: "/",
          "Set-Cookie": `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
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
        sendJson(res, 200, buildActivity());
        return;
      }

      if (path === "/api/pulse" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, buildPulse());
        return;
      }

      if (path === "/api/trending" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, await buildTrending());
        return;
      }

      if (path === "/api/token" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        const mint = url.searchParams.get("mint") || "";
        sendJson(res, 200, await getTokenTerminal(id, mint));
        return;
      }

      if (path === "/api/spark" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        const mint = url.searchParams.get("mint") || "";
        sendJson(res, 200, await fetchSpark(mint));
        return;
      }

      if (path === "/api/trade/buy" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        let body: any = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        sendJson(res, 200, await executeBuy(id, body));
        return;
      }

      if (path === "/api/trade/sell" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        let body: any = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        sendJson(res, 200, await executeSell(id, body));
        return;
      }

      if (path === "/api/settings" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        let body: any = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        sendJson(res, 200, patchSettings(id, body));
        return;
      }

      if (path === "/api/hunter/start" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, startHunter(id));
        return;
      }

      if (path === "/api/hunter/stop" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, stopHunter(id));
        return;
      }

      if (path === "/api/hunter/kill" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, emergencyStop(id));
        return;
      }

      if (path === "/api/hunter/clear-kill" && req.method === "POST") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, clearKill(id));
        return;
      }

      if (path === "/api/logout" && req.method === "POST") {
        const cookies = parseCookies(req.headers.cookie);
        destroySession(cookies.sid);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Set-Cookie": "sid=; Path=/; HttpOnly; Max-Age=0"
        });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // SPA routes — terminal lives at / and /terminal
      if (
        path === "/" ||
        path === "/terminal" ||
        path === "/terminal/" ||
        path === "/app" ||
        path === "/app/"
      ) {
        const data = await readFile(join(publicDir, "index.html"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache"
        });
        res.end(data);
        return;
      }

      let filePath = join(publicDir, path);
      if (path === "/logo.svg" || path === "/favicon.svg") {
        filePath = join(rootPublic, path.slice(1));
      }
      try {
        const data = await readFile(filePath);
        const type = MIME[extname(filePath)] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
        res.end(data);
      } catch {
        sendText(res, 404, "Not found", "text/plain");
      }
    } catch (e) {
      logger.error("web error", e);
      sendJson(res, 500, { ok: false, error: "server error" });
    }
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, "0.0.0.0", () => {
    logger.info(`Web terminal listening on 0.0.0.0:${port}`);
  });

  return server;
}
