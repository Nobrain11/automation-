import { bot } from "./bot/bot.js";

import {
  validateConfig
} from "./config.js";

import {
  runMigrations
} from "./db/migrations.js";

import {
  closeDatabase,
  db
} from "./db/sqlite.js";

import {
  scanner,
  setDecisionHandler
} from "./scanner/scanner-instance.js";

import {
  notifyQualifiedToken
} from "./scanner/notifier.js";

import {
  TokenCandidate
} from "./scanner/types.js";

import {
  logger
} from "./utils/logger.js";

function getRunningUserIds(): number[] {
  try {
    const rows = db
      .prepare(
        `
        SELECT telegram_id
        FROM auto_settings
        WHERE auto_state = 'running'
          AND kill_switch = 0
        `
      )
      .all() as { telegram_id: number }[];

    return rows.map((r) => r.telegram_id);
  } catch {
    return [];
  }
}

async function onTokenDecision(
  _telegramId: number,
  token: TokenCandidate
): Promise<void> {
  const users = getRunningUserIds();

  if (users.length === 0) {
    return;
  }

  const targets = users.slice(0, 50);

  // Passes: push to Telegram (actionable).
  // Skips: stored in DB with real reasons — view via Decisions screen (avoids spam).
  if (!token.passed) {
    return;
  }

  for (const userId of targets) {
    try {
      await notifyQualifiedToken(bot, userId, token);
    } catch (error) {
      logger.warn(
        `Decision notify failed for ${userId}`,
        error
      );
    }
  }
}

async function main() {
  validateConfig();

  runMigrations();

  setDecisionHandler(onTokenDecision);

  await scanner.start();

  logger.info("Database initialized.");
  logger.info("Pump.fun discovery + decision engine initialized.");

  await bot.start({
    onStart: () => {
      logger.info("Telegram bot started.");
    }
  });
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down...`);

  try {
    await scanner.stop();
  } catch (error) {
    logger.error("Failed to stop scanner.", error);
  }

  try {
    await bot.stop();
  } catch (error) {
    logger.error("Failed to stop Telegram bot.", error);
  }

  try {
    closeDatabase();
  } catch (error) {
    logger.error("Failed to close database.", error);
  }

  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

main().catch((error) => {
  logger.error("Fatal startup error.", error);
  process.exit(1);
});
