# Game Design Document — Hearthbound Online (working title)

Original cozy-fantasy 2D top-down pixel MMORPG. All names, formulas, art and audio are original; formulas are temporary assumptions (ASSUMPTIONS.md).

## Core loop
Talk to NPCs → accept quests → fight monsters with skills → earn EXP/Gold/loot → equip, refine, socket gems, insert monster cards, slot skill stones → tackle dungeons, world bosses and arena → gather & craft → trade on the market → collect pets/mounts → play Hearthcards → daily missions, events, pass.

## World
Emberglen Village (hub, 18 service NPCs) → Whisperwood (Lv1–12, Mossy Hollow dungeon entrance) → Amber Hills (Lv10+, PvP-flag zone, Sunken Crater world boss) → Frostmere Steppe (Lv25+). Personal Cozy Farm and House (instanced). Hearth Arena (instanced). Day/night cycle (8 real minutes), weather per map (rain, snow, fog, leaves), lighting from lamps/torches/windows.

## Classes
26 classes in 9 roles (tank, warrior, assassin, archer, mage, healer, support, summoner, tech), each with element, weapon restrictions, base stats & growth, a class gauge and 18 skills (active, passive, ultimate). Gauge fills on hits; at 100% the next skill is empowered (+50%) and some classes add unique effects (Vanguard shield, Chrono cooldown reset, Fortune random 0.5–2.5× multiplier, Void HP-for-power).

## Progression
Base level 1–120 with `floor(100·L^2.2)` EXP; job levels grant skill points; 3 Ascensions gated at 60/90/120 (Guardian Hearts); Extended Mastery after Ascension 3; stat points (3/level), milestone mail every 10 levels; combat power score.

## Combat
Server-authoritative pipeline: hit (accuracy vs evasion) → element matrix (9×9) → defense `100/(100+def−pen)` → crit ×1.5 → buffs → shields → HP. 31 status effects (DoT/HoT, CC with resist, buffs/debuffs, shield, stealth, invulnerability, taunt). Skill targeting: single, AoE self/target, line, cone, chain, party; dash, summons, lifesteal, cleanse.

## Items & enhancement
Six gear tiers (Oakwood → Astral) × 12 weapon types + 6 armor + 3 accessory slots, set bonuses at 3/5/8 pieces; random options; refinement +1–20 with the master prompt success table, downgrade floor +10, ward charm, pity; 4 gem sockets (+5/10/15/20), 9 gem types × 3 grades with fusion; monster cards (one per monster) + collection bonuses; skill stones (inscribe, 2 modifiers, refine, 4 slots).

## Pets, farm, mounts, housing
12 species (capture with Silk Net on weakened monsters, or hatch eggs with published odds), levels, stars, evolution, feeding, active skill & owner bonus; farm with capacity 12→60, feeder upgrades, offline EXP from timestamps (12 h cap, food-limited); 4 mounts with speed & passive bonuses; decorations placeable/rotatable on farm and in house.

## PvE / PvP
Mossy Hollow story dungeon (2 waves + Hollow King boss with phases); 5 daily dungeon types × 10 floors; 7 rotating world bosses with telegraphs and contribution scoring (damage + 1.5×healing + 1.2×tanked); arena (online ranked 1v1 & duels between real players with Elo; AI 2v2/3v3 in artifact); open-world PvP flag in PvP maps.

## Economy
Gold (main), Crystal (special, tradable on Gold↔Crystal order book; simulated, no cash value), arena tokens, boss coins, card dust, guild tokens. Double-entry ledger with labelled faucets (monsters, quests, events) and sinks (refine, NPC shops, market tax 5%, exchange fee 1%, teleport, resets). Market listings with escrow, buy orders, auctions with anti-sniping, direct trade with lock+confirm.

## Social
Chat channels (local/world/party/guild/trade/whisper), friends/block/report, party (6), guild (create, invite, donate, level, blessing, storage), mail with attachments, marriage (artifact: simulated partner).

## Hearthcards (TCG)
Original turn-based card game: 92 cards (creature/spell/trap/equipment/field/hero) across 9 elements, keywords Guard/Swift/Flying/Venom/Shield/Lifelink, 20-card decks, 7 starter decks, AI duels, 10-floor tower, ranked ladder (vs AI), packs with pity, craft/dust.

## LiveOps
7-day login calendar, 6 daily missions + activity chests, weekly rotating events (EXP / drop multipliers + missions), 30-level adventure pass (free/premium via simulated Crystal), gacha with exact odds and 50-draw pity. Real payments disabled.
