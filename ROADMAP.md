# PUMP AUTO — Phases 1–5

## Phase 1 — Foundation (host + wallet)
- [x] SQLite schema + migrations
- [x] Encrypted wallet create/import
- [x] Telegram bot + web terminal shell
- [x] `/health` with phase1 flags
- [x] Docker Compose + volume path
- [ ] Deployed on always-on host with volume (operator step)

## Phase 2 — Discovery
- [x] Pump.fun HTTP discovery
- [x] WS log scanner scaffold
- [x] Filter milestones (bonding, mint, freeze, age, liq, holders, volume)
- [x] Min quality floor (volume / liquidity)
- [x] Decision log table (pass/skip + reasons)
- [ ] Live WS stable under production RPC (operator RPC quality)

## Phase 3 — Execution
- [x] Buy/sell service path
- [x] Positions open/close
- [x] Position monitor: time-stop, SL, TP, trailing
- [x] Trade history table
- [ ] Confirmed mainnet fill rate under tip policy (needs live capital test)

## Phase 4 — Auto-Hunter
- [x] Per-user auto_state / kill_switch
- [x] Max trades hour/day
- [x] Open position cap
- [x] Smart money boost amount
- [x] Daily loss cap enforcement
- [x] Cooldown between auto buys
- [x] Explainability via decisions API

## Phase 5 — Product surface
- [x] Settings model (TP tiers, SL, trailing, caps)
- [x] Referral schema
- [x] Health + phase smoke script
- [x] GO_LIVE deploy docs
- [ ] Single CSS design system (ongoing cleanup)
- [ ] Supabase optional backend (optional)
- [ ] Public marketing site (optional)

---

**Operator must complete:** always-on deploy + `WALLET_ENCRYPTION_KEY` stability + Helius (or equivalent) RPC.
