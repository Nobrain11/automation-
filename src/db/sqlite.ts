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

  // Vercel / Lambda: only /tmp is writable
  if (canUseDir("/tmp")) {
    logger.warn(
      `Cannot write database at ${preferred}. Using /tmp/bot.sqlite (ephemeral on serverless).`
    );
    return "/tmp/bot.sqlite";
  }

  logger.warn(
    `Cannot write database at ${preferred}. Falling back to ./data/bot.sqlite.`
  );
  const fallback = "./data/bot.sqlite";
  mkdirSync(dirname(fallback), { recursive: true });
  return fallback;
}

const databasePath = resolveDbPath();
const alreadyExists = existsSync(databasePath);

let db: Database.Database;
try {
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  logger.info(
    `SQLite: ${databasePath} (${alreadyExists ? "existing file" : "new file"})`
  );
} catch (error) {
  logger.error("SQLite open failed", error);
  // Last resort in-memory so routes can still load (data will not persist)
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  logger.warn("SQLite: using in-memory database (no persistence)");
}

export { db };

export function closeDatabase(): void {
  try {
    db.close();
  } catch {
    /* ignore */
  }
}

export function getResolvedDatabasePath(): string {
  return databasePath;
}
