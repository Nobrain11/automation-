import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

function canUseDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".write-test");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveDbPath(): string {
  const preferred = config.databasePath;
  const preferredDir = dirname(preferred);

  if (canUseDir(preferredDir)) {
    return preferred;
  }

  logger.warn(
    `Cannot write database at ${preferred}. Falling back to ./data/bot.sqlite (wallets will NOT survive redeploys until /data volume is mounted).`
  );

  const fallback = "./data/bot.sqlite";
  mkdirSync(dirname(fallback), { recursive: true });
  return fallback;
}

const databasePath = resolveDbPath();
const alreadyExists = existsSync(databasePath);

export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

logger.info(
  `SQLite: ${databasePath} (${alreadyExists ? "existing file" : "new file"})`
);

if (!alreadyExists && databasePath.includes("/data")) {
  logger.warn(
    "New DB under /data. If this repeats every deploy, attach a Railway volume at /data."
  );
}

export function closeDatabase(): void {
  db.close();
}

export function getResolvedDatabasePath(): string {
  return databasePath;
}
