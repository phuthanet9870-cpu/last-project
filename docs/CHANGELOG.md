# Changelog

## 0.2.0 — 2026-11-27 — Task 1: network performance
- Delta snapshots, separate fx channel, shared per-world serialization, spatial grid AOI, 40-nearest-player visibility cap, AOI refresh 300 ms, range-limited positional fx/local chat, cached movement stats, staggered snapshots.
- Load: 100 players p95 48 → 15 ms; 250 players p95 46 ms (within 50 ms budget); bandwidth per client 352 → 66 KB/s.

## 0.1.0 — 2026-11-27 (first session)
- Monorepo (pnpm, strict TS, ESLint, Vitest) and shared `game-core` engine.
- Browser client: procedural pixel-art renderer, lighting/day-night/weather, HUD, 22 system windows, mobile joystick, Thai/English, procedural audio + radio, developer testing panel + System Registry.
- Game server: Fastify REST + WebSocket, Argon2id auth with refresh rotation, PostgreSQL persistence, shared double-entry ledger, market/trade/party/duel/ranked arena, guilds, admin API + dashboard, BullMQ worker.
- Tests: 36 unit, 27-step artifact E2E, 13-step multiplayer, 3-step online browser E2E, load test 20/50/100.
- Fixes found by tests: daily dungeon boss never completed (champion boss rank), rate limiter throttled local play, server teleport kept old coordinates, Thai menu labels not refreshed.
