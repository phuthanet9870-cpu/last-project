# Phase C audit — Full System Rework (HB-007, HB-016…024, HB-036…045, HB-057…064)

Audit of the code at 0.15.0 against `Hearthbound_Full_System_Rework_Master_Prompt.md`. "Before" = state found; "Action" = what phase C does.

| HB | Requirement (short) | Before | Action |
|---|---|---|---|
| 007 | Astral Mastery after Lv 120 + Ascension III; 1 stat point per level for the first 50; milestones wings/title/announce | PARTIAL — mastery needed a 4th ascension at 120; no stat points; no announcement | gate = Lv 120 + Ascension III; +1 stat point for levels 1–50; server-wide announce at milestones |
| 016 | Every class has a fitting off-hand | PARTIAL — one generic Shield | 7 off-hand families by role (shield, quiver, orb, charm, focus lantern, toolkit, parrying dagger), class-restricted |
| 017 | Separate option pools per slot; choose first line at craft; reroll with Option Stone | PARTIAL — pools by item type; no first-line choice | per-slot pools; craft can lock the first option line; Enchant Stone renamed Option Stone |
| 018 | Refine never destroys; fail above +4 → −1; ward protects; high levels need more ore; high ward covers to +20 | WRONG — −1 only at +11–15 (chance) / +16+ | fail at current ≥ +5 → −1 (config `refineDowngradeFromLevel`); Ward ≤ +15, Greater Ward ≤ +20; ore qty scales |
| 019 | 4 sockets at +5/+10/+15/+20; removal free; downgrade disables, never deletes | PARTIAL — unsocket cost 500 G | free removal |
| 020 | 14 gem types × 5 grades, refine to +10, sources | PARTIAL — 9 types × 3 grades | 14 × 5; fusion to grade 5; dungeon/box sources |
| 021 | Monster cards: same stat in one row counts max, not sum; character-wide cap | WRONG — all cards summed | per-row max per stat + character cap per stat |
| 022 | Costume/wings/companion/wedding ring fixed stats; duplicates enhance to +5 (atomic) | PARTIAL — enhancement was cosmetic only | +10% stats per enhancement level; companion + wedding ring items |
| 023 | Refine/gem reveal; server result before animation | IMPLEMENTED_TESTED (E2E 39) | — |
| 024 | Monster Card vs TCG separate | IMPLEMENTED (separate stores) | test that TCG cards never add combat stats |
| 036 | Open daily dungeons from a window daily, 5 types × 10 floors, floor unlock | PARTIAL — needed the dungeon warden | open from the Dungeons window anywhere outside instances |
| 037 | Gem: single boss encounter | MISSING (generic waves) | boss-only run |
| 038 | Mine: break 14 ore rocks + core in 5 min | MISSING | destructible ore nodes objective, 5-min limit |
| 039 | Pet: defend the nest | MISSING | nest entity with HP; survive waves; lose if nest dies |
| 040 | EXP dungeon: EXP proportional to level | PARTIAL — fixed EXP per floor | EXP = % of the player's level requirement |
| 041 | Stone: blank stones + dust | PARTIAL — dust only | adds Blank Skill Stone |
| 042 | Wave mode: 5 waves + boss in 10 min, element rotates by weekday | MISSING | wave rules for EXP/Stone/Pet types; weekday element |
| 043 | 1 free reward per type per day; extra entries with Crystal 20 doubling; caps 5/day (EXP 2/day) | WRONG — 2 runs per floor | quota per type; quote + lock; charge only on reward; no charge on fail |
| 044 | Members without quota may help but get no reward | MISSING | per-member check at completion |
| 045 | Regular dungeon boss rewards 3 / account / dungeon / day | MISSING — per character | account-scoped quota |
| 057 | Eggs from monsters; pets help combat, stats, fishing/mining | PARTIAL — no gathering assistance | active pet adds gather yield / speed by species |
| 058 | Show pool + probability before opening any egg/box | IMPLEMENTED (egg odds tab, wish rates) | test that probabilities sum to 100% |
| 059 | Farm 12 → +4 up to 60 | IMPLEMENTED | test |
| 060 | Feeder 4 → 20 slots; hourly EXP offline | IMPLEMENTED | — |
| 061 | Feeder refine +10 with gold + regional food; failure keeps level | PARTIAL — gold only, always succeeds | chance + regional food, no downgrade |
| 062 | Pet dismantle → Star Dust by level; Lv 120 = 2× base | WRONG — 1 + stars | curve by level (CUSTOM_DESIGN), Lv 120 = 2× Lv 1… base; confirm in UI |
| 063 | Walk private farm; starter decorations free; 30 placed; visit offline friends | IMPLEMENTED | — |
| 064 | Duplicate mount → upgrade until +5, then Stable Seal; seals buy keys/chosen mount | PARTIAL — always sealed | duplicates raise mount level to +5 first |
