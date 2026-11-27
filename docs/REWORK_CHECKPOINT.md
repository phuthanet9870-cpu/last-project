# Full System Rework — checkpoint (resume here)

Sources: `Hearthbound_Full_System_Rework_Master_Prompt.md` (HB-001…HB-133, §00–§22) + Skill System V4 (in conversation, 2026-11-28).
Reference site `lanternhearth.mendoka.com` is **not reachable from the build container** (DNS ENOTFOUND on all 5 pages, 2026-11-28). Reference values therefore come only from: (a) numbers quoted in the user's spec as coming from the update page "U" — labelled `SPEC_QUOTED_U`; (b) the user's screenshots — `OBSERVED`; (c) Hearthbound design — `CUSTOM_DESIGN`. Nothing is claimed as verified from the reference game.

## Phase plan (spec §19) and status
| Phase | Scope | Status |
|---|---|---|
| A | Audit + HB registry + reference matrix | in progress — skill system audited (below) |
| B | P0 Skill V4: data model, 468 authored skills, tree/prereqs, job level/skill points, ascension (3 stages), pending/confirm/undo, gauges, combat integration, stones, hotbar 8 + normal attack, auto combat, GUI, 52 builds, migration | not started |
| C | Dungeons (HB-036…045), pet farm (057…064), mastery (007), gems/cards/equipment (016…024) | not started |
| D | World boss/arena/ranking/scheduler/social (046…056, 099…110) | not started |
| E | Market/exchange/wallet/entitlements/payment sandbox (065…077, 087…098, 121…122) | not started |
| F | TCG/creator/radio/UI/QoL (078…086, 100…109) | not started |
| G | Moderation/account lifecycle/liveops/content/perf (111…133) | not started |
| H | Migration + regression + playable build | not started |

## Skill system audit (before V4) — `packages/game-core/src/classes.ts`
- 26 classes exist; 468 skill IDs exist, but generated from **4 shared kits by role** (`KIT_MELEE/RANGED/CASTER/SUPPORT`) with element words prepended → e.g. Fortune Dealer gets "Steel Strike / Steel Rush / Iron Guard" (HB-003 defect, confirmed).
- No tree: unlock is `reqLevel` (character level) only; no prerequisites, no tree positions.
- Max rank fixed by type (active 10 / passive 5 / ultimate 3).
- Gauge: every class `max 100`, `+6/+8 per hit`, at 100 next skill ×1.5; 4 classes have one extra effect; Fortune Dealer multiplies every skill by random 0.5–2.5.
- Ascension: 3 promotions at Lv 60/90/120 (V4 asks for 3 *stages* = 2 promotions; fallback Lv 40/80, CUSTOM_DESIGN).
- Job level: exists (`jobLevel`, `jobExp`, +1 skill point per job level, cap 70) but skill points also come from base level (`skillPointsPerLevel`).
- Learning: `learnSkill` commits immediately (no pending/undo/confirm); reset costs 2,000 G.
- Stones: slotted into equipment stone slots, matched to a skill id (not one socket per skill).

## How to resume
`pnpm typecheck && pnpm test && node tests/e2e/artifact.e2e.mjs` (server tests: see docs/TEST_REPORT.md). Continue with the first phase not marked done above.
