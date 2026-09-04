// src/index.ts — start web first; never die on optional systems

import { bot } from "./bot/bot.js";
import { config, validateConfig } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { closeDatabase } from "./db/sqlite.js";
import { scanner, setDecisionHandler } from "./scanner/scanner-instance.js";
import { onTokenDecision } from "./services/hunter.js";
import {
  startPositionMonitor,
  stopPositionMonitor
} from "./services/monitor.js";
import { logger } from "./utils/logger.js";
import { startWebServer } from "./web/server.js";

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

  // Always bind HTTP first so Railway health checks pass
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

  void scanner
    .start()
    .then(() => logger.info("Pump.fun discovery engine initialized."))
    .catch((error) =>
      logger.error("Scanner failed to start (web + bot still running).", error)
    );

  try {
    await bot.start({
      onStart: () => {
        logger.info("Telegram bot started.");
      }
    });
  } catch (error) {
    logger.error(
      "Telegram bot failed to start; web terminal remains available.",
      error
    );
  }
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down...`);
  try {
    stopPositionMonitor();
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
