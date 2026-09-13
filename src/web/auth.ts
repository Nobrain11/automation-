// src/web/auth.ts — signed web sessions (no private keys)

import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;
const SESSION_PREFIX = "web";

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

function signSession(payload: string): string {
  return createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
}

export function createSession(telegramId: number): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${SESSION_PREFIX}.${telegramId}.${expires}`;
  return `${payload}.${signSession(payload)}`;
}

export function resolveSession(token: string | undefined | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== SESSION_PREFIX) return null;

  const telegramId = Number(parts[1]);
  const expires = Number(parts[2]);
  const signature = parts[3];
  if (!Number.isSafeInteger(telegramId) || !Number.isFinite(expires)) return null;
  if (Date.now() > expires) return null;

  const expected = signSession(`${parts[0]}.${parts[1]}.${parts[2]}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  return telegramId;
}

export function destroySession(_token: string): void {
  // Sessions are stateless signed cookies; expiry invalidates them.
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
