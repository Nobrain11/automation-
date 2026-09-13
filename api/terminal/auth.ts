import type { IncomingMessage, ServerResponse } from "node:http";

function sendText(
  response: ServerResponse,
  statusCode: number,
  body: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  response.end(body);
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const host = request.headers.host || "localhost";
    const url = new URL(request.url || "/", `https://${host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      sendText(
        response,
        400,
        "Missing login token. Open WEB TERMINAL again from the Telegram bot."
      );
      return;
    }

    if (!process.env.WALLET_ENCRYPTION_KEY?.trim()) {
      sendText(
        response,
        500,
        "Server misconfigured: WALLET_ENCRYPTION_KEY is missing in Vercel env."
      );
      return;
    }

    const { createSession, verifyLoginToken } = await import(
      "../../src/web/auth.js"
    );

    let telegramId: number | null = null;
    try {
      telegramId = verifyLoginToken(token);
    } catch {
      sendText(
        response,
        401,
        "Invalid login link. Open WEB TERMINAL again from the Telegram bot."
      );
      return;
    }

    if (!telegramId) {
      sendText(
        response,
        401,
        "Invalid or expired link. Open WEB TERMINAL again from the Telegram bot."
      );
      return;
    }

    const session = createSession(telegramId);
    response.writeHead(302, {
      Location: "/terminal",
      "Set-Cookie": `sid=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    });
    response.end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    sendText(response, 500, `Terminal auth error: ${message}`);
  }
}
