# Technical Design Document

```
Browser (Canvas 2D + DOM UI)
 ├─ LocalAdapter  ── runs packages/game-core in-browser (artifact / offline mode, simulated others)
 └─ RemoteAdapter ── WebSocket intents ──►  apps/game-server (Node 22, one process per world shard)
                                             ├─ Fastify REST: /api/auth, /api/characters, /api/worlds, /api/rankings, /api/admin/*, /api/payments (disabled)
                                             ├─ ws /ws: AUTH via access token + character ownership check
                                             ├─ GameServer: World instances (overworld per map, instanced dungeon/arena/farm/house), 20 Hz tick, 10 Hz AOI snapshots
                                             ├─ shared Ledger + MarketService (in-memory authority, flushed to Postgres per economic command)
                                             ├─ PostgreSQL 16 (durable)   └─ Redis 7 (presence, rate limits)
 apps/worker (BullMQ): daily reset marker, hourly ledger reconciliation, retention cleanup — idempotent via scheduled_jobs.job_key
 apps/admin-dashboard: static HTML using /api/admin/*
```

## Repository
`packages/game-core/src` — rng, config (versioned registry), stats, effects, classes (26×18 skills), combat, items, content (monsters/maps/NPCs/shops/quests/recipes/pets/mounts/cards/dungeons/achievements/events/gacha), economy (Ledger, OrderBook, Auction), tcg, mapgen (deterministic maps + A*), player (PlayerService domain service), world (simulation/AI/combat/dungeon/boss/arena), market (MarketService/trade/simulated traders), commands (single dispatcher).
`apps/game-client/src` — art (procedural pixel sprites), render (camera, layers, lighting, weather, VFX, minimap), ui (HUD, windows), panels (all system windows), adapter, audio (procedural BGM/SFX/radio), i18n, main.
`apps/game-server/src` — env, db (pool, tx, migrations, seed), auth, game, main. `apps/worker`, `apps/admin-dashboard`, `database/migrations`, `scripts`, `tests`.

## Protocol (§57)
Client → server: `{type:'cmd', v:1, id, cmd, args}`; server → client: `res {id,result:{ok,err?,msg?,data?}}`, `welcome`, `state` (owner-only player JSON incl. own wallet rows), `snap {mapId, entities (AOI), fx, extra}`, `market`, `tcg` (opponent hand/deck redacted), `trade`. Actor derived from session, never payload. Packet size ≤16 KB, unknown commands rejected, 30 commands/s limit (server mode). ~110 commands (see `COMMAND_NAMES` in commands.ts) plus server-only: whisper, partyAccept, tradeAccept, duelRequest/duelAccept, arenaJoin (matchmaking), guildInvite/guildAccept/guildInfo.

## Persistence (§59)
Economic commands and trades: pending ledger entries + dirty wallets + affected characters + market snapshot written in one transaction before ACK. Periodic character save every 30 s and on disconnect. Reconnect loads character JSONB + wallet rows.

## Security (§61)
Argon2id (19 MiB, t=2), HMAC-SHA256 access tokens (15 min), refresh tokens stored as SHA-256 hashes with rotation & reuse detection, 5-failure lockout, Redis rate limits, RBAC (player/moderator/admin), audited admin actions, chat sanitization, server-side movement/combat/reward computation, one active session per character.

## Database
See `database/migrations/001_init.sql` (accounts, sessions, login_history, worlds, characters, wallets, currency_ledger, market_state, market_transactions, trade_history, guilds, guild_members, guild_logs, pvp_matches, chat_messages, player_reports, moderation_actions, admin_audit_logs, game_logs, security_events, feature_flags, configuration_versions, scheduled_jobs, idempotency_keys, outbox_events, payment_orders). Tables listed in §56 but absent are recorded as gaps in SYSTEM_REGISTRY (S56).
