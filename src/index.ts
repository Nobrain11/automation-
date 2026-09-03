// src/index.ts

import { bot } from "./bot/bot.js";
import { config, validateConfig } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { closeDatabase } from "./db/sqlite.js";
import { scanner } from "./scanner/scanner-instance.js";
import { logger } from "./utils/logger.js";
import { startWebServer } from "./web/server.js";

async function main() {
  validateConfig();

  try {
    const rpcHost = new URL(config.rpcUrl).host;
    logger.info(`Using Solana RPC host: ${rpcHost}`);
  } catch {
    logger.warn("Could not parse SOLANA_RPC_URL for logging.");
  }

  runMigrations();
  logger.info("Database initialized.");

  await scanner.start();
  logger.info("Pump.fun discovery engine initialized.");

  startWebServer();
  if (config.webBaseUrl) {
    logger.info(`Web terminal public URL: ${config.webBaseUrl}`);
  } else {
    logger.warn(
      "WEB_BASE_URL not set — set it to your public HTTPS URL so Telegram login links work."
    );
  }

  await bot.start({
    onStart: () => {
      logger.info("Telegram bot started.");
    }
  });
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down...`);
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

main().catch((error) => {
  logger.error("Fatal startup error.", error);
  process.exit(1);
});
