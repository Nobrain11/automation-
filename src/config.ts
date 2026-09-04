import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
  // Prefer /data when volume exists; sqlite.ts falls back if not writable
  return onRailway ? "/data/bot.sqlite" : "./data/bot.sqlite";
}

export const config = {
  botToken: process.env.BOT_TOKEN?.trim() || required("TELEGRAM_BOT_TOKEN"),

  rpcUrl:
    process.env.SOLANA_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com",

  walletEncryptionKey: required("WALLET_ENCRYPTION_KEY"),

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
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key. " +
        `Got ${key.length} bytes. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
}
