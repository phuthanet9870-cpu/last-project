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

## Production checklist (all open)
Set `NODE_ENV=production` and a random `JWT_SECRET`; terminate TLS/WSS at a reverse proxy; restrict `CORS_ORIGIN`; separate DB per environment with least-privilege user; enable backups + PITR and run a restore drill; add metrics/alerts (tick p95, ledger mismatch from worker `security_events`); CI with typecheck/lint/test/e2e; admin MFA; security review; load test at target capacity (current validated ≈50 players per map).
