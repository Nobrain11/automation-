import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),

  rpcUrl:
    process.env.SOLANA_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com",

  walletEncryptionKey: required("WALLET_ENCRYPTION_KEY"),

  databasePath:
    process.env.DATABASE_PATH?.trim() ||
    "./data/bot.sqlite",

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
  const key = Buffer.from(config.walletEncryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
    );
  }
}
