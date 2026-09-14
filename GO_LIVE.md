# PUMP AUTO — Go Live (Phase 1)

**Do not run the trading bot as the only process on Vercel serverless.**  
Vercel is fine for static terminal files. The bot needs **one always-on Node process + persistent disk**.

---

## Recommended: Docker on any VPS

Works on Oracle Cloud free ARM, Hetzner, DigitalOcean, etc.

### 1. Server prep

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER   # re-login after
```

### 2. Clone & configure

```bash
git clone https://github.com/Nobrain11/automation-.git
cd automation-
cp .env.example .env
nano .env
```

Set at minimum:

```env
TELEGRAM_BOT_TOKEN=...
WALLET_ENCRYPTION_KEY=...   # generate once, never rotate casually
WEB_BASE_URL=https://YOUR_PUBLIC_URL
APP_URL=https://YOUR_PUBLIC_URL
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
DATABASE_PATH=/data/bot.sqlite
```

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start

```bash
docker compose up -d --build
docker compose logs -f
```

### 4. Health check

```bash
curl -s https://YOUR_PUBLIC_URL/health | jq
```

Expect:

```json
{
  "ok": true,
  "phase1": { "db": true, "telegram": true, "rpc": true },
  "persistentVolume": true,
  "walletRows": 0
}
```

Put Caddy or nginx in front for HTTPS, or use a tunnel.

---

## Alternative: Railway

1. New service from this repo  
2. **Volume** mount path `/data`  
3. Env: `TELEGRAM_BOT_TOKEN`, `WALLET_ENCRYPTION_KEY`, `DATABASE_PATH=/data/bot.sqlite`, `WEB_BASE_URL`, `SOLANA_RPC_URL`  
4. **Replicas = 1** (Telegram 409 if two)  
5. Deploy → open `/health`

---

## Phase 1 acceptance (must all pass)

- [ ] `GET /health` → `ok: true`
- [ ] Telegram `/start` responds
- [ ] Create or import wallet once
- [ ] Redeploy / restart container → **same wallet still there**
- [ ] Web terminal opens from bot link with session
- [ ] `/api/trending` returns real data or honest empty (no fake rows)
- [ ] Buy small amount → position row created
- [ ] Kill switch stops new auto entries

---

## What not to do

- Do not change `WALLET_ENCRYPTION_KEY` after users have wallets  
- Do not run two bot instances on the same token  
- Do not rely on Vercel `/tmp` SQLite for production wallets  
- Do not claim LIVE/READY in UI unless `/health` and scanner stats confirm it  
