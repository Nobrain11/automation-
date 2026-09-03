// src/web/auth.ts — signed web sessions (no private keys)

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db/sqlite.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;

function signingKey(): Buffer {
  return Buffer.from(config.walletEncryptionKey, "base64");
}

export function createLoginToken(telegramId: number): string {
  const exp = Date.now() + LOGIN_TTL_MS;
  const payload = `${telegramId}.${exp}`;
  const sig = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLoginToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expStr, sig] = parts;
  const telegramId = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isFinite(telegramId) || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;

  const payload = `${idStr}.${expStr}`;
  const expected = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return telegramId;
}

export function createSession(telegramId: number): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expires = now + SESSION_TTL_MS;

  db.prepare(`
    INSERT INTO web_sessions (token, telegram_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, telegramId, now, expires);

  return token;
}

export function resolveSession(token: string | undefined | null): number | null {
  if (!token) return null;
  const row = db.prepare(`
    SELECT telegram_id, expires_at FROM web_sessions WHERE token = ?
  `).get(token) as { telegram_id: number; expires_at: number } | undefined;

  if (!row) return null;
  if (Date.now() > row.expires_at) {
    db.prepare(`DELETE FROM web_sessions WHERE token = ?`).run(token);
    return null;
  }
  return row.telegram_id;
}

export function destroySession(token: string): void {
  db.prepare(`DELETE FROM web_sessions WHERE token = ?`).run(token);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}
