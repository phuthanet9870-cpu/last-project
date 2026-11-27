# Architecture Decision Records

Dates: 2026-11-26/27 (first session).

**ADR-001 Shared game-core package.** All rules (stats, combat, effects, skills, items, enhancement, pets, crafting, quests, economy ledger, order book, auction, TCG, world simulation, command dispatcher) live in `packages/game-core` as pure TypeScript. The artifact runs it in-browser (LocalAdapter); the server runs the same code authoritatively. *Alternative:* separate client/server logic — rejected (divergence risk, explicitly forbidden by delivery prompt §7).

**ADR-002 Canvas 2D renderer instead of Phaser 3 (deviation from §02).** Reason: single self-contained bundle for Claude Artifacts, full control over procedural pixel art, no asset loader needed. Trade-off: no WebGL batching; measured 61 fps headless in town. Revisit if sprite counts grow.

**ADR-003 Plain DOM UI instead of React/Zustand (deviation from §02).** A ~20-line `h()` helper keeps the bundle small and avoids a build-time JSX toolchain. Trade-off: manual re-render of windows; acceptable at current UI size.

**ADR-004 Modular monolith: REST (Fastify) + WebSocket (`ws`) + game loop in one process; Colyseus not used (deviation from §02).** The shared `World` already provides room semantics; Colyseus schema sync would duplicate it. Trade-off: single process per world shard (see KNOWN_ISSUES #2).

**ADR-005 Durable model: character state as JSONB + relational ledger/wallets.** Characters persist as a versioned JSONB document (`state_version`), while money uses `wallets` + immutable `currency_ledger` (NUMERIC integers, double-entry, unique (tx_id,account,currency)). Market snapshot persisted per world. *Alternative:* fully normalized item tables (§56) — deferred; requires migration when item ownership must be queried across players.

**ADR-006 Shared world ledger on the server.** All online characters' wallets live in one in-memory `Ledger` (loaded from `wallets`) so cross-player transfers are atomic in-process; every economic command flushes pending entries + dirty wallets + affected characters + market snapshot in **one** PostgreSQL transaction before the ACK is sent.

**ADR-007 Prisma not used.** Raw `pg` with SQL migrations (`database/migrations`) — fewer moving parts, explicit SQL constraints. Trade-off: no generated types for rows.

**ADR-008 esbuild instead of Vite** for the client bundle (IIFE single file for the artifact; `pnpm dev` serves with watch).

**ADR-009 Simulated others in artifact mode.** Bots ("·sim"), simulated traders (`sim:` ledger accounts minted via a labelled faucet so the ledger stays balanced), simulated leaderboards. Always labelled; registry status SIMULATED, never COMPLETE.

**ADR-010 Rate limiting only in server mode.** The command rate limiter (30/s) applies to `mode: 'server'`; the single-player LocalAdapter cannot cheat against itself.

**ADR-011 Templated skill kits.** 26 classes × 18 skills generated from 4 role kits with element/role transforms and per-class gauge mechanics, to reach 468 unique IDs with data-driven effects (no executable content). Hand-designed kits are future work.

**ADR-012 Payments and paid randomness disabled.** `realPayments=false`, `paidRandomRewards=false`; the dashboard refuses enabling real payments. Gacha uses simulated Crystal with published odds and pity.
