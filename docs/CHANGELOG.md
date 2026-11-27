# Changelog

## 0.1.0 — 2026-11-27 (first session)
- Monorepo (pnpm, strict TS, ESLint, Vitest) and shared `game-core` engine.
- Browser client: procedural pixel-art renderer, lighting/day-night/weather, HUD, 22 system windows, mobile joystick, Thai/English, procedural audio + radio, developer testing panel + System Registry.
- Game server: Fastify REST + WebSocket, Argon2id auth with refresh rotation, PostgreSQL persistence, shared double-entry ledger, market/trade/party/duel/ranked arena, guilds, admin API + dashboard, BullMQ worker.
- Tests: 36 unit, 27-step artifact E2E, 13-step multiplayer, 3-step online browser E2E, load test 20/50/100.
- Fixes found by tests: daily dungeon boss never completed (champion boss rank), rate limiter throttled local play, server teleport kept old coordinates, Thai menu labels not refreshed.
