export const config = {
  maxDuration: 30
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405 }
    );
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const receivedSecret = request.headers
      .get("x-telegram-bot-api-secret-token")
      ?.trim();
    if (receivedSecret !== expectedSecret) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const token =
    process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim();
  if (!token) {
    return Response.json(
      { ok: false, error: "missing_bot_token" },
      { status: 500 }
    );
  }

  try {
    const update = await request.json();
    if (!update || typeof update !== "object") {
      return Response.json(
        { ok: false, error: "invalid_update" },
        { status: 400 }
      );
    }

    const { bot } = await import("../../src/bot/bot.js");
    await bot.handleUpdate(update as object);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "update_failed";
    console.error("Telegram webhook update failed", error);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
