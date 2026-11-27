# Test Report

All results below were produced by commands actually run in this repository's dev container (Linux, Node 22.23, PostgreSQL 16, Redis 7, headless Chromium). Raw output: `tests/e2e/last-run.json`, `tests/e2e/online-last-run.json`, `tests/multiplayer/last-run.json`, `tests/load/last-run.json`.

| Check | Command | Result |
|---|---|---|
| TypeScript strict typecheck | `pnpm typecheck` | **PASS** (0 errors) |
| Lint (typescript-eslint) | `pnpm lint` | **PASS** (0 errors, 4 unused-var warnings) |
| Client build (esbuild) | `pnpm build:client` | **PASS** — `game.js` ≈ 483 KB minified (includes registry JSON) |
| Unit tests (Vitest) | `pnpm test` | **42/42 PASS** |
| Artifact end-to-end (Playwright, real UI) | `pnpm test:e2e` | **28/28 PASS**, 0 browser console/page errors |
| Multiplayer integration (2 real WS clients + Postgres) | `pnpm server` then `pnpm test:multiplayer` | **13/13 PASS** |
| Online-mode browser E2E (2 browsers vs server) | `node tests/e2e/online.e2e.mjs` | **3/3 PASS**, 0 browser errors |
| Worker jobs vs real DB | `pnpm worker -- --once` | **PASS** — ledger reconcile: 0 unbalanced tx, 0 wallet mismatches |
| One-command start | `pnpm game:start` | **PASS** — `/api/health` db=true redis=true; client 200; admin 200 (fails with clear guidance if Postgres is down) |
| Load test | `tsx tests/load/load.ts 20 50 100` | see below |

## Unit tests (packages/game-core/test/core.test.ts)
Content registry integrity (26 classes × 18 = 468 skill IDs; ≥100 items; drop/quest references; every map spawn & portal reachable by A*), stat formulas from the master prompt, crit cap, all 81 element pairs, damage finiteness under extreme defense, EXP curve & multi-level gain, ascension gate, class weapon restriction, inventory overflow → mail, refine costs & +10 downgrade floor, gem socket unlock, double-entry ledger (balanced/negative/idempotency), **master prompt order book example (buy 300 @152 → 100@150 + 200@152 = 45,400G)**, auction outbid refund + settle-once, market double-buy race, farm offline settlement (cap, food, idempotent), pet farm/summon exclusivity, tutorial quest chain + reward once, 7 legal starter decks, 20 AI-vs-AI TCG matches terminate + hidden info redaction, gacha pity, world kill → EXP/gold/death-once, collision at map border, dungeon reward once, save round-trip with BigInt, status effects (stacking, DoT, expiry, shield, CC resist, cleanse).

## Artifact E2E (tests/e2e/artifact.e2e.mjs) — the 28-step player loop from the delivery prompt
01 start screen · 02 character creation + class · 03 movement/collision/camera · 04 NPC + quest · 05 portal travel · 06 combat/skills/EXP/loot/gold · 07 inventory/equipment · 08 refine +5 · 09 gem + monster card + skill stone · 10 hatch + capture + summon + feed + farm offline · 11 mount ride · 12 gather + craft · 13 market buy/list/buy-order/auction bid/exchange + ledger balanced · 14 direct trade (simulated partner) · 15 party/friend/guild/mail/marriage · 16 dungeon waves + boss reward once · 17 world boss contribution rewards · 18 arena vs AI + rating · 19 card duel to completion · 20 login/pass/gacha + real payments refused · 21 all 22 menu windows open · 22 System Registry view · 23 save → reload → continue · 24 export save · 25 mobile viewport joystick · 26 Thai language · 27 frame rate (61 fps headless) · 28 projectile in flight + durability wear + Repair button.
Screenshots: `tests/e2e/screenshots/`.

## Multiplayer (tests/multiplayer/two-clients.test.ts)
Argon2id registration/login, wrong password 401, refresh rotation + reuse detection · unique character names, unauthenticated 401 · bad token WS 4401, foreign character 4404 · two clients see each other · server-authoritative movement replicated, client teleport FORBIDDEN · chat local/whisper, XSS escaped, malformed packet rejected · party requires acceptance · real trade item↔gold with lock+confirm, `trade_history` row · market list (escrow) → buy → double buy rejected, **all DB ledger tx balanced, no negative wallets** · server combat kill persisted to DB · disconnect/reconnect restores inventory & gold · **ranked arena 1v1 between the two real players, Elo ±16 persisted in `pvp_matches`** · admin RBAC (player 403), overview, audited GM grant.

## Load test (single process, all clients in one town map, movement + chat, no combat)
Server and load generator share one 4-core dev container, so CPU contention inflates the numbers. Budget: 50 ms per tick (20 Hz).

| Clients | Tick p95 before (v0.1.0) | Tick p95 now | Tick avg now | Download per client before → now |
|---|---|---|---|---|
| 20 | 4.7 ms | 2.8 ms | 1.6 ms | 92 → 34 KB/s |
| 50 | 15.0 ms | 7.3 ms | 4.9 ms | 175 → 67 KB/s |
| 100 | 48.1 ms | **15.3 ms** | 10.4 ms | 352 → 66 KB/s |
| 250 | not run | **45.8 ms** | 28.5 ms | — → 63 KB/s |

Changes that produced this (each measured; CPU profiles in the work log): delta snapshots (new entities in full, then only changed dynamic fields), fx/chat moved to their own small message instead of forcing a full snapshot, one shared serialization per world per tick, spatial grid AOI, visibility cap of the 40 nearest players (party first), AOI set refreshed every 300 ms, positional fx and local chat range-limited to 1300 px, cached movement/regen stats, and staggered snapshot ticks. Two earlier guesses (state resend, serialization alone) did not improve tick time; profiling found the real costs (sorting in AOI selection and send bursts).

**Validated capacity: 250 concurrent players in one map instance within the 50 ms p95 budget** on this hardware. Not run: 500/1000 tiers, soak test, combat-heavy workload.

## Not run / blocked (honest list)
- Security test suite beyond the auth/forgery checks above (no fuzzing, no pen test, no dependency audit run).
- Database transaction concurrency tests across multiple server processes (architecture is single-process).
- Docker Compose stack (`docker compose up`) — Docker daemon not available in this environment; compose file is **unverified**.
- Payment webhook tests — payments are disabled.
- Backup/restore drill — NOT_RUN.
