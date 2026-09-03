# PUMP AUTO

Telegram + Web terminal for Solana / pump.fun discovery and automated trading.

## Why wallets disappear after every deploy

Railway **wipes the container filesystem** on each deploy. If the SQLite DB lives inside the image (`./data/...`), every wallet is lost.

### Fix (required once)

1. In Railway → your service → **Volumes**
2. **Add volume**
   - Mount path: `/data`
3. Set env:
   ```
   DATABASE_PATH=/data/bot.sqlite
   WALLET_ENCRYPTION_KEY=<same key every time>
   ```
4. Redeploy

After that, wallets **persist** across deploys.

**Also critical:** never change `WALLET_ENCRYPTION_KEY`. If it changes, old encrypted keys cannot be decrypted even if the DB file still exists.

Generate once and keep it forever:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Railway env vars

```
BOT_TOKEN=
WALLET_ENCRYPTION_KEY=          # fixed forever
SOLANA_RPC_URL=                 # Helius recommended
WEB_BASE_URL=https://YOUR-APP.up.railway.app
DATABASE_PATH=/data/bot.sqlite
PORT=3000
```

## Features

- Non-custodial encrypted wallets (AES-256-GCM)
- Telegram + Web Terminal
- Pump scanner + Auto-Hunter (Jupiter)
- DexScreener pump movers + token review scores
- Position monitor (time-stop / SL-TP proxies)

## Deploy checklist

1. Volume mounted at `/data`
2. Env vars set (encryption key never rotated casually)
3. Redeploy
4. Logs should show: `SQLite: /data/bot.sqlite (existing file — wallets should persist)` on later boots
5. Telegram → create/import wallet **once** → fund SOL

## Local

```bash
npm install
cp .env.example .env
npm run dev
```
