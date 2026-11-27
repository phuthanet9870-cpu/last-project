# Operations Runbook

Status: written and partly exercised in the development container. **No production deployment has been performed.** Items marked *(verified here)* were run in the dev container; items marked *(not run)* need a staging environment.

## 1. Build and deploy
| Step | Command | Status |
|---|---|---|
| Static checks + tests | `pnpm typecheck && pnpm lint && pnpm test` | verified here |
| Client build | `pnpm build:client` | verified here |
| Server/worker bundle (no tsx at runtime) | `node scripts/build-server.mjs` → `dist/server.mjs`, `dist/worker.mjs` | verified here (bundled server started, `/readyz` 200) |
| Container image | `docker build -t hearthbound:<version> .` | **not run** (no Docker daemon in the dev container) |
| Full stack with TLS | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` | **not run** |
| CI | `.github/workflows/ci.yml` (pull requests + manual dispatch) | written; **not run on GitHub yet** — the same steps were run locally |

Required production environment (`.env.production`, never committed): `DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET` (≥32 random chars), `MFA_ENC_KEY` (≥32 random chars), optional `METRICS_TOKEN`, `ADMIN_USERNAME`/`ADMIN_PASSWORD` for the first admin.
The server **refuses to start** with `NODE_ENV=production` if any of these are weak or missing, if `CORS_ORIGIN` is `*`, if `DEV_COMMANDS=1`, or if the database uses the development password *(verified here: refused with weak settings, started with hardened settings; HSTS and locked CORS observed)*.

## 2. TLS / WSS
Caddy (`ops/Caddyfile`) terminates TLS with automatic certificates and proxies HTTP + WebSocket to `game:2567`. The game server runs with `TRUST_PROXY=1` **only** behind the proxy — without a proxy it ignores `X-Forwarded-For`, so clients cannot spoof IPs to bypass rate limits *(verified here: 24 spoofed-IP login attempts were still throttled)*. `/metrics` is blocked at the proxy and scraped on the internal network. **Not run:** real certificate issuance (needs a public DNS name).

## 3. Admin accounts and MFA
1. Create the first admin via `ADMIN_USERNAME`/`ADMIN_PASSWORD` on first start (then remove the variables).
2. Sign in, call `POST /api/auth/mfa/setup` (returns an `otpauth://` URL for any authenticator app), then `POST /api/auth/mfa/enable {code}`. All sessions are revoked; sign in again with the 6-digit code (admin dashboard has a code field).
3. In production every admin/moderator API call requires an MFA-verified session (`ADMIN_REQUIRE_MFA` cannot be disabled). Codes are single-use per 30 s window (replay protection); secrets are AES-256-GCM encrypted with `MFA_ENC_KEY` *(verified here by tests)*.
4. Lost authenticator: an operator clears `mfa_secret` for that account in the database after identity verification and records it in `admin_audit_logs`.

## 4. Backups and restore
- Scheduled: `scripts/db-backup.sh` (pg_dump custom format, archive readability check, retention) from cron; copy the files off-host *(script verified here; scheduling + off-host copy not run)*.
- Redis holds only presence/rate-limit/queue state (AOF enabled in compose); it is not a source of truth.
- **Restore drill** *(verified here)*: `node scripts/backup-drill.mjs` dumps the live DB, restores into a throw-away database, compares every table's row count, migrations, ledger totals and unbalanced transactions, then drops the copy. Last result: `docs/backup-drill-last.json` — ok, 30 tables, ~31k rows, dump 0.7 s + restore 1.2 s (small dev dataset; real RTO must be measured on production-sized data).
- Restore procedure: stop game + worker → `createdb` new database → `pg_restore --no-owner --dbname=<new> <file>` → run `node scripts/backup-drill.mjs`-style checks (row counts, ledger reconcile via `pnpm worker -- --once --job reconcileLedger`) → point `DATABASE_URL` at it → start.

## 5. Monitoring and alerts
- `GET /metrics` (Prometheus text): online players, worlds, tick avg/p95, WS bytes, persist errors, HTTP requests/5xx, ledger backlog, Redis/DB up, memory, uptime. Optional `METRICS_TOKEN` bearer protection *(endpoint verified here; the token check itself has no automated test)*.
- `GET /readyz` (DB reachable) for load balancers/health checks; `GET /api/health` for humans.
- Alert rules: `ops/prometheus/alerts.yml` — server down, tick p95 > 50 ms for 5 min, DB unreachable, any state-save failure, ledger backlog, 5xx rate, Redis down, memory *(rules written and YAML-validated; no Prometheus/Alertmanager run here)*.
- Logs: structured JSON (pino via Fastify) to stdout; ship with the platform's log collector.

## 6. Capacity (load test, verified here)
Single process, one 4-core dev container shared with the load generator, all clients in one town map, movement + chat only:
| Clients | tick p95 (budget 50 ms) | downstream per client |
|---|---|---|
| 100 | 27.4 ms | 65 KB/s |
| 250 | 47.1 ms | 62 KB/s |
Launch recommendation: cap at **200 concurrent players per process** until a soak test (hours, with combat) is run on production hardware. No horizontal scaling/load balancing across processes yet (single world shard).

## 7. Incident checklist
1. Check alerts → `/readyz`, `/metrics`, logs. 2. If saves fail: stop accepting logins (scale to zero behind the proxy), keep the process up so in-memory state can flush when the DB returns. 3. If data is corrupted: restore the latest good backup (section 4) and compensate players from `currency_ledger` + `admin_audit_logs`. 4. Record the incident, timeline and fix.

## 8. Rollback
Images are versioned by tag; roll back by redeploying the previous tag. Migrations are additive (`ADD COLUMN IF NOT EXISTS`, new tables) so the previous version runs against the newer schema; for a destructive migration, restore the pre-deploy backup instead.
