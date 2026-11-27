# PROGRESS — session handoff

**State: playable prototype. NOT "GAME COMPLETE"** — release gates (§69) are not met. See SYSTEM_REGISTRY.md (581 IDs: 282 COMPLETE, 94 TESTING, 92 PARTIAL, 8 SIMULATED, 8 BLOCKED, 97 NOT_STARTED).

## Phase status
| Phase | Status |
|---|---|
| 0 Foundation | Done: pnpm monorepo, strict TS, lint, Vitest, migrations, env template, compose (unverified) |
| 1 Multiplayer world | Done (prototype): auth, characters, WS world, movement, AOI, chat, reconnect, persistence |
| 2 Core combat | Done: stats, skills, effects, elements, AI, loot, ledger, EXP |
| 3 Progression & items | Mostly: refine/gems/options/stones/cards/ascension; gaps: durability, transmog, option extraction |
| 4 Social & life skills | Partial: party/trade/chat/mail online; guild basic; gathering + crafting |
| 5 Adventure | Partial: story + 50 daily dungeon floors (solo), world boss, achievements; no raids/party instances |
| 6 Pets/mounts/space | Mostly: pets, farm offline, mounts, decorations; housing minimal; marriage simulated |
| 7 Economy | Mostly: market, buy orders, auction, exchange, trade, admin economy monitor |
| 8 Competitive | Partial: ranked 1v1 + duel online; AI 2v2/3v3; no modes/seasons |
| 9 TCG | Partial: engine, 92 cards, decks, AI, tower, packs; no PvP duels |
| 10 Commerce/LiveOps | Partial: login/missions/pass/events/gacha (simulated currency); payments BLOCKED |
| 11 Production readiness | Not started (no TLS, CI, backups, monitoring) |
| 12 Artifact packaging | Done |
| 13 Audit | Done (docs/SYSTEM_AUDIT.md) |

## Last verified commands (2026-11-27)
`pnpm typecheck` ✔ · `pnpm lint` ✔ (0 errors) · `pnpm test` 36/36 · `pnpm test:e2e` 27/27 · `pnpm test:multiplayer` 13/13 · online browser E2E 3/3 · worker `--once` ✔ · `pnpm game:start` ✔ · load 20/50/100.

## Next dependency-ready tasks (in order)
1. ~~Delta snapshots + spatial hash AOI~~ DONE v0.2.0 (250 players/map p95 46 ms).
2. Normalize item ownership tables; move market matching into DB transactions with row locks (enables multi-process).
3. Online versions of SIMULATED systems: marriage consent flow, friend presence (Redis TTL), TCG PvP duels, guild storage.
4. Party dungeon instances; arena 2v2/3v3 matchmaking for real players; seasons.
5. CI pipeline (typecheck/lint/test/e2e), TLS reverse proxy, backups + restore drill, Prometheus metrics.
6. Content expansion toward §01 targets; hand-designed class kits; production art.

## How to resume
Read MASTER_PROMPT.md, this file, DECISIONS.md, KNOWN_ISSUES.md, SYSTEM_REGISTRY.md. Start Postgres/Redis (`service postgresql start; service redis-server start` in the dev container or `docker compose up -d postgres redis`), then `pnpm install && pnpm game:start`.
