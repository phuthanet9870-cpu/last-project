# Deployment Guide

> Production deployment has **not** been performed (NOT_RUN). This guide covers local and staging-style runs. Do not enable real payments.

## Requirements
Node 22+, pnpm 10, PostgreSQL 16, Redis 7 (or Docker).

## Local (verified)
```bash
pnpm install
```
```bash
docker compose up -d postgres redis
```
```bash
pnpm game:start
```
Open http://localhost:2567/ (game, choose **Online Mode**) and http://localhost:2567/admin/ (dashboard). To create an admin: set `ADMIN_USERNAME` / `ADMIN_PASSWORD` before first start.
Worker (separate terminal):
```bash
pnpm worker
```
Offline/artifact build only (no database): `pnpm build:client`, then open `deliverables/playable-artifact/index.html`, or `pnpm dev` for http://localhost:5173.

## Full stack via Docker Compose (unverified here — no Docker daemon in the build environment)
```bash
docker compose up
```

## Production-style deployment (written, not yet run)
See **docs/OPERATIONS_RUNBOOK.md** for the full procedure, and **docs/RELEASE_ACCEPTANCE.md** for why this build is not production-ready.
```bash
node scripts/build-server.mjs
```
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
- TLS/WSS: Caddy (`ops/Caddyfile`), automatic certificates for `$DOMAIN`. The game server runs with `TRUST_PROXY=1` only behind the proxy.
- The server refuses `NODE_ENV=production` with weak `JWT_SECRET`/`MFA_ENC_KEY`, `CORS_ORIGIN=*`, `DEV_COMMANDS=1` or the development DB password.
- Admins must enrol TOTP MFA (`/api/auth/mfa/setup` → `/api/auth/mfa/enable`); admin APIs require an MFA session in production.
- Backups: `scripts/db-backup.sh` (cron), restore drill `node scripts/backup-drill.mjs`.
- Monitoring: `/metrics`, `/readyz`, alert rules in `ops/prometheus/alerts.yml`.
- CI: `.github/workflows/ci.yml` runs on pull requests and manual dispatch.

## Production checklist (all open)
Set `NODE_ENV=production` and a random `JWT_SECRET`; terminate TLS/WSS at a reverse proxy; restrict `CORS_ORIGIN`; separate DB per environment with least-privilege user; enable backups + PITR and run a restore drill; add metrics/alerts (tick p95, ledger mismatch from worker `security_events`); CI with typecheck/lint/test/e2e; admin MFA; security review; load test at target capacity (current validated ≈50 players per map).
