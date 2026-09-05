// src/index.ts — start web first; never die on optional systems

import { bot } from "./bot/bot.js";
import { config, validateConfig } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { closeDatabase } from "./db/sqlite.js";
import {
  httpDiscovery,
  setHttpDecisionHandler
} from "./scanner/http-discovery.js";
import { scanner, setDecisionHandler } from "./scanner/scanner-instance.js";
import { onTokenDecision } from "./services/hunter.js";
import {
  startPositionMonitor,
  stopPositionMonitor
} from "./services/monitor.js";
import { logger } from "./utils/logger.js";
import { startWebServer } from "./web/server.js";

async function startTelegramSafely() {
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    logger.info("Telegram webhook cleared (long-polling mode).");
  } catch (error) {
    logger.warn("deleteWebhook failed (continuing)", error);
  }

  await new Promise((r) => setTimeout(r, 2500));

  try {
    await bot.start({
      onStart: () => {
        logger.info("Telegram bot started.");
      }
    });
  } catch (error: any) {
    const desc = String(error?.description || error?.message || error);
    if (desc.includes("409") || desc.includes("Conflict")) {
      logger.error(
        "Telegram 409 Conflict: another process still uses this BOT_TOKEN. " +
          "Replicas must be 1. Or revoke token in BotFather and update BOT_TOKEN."
      );
      return;
    }
    logger.error(
      "Telegram bot failed to start; web terminal remains available.",
      error
    );
  }
}

async function main() {
  validateConfig();

  try {
    logger.info(`Using Solana RPC host: ${new URL(config.rpcUrl).host}`);
  } catch {
    logger.warn("Could not parse SOLANA_RPC_URL.");
  }

  runMigrations();
  logger.info("Database initialized.");

  setDecisionHandler(onTokenDecision);
  setHttpDecisionHandler(onTokenDecision);

  startWebServer();
  if (config.webBaseUrl) {
    logger.info(`Web terminal: ${config.webBaseUrl}`);
  } else {
    logger.warn("WEB_BASE_URL not set — Telegram login links will fail.");
  }

  try {
    startPositionMonitor();
  } catch (error) {
    logger.error("Position monitor failed to start", error);
  }

  try {
    httpDiscovery.start(20_000);
  } catch (error) {
    logger.error("HTTP discovery failed to start", error);
  }

  void scanner
    .start()
    .then(() => logger.info("Pump.fun log scanner initialized."))
    .catch((error) =>
      logger.error("WS scanner failed (HTTP discovery still running).", error)
    );

  await startTelegramSafely();
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down...`);
  try {
    stopPositionMonitor();
  } catch {
    /* ignore */
  }
  try {
    httpDiscovery.stop();
  } catch {
    /* ignore */
  }
  try {
    await bot.stop();
  } catch (error) {
    logger.error("Failed to stop Telegram bot.", error);
  }
  try {
    await scanner.stop();
  } catch (error) {
    logger.error("Failed to stop scanner.", error);
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

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", reason);
});

main().catch((error) => {
  logger.error("Fatal startup error.", error);
  process.exit(1);
});
