# PUMP AUTO — Go Live Checklist

## 1. Railway Variables (required)

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
