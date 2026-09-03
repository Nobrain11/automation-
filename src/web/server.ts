// src/web/server.ts — PUMP AUTO terminal webapp

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  createSession,
  destroySession,
  parseCookies,
  resolveSession,
  verifyLoginToken
} from "./auth.js";
import {
  buildActivity,
  buildDashboard,
  buildPulse,
  clearKill,
  emergencyStop,
  executeBuy,
  executeSell,
  patchSettings,
  startHunter,
  stopHunter
} from "./api.js";
import { resolvePublicTerminalDir } from "./paths.js";

const PUBLIC_DIR = resolvePublicTerminalDir();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json"
};

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type = "text/plain; charset=utf-8",
  extraHeaders: Record<string, string> = {}
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sessionFromReq(req: IncomingMessage): number | null {
  const cookies = parseCookies(req.headers.cookie);
  return resolveSession(cookies["pa_session"]);
}

async function serveStatic(res: ServerResponse, urlPath: string) {
  let rel = urlPath === "/" || urlPath === "" ? "/index.html" : urlPath;
  if (rel.includes("..")) {
    send(res, 400, "Bad path");
    return;
  }
  const filePath = join(PUBLIC_DIR, rel.replace(/^\//, ""));
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    send(res, 200, data, type);
  } catch {
    try {
      const data = await readFile(join(PUBLIC_DIR, "index.html"));
      send(res, 200, data, "text/html; charset=utf-8");
    } catch {
      send(res, 404, `Terminal UI not found. Looked in: ${PUBLIC_DIR}`);
    }
  }
}

function requireAuth(
  req: IncomingMessage,
  res: ServerResponse
): number | null {
  const id = sessionFromReq(req);
  if (!id) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }
  return id;
}

export function startWebServer(): void {
  const port = config.webPort;
  logger.info(`Terminal static dir: ${PUBLIC_DIR}`);

  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || "localhost";
      const url = new URL(req.url || "/", `http://${host}`);
      const path = url.pathname;

      if (path === "/auth/callback" && req.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const telegramId = verifyLoginToken(token);
        if (!telegramId) {
          send(
            res,
            401,
            "Login link expired or invalid. Open a new link from the Telegram bot."
          );
          return;
        }
        const session = createSession(telegramId);
        const secure = config.webBaseUrl.startsWith("https") ? "; Secure" : "";
        send(res, 302, "", "text/plain", {
          Location: "/",
          "Set-Cookie": `pa_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure}`
        });
        return;
      }

      if (path === "/api/me" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, { telegramId: id });
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
        sendJson(res, 200, buildActivity(40));
        return;
      }

      if (path === "/api/pulse" && req.method === "GET") {
        const id = requireAuth(req, res);
        if (!id) return;
        sendJson(res, 200, buildPulse(30));
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
        let body: Record<string, unknown> = {};
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
        if (cookies["pa_session"]) destroySession(cookies["pa_session"]);
        send(res, 200, JSON.stringify({ ok: true }), "application/json", {
          "Set-Cookie": "pa_session=; Path=/; HttpOnly; Max-Age=0"
        });
        return;
      }

      if (path === "/health") {
        sendJson(res, 200, { ok: true, publicDir: PUBLIC_DIR });
        return;
      }

      await serveStatic(res, path);
    } catch (error) {
      logger.error("Web server error", error);
      sendJson(res, 500, { error: "internal" });
    }
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info(`Web terminal listening on 0.0.0.0:${port}`);
  });

  server.on("error", (err) => {
    logger.error("HTTP server failed to bind", err);
  });
}
