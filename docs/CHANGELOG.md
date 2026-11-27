# Changelog

## 0.9.0 — 2026-11-27 — Guild & wedding
- Wedding: proposal now creates an **engagement** (partner consent online); the marriage completes at the new **Blossom Wedding Plaza** (portal south of Emberglen) with Planner Rosa: both partners at the altar, 5,000 Gold, ceremony phases (guests gather → vows → rings → celebration with petals), HUD banner, friends notified online, guests receive a cake slice once. The ceremony is cancelled if a partner leaves before the celebration. Couple bonus applies only after the wedding. Online couple teleport (10 min cooldown, not in instances). Artifact: simulated partner and guests.
- Guild (online, DB-backed): shared guild storage table (anyone deposits, officers/leader withdraw; capacity 50 + 10/level; atomic with the player save; activity log), promote/demote, remove member (rank-checked), leadership transfer, announcements (HTML stripped), disband (storage must be empty), leaders must transfer before leaving; membership re-synced from the DB at login.
- Guild war: leader/officer declares on another guild; that guild's leader/officer accepts; up to 5 online members per side play Lantern Siege; result stored in `guild_wars`; winner +2000 guild EXP and 50 guild tokens each (loser +300/10). Artifact: 3v3 vs a simulated rival guild.
- Fix (found by test): `inMatch` treated abandoned, unfinished arena matches as active, which would have blocked guild wars for anyone who had left an arena early.
- Fix (found by test): guild announcement sanitiser left tag fragments (`<b>pm</b>` → `bpm/b`).
- Tests: unit 63, E2E 34/34, multiplayer 23/23, online browser E2E 3/3.

## 0.8.0 — 2026-11-27 — Task 7: LiveOps / rankings / Hearthcards
- Memberships (simulated Crystal only, no auto-renew): Weekly (60 free Crystal/day), Monthly (50/day + 5% EXP), Festival (×2 event mission rewards and Event Tokens), Permanent Hearth (500 Gold/day + 3% drop), Grand Lantern (+5% EXP/Gold). Time-limited passes extend when re-bought; daily claims once per Asia/Bangkok day.
- Gacha: 4 banners — Standard, Seasonal Wishes (monthly featured mythic), Fashion Box, Gem Box — each with its own pity counter; odds shown in UI. Paid random rewards remain disabled.
- Events: third rotating weekly event (Gold Rush, ×1.5 monster Gold); event countdown and calendar with start times; event missions grant Event Tokens; Seasonal Shop; login reminders for the event and unclaimed membership dailies. Server applies the current week's EXP/drop/gold multipliers live.
- Rankings: online `/api/rankings/:kind` for level, cp, pvp, tcg, pet, life, mastery and `class:<id>` (whitelisted SQL expressions; unknown kinds → 400); combat power is now persisted on every save. Artifact boards are simulated and labelled [sim]. Weekly champion: worker job writes `weekly_champions`; the server grants/removes «Champion of the Week».
- Hearthcards: interactive tutorial duel with step hints and a one-time reward; card exchange (3 same-rarity spare cards → 1 of next rarity); starter cards are account-bound (no trade/dust/exchange); card trading in online direct trade (recorded in trade_history); cosmetics bought with card dust (card backs, playmats, animated table) applied to the duel screen.
- Fix (found by test): admin grant of `card_dust`/`star_dust` gave inventory items instead of currency (name exists in both registries); currencies now take precedence and unknown names are rejected.
- Fix (found by test): the last action of an online PvP card duel threw a server TypeError (side read after the match was cleared), so the finishing player got an error reply.
- Tests: unit 60, E2E 33/33, multiplayer 21/21, online browser E2E 3/3.

## 0.7.0 — 2026-11-27 — Task 6: market & economy
- Auto-bid (proxy) auctions: bids are private maxima, winner pays one increment above the runner-up, unused reservation released.
- Market: filters (type, rarity, max level, usable by my class, has stat), Best Sellers (24h), Wishlist with price alerts, personal trade history, per-item price chart (1h/24h/7d), exchange candles (1m/5m/1h).
- Account-wide sales collection box (proceeds from listings/auctions collected by any character on the account).
- Crystal split: tradeable, waiting (72h holding period after exchange purchases) and free/bound (starter, login); free is spent first; only tradeable Crystal can be sold.
- Security: server market snapshots are per-player (other players' history, Crystal holds and auction maxima are never sent).
- Tests: unit 55 (auction expectation updated for second-price proxy bidding), E2E 32/32, multiplayer 20/20.

## 0.6.0 — 2026-11-27 — Task 5: PvP modes
- Three arena modes: Last Light (elimination), Lantern Siege (3 capture lanterns, points per second, first to 100), Ember Rush (carry crystals to base, carriers drop on death, first to 5); objective-mode respawns at base; bots play objectives.
- Per-match stats (kills/damage/healing/objectives) and MVP (+10 tokens, «Arena MVP» title); in-match score banner and scoreboard.
- Online queues per size × mode (1v1/2v2/3v3) with rating-balanced snake-draft teams; artifact up to 5v5 vs AI.
- Seasons (28 days): PvP tier rewards (Bronze→Diamond, Diamond title) + soft reset; Hearthcards season card-dust reward + rank −1. Rewards mailed once per season.
- Fix (found by test): new characters started in season 1 and would have received a free reward for a season they never played; legacy saves are guarded.
- Tests: unit 52, E2E 31/31, multiplayer 19/19.

## 0.5.0 — 2026-11-27 — Task 4: items & pets
- Gem refining +0–10 (+10% gem stat per level, failure keeps level), cosmetic enhancement +0–5 (visual aura only, no stats), focused crafting (guaranteed chosen option for 1 Enchant Stone), Emberlight Blessing (+10% refine), second monster-card slot at +10, skill stone re-inscription, warehouse expansion (120→300).
- Pets: regional foods (double effect for matching elements), pet runes (Fang/Shell/Wind, 2 slots), friend farm visits with daily likes (online: real friend's farm, likes persist even if owner offline; artifact: simulated friends' farms).
- Mounts: duplicate whistles → Stable Seals; Stable Seal shop.
- Fix (found by test): server party membership was tied to the map and lost on map change; now carried with the player.
- Tests: unit 48, E2E 30/30, multiplayer 18/18.

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
