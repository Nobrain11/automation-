import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const dir = dirname(config.databasePath);

try {
  mkdirSync(dir, { recursive: true });
} catch (error) {
  logger.error(
    `Cannot create database directory: ${dir}. On Railway, mount a volume at /data.`,
    error
  );
  throw error;
}

const alreadyExists = existsSync(config.databasePath);

export const db = new Database(config.databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

logger.info(
  `SQLite: ${config.databasePath} (${alreadyExists ? "existing file — wallets should persist" : "new file — empty DB"})`
);

if (!alreadyExists && config.databasePath.startsWith("/data")) {
  logger.warn(
    "New database under /data. If this happens on every deploy, the Railway volume is not mounted at /data."
  );
}

if (!config.databasePath.startsWith("/data") && process.env.RAILWAY_ENVIRONMENT) {
  logger.warn(
    "DATABASE_PATH is not under /data on Railway — wallets will be wiped on every redeploy. Mount a volume at /data and set DATABASE_PATH=/data/bot.sqlite"
  );
}

export function closeDatabase(): void {
  db.close();
}
