import { createSession, verifyLoginToken } from "../../src/web/auth.js";

export default function handler(request: Request): Response {
  const requestUrl = request.url.startsWith("http")
    ? request.url
    : `https://${request.headers.get("host") || "localhost"}${request.url}`;
  const url = new URL(requestUrl);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      "Missing login token. Open WEB TERMINAL again from the Telegram bot.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }
    );
  }

  let telegramId: string | null;
  try {
    telegramId = verifyLoginToken(token);
  } catch {
    return new Response(
      "Invalid login link. Open WEB TERMINAL again from the Telegram bot.",
      {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }
    );
  }

  if (!telegramId) {
    return new Response(
      "Invalid or expired link. Open WEB TERMINAL again from the Telegram bot.",
      {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }
    );
  }

  const session = createSession(telegramId);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `sid=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    }
  });
}
