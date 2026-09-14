import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

type SqliteDb = {
  pragma: (s: string) => unknown;
  close: () => void;
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => { changes: number };
  };
  exec: (sql: string) => void;
};

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

  if (canUseDir(preferredDir)) return preferred;

  if (canUseDir("/tmp")) {
    logger.warn(
      `Cannot write database at ${preferred}. Using /tmp/bot.sqlite (ephemeral).`
    );
    return "/tmp/bot.sqlite";
  }

  const fallback = "./data/bot.sqlite";
  try {
    mkdirSync(dirname(fallback), { recursive: true });
  } catch {
    /* ignore */
  }
  return fallback;
}

function openDatabase(): { db: SqliteDb; path: string } {
  let DatabaseCtor: new (
    path: string
  ) => SqliteDb;
  try {
    // Native module — can fail on some serverless platforms
    const require = createRequire(import.meta.url);
    DatabaseCtor = require("better-sqlite3");
  } catch (error) {
    logger.error("better-sqlite3 load failed", error);
    throw new Error(
      "better-sqlite3 native module failed to load on this runtime"
    );
  }

  const databasePath = resolveDbPath();
  const alreadyExists = existsSync(databasePath);
  const db = new DatabaseCtor(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  logger.info(
    `SQLite: ${databasePath} (${alreadyExists ? "existing file" : "new file"})`
  );
  return { db, path: databasePath };
}

let databasePath = ":memory:";
let db: SqliteDb;

try {
  const opened = openDatabase();
  db = opened.db;
  databasePath = opened.path;
} catch (error) {
  logger.error("SQLite open failed — using limited in-memory stub", error);
  // Minimal stub so imports do not crash the serverless function
  const tables = new Map<string, unknown[]>();
  db = {
    pragma: () => undefined,
    close: () => undefined,
    exec: () => undefined,
    prepare: () => ({
      get: () => undefined,
      all: () => [],
      run: () => ({ changes: 0 })
    })
  };
  void tables;
  databasePath = ":memory-stub:";
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
