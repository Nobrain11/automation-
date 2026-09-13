import { createSession, verifyLoginToken } from "../../src/web/auth.js";

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const telegramId = verifyLoginToken(token);

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
