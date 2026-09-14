import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Terminal API proxy for Vercel.
 * Avoid crashing the whole deployment if native sqlite cannot load.
 */
export const config = {
  maxDuration: 30
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const originalUrl = req.url || "/";
    // Strip /api/terminal prefix if present
    req.url = originalUrl.replace(/^\/api\/terminal(?=\/|$)/, "") || "/";

    const mod = await import("../../src/web/server.js");
    if (typeof mod.handleWebRequest !== "function") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "handler_missing" }));
      return;
    }
    await mod.handleWebRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: message,
          hint: "Vercel serverless cannot run full SQLite bot reliably. Use a VPS or check WALLET_ENCRYPTION_KEY / TELEGRAM_BOT_TOKEN."
        })
      );
    }
  }
}
