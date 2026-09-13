import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";

loadEnv({ path: "/vercel/share/.env.project", override: false });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function rpcEndpoint(): string {
  const value = process.env.SOLANA_RPC_URL?.trim();
  return value && /^https?:\/\//i.test(value)
    ? value
    : "https://api.mainnet-beta.solana.com";
}

function encryptionKey(): string {
  const raw = required("WALLET_ENCRYPTION_KEY");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return raw;
  return createHash("sha256").update(raw).digest("base64");
}

function defaultDatabasePath(): string {
  return process.env.DATABASE_PATH?.trim() || "./data/bot.sqlite";
}

export const config = {
  botToken: required("TELEGRAM_BOT_TOKEN"),

  /** Solana mainnet RPC */
  rpcUrl: rpcEndpoint(),

  walletEncryptionKey: encryptionKey(),

  databasePath: defaultDatabasePath(),

  logLevel: process.env.LOG_LEVEL?.trim() || "info",

  webPort: Number(process.env.PORT || process.env.WEB_PORT || 3000),

  webBaseUrl: (
    process.env.WEB_BASE_URL?.trim() ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim()}`
      : "")
  ).replace(/\/$/, "")
};

export function validateConfig(): void {
  const raw = config.walletEncryptionKey;
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("WALLET_ENCRYPTION_KEY must be valid base64.");
  }
  if (key.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must decode to 32 bytes.");
  }
}
