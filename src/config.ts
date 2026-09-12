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

function baseRpcEndpoint(): string | null {
  const value = process.env.BASE_RPC_URL?.trim();
  return value && /^https?:\/\//i.test(value) ? value : null;
}

function encryptionKey(): string {
  const raw = required("WALLET_ENCRYPTION_KEY");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return raw;
  return createHash("sha256").update(raw).digest("base64");
}

function defaultDatabasePath(): string {
  if (process.env.DATABASE_PATH?.trim()) {
    return process.env.DATABASE_PATH.trim();
  }
  const onRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
  return onRailway ? "/data/bot.sqlite" : "./data/bot.sqlite";
}

export const config = {
  botToken:
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.BOT_TOKEN?.trim() ||
    process.env.TELEGRAM?.trim() ||
    required("TELEGRAM_BOT_TOKEN"),

  /** Solana (live) */
  rpcUrl: rpcEndpoint(),

  /** Base — optional until EVM trading is enabled */
  baseRpcUrl: baseRpcEndpoint(),

  walletEncryptionKey: encryptionKey(),

  databasePath: defaultDatabasePath(),

  logLevel: process.env.LOG_LEVEL?.trim() || "info",

  webPort: Number(process.env.PORT || process.env.WEB_PORT || 3000),

  webBaseUrl: (
    process.env.WEB_BASE_URL?.trim() ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim()}`
      : "")
  ).replace(/\/$/, ""),

  /** Feature flags */
  chains: {
    solanaLive: true,
    baseEnabled: Boolean(baseRpcEndpoint()),
    ethereumEnabled: Boolean(process.env.ETH_RPC_URL?.trim()),
    robinhoodEnabled: false
  }
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
