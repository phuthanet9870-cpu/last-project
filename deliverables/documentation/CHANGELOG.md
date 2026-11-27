# Changelog

## 0.4.0 — 2026-11-27 — Task 3: real online versions of simulated systems
- Party dungeons: online party members on the same map enter the leader's instance together (each uses their own daily entry, all receive rewards); in the artifact, party bots follow you across maps and into dungeons.
- Marriage with consent: proposal → partner `marriageAccept`; mutual friendship, officiant proximity, ring or 10,000G; divorce clears both (also offline partner via DB).
- Friend presence: online status for friends; current map shown only when the friendship is mutual.
- Hearthcards PvP: friendly duels between real players, server-authoritative, each side sees itself as side 0 with opponent hand/deck hidden; disconnect = surrender.
- Fix (found by test): in-tick rewards (loot/gold/level) did not re-sync the owner's state after v0.2.0; any domain event now marks state dirty.
- Tests: unit 43, E2E 29/29, multiplayer 17/17.

## 0.3.0 — 2026-11-27 — Task 2: combat gaps
- Real projectiles: player ranged attacks and single-target bolt/arrow skills travel and resolve on arrival (homing); monster ranged shots fly to the aimed point and can be dodged by moving.
- Knockback (collision-checked, bosses immune, CC resist reduces) on Quake, Cataclysm, Blast, Nova, Executioner and boss stomps; Knockdown status (1.2 s).
- Guard monsters (Thornwood Sentry at Mossy Hollow entrance, Amber Sentinel at the crater path): hold position, aggro on approach, raise defense below 50% HP.
- Equipment durability: weapon wears on hits, armor when hit, −5% on death; broken gear gives no stats; repair at Brunhild (Repair all) or Tinker Kit; auto-battle auto-repairs.
- Tests: unit 42, E2E 28/28 (new step 28), multiplayer 13/13 (combat step now respawns on death).

## 0.2.0 — 2026-11-27 — Task 1: network performance
- Delta snapshots, separate fx channel, shared per-world serialization, spatial grid AOI, 40-nearest-player visibility cap, AOI refresh 300 ms, range-limited positional fx/local chat, cached movement stats, staggered snapshots.
- Load: 100 players p95 48 → 15 ms; 250 players p95 46 ms (within 50 ms budget); bandwidth per client 352 → 66 KB/s.

## 0.1.0 — 2026-11-27 (first session)
- Monorepo (pnpm, strict TS, ESLint, Vitest) and shared `game-core` engine.
- Browser client: procedural pixel-art renderer, lighting/day-night/weather, HUD, 22 system windows, mobile joystick, Thai/English, procedural audio + radio, developer testing panel + System Registry.
- Game server: Fastify REST + WebSocket, Argon2id auth with refresh rotation, PostgreSQL persistence, shared double-entry ledger, market/trade/party/duel/ranked arena, guilds, admin API + dashboard, BullMQ worker.
- Tests: 36 unit, 27-step artifact E2E, 13-step multiplayer, 3-step online browser E2E, load test 20/50/100.
- Fixes found by tests: daily dungeon boss never completed (champion boss rank), rate limiter throttled local play, server teleport kept old coordinates, Thai menu labels not refreshed.
