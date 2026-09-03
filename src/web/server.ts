// src/web/server.ts — PUMP AUTO terminal webapp

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

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
  emergencyStop,
  startHunter,
  stopHunter
} from "./api.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "../../public/terminal");

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
      send(res, 404, "Not found");
    }
  }
}

export function startWebServer(): void {
  const port = config.webPort;

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
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, { telegramId });
        return;
      }

      if (path === "/api/dashboard" && req.method === "GET") {
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, await buildDashboard(telegramId));
        return;
      }

      if (path === "/api/activity" && req.method === "GET") {
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, buildActivity(25));
        return;
      }

      if (path === "/api/hunter/start" && req.method === "POST") {
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, startHunter(telegramId));
        return;
      }

      if (path === "/api/hunter/stop" && req.method === "POST") {
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, stopHunter(telegramId));
        return;
      }

      if (path === "/api/hunter/kill" && req.method === "POST") {
        const telegramId = sessionFromReq(req);
        if (!telegramId) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        sendJson(res, 200, emergencyStop(telegramId));
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
        sendJson(res, 200, { ok: true });
        return;
      }

      await serveStatic(res, path);
    } catch (error) {
      logger.error("Web server error", error);
      sendJson(res, 500, { error: "internal" });
    }
  });

  server.listen(port, () => {
    logger.info(`Web terminal listening on port ${port}`);
  });
}
