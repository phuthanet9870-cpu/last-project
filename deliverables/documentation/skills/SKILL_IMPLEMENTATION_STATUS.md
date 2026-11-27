# Skill System V4 — implementation status

| # | Requirement (V4 section) | Status | Evidence |
|---|---|---|---|
| 1 | 26 classes × 18 unique authored skills (468), no shared role kits | IMPLEMENTED_TESTED | `skills_v4.test.ts` "26 × 18", "no two classes share a skill name" |
| 2 | Class identity (§14), e.g. Fortune Dealer = cards/dice/reroll | IMPLEMENTED_TESTED | test "Fortune Dealer uses cards / dice / reroll"; dice recorded in combat |
| 3 | 3 Ascension stages, nodes per stage, Lv 40/80 fallback | IMPLEMENTED_TESTED | stage test; ascension gate test (core.test.ts) |
| 4 | Visual tree, prerequisites AND/OR, node states | IMPLEMENTED_TESTED | `validateKit` on all 26; E2E step 41 (locked nodes, +1, Undo) |
| 5 | Per-skill max rank + rank tables | IMPLEMENTED_TESTED | rank-table test (UI table = combat values) |
| 6 | Job level → skill points; base level → stat points | IMPLEMENTED_TESTED | "new character…" test |
| 7 | Pending allocation, Undo / Clear / Confirm | IMPLEMENTED_TESTED | E2E step 41 |
| 8 | Server atomic commit, revision, idempotency | IMPLEMENTED_TESTED | unit "atomic draft commit"; multiplayer step "Skill V4 on the server" |
| 9 | ≥ 52 recommended builds + Auto Allocate into a draft | IMPLEMENTED_TESTED | all 52 → legal 70-point draft incl. ultimate; E2E Auto Allocate + Confirm |
| 10 | 26 unique class gauges (§13) | IMPLEMENTED_TESTED | per-class parametrized test for all 26 (gains, spend scaling, requirements, phase advance) + combat tests for Moon Oracle phase, Spirit Monk Ki, Blade Sentinel Edge, Fortune dice |
| 11 | Normal attack separate from the tree | IMPLEMENTED_TESTED | per-class `normal`; test "normal attack is separate" |
| 12 | Passives apply only after commit | IMPLEMENTED_TESTED | test "passives apply only after commit" |
| 13 | Physical vs magical damage | IMPLEMENTED_TESTED | existing combat tests + per-skill `dmgType` |
| 14 | CDR = min(20%, DEX×0.1% + gear); no cast times | IMPLEMENTED_TESTED | CDR cap test; `castMs` removed from all skill data |
| 15 | Status effects §22 | IMPLEMENTED_TESTED (existing set) | added `matk_up`, `mdef_break`; all statuses referenced by skills exist (checked at build) |
| 16 | Skill stones: 1 socket per skill, free embed/remove, free first inscription, re-inscribe cost + keep old/new, refine +10, legendary behaviour | IMPLEMENTED_TESTED | "V4 skill stones" test; E2E step 09 |
| 17 | Skill detail: current vs next rank from combat data | IMPLEMENTED_TESTED | rank-table test + E2E compare table |
| 18 | Hotbar 8 slots, multiple sets, drag-and-drop, no passives | IMPLEMENTED_TESTED (rules, sets) / IMPLEMENTED_UNTESTED (drag gesture) | "V4 hotbar" test; drag-and-drop not driven by E2E |
| 19 | Reset scroll | IMPLEMENTED_TESTED | reset test (scroll used before gold) |
| 20 | Auto-combat integration | IMPLEMENTED_TESTED | E2E 37 + 39 (auto-battle kills/loots) |
| 21 | New GUI (§32–33 colours/layout) | IMPLEMENTED_TESTED (function) / UNVERIFIED (fidelity to reference) | E2E 41 screenshots |
| 22 | Original icons + asset registry; placeholders not called final | PARTIAL — placeholders | see asset registry below |
| 23 | Database / API with server authority | IMPLEMENTED_TESTED | multiplayer step; commands run in the shared server dispatcher |
| 24 | Migration: refund, never remap | IMPLEMENTED_TESTED (code) / NOT RUN on production | `SKILL_MIGRATION_REPORT.md` — needs owner approval |
| 25 | Balance report | SIMULATION_ONLY | `SKILL_BALANCE_REPORT.md` |
| 26 | Docs set | IMPLEMENTED | this folder |

## Asset registry — skill art (PLACEHOLDER, not final)
| Asset | Current | Final needed |
|---|---|---|
| 468 skill icons | Procedural 12×12 glyph chosen by skill VFX (22 glyphs), coloured with the class trim colour; frame shape by type (square active, round passive, gold ultimate) | 468 unique hand-made icons (or 26 class sets × 18) |
| Skill VFX | 14 generic particle styles (proj, ring, line, rain, explosion…) | per-skill effects for ultimates at minimum |
| Gauge HUD art | generic bar + text (phase name for phase gauges) | 26 class gauge widgets |
| Summon sprites (wolf, bear, hawk, behemoth, treant, wraith, reaper, turret, cannon) | all use the "wisp" sprite | individual sprites |
| Training dummy | golem sprite | dummy sprite |
