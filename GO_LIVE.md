# PUMP AUTO — Go Live Checklist

## 1. Vercel Variables (required for webhook deployment)

| Variable | Notes |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret; must match Telegram's webhook header |
| `TELEGRAM_WEBHOOK_SETUP_TOKEN` | Separate random token for the setup endpoint |
| `WALLET_ENCRYPTION_KEY` | Base64 value decoding to 32 bytes |
| `DATABASE_PATH` | Use a persistent external database or storage for production data |
| `WEB_BASE_URL` | Deployed HTTPS URL, without a trailing slash |

After deploying, register Telegram's webhook once:

```bash
curl -X POST "https://YOUR-VERCEL-DOMAIN/api/telegram/setup" \\
  -H "Authorization: Bearer YOUR_TELEGRAM_WEBHOOK_SETUP_TOKEN"
```

Then verify it:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

The response should show `https://YOUR-VERCEL-DOMAIN/api/telegram/webhook` and no recent delivery errors. Do not run the long-polling `src/index.ts` process on Vercel.

## 2. Railway Variables (required)

| Variable | Example | Notes |
|----------|---------|-------|
| `BOT_TOKEN` | from @BotFather | Required |
| `WALLET_ENCRYPTION_KEY` | base64 32-byte key | **Never change** after wallets exist |
| `DATABASE_PATH` | `/data/bot.sqlite` | Required for persistence |
| `WEB_BASE_URL` | `https://your-app.up.railway.app` | No trailing slash |
| `SOLANA_RPC_URL` | Helius / your RPC | Strongly recommended |
| `PORT` | `3000` | Railway sets this usually |
| `ADMIN_TELEGRAM_ID` | your Telegram user id | Optional admin alerts |

Generate encryption key once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 2. Persistent volume (required for wallets)

1. Railway → service → **Volumes** → Add
2. Mount path: `/data`
3. Redeploy
4. Open `https://YOUR-APP/health`

Expect:

```json
{
  "ok": true,
  "persistentVolume": true,
  "walletRows": 0
}
```

After first wallet create/import, `walletRows` ≥ 1 and stays after redeploy.

## 3. Telegram

1. `/start` on the bot
2. Create or **import** wallet (save the key offline)
3. Fund wallet with SOL
4. Open **WEB TERMINAL** from the bot menu
5. Confirm trending loads (pump.fun movers)

## 4. Smoke test

- [ ] `/health` returns `ok: true`
- [ ] Telegram responds to `/start`
- [ ] Wallet persists after redeploy
- [ ] Web terminal login works
- [ ] TRENDING shows real tokens or honest OFFLINE
- [ ] Settings save
- [ ] Emergency stop works

## 5. Logo assets

- `/logo.svg` — app mark (green bolt on dark tile)
- `/favicon.svg` — browser tab icon

## Risk note

This is live market automation. Only use funds you can afford to lose.
