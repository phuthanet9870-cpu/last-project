# Skill migration report (V3 generic kits → V4 authored trees)

## What changes for an existing character
`migrateSkillsV4()` in `packages/game-core/src/player.ts` runs when a save is loaded (`deserializePlayer`, and every `PlayerService` constructor). It is **idempotent**: it marks the save `skillV = 4` and does nothing on later loads.

| Old data | After migration | Why |
|---|---|---|
| `skillRanks` with ids `<class>_s01…_s18` (shared role kits) | reset to the class starter skill at rank 1 | Old skills cannot be mapped to the new ones. Remapping would put e.g. a warrior "Steel Strike" rank onto a Fortune Dealer card skill (forbidden by the spec). |
| `skillPoints` | `job level − 1` (= every point back, starter rank paid) | Full refund. Base-level skill points no longer exist in V4. |
| hotbar | skill ids cleared, items (potions etc.) kept, starter skill in slot 1 | Old ids no longer exist. |
| skill stones inscribed to old ids | become blank, unlocked; first inscription free again | The skill they were bound to no longer exists. |
| class gauge value | 0 | Gauge scales changed (e.g. 0–5 stacks instead of 0–100). |
| `skillMigration` | `{ at, refunded, fromV: 3 }` | Audit trail on the character. |

The player keeps everything else (level, job level, stats, items, gold, ascension).

## Ascension change
Ascension gates moved from Lv 60/90/120 to **Lv 40/80/120** (stage II at 40, stage III at 80; the third ascension at 120 still unlocks extended mastery). Characters already above a gate keep their level; an un-ascended character above Lv 40 simply needs to ascend before gaining further levels (their EXP is kept, capped at the level-up threshold — existing behaviour).

## Tests
- `packages/game-core/test/skills_v4.test.ts` › "V4 migration": old ids are refunded (`refunded = 8` for ranks 5 + 3), points = job level − 1, potion stays on the hotbar, second load does not run again.
- Multiplayer test step "Skill V4 on the server": a character created on the real server has V4 ids, commits over WebSocket, the revision/idempotency checks hold, and the state is persisted in Postgres.

## Production — needs owner approval
Deploying this build migrates every character the first time it loads (full skill refund). That is a **real migration** and was **not** run against production. Before deploying:
1. take a database backup (`scripts/db-backup.sh`);
2. announce the refund to players;
3. optionally pre-migrate offline with a one-off script and compare `skillMigration.refunded` totals;
4. the owner approves the rollout.
