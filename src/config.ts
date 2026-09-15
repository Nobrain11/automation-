import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";

loadEnv({ path: "/vercel/share/.env.project", override: false });

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function rpcEndpoint(): string {
  const configured = optional("SOLANA_RPC_URL");
  if (configured && /^https?:\/\//i.test(configured)) return configured;

  const apiKey = optional("API_KEY");
  if (apiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
  }

  return "https://api.mainnet-beta.solana.com";
}

/** Never throw at import time — Vercel loads this module for every route. */
function encryptionKeySafe(): string {
  const raw =
    optional("WALLET_ENCRYPTION_KEY") ||
    optional("TELEGRAM_WEBHOOK_SECRET") ||
    "vercel-dev-insecure-key-change-me";
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return raw;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(raw).digest("base64");
}

function defaultDatabasePath(): string {
  if (optional("DATABASE_PATH")) return optional("DATABASE_PATH")!;
  // Vercel serverless filesystem is read-only except /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/bot.sqlite";
  }
  return "./data/bot.sqlite";
}

function resolveBotToken(): string {
  return (
    optional("TELEGRAM_BOT_TOKEN") ||
    optional("BOT_TOKEN") ||
    optional("TELEGRAM") ||
    ""
  );
}

function resolveWebBaseUrl(): string {
  return (
    optional("APP_URL") ||
    optional("WEB_BASE_URL") ||
    (optional("VERCEL_URL") ? `https://${optional("VERCEL_URL")}` : "") ||
    (optional("RAILWAY_PUBLIC_DOMAIN")
      ? `https://${optional("RAILWAY_PUBLIC_DOMAIN")}`
      : "")
  ).replace(/\/$/, "");
}

export const config = {
  /** Empty string if unset — callers must check before starting the bot */
  botToken: resolveBotToken(),

  rpcUrl: rpcEndpoint(),

  walletEncryptionKey: encryptionKeySafe(),

  databasePath: defaultDatabasePath(),

  logLevel: optional("LOG_LEVEL") || "info",

  webPort: Number(process.env.PORT || process.env.WEB_PORT || 3000),

  webBaseUrl: resolveWebBaseUrl()
};

export function requireBotToken(): string {
  if (!config.botToken) {
    throw new Error("Missing required environment variable: TELEGRAM_BOT_TOKEN");
  }
  return config.botToken;
}

export function validateConfig(): void {
  requireBotToken();
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
