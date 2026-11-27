# Hearthbound — Skill System V4

Status labels used here: IMPLEMENTED_TESTED · IMPLEMENTED_UNTESTED · PARTIAL · UI_ONLY · SIMULATION_ONLY · NOT_IMPLEMENTED · BLOCKED.
Provenance labels: VERIFIED_REFERENCE · SCREENSHOT_OBSERVED · PROVIDED_SPEC · INFERRED · CUSTOM_DESIGN · UNVERIFIED · NEEDS_BALANCING.
The reference site could not be reached from the build container (DNS failure), so **no value is VERIFIED_REFERENCE**.

## 1. Source of truth
| What | Where | Generated doc |
|---|---|---|
| 26 class kits (gauge, normal attack, 18 skills, 2 builds) | `packages/game-core/src/skills/classdata_{a,b,c}.ts` | `CLASS_SKILL_DATABASE.json` |
| Rank math (MP/CD/power/hits per rank) | `skills/v4.ts` `valuesAt()` | per-rank tables in the DB json |
| Tree validation (18 skills, cells, prereqs, cycles) | `skills/v4.ts` `validateKit()` | `SKILL_TREE_REGISTRY.json` |
| Gauge engine | `skills/gauge.ts` | — |
| Skill stones | `skills/stones.ts` | `SKILL_STONE_MODIFIERS.json` |
| Class damage calibration | `skills/balance.ts` (written by `scripts/gen-skill-docs.ts --calibrate`) | `SKILL_BALANCE_REPORT.md` |
| Allocation rules / Auto Allocate / migration | `player.ts` `validateSkillDraft`, `autoAllocateDraft`, `commitSkills`, `migrateSkillsV4` | `SKILL_MIGRATION_REPORT.md` |

The skill detail window, combat (`PlayerService.effectiveSkill` → `World.castSkill`) and the docs all read `valuesAt()`. No number is duplicated in UI code.

## 2. Rules
- **26 classes × 18 authored skills = 468.** No shared role kits (the old generic "Steel Strike" kits were deleted). Fortune Dealer uses cards, dice and rerolls. *PROVIDED_SPEC (count, identity) / CUSTOM_DESIGN (each skill).*
- **3 Ascension stages** per class: I = 8 nodes, II = 6 nodes, III = 4 nodes including the ultimate. A stage-n skill requires Ascension n−1 (Ascension I→II at base Lv 40, II→III at Lv 80). *Stages PROVIDED_SPEC; Lv 40/80 CUSTOM_DESIGN fallback named in the spec; node counts CUSTOM_DESIGN (the screenshot shows 9 nodes in Ascension 1, SCREENSHOT_OBSERVED, not copied).*
- **Prerequisites** are AND by default, OR where marked (dashed line in the tree). Validator rejects cycles, unknown skills, ranks above the parent's max, and parents in a later stage.
- **Per-skill max rank** (1–10; ultimates 3). Rank formula: power × (1 + 10%·(rank−1)), MP + 0.6·(rank−1), cooldown − cdr·(rank−1) (min 0.5 s). *CUSTOM_DESIGN / NEEDS_BALANCING.*
- **Skill points come from job level only**: 1 per job level (job 1 = 1 point, spent on the starter skill), cap 70. Base level gives stat points only. *PROVIDED_SPEC (source) / CUSTOM_DESIGN (amount).*
- **Pending allocation**: the client keeps a draft (+/−, Undo, Clear); nothing changes on the server until **Confirm**, which sends one `skillCommit {draft, rev, opId}`. The server validates the whole draft, applies it all-or-nothing, bumps `skillRev`, and remembers the last 20 `opId`s so a retried request is applied once. A stale `rev` returns `STALE_REVISION`; lowering ranks needs a reset.
- **Reset**: a Scroll of Unlearning if owned, otherwise 2,000 G; refunds everything except the starter skill.
- **Recommended builds**: 2 per class (52). Auto Allocate fills a *draft* in build order, then the path to the ultimate, then passives, then everything else — legal at every step. Tested: all 52 reach a legal 70-point draft that includes the ultimate.
- **Normal attack** is per class (`normal` in each kit) and not part of the tree.
- **Passives** apply only after Confirm (they read committed ranks).
- **Damage types**: physical (ATK vs DEF, can miss), magical (MATK vs MDEF), heal, utility.
- **Cooldown reduction** = min(20%, DEX × 0.1% + equipment CDR). *PROVIDED_SPEC.* No cast times.
- **Gauges** (26, one per class, `skills/gauge.ts`): kinds resource / stacks / charge / combo / phase; gains on hit, hurt, heal, cast, kill, crit, standing still; optional decay; skills can cost, require (`need`) or add gauge. Effects: empower, shield, crit, haste, heal, cdReset (Chrono Rewind), phase (Moon Oracle 4 phases, Tide Witch high/low), gamble (Fortune Dealer dice), selfburn (Heat / Entropy HP cost), summonBoost, freezeChance, chainBoost.
- **Skill stones**: one socket per active skill, embed/remove free (Skills window or Enchanter); first inscription free; re-inscription 5 Stone Dust + 500 G rolls a new set held as *pending* until the player keeps old or takes new (saved on the item); refine +10; legendary stones add a behaviour (echo, quicksilver, hollow cost, expanse, forked path).
- **Hotbar**: 8 skill slots + 2 potion keys, 3 sets (SET button), drag-and-drop between slots and from the tree, passives and unlearned skills refused by the server.
- **Auto-combat** uses the same commands: heal skill below 50% HP, otherwise the strongest ready damage skill whose MP, gauge requirement and range are met, otherwise the normal attack.

## 3. GUI (§32–33)
Cream panel, muted-green title bar, brown/gold frame (`.win.skwin` in `apps/game-client/styles.css`). Header (class, job/base level, ascension, gauge with live value), gauge description, Ascension I/II/III tabs with point totals, the tree (prerequisite lines gold when met, dashed for OR; node states locked / available / learned / maxed / pending), detail panel (type, damage type, requirements with ✓/✗, current-vs-next rank table, ±1 rank, hotbar 1–8, stone socket), builds selector with pros/cons and Auto Allocate, footer (points, pending, Undo, Clear, Reset, Confirm). Thai and English.
*Layout fidelity to the reference game is UNVERIFIED (reference not reachable); the layout follows the spec text and the user's screenshot.*

## 4. Known limits
See `SKILL_IMPLEMENTATION_STATUS.md`. Most important: skill icons are procedural placeholders (22 glyphs coloured per class), balance is SIMULATION_ONLY, and deploying this build migrates every character on load (full skill-point refund), which needs owner approval before production.
