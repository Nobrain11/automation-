import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const LOGIN_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signingKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("WALLET_ENCRYPTION_KEY is missing");
  }
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(raw).digest();
}

function verifyLoginToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idText, expiryText, signature] = parts;
  const telegramId = Number(idText);
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(telegramId) || !Number.isFinite(expiry)) return null;
  if (Date.now() > expiry) return null;

  const expected = createHmac("sha256", signingKey())
    .update(`${idText}.${expiryText}`)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  return telegramId;
}

function createSession(telegramId: number): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `web.${telegramId}.${expiry}`;
  const signature = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(
    request.url || "/",
    `https://${request.headers.host || "localhost"}`
  );
}

function sendText(
  response: ServerResponse,
  statusCode: number,
  body: string
): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(body);
}

export const config = {
  maxDuration: 10
};

export default function handler(
  request: IncomingMessage,
  response: ServerResponse
): void {
  try {
    const token = requestUrl(request).searchParams.get("token");

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
        "Server misconfigured: set WALLET_ENCRYPTION_KEY in Vercel Environment Variables."
      );
      return;
    }

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
      Location: "/",
      "Set-Cookie": `sid=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    });
    response.end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    sendText(response, 500, `Terminal auth error: ${message}`);
  }
}
