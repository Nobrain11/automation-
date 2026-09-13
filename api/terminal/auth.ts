export default async function handler(request: Request): Promise<Response> {
  try {
    const requestUrl = request.url.startsWith("http")
      ? request.url
      : `https://${request.headers.get("host") || "localhost"}${request.url}`;
    const url = new URL(requestUrl);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        "Missing login token. Open WEB TERMINAL again from the Telegram bot.",
        { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    if (!process.env.WALLET_ENCRYPTION_KEY?.trim()) {
      return new Response(
        "Server misconfigured: WALLET_ENCRYPTION_KEY is missing in Vercel env.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const { createSession, verifyLoginToken } = await import(
      "../../src/web/auth.js"
    );

    let telegramId: number | null = null;
    try {
      telegramId = verifyLoginToken(token);
    } catch {
      return new Response(
        "Invalid login link. Open WEB TERMINAL again from the Telegram bot.",
        { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    if (!telegramId) {
      return new Response(
        "Invalid or expired link. Open WEB TERMINAL again from the Telegram bot.",
        { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } }
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return new Response(`Terminal auth error: ${message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
