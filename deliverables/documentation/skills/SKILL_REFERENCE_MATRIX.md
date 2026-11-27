# Skill reference matrix (V4) — where every important value comes from

Reference game pages were **not reachable** from the build container (DNS ENOTFOUND, 2026-11-28; the owner asked not to retry).
Priority used: screenshots → recorded reference data (none available) → Full System Rework MP → Skill V4 → main MP → UI spec → current source → own design.

| Item | Value in Hearthbound | Label | Source / note |
|---|---|---|---|
| Classes × skills | 26 × 18 = 468 | PROVIDED_SPEC | Skill V4 §01 |
| Ascension stages | 3 | PROVIDED_SPEC | V4 |
| Ascension levels | Lv 40 / Lv 80 | CUSTOM_DESIGN | V4 fallback named in the spec |
| Nodes per stage | 8 / 6 / 4 | CUSTOM_DESIGN | Screenshot shows 9 in Ascension 1 (SCREENSHOT_OBSERVED); not copied |
| Rank table shape (MP up, CD flat, damage % up, hits) | yes | SCREENSHOT_OBSERVED (shape only) | Screenshot: rank 4→5 MP 9→10, CD 2 s, 2.5 m, 175.5%→189% ATK, ×2 |
| Damage growth per rank | +10% of base per rank (default) | CUSTOM_DESIGN / NEEDS_BALANCING | The screenshot's +7.7% step was not used as a rule |
| MP growth per rank | +0.6 per rank (rounded) | INFERRED | From screenshot MP 9→10 step |
| Skill point source | job level only, 1 per level | PROVIDED_SPEC / CUSTOM_DESIGN amount | V4 |
| Job level cap | 70 | CUSTOM_DESIGN | existing game value |
| CDR | min(20%, DEX × 0.1% + gear) | PROVIDED_SPEC | V4 |
| Cast times | none | PROVIDED_SPEC | "no RO-style cast times" |
| 26 gauge names | as listed in §13 | PROVIDED_SPEC | V4 §13 |
| Gauge rules (max, gains, effects) | per class in classdata | CUSTOM_DESIGN / NEEDS_BALANCING | |
| Class identities | per §14 | PROVIDED_SPEC (identity) / CUSTOM_DESIGN (skills) | e.g. Fortune Dealer = cards/dice/reroll |
| Every skill name, effect, number | classdata_*.ts | CUSTOM_DESIGN / NEEDS_BALANCING | original Hearthbound content |
| Per-class damage scale | skills/balance.ts | SIMULATION_ONLY / NEEDS_BALANCING | 3 calibration passes vs neutral dummy |
| Stone: first inscription free, re-inscribe cost + keep choice, +10 refine, legendary behaviour | yes | PROVIDED_SPEC (rules) / CUSTOM_DESIGN (numbers) | V4 §24 |
| Re-inscription cost | 5 Stone Dust + 500 G | CUSTOM_DESIGN | |
| Stone modifiers ranges | power 5–15%, CD 5–12%, MP 5–20%, radius 5–20% | CUSTOM_DESIGN | |
| Hotbar | 8 slots, 3 sets, no passives | PROVIDED_SPEC (8, sets, no passives) / CUSTOM_DESIGN (3 sets) | |
| Reset | scroll, else 2,000 G | PROVIDED_SPEC (scroll) / CUSTOM_DESIGN (gold) | |
| Builds | 2 per class = 52 | PROVIDED_SPEC (≥ 52) / CUSTOM_DESIGN (content) | |
| GUI colours | cream / muted green / brown-gold | PROVIDED_SPEC | §33 |
| Skill icons | procedural glyphs | PLACEHOLDER (not final) | see SKILL_IMPLEMENTATION_STATUS.md asset registry |
