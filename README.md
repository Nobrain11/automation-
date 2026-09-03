# PUMP AUTO

Telegram + Web terminal for Solana / pump.fun discovery and automated trading.

## Features

- Non-custodial encrypted wallets (AES-256-GCM)
- Telegram controls + Web Terminal (bottom nav)
- Pump.fun scanner + filters
- Auto-Hunter (buy on filter pass via Jupiter)
- Manual BUY / SELL 100%
- DexScreener trending (price, mcap, liq, volume)
- Position monitor: time-stop, SL/TP/trailing proxies
- Emergency kill switch (stops new entries, does not auto-sell)

## Railway env vars

```
BOT_TOKEN=
WALLET_ENCRYPTION_KEY=   # base64 of 32 random bytes
SOLANA_RPC_URL=          # Helius or other private RPC recommended
WEB_BASE_URL=https://YOUR-APP.up.railway.app
DATABASE_PATH=/data/bot.sqlite
PORT=3000
```

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Deploy checklist

1. Push / connect repo `Nobrain11/automation-`
2. Set env vars above
3. Attach volume for `/data` if possible
4. Redeploy
5. Open Telegram bot → `/start` → create/import wallet → fund SOL
6. Open **WEB TERMINAL** login link
7. TRADE tab → set size/slippage → Save
8. AUTOMATION → Start, or TRENDING → BUY

## Honest limits

- Brand-new bonding-curve tokens often have **no Jupiter route** yet
- TP/SL/trailing use **market momentum proxies** (DexScreener), not exact entry-price PnL
- Emergency stop does **not** close positions
- Private keys never leave the server encrypted blob / Telegram export flow

## Local

```bash
npm install
cp .env.example .env
npm run dev
```
