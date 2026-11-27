# Skill System V4 — test report

All results come from commands run in this container (Linux, Node 22, PostgreSQL 16, Redis 7, headless Chromium). Nothing below is estimated.

| Check | Command | Result |
|---|---|---|
| Typecheck (strict) | `pnpm typecheck` | PASS |
| Unit tests (all) | `npx vitest run` | **170/170 PASS** (164 game-core, 6 server) |
| V4 unit suite | `packages/game-core/test/skills_v4.test.ts` | 47 tests (21 + 26 per-class gauge cases) — data (468, unique names, Fortune Dealer identity, 26 gauges, 52 builds, 3 stages, normal attack, rank table = combat), allocation (points, job level / prerequisite / ascension rules, atomic commit + stale revision + idempotent replay + cannot lower, command `skillCommit`, passives after commit, reset scroll), builds (all 52 auto-allocate into a legal 70-point draft that reaches the ultimate), stones (free first inscription, socket swap, pending re-inscription keep old, legendary fork behaviour, remove), hotbar (passive/unlearned refused, swap, 3 sets), migration (refund, items kept, idempotent), gauges (lunar phase, NOT_ENOUGH_GAUGE, dice), CDR cap |
| Browser E2E (artifact, real UI) | `node tests/e2e/artifact.e2e.mjs` | see docs/TEST_REPORT.md for the final run; step 41 drives the skill window: 3 tabs, locked nodes, +1 → pending, Undo, compare table, Auto Allocate (+69), Confirm (rev +1), stale revision rejected, HUD gauge |
| Multiplayer (real server + Postgres + 2 WS clients) | `pnpm server` + `pnpm test:multiplayer` | step "Skill V4 on the server": V4 ids on a fresh character, commit over WebSocket, replay applied once, stale revision rejected, invalid hotbar id refused, state persisted |
| Balance simulation | `npx tsx scripts/gen-skill-docs.ts` | SIMULATION_ONLY — see SKILL_BALANCE_REPORT.md |

## Not covered by automated tests
- The drag-and-drop gesture itself (server rules for the resulting `hotbar` command are tested).
- Visual fidelity to the reference game (reference not reachable).
