# MASTER PROMPT — ORIGINAL FULL-SYSTEM 2D MMORPG

> วิธีใช้: ส่งไฟล์นี้ทั้งไฟล์ให้ AI Coding Agent ที่มีสิทธิ์อ่าน/เขียน Repository และรันคำสั่งในเครื่องพัฒนา แล้วสั่งให้ปฏิบัติตามตั้งแต่ BEGIN ถึง END โดยไม่ต้องนำ Prompt อื่นมาต่อท้าย
>
> ขอบเขต: รวมข้อกำหนดเกมจากการวิเคราะห์ Lantern Hearth, Master Prompt ก่อนหน้า และการออกแบบทดแทนระบบที่เข้าถึงไม่ได้ พร้อมระบบขยายและเกณฑ์ตรวจรับทั้งหมดในไฟล์เดียว ไม่ใช่ซอร์สโค้ดหรือข้อมูลลับของเกมอ้างอิง ข้อมูลภายในและสูตรทั้งหมดที่ไม่ยืนยันได้เป็นสมมติฐานสำหรับเกมใหม่

# BEGIN MASTER PROMPT

## 00 — บทบาทและภารกิจ

ทำงานในฐานะทีม Game Director, Game Designer, Technical Director, Software Architect, Senior Full-stack Engineer, Multiplayer Network Engineer, Database Architect, Combat Designer, Economy Designer, UI/UX Designer, Pixel Art Director, DevOps, Security Engineer, QA Lead และ Live Operations Manager

เป้าหมายคือสร้าง MMORPG 2D ออนไลน์ต้นฉบับที่เล่นได้จริง มีโลกถาวร ตัวละครหลายคน ระบบต่อสู้ พัฒนาอาชีพ ไอเทม เศรษฐกิจ สังคม สัตว์เลี้ยง ดันเจี้ยน PvP เกมการ์ด และระบบบริหารเกมครบถ้วน ตั้งแต่หน้าจอเริ่มเกมถึง Endgame และระบบปฏิบัติการหลังเปิดบริการ

ใช้แนวคิด Behavioral Analysis และ Clean-room Design: สร้างโค้ด สูตร เนื้อเรื่อง ชื่อตัวละคร แผนที่ ภาพ เสียง และอัตลักษณ์ต้นฉบับ ไม่คัดลอกซอร์สโค้ดหรือทรัพย์สินของ Lantern Hearth หรือเกมอื่นโดยไม่ได้รับอนุญาต ไม่อ้างว่าข้อกำหนดนี้คือสถาปัตยกรรมจริงของเกมอ้างอิง

ห้ามส่งมอบเพียง Landing Page, UI Mockup, Prototype ที่มีแต่ปุ่มหลอก หรือข้อมูลจำลองที่อ้างว่าเป็นระบบจริง เป้าหมาย Production-ready ต้องพิสูจน์ด้วยการทดสอบ การรักษาความปลอดภัย และการตรวจรับ ไม่ใช่เพียงการประกาศว่าเสร็จ

## 01 — ค่าเริ่มต้นและขอบเขตผลิตภัณฑ์

- ชื่อชั่วคราว Hearthbound Online (เปลี่ยนได้); Cozy Fantasy Pixel Art ต้นฉบับ; มุมมอง 2D top-down หรือ isometric แบบเดียวกันทั้งโปรเจกต์ (ค่าเริ่มต้น top-down 8 ทิศทาง); เล่นฟรีบนเว็บ รองรับ Mobile Web และ Desktop wrapper ภายหลัง
- ภาษาไทย/อังกฤษ; โลกออนไลน์แบบ persistent; Server-authoritative; แยกโลกและเศรษฐกิจตาม World; Modular Monolith ก่อนแยกบริการตามผลทดสอบจริง
- Gold เป็นเงินหลัก; Crystal เป็นเงินพิเศษ; Extended Mastery เป็นเลเวลต่อเนื่องหลัง Ascension; ชื่อเฉพาะทั้งหมดเปลี่ยนได้
- เป้าหมายเนื้อหา: 26 อาชีพ × 18 สกิล = 468 สกิล; Base Level 120; Ascension 3 ขั้น; 25 ภูมิภาค; 150 แผนที่; 1,200 มอนสเตอร์; 5,000 ไอเทม; 350 สัตว์เลี้ยง; 1,200 การ์ดมอนสเตอร์; 85 การ์ด TCG ขึ้นไป; 7 Starter Deck; ปาร์ตี้ 6 คน; Daily Dungeon 5 ประเภท ประเภทละ 10 ระดับ; จำนวน NPC และเควสต์รองรับอย่างน้อย 357 และ 153 ตามลำดับ
- ตัวเลขคือเป้าหมายออกแบบ ไม่ใช่คำยืนยันจำนวนในเกมอ้างอิงหรือจำนวนที่สร้างแล้ว; ทุกจำนวน/เพดาน/สูตรต้องปรับจาก versioned configuration โดยไม่แก้ Core Engine
- สภาพแวดล้อม Development, Staging, Production แยกกัน; Feature Flag สำหรับระบบเสริม, การเติมเงินจริง, paid random rewards, raid, housing, breeding, guild war และ cross-world transfer; ค่าเริ่มต้นปลอดภัยและปิดการใช้เงินจริงจนกว่าจะได้รับอนุญาต
- ผู้เล่นพร้อมกันเป้าหมายทดสอบ: prototype 10–20; alpha 50–100; closed beta 100–500; open beta 500–1,000; production 1,000–5,000+ เมื่อผลทดสอบยืนยันเท่านั้น ไม่รับประกันล่วงหน้า

## 02 — Technology stack และสถาปัตยกรรม

เลือกเวอร์ชัน stable ที่เข้ากันได้และบันทึก lockfile: React, TypeScript strict, Vite, Tailwind CSS, Zustand, Phaser 3/WebGL (Canvas fallback หากจำเป็น), i18next; Node.js, Fastify, Colyseus, WebSocket, Zod; PostgreSQL, Prisma, Redis, BullMQ; Tiled JSON map editor; S3-compatible object storage/CDN; Docker Compose, Nginx, Git, CI/CD; Prometheus/Grafana หรือระบบ metrics เทียบเท่า; Vitest, Playwright, integration และ multiplayer load tests. ใช้ pnpm workspace. บันทึก ADR หากต้องเปลี่ยนเทคโนโลยีเพื่อให้เข้ากับ Repository เดิม

```text
Browser / Mobile Web / Desktop
      | HTTPS / WSS
CDN + Gateway + Load Balancer
      |-- API / Auth (Fastify)
      |-- Game Server (Colyseus rooms)
      |-- Admin UI + protected Admin API
      |-- Worker (BullMQ)
          |-- Domain modules + shared validation
          |-- PostgreSQL (durable authoritative data)
          |-- Redis (cache, presence, queue, temporary state)
          |-- Object storage (versioned assets)
      |-- Observability / audit / backup
```

Frontend ส่ง intent ไม่ใช่ผลลัพธ์; Server ตัดสินตำแหน่ง การต่อสู้ EXP เงิน ไอเทม การสุ่ม รางวัล และการซื้อขาย; Client ห้ามเชื่อมฐานข้อมูลโดยตรง. แยก REST control plane ออกจาก real-time simulation. ใช้ shared schemas, versioned protocol, domain events, clear ownership และ dependency direction. ใช้ outbox สำหรับ durable events; Redis Pub/Sub ไม่ใช่หลักประกันการส่งธุรกรรมสำคัญ

## 03 — Repository structure

```text
mmorpg/
  apps/
    game-client/
    game-server/
    api-server/
    admin-dashboard/
    worker/
  packages/
    shared/
    game-core/
    combat-engine/
    economy-engine/
    network-protocol/
    database/
    validation/
    localization/
    game-config/
  content/
    classes/ skills/ monsters/ items/ maps/ npcs/ quests/
    pets/ mounts/ cards/ dungeons/ bosses/ crafting/ events/ shops/
  assets/
    characters/ monsters/ tilesets/ effects/ icons/ music/ audio/
  infrastructure/
  scripts/
  tests/
  docs/
  .env.example
  docker-compose.yml
  pnpm-workspace.yaml
  README.md
```

ภายใน Game Server แยก core, auth, network, world, movement, character, combat, skills, effects, monsters, items, enhancement, pets, mounts, quests, economy, market, social, adventure, pvp, tcg, crafting, commerce, liveops, automation, security, admin, workers, database, tests. แยก domain logic, application service, repository adapter, transport, configuration และ test fixture. ห้ามสร้าง circular dependencies

## 04 — Definition of Done ใช้กับทุกระบบในไฟล์นี้

ทุกระบบต้องมี System ID, purpose, prerequisites, user workflow, rules/limits, source/sink และ reward/cost ถ้าเกี่ยวข้อง, domain model, database/migration ถ้าจำเป็น, server service, REST/WebSocket contract, client state และหน้าจอ, loading/empty/error states, authorization, validation, idempotency/concurrency ตามความจำเป็น, audit/metrics, feature flag, localization, test cases, documentation และ acceptance criteria. ทุกปุ่มต้องทำงานจริง หรือปิดและแจ้งชัดเจนว่าไม่เปิดใช้งาน. ห้ามนับ mock/TODO/interface/placeholder เป็น COMPLETE. ไม่จำเป็นต้องสร้าง endpoint/table แยกสำหรับกลไกย่อยที่ใช้ร่วมกัน ให้บันทึก mapping ที่ตรวจสอบได้

สถานะ registry: NOT_STARTED, DESIGNING, IN_PROGRESS, BLOCKED, TESTING, COMPLETE. ใน audit เพิ่ม PARTIAL, MOCK_ONLY, BROKEN, MISSING. COMPLETE ต้องมีหลักฐานการทดสอบ end-to-end จริง. ระบบที่ไม่ได้เปิดด้วย feature flag ต้องระบุว่า implemented/disabled หรือยังไม่พัฒนา ไม่ปะปนกัน

# PART A — ACCOUNT, CHARACTER, CORE GAMEPLAY

## 05 — Account, identity and session

สมัครสมาชิก, login/logout, email verification, forgot/reset/change password, guest account และ upgrade, OAuth, account binding/recovery, access/refresh token rotation, session expiry/revocation, device management, login history, concurrent session policy, account suspension/ban/deletion, terms/privacy consent, age/region restrictions, account-shared rewards/entitlements, beta progress และ purchase recovery. ใช้ Argon2id; short-lived access token; refresh token เก็บ hash และ rotate; secure cookies เมื่อใช้ cookie-based auth; brute-force protection; email token อายุจำกัด; server ตรวจ account ownership ทุกคำสั่ง. ห้ามล็อกอินบัญชีที่ถูกระงับ. การลบบัญชีต้องจัดการข้อมูลตามกฎหมายและ retention policy

## 06 — World and server

World/server/channel selection, region, world status/population/capacity, online count, login queue, maintenance mode, world-specific economy/market/ranking, character assignment, world isolation, cross-server communication ที่ได้รับอนุญาต, controlled transfer และ merge tools (ปิดค่าเริ่มต้น), world announcements, server time, restart recovery. ทุก entity, wallet, listing และ ranking ที่แยกโลกต้องมี world scope; ห้ามย้ายเงิน/ไอเทมข้ามโลกโดยปริยาย

## 07 — Character creation and profile

Create/select/delete/restore/rename character, unique name และ validation, slots, body type/gender, race, class, hairstyle/color, skin, eyes, face, starter outfit, sprite preview, appearance change, character profile, last location, playtime. สร้าง starter inventory, stats, wallet และตำแหน่งเริ่มต้นในธุรกรรมเดียว. ตรวจสิทธิ์และ cooldown ในการลบ/คืนตัวละคร. รองรับหลายตัวละครต่อบัญชี

## 08 — Class system

ออกแบบ 26 อาชีพต้นฉบับ: Vanguard (Tank), Blade Sentinel (Warrior), Rune Knight (Magic Warrior), Wild Archer (Archer), Falcon Scout (Ranger), Shadow Rogue (Assassin), Phantom Dancer (Evasion DPS), Dawn Priest (Healer), Spirit Monk (Support Fighter), Moon Oracle (Support Mage), Flame Weaver (Fire Mage), Frost Sage (Ice Mage), Storm Caller (Lightning Mage), Earth Keeper (Earth Mage), Tide Witch (Water Mage), Void Scholar (Dark Mage), Sun Herald (Light Mage), Beast Tamer (Pet Summoner), Grove Warden (Nature Summoner), Soul Binder (Spirit Summoner), Iron Engineer (Technology DPS), Cannon Smith (Heavy Ranged DPS), Sky Dragoon (Mobile Melee), Chrono Adept (Time Mage), Fortune Dealer (Random Effect DPS), Melody Bard (Support)

แต่ละอาชีพมี base stats, growth, role, element, weapon/equipment restrictions, class resource/gauge, passive, unique mechanics, 18 skills, skill tree/mastery, animation/sound, progression, balance config. สร้าง Class Registry แยกจาก combat engine. ต้องมีข้อดีข้อเสียและบทบาทที่มีคุณค่า ไม่ใช่แค่เปลี่ยนชื่อสกิล

## 09 — Progression

Base Level/EXP, Job Level/EXP, EXP curve, skill/stat points, level requirements/cap, level-up animation/rewards, class mastery, skill unlock, stat/skill reset, ascension 1–3, ascension quests/rewards/bonuses, extended mastery (เทียบแนวคิด Lantern Level), milestones, rested EXP, party EXP share, EXP modifiers/penalty, catch-up, combat power calculation. ค่าเริ่มต้น Level 1–120 แล้ว ascension 3 tiers ผ่าน quest และ requirement ที่ config ได้; ไม่ reset level โดยปริยาย เว้นแต่กำหนดนโยบายชัดเจน. หลังขั้น 3 เปิด Extended Mastery พร้อมเพดานโบนัส/diminishing returns; milestone หลังระดับ 50 ได้ cosmetic/utility เป็นหลัก. สูตรตั้งต้น `requiredExp(L)=floor(100*L^2.2)` สำหรับจากระดับ L ไป L+1; ไม่เรียกสูตรเมื่อชนเพดาน; รองรับรับ EXP ครั้งเดียวขึ้นหลายระดับ, overflow policy, versioning, UI preview. ใช้ curve จริงจาก simulation เวลาเก็บเลเวลก่อนเปิดบริการ

## 10 — Stat engine

Primary: STR, AGI, VIT, INT, DEX, LUK. STR = physical attack/knockback resistance; AGI = attack speed/evasion; VIT = HP/DEF; INT = MATK/MP/heal; DEX = hit/cooldown reduction; LUK = crit/drop bonus แบบมีเพดาน

Derived: HP, MP, ATK, MATK, DEF, MDEF, accuracy/hit, evasion/flee, critical chance/damage, attack/cast/move speed, cooldown reduction, HP/MP regen, armor/magic penetration, healing power/received, lifesteal, damage reduction, block chance/strength, status/CC/element resistance, elemental damage bonus, drop/gold/EXP bonus, PvP damage bonus/reduction, threat

สูตรตั้งต้น (ออกแบบใหม่ ไม่ใช่สูตรจริงเกมอ้างอิง):
```ts
MaxHP = 100 + level * 25 + VIT * 18 + equipmentHP;
MaxMP = 50 + level * 8 + INT * 12 + equipmentMP;
ATK = weaponATK + STR * 2.5 + DEX * 0.5 + level;
MATK = weaponMATK + INT * 3 + level;
DEF = armorDEF + VIT * 1.5;
MDEF = armorMDEF + INT * 0.8 + VIT * 0.5;
Accuracy = 100 + DEX * 2 + level;
Evasion = AGI * 1.5 + LUK * 0.3 + level * 0.5;
CritPercent = Math.min(50, 5 + LUK * 0.2);
```

Stat pipeline: Base + level growth + allocated points + equipment + refine + random option + gems + monster cards + pets + mounts + passive + buffs + temporary bonus. แยก flat/additive percentage/multiplicative groups; กำหนดลำดับคำนวณ, rounding, soft/hard cap, diminishing returns, invalid values และ cache invalidation. ไม่คิด equipment ซ้ำในสูตรและ pipeline. สร้าง stat guide, modifier breakdown, preview และ test ทุกสูตร

## 11 — Movement and control

Click-to-move, WASD, touch, virtual joystick, key shortcuts, mouse/touch target, 8-direction movement/facing, idle/run/attack/cast/death animations, A* pathfinding, tile/object/dynamic collision, NPC interaction range, skill range, move speed modifiers, knockback, dash, teleport, map transition, auto navigation/click-to-quest, prediction/reconciliation/interpolation. Server ตรวจ speed, map, collision, ownership และ sequence; จำกัด movement request. Map change ต้องโหลด destination ก่อน commit; ไม่ยอมให้ client ส่งพิกัด teleport เอง

## 12 — Combat engine

Target select/lock/switch, normal/auto attack, melee/ranged/projectile, physical/magical/pure/element damage, single-target/AoE/ground/directional/cone/line/chain/multi-hit/splash, combo, channel/cast/cast interrupt, range/cooldown/global cooldown, resource cost, crit/miss/dodge/block/parry, absorption/shield/reflect/lifesteal, healing/HoT/DoT, threat/aggro/taunt, summon/trap, invulnerability/immunity, death/resurrection/respawn, kill/assist attribution, rewards/loot distribution, damage numbers, combat log, damage/DPS meter

Canonical pipeline: validate session/actor/target/map/range/resources/cooldown → reserve and commit cost → determine hit/critical using server RNG → compute base × skill × defense × element × crit × modifiers → apply shields → commit HP → enqueue effects/triggers → process death once → grant durable rewards once → broadcast authorized result. Define fixed ordering, rounding and clamps; cap trigger recursion/event count to avoid infinite reflect loops. Validate PvP permission and friendly-fire policies. Cancel/interrupt behavior explicit. Do not accept damage/HP/EXP/loot totals from client

สูตรตั้งต้น `effectiveDefense=max(0, defense-penetration)`; `damage=floor(attack*skillMultiplier*100/(100+effectiveDefense)*elementMultiplier*criticalMultiplier*buffMultiplier)`; crit multiplier 1.5; pure damage bypass defense only as specified; miss=0; shields absorb before HP change. Configure hit/evasion caps, defense coefficient, damage variance, crit and PvP multipliers. Healing cannot exceed missing HP unless converting to shield through explicit effect. Tests for zero/negative/overflow, overkill, simultaneous death, immunities, reflect, reconnect and duplicate rewards

## 13 — Status effect engine

Buff, debuff, poison, burn, bleed, freeze/chill, stun, silence, root, slow, blind, fear, sleep, confusion, curse, knockback/down, disarm, taunt, invulnerability, stealth/reveal, shield, regeneration, attack/defense increase/decrease, move increase, healing reduction. Definition: source, target, duration, tick interval, max stacks, stack/refresh policy, dispel/cleanse, immunity/resistance, priority, expiry, visual indicator. Specify offline expiration and CC diminishing returns. Apply/remove modifiers once. Shared effect framework for skills/items/pets/monsters

## 14 — Elements

9 elements: Neutral, Fire, Water, Earth, Wind, Ice, Light, Dark, Spirit. 9×9 directional matrix with attacker row and defender column; base multipliers 2, 1, 0.5, 0.25 configurable. Neutral interaction defaults to 1; design remaining relationships as a balanced original matrix, test all 81 pairs; define light/dark and spirit explicitly. Character/monster/skill/weapon/armor element, damage bonus, resistance/penetration, conversion, temporary imbue, element chart and tooltips. Clarify precedence skill override > weapon > class > neutral; armor/character defender rules documented

## 15 — Skill system and skill stones

Skill definition: ID/class, name/description/icon, active/passive/toggle/ultimate, required level/prerequisites, max rank, MP/resource cost, cooldown, cast/channel time, range/radius, damage/heal formula ID, target type, element, effect list, animation/VFX/SFX. Skill tree/unlock/upgrade/reset, skill points, loadout/hotbar, cooldown indicator, tooltip/preview, combo, queue/interruption/resource validation. 468 unique definitions target, not 468 copies of same behavior. Use constrained effect DSL/registered formulas rather than arbitrary executable code from content

Skill stones: blank stone, rarity/grade, drop/craft, inscription/random modifier, re-inscription, refine +0–10, socket/embedding/removal, dismantle/stone dust, protection, trade. Modifiers damage, cooldown, MP, radius, projectiles, duration, target count, crit, element, status. Compatibility with skill/class; prevent negative cooldown/cost or invalid effect combinations; preview costs and confirm. Stone changes persist and recompute skill stats

# PART B — WORLD AND ADVENTURE CONTENT

## 16 — Map and world engine

World map, region, town/village, field/forest/cave/desert/mountain/snow/swamp/ocean, dungeon, boss/PvP arena, guild hall, personal farm, housing/event area, safe/combat/restricted zone, portal/warp/teleport NPC, respawn/save point, Tiled collision/object/decoration layers, NPC/monster/resource spawn, map requirement, minimap, discovery/fog of war, weather, day/night cycle, ambient effects/BGM, regional resource table. Add maps through data without modifying engine. Validate references and reachable spawn/portal tiles. Instance IDs and world scope prevent cross-instance actions

## 17 — Entity and monster AI

Entity Manager: Player, Monster, NPC, Pet, Mount, Projectile, Resource Node, Ground Effect, Loot; unique entity IDs, lifecycle/spawn/despawn, spatial index and ownership. Monster types normal, elite, rare, mini/field/dungeon/world/event boss, summoned; level, element, stats/resistance, attack/skills, drop/EXP/gold/card, spawn/respawn/limit, behavior profile, guard, evolution, boss phases, enrage, telegraph, loot ownership

FSM: Idle → Patrol → Detect → Chase → Attack/Cast → Retreat/Return Home → Regenerate; Dead → Respawn. Transitions depend on aggro/threat, leash, cooldown, HP, target validity. Aggressive/passive/defensive/social aggro/ranged profiles. Limit AI update budget; despawn invalid entities; reward death once. Boss mechanics use explicit encounter state machine

Example original data:
```json
{"id":"forest_slime_001","name":"Forest Slime","level":5,"element":"earth","maxHP":250,"attack":18,"defense":8,"moveSpeed":65,"attackRange":40,"aggroRange":150,"leashRange":300,"attackIntervalMs":1500,"respawnSeconds":15,"aiType":"passive","baseExp":35,"goldMin":5,"goldMax":15,"skills":[],"drops":[{"itemId":"slime_gel","chance":0.65,"min":1,"max":3}]}
```

## 18 — NPC, dialogue, story and quests

NPC framework: quest, shop, blacksmith, enchanter, healer, teleport, storage, skill trainer, guild, dungeon, arena, pet, mount, marriage, crafting, exchange, event, card duel NPC. Dialogue tree/conditions/choices, portraits, animation, interaction range/requirements, schedule, quest indicator, contextual/multilingual dialogue

Quest types main/side/daily/weekly/repeatable/event/class/ascension/guild/party/hidden/tutorial. Objectives kill, collect, talk, visit, deliver, craft, upgrade, capture pet, clear dungeon/boss, PvP win, card duel, gathering, reach level. Acceptance/abandon, tracking/progress, chains/prerequisites/branches, rewards/choice/auto-claim, auto navigation, story scenes/skip/journal/history, repeat reset, tutorial guide. Server domain events drive counters; define whether existing progress/items count; reward settlement idempotent; validate objective and inventory consumption

## 19 — Loot and reward

Weighted loot table, guaranteed/rare/multiple/conditional/level/regional/boss drops, personal/shared/party loot, ownership/protection timer/expiry, auto loot/filter, need/greed optional, drop rate bonus, rare drop VFX/announcement, anti-exploit. Server RNG; distinguish independent drops from mutually exclusive weighted pools; probability schema and bounds; reward transaction IDs, idempotency, eligibility, full-inventory overflow mail. Loot reward never duplicated on reconnect or retry

# PART C — ITEMS, EQUIPMENT AND ENHANCEMENT

## 20 — Item registry and inventory

Item types weapon, armor, accessory, consumable/potion/food, material/ore, gem, skill stone, monster card, quest item, pet egg/food/rune, mount key, costume/wings, decoration, currency token, gacha ticket, card pack, pass/event item. Rarity Common/Uncommon/Rare/Epic/Legendary/Mythic. Definition ID/name/description/type/rarity/icon/max stack/buy-sell price/tradeable/account or character bound/expiration/requirements/usage/drop sources. Separate item definition from unique instance. Equipment has unique ID; stack instances have quantity

Inventory slots/categories, stack/split/merge, drag/drop, sort/search/filter, lock/favorite, tooltip/compare, use/destroy/sell/bulk sell/dismantle/bulk dismantle, expansion/capacity/optional weight, account and character warehouse, guild storage, deposit/withdraw, binding rules, full inventory handling/overflow mail. Single ownership location at a time: inventory/equipment/storage/mail escrow/market escrow/auction escrow/trade escrow. All movements atomic with item transaction history; check quantities, ownership, capacity, restrictions, world scope. Never duplicate items under concurrent moves

## 21 — Equipment

Slots main/off hand, head/body/gloves/boots/belt, ring 1/2, necklace/earrings, outfit/head costume/wings/back accessory/cosmetic companion/wedding ring. Equip/unequip, requirement, set/set bonus, stats/comparison, durability/loss/repair, binding, weapon/armor type, class restriction, preset/loadout, appearance override/transmog/hide cosmetic. Atomic equip swap with free slot validation; recompute stats; enforce weapon compatibility; equipment locked in market cannot equip

## 22 — Refinement and cosmetic enhancement

Refine +0–20, ore/material/gold cost, success/failure, safe level, downgrade, protection/ward/blessing (original names), pity/guaranteed milestone, bonuses, VFX/history/announcement, bulk refine if enabled. Default success from +1 through +20: 100,100,100,100,100,85,75,65,55,45,40,35,30,25,20,18,15,12,10,8 percent. +1–5 guaranteed; +6–10 consume materials on failure; +11–15 configurable downgrade probability; +16–20 default downgrade unless protected. Define exact downgrade floor, protection consumption, pity increment/reset and costs before launch; never silently destroy item. Show odds and consequences before confirmation. Cosmetic enhancement consumes duplicate cosmetic or dedicated material with explicit rules; no unintended competitive advantage

For fixed probability p without downgrade/pity, expected attempts = 1/p and expected single-step gold = cost/p; full-path costs with downgrade/pity must be simulated. Add refinement simulator/test fixture; atomic spend + roll + result; log RNG/config version and outcome

## 23 — Random options, enchantment and gems

Option pool/rarity/tier/value/slot, enchant stone, single/all reroll, lock, transfer/extraction, preview/history, crafting option selection, enchanter NPC. Compatibility by item type; no conflicting effects; protect locked options; atomic material spend

Gems STR/AGI/VIT/INT/DEX/LUK, HP/MP, attack/defense/crit/element. Socket unlock +5/+10/+15/+20 (4 max), embed/remove/upgrade/fusion/grade/refine +0–10/dismantle/dust/protection/market. Explicit policy for gems when refine drops below unlock threshold (default disable modifier until unlocked; do not silently delete). Prevent double count and duplicated gem on removal

## 24 — Monster card collection

Separate from TCG. Card collection/drop/rarity/effect/slot/row/equip/unequip/upgrade, duplicates, collection and set bonuses, stat calculation/modifier/cap, dismantle/trade, collection book/discovery/completion reward. Support 1,200 definitions; each effect compatible with modifier engine; distinguish owned card, equipped card and catalog entry. Enforce card bonus caps and deterministic stacking

# PART D — PETS, MOUNTS AND PERSONAL SPACE

## 25 — Pet system

Collection/capture, egg/hatching/timer, name/rename/species/rarity/element/role, level/EXP/stats/growth, happiness/affection/hunger, feeding/regional food, summon/dismiss/follow, combat/targeting/active-passive skills/unlock/runes/upgrade, star upgrade/evolution/fusion, optional breeding, equipment, dismantling/star dust, trading, collection book/ranking. Roles Tank/DPS/Healer/Support/Farming/Utility. AI follow owner, recover stuck path, respect leash, avoid impossible targets; reward contribution rules; pet buffs recomputed when summoned or changed. Unique pet ownership; prevent simultaneous farm assignment and active combat unless policy permits

## 26 — Pet farm and offline progress

Personal farm instance, capacity/expansion (12→60 pets), assignment/resting, auto feeding, lantern-style feeder/slots/expansion (4→20), feeder upgrade +0–10, food storage, offline pet EXP/progress/resource production, decoration placement/rotation/removal (30 default), friend visit/permissions/likes/ranking. Server timestamps and last settlement time; max accumulation duration configurable; calculate elapsed segments with feeder/food consumption, cap by available food and capacity; idempotent settlement; no client-clock trust. Visit permissions and collision-safe placement

## 27 — Mount and housing

Mount collection/unlock/key/riding/dismount/movement speed/skin/rarity/enhancement/level/passive bonus/stable/duplicate conversion/stable seal exchange/animation/restrictions/collection reward. Mount speed validated server-side; restrictions in combat/instances configurable; cosmetic and stat bonuses distinct

Housing optional: personal house/instance/expansion/furniture/craft/place/rotate/theme/room decoration/visitor permissions/friend visit/showcase/storage. Store layout and ownership; no item duplication between placed furniture and inventory; validate bounds; use feature flag

# PART E — PVE, PVP AND AUTOMATION

## 28 — Dungeons and raids

Regular/daily/weekly/solo/party/challenge/endless/event dungeon; entry/requirements/ticket/daily limit; isolated instance and party membership; difficulty/floor/unlock/wave/boss/timer/objective/failure/completion/reward/first clear/daily reward cap/claim/additional entry or reward/reconnect/leave/reset. State: Created→Waiting→Active→Encounter→Completed or Failed→Reward settlement→Closed. Reserve entry cost once; handle crash/refund policy; reconnect without duplicating run; reward once. Daily types Gem Dungeon, Refinement Mine, Pet Dungeon, EXP Dungeon, Skill Stone Dungeon; 10 floors or difficulty tiers each; configurable rewards and reset

Raid optional: instance, raid party/leader, multiple encounters, difficulty, weekly lockout, mechanics/shared objectives, wipe/checkpoint, loot/tokens/ranking; persistent encounter checkpoints and lockout; enable only after instance engine stable

## 29 — World boss

Schedule/rotation/spawn/countdown/announcement/entry/level requirement, HP and damage scaling, phases/skills/telegraph, participation and contribution from damage/healing/tanking/support, contribution ranking/MVP/participation and ranking rewards, boss coin/shop/exchange/history/anti-AFK eligibility. Default design level 30+, seven rotating bosses, 12:30/18:30/21:00/23:30 Asia/Bangkok as configurable example; not a claim about live schedule. Fix scaling at encounter start or define safe dynamic policy; prevent contribution farming; settle once per boss session. Fair reward weighting for non-DPS roles

## 30 — PvP, arena and matchmaking

Duel request/accept/countdown/boundary/result; friendly/casual/ranked; arena entry/queue/matchmaking/team assignment; 1v1,2v2,3v3,5v5,10v10, FFA; timer/respawn/scoring/kills/assists/MVP/spectator, tokens/shop/rewards/ranking/history/seasons/rating, anti-AFK/disconnect penalty/reconnect/anti-win-trading. Modes capture point (3 points), team deathmatch, last survivor, resource capture to base, base defense (original names). State Queue→Match Found→Ready→Countdown→Active→Finished→Settlement. Elo or Glicko with documented parameters; season reset and reward snapshot. PvP-specific balance, stat normalization optional. Default schedule example 13:00/20:00/22:00 Asia/Bangkok configurable. Validate objectives and score server-side; no hidden state leaks to spectators

## 31 — Official auto play and offline system

Auto attack/skill/target/move/loot/potion, HP/MP potion threshold, skill priority, target/monster-level/loot-rarity filter, radius, return to hunting point, auto repair, inventory full stop, death stop, timer/rewards/AFK notification. Optional offline EXP/gold/resources/reward limit/claim. Auto controller uses same combat/movement/loot constraints as manual player; no client bypass. Define online vs offline policy, resource consumption, cap, stop conditions, disconnect handling and fairness. Offline calculation server timestamp, idempotent settlement, no double online/offline reward. Configurable auto play parity vs manual gameplay and test economy impact

# PART F — LIFE SKILLS AND CRAFTING

## 32 — Gathering and professions

Mining/fishing/logging/herbalism/foraging/hunting materials; resource nodes ore veins/fishing spots/trees/herbs, respawn/rarity, tools/durability, gathering level/EXP/success/rare drop/animation/regional resources/ranking. Validate range/tool/node availability, atomic depletion and respawn, anti-spam

Professions blacksmithing/weaponsmithing/armorsmithing/alchemy/cooking/tailoring/jewelcrafting/engineering/woodworking/enchanting/rune crafting. Level/EXP, recipe registry/unlock/blueprint, requirements/material/currency/time/queue, success/quality/result/option selection, bulk crafting, conversion/dismantling/salvage/history/ranking. Atomic input consumption/output creation; timed queue reservation and refund rules; prevent infinite profitable NPC conversion loops. Configure recipe yields, unlock, tool, workstation and economy balance

# PART G — ECONOMY AND COMMERCE BETWEEN PLAYERS

## 33 — Currency, wallet and ledger

Gold; premium/tradeable/locked/waiting/free Crystal; arena token; world boss coin; dungeon/guild/event token; card pack mark/card dust/stable seal/star dust. Balance, earn/spend/reserve/release/transfer/exchange/refund/history/expiry/restrictions/source/sink/fee/tax. Define account vs character wallet, world scope and non-tradeable restrictions. Use integer/BigInt minor units; serialize BigInt safely (string in JSON); no floating point currency. Double-entry ledger with system mint/burn accounts, balanced debit/credit per currency and transaction; available/reserved balances non-negative; transaction ID/reason/source/destination/timestamp/status/idempotency key. Reconcile ledger and wallet snapshots; all money movement atomic; no client trust

Example: buyer pays 100,000 Gold; seller receives 95,000; fee sink receives 5,000. Ledger entries sum to zero. Tax rounding explicit, not hidden. Track sources monster/quest/event and sinks refine/craft/tax/NPC

## 34 — NPC shops

General/weapon/armor/potion/material/pet/mount/arena/boss/guild/event/exchange/limited shops; rotating inventory, daily/weekly/account/character limits; buy/sell/bulk purchase/bulk sell/buyback. Server price and stock; validate binding, requirements, inventory capacity, currency and limits; atomic settlement; prevent shop resale arbitrage by default

## 35 — Central marketplace

Overview/search/category/rarity/level/class/stat/price filters and sorting; best sellers/recent/trending/price history/chart/wishlist/price alert; sell listing/order, buy order/buy shop, player stall, direct purchase/partial purchase/cancel/expiration, listing fee/tax/slot limit (default shared 12 slots for listing/buy/auction), my listings/purchases/sales/history/sales collection/account shared collection; item/currency escrow. Transaction isolation/row locks/versioning; listing item cannot be equipped, sold or moved simultaneously. Atomic ownership/currency transfer; price/qty validation; buyer full inventory policy; cancel vs buy race tests; no fake listings

## 36 — Auction

Listing, starting price, min increment, current bid/bidder/anonymous display, buy now, auto bid/max bid, reserve funds, outbid refund, countdown/extension/anti-sniping, settlement/winner/seller payout/tax/history/expiry/notification. Auction states explicit; server clock; funds reserved, not charged twice. Resolve simultaneous bid/buy-now/expiry deterministically. Idempotent settlement even when offline; private max bid not leaked. Refund and ownership audit

## 37 — Crystal exchange order book

World-scoped Gold↔eligible Crystal, order book, limit buy/sell, instant buy/sell, price-time priority, partial/full fill, cancellation, available/reserved/locked balance, settlement/fee/price history/trade history/candlestick/market depth/timeframes, currency eligibility/holding period. No cash withdrawal or real-money redemption. One sequenced matching authority per world/pair or transactional equivalent; match best price first, oldest first at equal price; resting order price; preserve reservations and release excess; deterministic ties, safe cancellation, minimum lot and integer tick size, self-trade prevention policy, maximum order size, fee rounding. Use DB transactions plus outbox; retry safe. Simulate example asks (150G×100, 152G×250, 155G×400, 158G×300, 160G×500): buy limit 152G for 300 fills 100 at 150 and 200 at 152, total 45,400G before fees. Test partial fill, cancel, concurrent match, locked Crystal eligibility

## 38 — Direct trading and economy balance

Trade request/accept/window, add/remove item/currency, lock/double confirm/reset on change/cancel/timeout/distance/binding/capacity/settlement/history. Any change resets both confirmations; validate both inventories/wallets and ownership in one transaction; release escrow on abort; no offline exploit

Economy analytics: faucets/sinks, daily currency created/destroyed/supply, item supply/demand, velocity, average/median prices, inflation index, wealth distribution/concentration, suspicious transactions/abnormal volume, NPC price control/configurable tax/dashboard. Set measurable economy targets; simulate gold/hour and progression cost, audit anomalous creation, adjust versioned balance. No infinite currency/reward loops or unauthorized minting

# PART H — SOCIAL AND COMMUNITY

## 39 — Chat and friend system

Local/world/private/party/guild/trade/system/help/event chat; emoji, item/character links, history/timestamp, filtering, spam prevention, mute/block/report/moderation/rate limit. Escape user content; no XSS; validate channel membership; restrict private chat appropriately; retention and privacy controls. Presence via Redis with TTL; persistent moderation actions. Friend request/accept/reject/remove/list, online/last online, location only with consent, notes/whisper/party invite/trade/farm visit/block/privacy. Block takes precedence over invitations and visibility; avoid leaking presence/location across privacy settings

## 40 — Party and guild

Party max 6: create/invite/request/accept/leave/kick/leader/transfer/role/member HUD HP/MP/position, shared EXP/loot/distribution rules, dungeon/teleport, finder/matchmaking/ready check/chat/buff/disband. Membership single party, membership snapshots at reward time, range/participation eligibility, leader disconnect handling, clear invitation TTL

Guild: creation/name/emblem/description/recruitment/application/invitation/membership/leader/officer/roles/permissions/member list/chat/level/EXP/donation/contribution/quest/skill/buff/storage/shop/hall/ranking/announcement/activity log/alliance/rivalry/war/territory/leadership transfer/disband. Configurable capacity; permissions least privilege; guild storage audit; prevent donation/reward exploits; guild war/territory optional with scheduled battles, scoring and balanced rewards

## 41 — Mail and marriage

Mail system/player/guild/admin, item/currency attachment, send/receive/claim/claim all/read/expiry/return/delete/notification, overflow reward/offline reward/purchase delivery. Attachments escrow; idempotent claim; no deletion of unclaimed value without explicit expiry policy; mail fees and anti-spam; capacity and binding checks

Marriage: mutual relationship request/proposal/engagement/requirements/reservation/venue/plaza/ceremony/invitations/outfit/ring/title/couple buff/emote/quest/partner teleport/anniversary/divorce/privacy. Mutual consent and withdrawal; no forced relationship; teleport respects map rules; breakup removes applicable perks; clear refund rules

# PART I — TRADING CARD GAME (SEPARATE FROM MONSTER CARD)

## 42 — Card collection and decks

Original TCG with 85+ cards and 7 starter decks target. Card types creature/spell/trap/equipment/field/hero; definition ID/name/art/type/element/rarity/cost/ATK/DEF/HP/ability/keyword/description/set/tradeable/craft cost. Collection/album/set/discovery/search/filter/optional upgrade/duplicate/binding/trade/dismantle/dust/craft/completion reward. Deck create/rename/delete/duplicate/import/export/size validation/copy limit/restrictions/element rules/starter/preset/preview/stats/auto suggestion. Validate ownership and legal deck before match; lock snapshot of deck and rule version for active match. Design original card rules and artwork; no copying another TCG

## 43 — TCG battle engine and modes

Authoritative turn-based state machine: match start, shuffle/draw/starting hand/mulligan, turn order/resource or mana, card play, summon/attack, spell resolution/trap trigger, target selection, effect queue/trigger/continuous effect/status, graveyard/discard/return/destroy/transform, turn timer/end turn, win/lose/draw/surrender/disconnect/reconnect, replay/battle log. Define deterministic rule ordering, priority, action validation, event budget to avoid loops, server RNG, hidden hand/deck information redaction for opponent and spectators. Persist replay events and seed securely; no opponent hidden-state leakage. Test illegal action, timer expiry, simultaneous effects, disconnect, duplicate action and replay consistency

Modes tutorial, AI duel, PvE duel tower (10 floors default), casual/friendly/ranked, tournament/practice/spectator, matchmaking/history/rank stars/rating/season reset/reward/leaderboard. Bronze, Silver, Gold, Platinum, Diamond, Legend; default 10 steps for non-Legend ranks configurable. AI uses legal visible information. Server calculates rating and reward once; prevent collusion/win trading

## 44 — Card packs and cosmetics

Card packs/opening/rarity/pool/pack marks/guarantee/pity/exchange/shop, card backs/playmats/battle table skins/animated or classic table/card reveal. Transparent odds and guarantee conditions, server RNG, atomic consumption and grant, duplicate conversion, history; cosmetics separate from battle balance. Paid pack rules disabled until compliance and explicit approval

# PART J — MONETIZATION, LIVE OPERATIONS AND RETENTION

## 45 — Premium shop and payments

Premium shop/currency/top-up/payment order/verification/webhook/history/delivery, first and other top-up bonus, limited/starter packages, cosmetic/convenience/seasonal shop, gifts, purchase limits/confirmation/refund/chargeback/recovery. Sandbox payment provider initially; no stored card data; server verifies signature, provider event ID, order, amount, currency, account and final status; idempotent fulfillment and reconciliation. Never trust client payment confirmation. Handle out-of-order webhook and partial refund; log sensitive operations, redact secrets; purchase entitlements recoverable according to policy. Disable live payments until authorization, legal/platform review and security audit

## 46 — Gacha and probability rules

Standard/seasonal/fashion/pet/mount/card banners; tickets/single/multi draw, weighted pools, guaranteed rarity/pity, duplicate conversion, banner expiry, history/preview/delivery/animation skip/server RNG, spending limits and purchase protection. Display exact odds, pity rules, costs and limitations before confirmation; probability table validation, published version, guarantee interaction and refund policy. Cryptographically appropriate randomness for paid rewards, no client influence; atomic currency spend + draw + grant + pity update; retry returns same recorded result. Do not manipulate outcomes based on spend or vulnerability. Real-money random rewards off by default; age restrictions and relevant legal/platform requirements must be reviewed

## 47 — Pass and membership

Daily/weekly/monthly pass, adventure pass free/premium, festival pass, permanent membership/grand membership, free/premium reward tracks, pass EXP/level/mission/reward/purchase/upgrade/duration/expiry/entitlement/daily claim/unclaimed reward mail. Configurable benefits (EXP/drop/tax/convenience only if balance review approves); avoid extreme competitive advantage. Define stacking/expiry/renewal/catch-up and upgrade behavior; no duplicate claims or hidden auto-renewal

## 48 — Event framework and recurring rewards

Daily/weekly/monthly/seasonal/festival/login/EXP/gold/drop boost/boss/dungeon/PvP/gather/craft/collection/community goal events. Calendar, start/end/countdown/requirements/mission/currency/rewards/shop/announcements/rank/archive/scheduler. Content editor creates scheduled events without deployment; timezone explicit; config version attached to active event; stop/rollback without corrupting progress

Daily login, consecutive days, login calendar, daily/weekly/monthly missions, activity points/chests, reset/catch-up/milestone/unclaimed rewards/claim history. Use server reset boundaries and durable claims; define missed days, timezone change, daylight saving and outages; unclaimed mail exactly once

## 49 — Achievements, titles, ranking

Achievement registry/progress/points/rewards/notification; combat/monster kills/level/quest/explore/collection/craft/gather/social/PvP/dungeon/boss/pet/TCG/hidden. Event-driven counters with deduplication and versioning; distinguish one-time from repeatable; migration/backfill policy

Rankings level/combat power/class/stat/pet/mount/guild/achievement/life skill/wealth optional/donor optional (privacy and fairness review)/PvP/arena/boss/dungeon/extended mastery/card duel/creator/seasonal; snapshots/reset/rewards/history/anti-exploit. Redis sorted sets as derived cache, PostgreSQL durable snapshots; stable ties; private profiles opt-out where suitable. Title collection/unlock/equip/display/bonus/permanent/temporary/weekly/seasonal/MVP/milestone; expire correctly and recalculate stats

## 50 — Creator and community program

Creator application/verification/profile/code/referral/video submission/content review/view milestone/referral tracking/rewards/dashboard/ranking/fraud detection/approval/Discord and social links. YouTube submissions checked through permitted APIs or manual review; no fabricated views; no exposure of private player data; self-referral/duplicate reward protection; disclosure of sponsorship where required

# PART K — GAME CLIENT, ART, UX AND LOCALIZATION

## 51 — Game interface and screens

Fantasy pixel art UI with consistent typography, spacing, readable controls, keyboard and touch support. Main HUD: portrait/name/level, HP/MP/EXP, class gauge, buffs/debuffs, skill and consumable hotbars, target frame/monster HP, party HUD, minimap/world map, quest tracker/chat/currencies/notifications/event countdown/server time/ping/FPS

All windows: login/register/world selection/character creation/selection, character profile/stats/equipment/inventory/storage/skills/quests/story journal, pet/mount/farm/housing, monster card/TCG/deck builder, gathering/crafting/refine/gem/skill stone/enchant, NPC shops/market/auction/exchange/trade, party/guild/friend/mail/marriage, dungeon/raid/world boss/arena/matchmaking, ranking/achievement/title/event calendar, premium shop/gacha/pass, settings/help/wiki/creator/more menu. UI interactions must connect to real authenticated server workflows; contextual NPC menus; confirm irreversible actions; tooltip shows binding/price/odds/effects; clear error messages; no client-only currency or inventory state treated as durable truth

Components modal/tooltip/dropdown/context menu/tabs/progress bar/scroll list/search/filter/item grid/confirm dialog/toast/loading/error/empty/pagination/virtualized list/drag-drop. Responsive panels, keyboard navigation, focus trapping, touch targets, predictable close behavior. Prevent duplicate submissions and show pending server confirmation; reconnect state refresh. All menus accessible from appropriate progression stage; locked reasons visible

## 52 — Mobile, accessibility and performance settings

Responsive layout, mobile virtual joystick/touch skill buttons/targeting, camera zoom, landscape/fullscreen, UI/font scaling, colorblind/high contrast/reduced motion/key remap, screen reader support for menus, sound/animation toggle, low performance/memory saver, particle/sprite limits, asset quality. No essential gameplay information conveyed solely by color or sound. Support safe areas, mobile input and window resize. Test multiple resolutions/devices and Thai font rendering

## 53 — Art and asset pipeline

Original cozy fantasy pixel art, coherent palette, warm lighting, 8-direction sprites, readable class silhouettes and combat telegraphs. Choose consistent tile size, sprite anchor, collision footprint, scale and render order; document art spec. Character/monster/NPC/pet/mount sprite sheets; equipment overlays; idle/walk/run/attack/cast/hit/death animations; tilesets/terrain/props/item & skill icons/UI frames/particles/projectiles/spell VFX/damage numbers/weather/lights. Texture atlases, asset manifest/versioning, lazy/preload/cache, pooling, CDN, compressed assets and error fallback. Define naming conventions and licenses. Use clearly labeled original placeholder assets during development; production requires approved/licensed final assets, no copying from reference game. Build content editor and import/export validation

## 54 — Audio and radio

Town/field/dungeon/boss BGM, battle/skill/UI/ambient/footstep SFX, master/music/SFX/ambient volumes/mute/fades/transitions. Radio with content registry, playlist/track/shuffle/repeat/favorites/language/mood/instrumental filter, optional licensed lyrics display. Streaming/file loading with error handling and browser autoplay consent; licensed/original audio only; moderation for submitted content

## 55 — Localization and help

Thai/English switching, translation keys/namespaces/fallback, number/currency/date/timezone/Unicode/Thai fonts, NPC/quest/item/skill/UI/system translations, missing-key detection, no player-facing hardcoded text in domain logic. Wiki/help/tutorial/stat guide accessible in game, versioned content from registry; explain skill/element/refine/market rules and player support. Test truncation, line breaks, long names and fallback

# PART L — BACKEND RECONSTRUCTION (DESIGNED FROM FIRST PRINCIPLES)

## 56 — Database architecture and entities

Create ERD and migrations. PostgreSQL is source of truth for durable ownership, progression, payments, transactions. Use PK/FK, unique/index/check constraints, world scope, timestamps UTC, config versions and explicit ownership. Database model groups (names may change with ADR but functionality must remain):

```text
Account: accounts, account_sessions, account_roles, account_entitlements, account_settings, account_devices, account_bans
World: worlds, channels, world_settings, world_status, server_announcements, map_instances
Character: characters, character_appearance, character_stats, character_progression, character_classes, character_skills, character_titles, character_settings, character_locations
Content: class_definitions, skill_definitions, stat_definitions, item_definitions, monster_definitions, map_definitions, npc_definitions, quest_definitions, pet_definitions, mount_definitions, card_definitions, recipe_definitions, dungeon_definitions, boss_definitions, loot_tables, content_versions
Items: item_instances, item_options, item_refinements, item_sockets, inventory_slots, equipment_slots, storage_slots, item_transactions, item_locks
Economy: currencies, wallets, currency_ledger, currency_reservations, market_listings, market_orders, market_transactions, market_price_history, auctions, auction_bids, exchange_orders, exchange_trades, trade_sessions, trade_history
Progression: quest_progress, quest_history, achievements, achievement_progress, reward_claims, daily_progress, weekly_progress, login_rewards
Pets/mounts: pets, pet_skills, pet_runes, pet_farms, farm_feeders, farm_decorations, mounts, mount_stables, houses, house_decorations
Social: friends, friend_requests, blocked_players, parties, party_members, guilds, guild_members, guild_roles, guild_permissions, guild_storage, guild_logs, marriages, messages, mail, mail_attachments
PvE/PvP: dungeon_runs, dungeon_participants, dungeon_rewards, raid_runs, boss_sessions, boss_contributions, arena_matches, arena_participants, pvp_ratings, pvp_seasons
Life skills: professions, character_professions, crafting_jobs, gathering_progress
TCG: tcg_collections, tcg_card_instances, tcg_decks, tcg_deck_cards, tcg_matches, tcg_match_events, tcg_ratings, tcg_packs, tcg_pack_history
Commerce: shop_products, payment_orders, payment_events, purchases, purchase_entitlements, gacha_banners, gacha_pools, gacha_history, gacha_pity, passes, pass_progress, pass_rewards
LiveOps: events, event_missions, event_progress, event_rewards, rankings, ranking_snapshots, creator_profiles, creator_referrals, creator_rewards, feature_flags, game_configurations, configuration_versions
Ops: admin_users, admin_roles, admin_audit_logs, game_logs, security_events, player_reports, moderation_actions, scheduled_jobs, idempotency_keys, outbox_events
```

Define account 1:N characters, character 1:N skills/pets/inventory slots, item definition 1:N instances, wallet 1:N ledger entries, transaction 1:N balanced ledger entries, guild 1:N members, dungeon run 1:N participants, TCG deck 1:N deck cards. Enforce exactly one item ownership location; unique claim keys by player/reward/reset period; unique payment event and fulfillment; market reservations and order version; prevent duplicate active character session. Add indices for world+character, owner+slot, world+item+price, order pair/side/price/time, jobs due, rank season. Use migrations and reversible deployment plan. Never store passwords/secrets in plain text

## 57 — Network protocol and API

WebSocket authentication, session validation, join/leave world/room/map/dungeon/arena/party, state snapshot/delta, entity spawn/despawn/movement, combat/interaction/chat, heartbeat/ping/pong/latency, reconnect/resume/snapshot recovery, command sequence/deduplication/schema validation/rate & size limits/compression/metrics. Separate high-frequency updates from durable reliable events; per-recipient hidden data filtering; no cross-room data leaks

Client command examples: AUTHENTICATE, JOIN_WORLD, MOVE, STOP_MOVE, SELECT_TARGET, ATTACK, CAST_SKILL, USE_ITEM, INTERACT_NPC, PICKUP_LOOT, EQUIP_ITEM, SEND_CHAT, INVITE_PARTY, JOIN_DUNGEON. Expand typed commands for every module. Server events: AUTH_RESULT, WORLD_SNAPSHOT, ENTITY_SPAWN, ENTITY_DESPAWN, ENTITY_MOVEMENT, COMBAT_RESULT, SKILL_RESULT, STATUS_EFFECT_UPDATE, HP_UPDATE, MP_UPDATE, EXP_UPDATE, LEVEL_UP, INVENTORY_UPDATE, CURRENCY_UPDATE, QUEST_UPDATE, PARTY_UPDATE, SYSTEM_NOTIFICATION. Each envelope protocolVersion, requestId, sequence (where applicable), type, payload; authenticated actor derived from session, not payload. ACK/error with stable error code; dedup durable requests; reconnect snapshot and replay only permitted events

REST versioned endpoints for auth, worlds, character CRUD/profile, content catalog, inventory/storage, quests, shops, market/orders/auction/exchange/trade, pets/farm, social, mail, dungeon/boss/PvP, TCG, rewards, payments, events, rankings, reports and admin. Define OpenAPI contracts, validation, authentication, pagination, error format, idempotency key, permission/world scope, rate limit. Do not blindly expose internal tables. Use a single authoritative service for each mutation, whether invoked by REST or WebSocket

## 58 — Game server modules and dependency graph

Services: Authentication, Session, World, Character, Entity, Movement, Collision, Combat, Skill, StatusEffect, MonsterAI, NPC, Spawn, Loot, Quest, Inventory, Equipment, Refinement, Gem, SkillStone, MonsterCard, Pet, Mount, Farm, Gathering, Crafting, Economy, Wallet, Marketplace, Auction, Exchange, Trade, Party, Guild, Friend, Chat, Mail, Dungeon, Raid, Boss, Arena, TCG, Ranking, Reward, Event, Payment, Gacha, Pass, Achievement, Notification, Moderation, Admin, Audit. Add house, marriage, creator, localization, content config and worker services. Interfaces explicit; transport independent; domain events crossing module boundaries; no cyclic dependencies

Dependency order: auth→world/character→entity/movement→stats/effects/skills/combat→monster/loot/EXP→inventory/equipment/quest→enhancement→social/instance/pet/craft→economy/market→competitive/TCG→commerce/liveops. Wallet and transaction primitives must exist before any economic reward, not delayed until marketplace phase. Content registry and authorization precede all modules. Observability/security/tests begin at foundation and continue every phase

## 59 — Server tick, scalability and persistence

Default fixed simulation 20 Hz (50 ms tick); client render target 60 FPS; movement updates 10–20 Hz; monster AI 5–10 Hz or budgeted; effects scheduled per tick/event; position persistence every 30–60 s plus safe transfer/logout; inventory/currency critical writes before ACK; ranking refresh 1–5 min. Values tunable from measured results

Tick: receive commands → validate/session/sequence → movement/collision → AI → combat/skills → status effects → death/rewards → synchronize visible entities → queue noncritical persistence. Do not block tick on slow DB calls; durable transaction results applied in controlled sequence, only acknowledge once committed. Fixed timestep and bounded catch-up; monotonic server clock for simulation, UTC wall time for persistence; protect against tick overruns

Entity lifecycle, spatial hash/partition, area of interest, visibility/interest management, object/projectile pools, collision efficiency, batched deltas, AI/spawn budgets, room capacity, instance isolation, inactive room and connection cleanup, memory/CPU/event-loop monitoring. Broadcast only nearby relevant entities. Scale rooms by world/channel/map and dungeon/arena instances. Avoid concurrent writers to same character: ownership lease/fencing or equivalent. World transfer and reconnect consistent. Load balancer WebSocket affinity/routing as needed

Persistence: periodic/logout/critical saves; inventory/progression durable, session/crash recovery, optimistic/pessimistic locks as necessary, atomic transactions, idempotent retries, outbox, dead-letter queue, dedup, data integrity checks, migrations/seed/backup/PITR. Redis temporary only for currency/items; no uncommitted durable values on client. Handle process crash between commit and event publish; outbox replay; graceful shutdown; restore drill

## 60 — Scheduled jobs, offline settlement and time

BullMQ workers: daily/weekly/monthly reset, event activate/deactivate, boss schedule, auction expiry/settlement, order expiry, mail expiry, pass expiry, reward delivery, ranking snapshot/season reset, farm/offline reward calculation, payment reconciliation/retry, cleanup/log archive/backups. UTC in DB, user timezone display, configurable reset timezone. Job key includes scope/period; distributed lock with safe ownership/fencing where needed; retries/backoff/dead-letter queue; idempotency enforced by DB unique keys, not just lock. Recover missed scheduled jobs after downtime. Offline progress from server timestamps, cap, settle once; no double claims

# PART M — SECURITY, ADMIN, MODERATION

## 61 — Security model

Server-authoritative command validation: speed/position/teleport/collision/range/cooldown/resource/item ownership/currency/HP/damage/reward eligibility. Packet schema, session ownership, permission, sequence, replay protection, rate/size limits, brute force protection, input sanitization, SQL injection/XSS/CSRF controls, secure cookies, HTTPS/WSS, secret management, session revocation, access control. Prevent item/currency duplication, negative balance, multi-claim, unauthorized grant, race conditions, bot/fraud/payment abuse. Detect suspicious movement/trade/automation with explainable signals; manual review/appeal; do not ban solely on unreliable one-off signal. Distinguish official auto-play from unauthorized automation. Threat model and security tests for all critical flows; redact tokens/passwords/PII; backup encryption and least privilege. Never expose private backend to game client

## 62 — Admin dashboard and GM tools

Separate admin UI and protected API. Overview online/active worlds/rooms/server health/CPU/RAM/DB/Redis/latency/error/sessions/DAU/MAU/retention/new accounts/revenue/currency supply/market. Player management search/account/character/inventory/equipment/ledger/trade/login/report, kick/mute/suspend/ban/unban/reset stuck/teleport/recover/compensation. Content editors class/skill/monster/item/NPC/quest/pet/mount/card/recipe/dungeon/boss/shop/gacha/pass/event/drop tables/element matrix/EXP curve/stat formula/localization/map references. Economy monitor supply/transactions/market/auction/exchange/suspicious trade/item grant/currency adjustment/compensation/tax settings. LiveOps announcement/maintenance/event schedule/feature flags/server config/content preview/publish/version/rollback

Admin MFA, RBAC/least privilege, separate session, audit log actor/reason/before-after/time/request, sensitive action confirmation, approval workflow for large grants and changes, no direct uncontrolled SQL mutation, immutable audit retention and export. Config publishing validates references and probability tables; staged rollout/rollback, record version per transaction; approval before production changes

## 63 — Moderation and player safety

Report player/chat/cheat/scam/harassment/bug, evidence, queue/assignment/status, warning/mute/suspension/ban, appeal/review/history, safety settings/chat privacy/block. Limit access to evidence; privacy-aware retention; separate moderator roles; prohibit unauthorized monitoring of private messages. Account deletion/export requests, consent handling, age-appropriate controls and support contact. Provide clear player-facing reasons and appeal workflow

# PART N — OBSERVABILITY, ANALYTICS, INFRASTRUCTURE

## 64 — Analytics and logs

Events account create/login/logout/session duration/character create/class selected/level up/quest accept-complete/monster kill/dungeon enter-complete/boss participation/PvP match/item drop-craft-refine-trade/currency earn-spend/pet acquired/gacha draw/purchase/event participation/tutorial completion/errors. Reports D1/D7/D30 retention, DAU/WAU/MAU, session length, progression funnel/class popularity/skill usage/kill distribution/dungeon and quest completion/economy inflation/PvP win rate/churn signals/revenue. Define event schema, event ID, version, UTC timestamp, consent, dedup, aggregation, retention and anonymization; collect minimum necessary data

Structured logs with request/correlation/session ID, errors, selective combat audit, economy/payment/admin/security audit, network/tick/DB/worker queue metrics, health/readiness checks, alert thresholds/error tracking/log retention/redaction. Monitoring dashboards and runbooks. No secrets or raw payment data in logs. Define SLOs based on measured performance; alert on ledger mismatch, duplicate rewards, tick overruns, DB failures and queue lag

## 65 — Deployment and operations

Docker Compose local stack PostgreSQL/Redis/game/API/worker/client/admin/Nginx, env templates, TLS, health checks, CI build/lint/typecheck/tests, migration pipeline, staging and production deployment, object storage/CDN, rolling deployment when compatible, graceful shutdown, backup/PITR/recovery/rollback, horizontal scaling/load balancing/monitoring. Pin dependencies, scan vulnerabilities, secure network policies, secret injection, least privilege service accounts, separate environment databases. Provide reproducible commands in README; no production deploy or real payment activation without explicit authorization. Restore backup in test environment and verify data integrity. Plan compatible protocol/database migrations and maintenance notice

# PART O — CONTENT CONFIGURATION AND GAME BALANCE

## 66 — Versioned content and formulas

Registry for EXP curve/level cap/stat growth/formula/cap/combat formula/element matrix/skill cooldown/cost/monster stats/spawns/drops/item rarity/equipment/refine/gem/stone/pet growth/mount speed/dungeon difficulty/boss scaling/PvP modifier/currency reward/sink/tax/fee/shop prices/gacha rates/pass rewards/event schedule/reset/flags. Validate IDs/types/ranges/references/duplicate keys/probability totals/recursive dependencies/quest and recipe loops. Preview, publish, version, audit, rollback. Use stable IDs and migrations; no arbitrary code execution from content. Content version attached to durable outcomes and replay. Balance simulation CLI and editor

## 67 — Balance and design requirements

All classes viable in their role; no class best everywhere. Reward tank/heal/support. Multiple progression routes; avoid forced paid advantage. Item faucets and sinks, measurable Gold inflation, prevent infinite currency/reward/recipe loops, clear costs/odds/risks, new-player catch-up, separate PvE/PvP tuning, control power creep, auto-play does not erase manual play value. Every mechanic defines requirement/cost/reward/limit/cooldown/expiry/failure/recovery. Design progression by expected time-to-level, time-to-kill, survivability, potion consumption, gold/hour, acquisition cost, refine expected value, dungeon difficulty and team contribution. Simulate before production; publish balance notes. Use temporary values until playtests confirm; do not claim the sample formulas are balanced

# PART P — TESTS AND ACCEPTANCE

## 68 — Testing strategy

Unit: stat pipeline, damage/heal/crit/hit/element 81 pairs, skill validation, status stacking/expiry, EXP curve/multiple level-up, item stack/equip/refine/gem/stone, pet growth/offline, loot tables, ledger, order matching, auction settlement, gacha probability/pity, TCG effect resolution. Property/invariant tests: nonnegative wallets, balanced ledger, single ownership, bounded HP, exactly-once claims, deterministic replay, config validation

Integration: login/create character/world entry/movement/kill/EXP/drop/equip/upgrade/quest/party/dungeon/rewards/trade/market/auction/exchange/mail/payment webhook/event claim/reset/reconnect. Concurrent tests: two purchases same item, duplicate claim, simultaneous currency trades, cancel vs match, auction bids, inventory move, payment webhook duplicate/out-of-order, worker retries, crash after commit, multiple sessions. End-to-end Playwright: two distinct users join map, see movement, fight, trade, reconnect and verify persisted state; mobile and Thai UI; no dead buttons. Security tests unauthorized actions, malformed packets, replay, speed/teleport, forged damage/reward, negative quantity, cross-world trade, permission bypass, hidden TCG data, admin abuse

Load tests 20,50,100,250,500,1,000 simulated clients; higher only after prior goals; realistic movement/combat/chat/market workload, long-running soak, disconnect/reconnect burst. Record hardware, workload, CPU/RAM, tick duration p50/p95/p99, packet bandwidth, DB latency, queue lag, error rate, throughput and consistency violations. Prototype performance target p95 tick work below 50 ms at configured target; define measured latency and error budget; tune before next capacity tier. Never invent test results. If environment cannot run test, record NOT_RUN/BLOCKED

## 69 — Release acceptance gates

Each module must meet Definition of Done in §04. Phase gate requires playable workflow, persisted state, validation and regression tests. Release gate: all required system IDs COMPLETE with proof; optional systems either complete and enabled or explicitly deferred/disabled with approval; no critical/high unresolved security or integrity issue; approved final assets and localization; load and soak tests at selected launch capacity; restore drill; monitoring and operational runbooks; moderation/support; legal/privacy/payment review; staging signoff; explicit authorization for production. If any gate fails, do not claim production-ready. Deliver audit of missing/partial/mock/broken/blocked systems and repair plan. Record known limitations and decisions

# PART Q — IMPLEMENTATION ROADMAP: START TO FINISH

## 70 — Required documentation and persistent project memory

Create these files as working documents before broad implementation. Consolidate duplicate sections if desired but preserve each named deliverable through a mapping in MASTER_PLAN.md. Store this entire prompt unchanged at repository root as MASTER_PROMPT.md.

```text
docs/
  MASTER_PLAN.md
  GAME_DESIGN_DOCUMENT.md
  TECHNICAL_DESIGN_DOCUMENT.md
  ASSUMPTIONS.md
  SYSTEM_REGISTRY.md
  SYSTEM_DEPENDENCIES.md
  SERVER_ARCHITECTURE.md
  GAME_LOOP.md
  ENTITY_MODEL.md
  COMBAT_ENGINE.md
  COMBAT_FORMULAS.md
  FORMULA_REGISTRY.md
  MONSTER_AI.md
  DATABASE_SCHEMA.md
  ER_DIAGRAM.md
  TRANSACTION_RULES.md
  API_SPECIFICATION.md
  NETWORK_PROTOCOL.md
  ECONOMY_DESIGN.md
  ECONOMY_ENGINE.md
  ORDER_MATCHING_ENGINE.md
  GAME_BALANCE.md
  UI_UX_SPECIFICATION.md
  CONTENT_PIPELINE.md
  CONTENT_CONFIGURATION.md
  ART_GUIDELINES.md
  SECURITY_MODEL.md
  OFFLINE_PROCESSING.md
  TEST_PLAN.md
  LOAD_TEST_REPORT.md
  DEPLOYMENT_GUIDE.md
  ADMIN_GUIDE.md
  DECISIONS.md
  CHANGELOG.md
  PROGRESS.md
  SYSTEM_AUDIT.md
  RELEASE_CHECKLIST.md
```

ASSUMPTIONS.md explicitly marks all invented formulas/architecture/balance values; distinguish reference observations from assumptions and design decisions. FORMULA_REGISTRY records units, order, clamps, rounding, version, tests. SYSTEM_REGISTRY includes every requirement in this file, including the legacy checklist below, mapped to stable IDs. For every ID record description/dependencies/models/API/protocol/screens/services/config/security/test/acceptance/status/evidence and links to code. No requirement disappears merely because it is merged into another module. Use machine-readable registry (JSON/YAML) and generated Markdown if practical; check coverage in CI. DECISIONS includes ADR, alternatives, trade-offs, date. PROGRESS is durable session handoff with completed/partial/blocked work, last commands/results, next dependency-ready work. Never put secrets in docs

## 71 — Initial playable content and expansion

Initial playable seed, built progressively as dependencies become available: 3 representative classes (Tank/DPS/Healer), 18 skills each (start with at least one real skill in combat vertical slice), 1 town, 3 hunting maps, 1 dungeon, 1 world boss, 20 monsters, 10 NPCs, 20 quests, 100 items, 30 equipment items, 10 pets, 3 mounts, 20 monster cards, 10 recipes, 1 daily event, marketplace, 1 PvP mode and 1 TCG starter deck. Early phase does not require content whose engine has not been implemented. Content must be playable and validated, not empty rows. Expand to all §01 targets after each engine passes its tests. Report engine completeness separately from content completeness. Content generation must create distinctive abilities, loot, recipes, quests and maps, with localization, original licensed assets, balance constraints and validation

## 72 — Phase 0: Repository and foundation (START HERE)

1. Inspect current repository, git status, available tools/runtime, dependency versions, existing docs and user constraints. Preserve existing working files. If empty, initialize monorepo, Git, packages, dev scripts, env template, lockfile, .gitignore, Docker Compose and README. If existing, document architecture and adapt without destructive reinitialization.
2. Create MASTER_PLAN, SYSTEM_REGISTRY with full coverage, ASSUMPTIONS, dependency graph, initial GDD/TDD/ERD, protocol/API contracts and ADRs.
3. Establish strict TypeScript, lint/format, tests, CI, local database/Redis, migration/seed, content registry, shared schemas, logging and health checks. Implement transaction/idempotency primitives and baseline authorization/security.
4. Scaffold game-client, game-server, API, worker and admin dashboard. Use environment variables; no hardcoded secrets. Start local services, verify health, migrate/seed DB, run build/tests. Gate: reproducible local startup and passing baseline tests. Stop and log blockers if prerequisites unavailable.

## 73 — Phase 1: Playable multiplayer world

Implement auth, account/character create/select, world/channel selection, map renderer/camera, collision/pathfinding, movement protocol, simulation, AOI, interpolation/reconciliation, session reconnect, nearby entities, NPC interaction, chat and HUD. Seed one town/test map and original placeholder sprites. Gate: two real authenticated client sessions can enter the same world, see each other, walk with collision, chat, disconnect/reconnect, and persist location. Verify unauthorized movement and cross-room messages rejected.

## 74 — Phase 2: Core combat and reward vertical slice

Implement stats, skill/effect registry, element matrix, combat pipeline, monster AI/spawn/respawn, HP/MP/death/revival, loot, wallet ledger, minimal inventory, EXP/level, reward idempotency, combat UI. Start with three class roles and minimal actual skills; expand to initial seed. Gate: players can kill monster, obtain item/Gold/EXP, level up, equip/use reward when supported, reconnect and retain progression. Tests for duplicate kill/reward, forged damage, cooldown, simultaneous death and full inventory. Core manual and auto controllers share rules.

## 75 — Phase 3: Character progression and items

Finish inventory/storage/equipment/consumables/NPC shop/quests/story, refine/options/gems/skill stones/monster cards, ascension/extended progression, class skill trees/loadouts, item sources/sinks. Gate: complete quest → receive gear → equip → refine/socket/card → updated server stats → stronger combat. All inventory mutations atomic, upgrade risks displayed, persistence verified.

## 76 — Phase 4: Social and life skills

Friends/party/guild/chat channels/mail/direct trade, gathering/mining/fishing and other resource nodes, professions/crafting/recipes. Gate: two players party, share eligible rewards, gather/craft, trade and mail, with permissions and no duplicate item/currency. Add social moderation and role permissions.

## 77 — Phase 5: Adventure content

Dungeons/daily dungeons/raid feature, world boss, auto-play, offline settlement, achievements/titles/rankings. Gate: party enters instance, completes boss/wave, receives reward once; world boss contributions fair across roles; automatic activity stops correctly; reset/reconnect safe.

## 78 — Phase 6: Pets, mounts and personal space

Pet collection/eggs/growth/skills/runes/stars/evolution, pet farm/feeders/decoration/offline EXP, mount/stable, housing optional, marriage. Gate: acquire pet → summon and battle → assign farm → settle offline progress once; mount speed validated; visit permissions and personal instance persistence.

## 79 — Phase 7: Full economy

Central market/sell/buy order/player stall, auction, Gold-Crystal exchange, escrow, price history/chart, analytics and admin audit. Gate: real users list/buy/bid/match/cancel; ownership transfers once, balanced ledger, no overspend/negative wallet/duplicate items under concurrency. Run economy simulation and review.

## 80 — Phase 8: Competitive modes

Duel, PvP modes, arena queue/matchmaking/scoring/season/rating, guild war/territory optional. Gate: two or more players complete ranked match, server validates score, reward/rating once; reconnect/disconnect handling, PvP balance and anti-collusion checks.

## 81 — Phase 9: TCG

Card collection/deck builder, battle rules engine, AI/PvE tower/friendly/casual/ranked, packs/crafting/season/cosmetics. Gate: legal decks play complete match; hidden information protected; replay and rewards consistent; pack probabilities/claims validated.

## 82 — Phase 10: Commerce and LiveOps

Premium shop/payment sandbox, gacha/pass/login rewards/event calendar/season, creator/referrals/radio, full admin content editor and feature flags. Gate: sandbox payment verified/idempotent, pass/event rewards correctly reset, admin edit/publish/rollback audited, paid features still disabled until approved. Complete all cross-module screens, localization and player support.

## 83 — Phase 11: Content expansion, production readiness and release (END HERE)

Expand seed to agreed content targets, complete original production assets and full Thai/English localization. Verify every system ID and legacy checklist entry. Run system audit, balance simulations, regression/unit/integration/E2E/security/concurrency/load/soak tests; fix critical/high issues and repeat. Optimize client/server/DB, mobile support, monitoring, backup/restore and migration/rollback. Prepare staging build, moderator/admin runbooks, support/privacy/legal/payment compliance review, launch capacity and incident response. Perform staging acceptance with user; record unresolved issues and decisions. Production deployment only with explicit permission. After authorized deployment, smoke-test, monitor and record release; otherwise deliver a staging-ready package and report deployment NOT_RUN. Final gate: all required features complete and verified, optional deferrals explicitly approved, no fabricated evidence. If blockers remain, do not claim completion; provide exact next action.

# PART R — AGENT EXECUTION PROTOCOL (FIRST SESSION AND EVERY RESUME)

## 84 — Mandatory operating rules

- Inspect repository and Git state before modifying; read this prompt, master plan, registry, dependencies, decisions, progress, changelog and relevant docs. Never recreate or overwrite a working project indiscriminately.
- Do not change stack, remove features or reduce scope without documented reason and user approval for material changes. Keep backward-compatible behavior and migrations where practical. No destructive migration without backup/approval.
- Implement vertical slices end-to-end; don't attempt 500 unrelated modules at once. Preserve every unimplemented requirement in registry. Prefer runnable code over endless planning. Use actual tools to write files/run tests when permitted.
- No hidden mock data, dead buttons, fake API, hardcoded game content, client-authoritative rewards, exposed secrets, unauthenticated protected API, bypassed validation or fabricated build/test results. Placeholders explicitly labeled and not COMPLETE.
- Keep docs, ADRs, registry, progress and changelog up to date. Run typecheck/lint/build and relevant tests after changes; fix regressions; record exact commands/results. Don't claim to have tested what was not run.
- Never deploy production, enable real payments, grant valuable live currency, delete live data, or copy proprietary game assets without explicit authorization. Use sandbox/test accounts and local DB.
- If budget/context ends, finish at safe checkpoint when possible; save progress, current phase, exact next task/dependencies, test status and blockers. Do not pretend background work continues. Resume from persisted state, not a fresh project.
- If execution environment cannot write/run, provide implementable patch/source and exact setup commands; mark results unverified. Do not invent filesystem contents.

## 85 — Workflow for each task

Inspect existing code → select registry IDs with satisfied dependencies → define vertical-slice plan and acceptance → data model/migration → domain/server logic → API/protocol → client state/UI → validation/permission/security → tests → run tests/build/lint/typecheck → fix errors → update docs/registry/progress/changelog → report evidence and next task. For cross-cutting changes run regression and concurrency tests as needed. Every task report: systems worked on, dependencies, files created/changed, migrations, endpoints/messages/screens, tests added and actual results, build status, security considerations, known issues/blockers, remaining tasks, next task. Use status not marketing claims.

## 86 — Resume instruction (embedded, no other prompt required)

If this is a subsequent session: read MASTER_PROMPT.md, MASTER_PLAN.md, SYSTEM_REGISTRY.md, SYSTEM_DEPENDENCIES.md, TECHNICAL_DESIGN_DOCUMENT.md, DATABASE_SCHEMA.md, DECISIONS.md, PROGRESS.md and CHANGELOG.md. Inspect git status and current code. Resume earliest dependency-ready IN_PROGRESS or NOT_STARTED item; resolve BLOCKED prerequisites where possible. Do not recreate project. Implement all applicable layers, run tests and regression, update registry/progress/changelog. If prior report disagrees with code, verify code and correct report. Continue until the current execution budget or a genuine blocker, then leave safe checkpoint.

## 87 — Full system audit instruction (embedded)

Act as independent Senior Game Architect and QA Lead. Compare code against every requirement in this master and registry; for each classify COMPLETE/PARTIAL/MOCK_ONLY/BROKEN/MISSING/BLOCKED with evidence. Check model/migration/server/API/protocol/client/UI/validation/permission/error/security/tests/localization/docs/end-to-end. Find dead buttons, TODO, placeholder, hardcoded values, mock responses, missing API, incomplete transactions, race conditions, security defects and unconnected features. File SYSTEM_AUDIT.md with Critical/High/Medium/Low severity, dependencies, remediation and actual test results. Fix critical first; re-audit and sync registry. No COMPLETE merely because a file or class exists. Report content counts separately from engine readiness.

# PART S — LEGACY COVERAGE CHECKLIST (516 ITEMS FROM INITIAL INVENTORY)

This checklist preserves the initial analysis inventory as traceable implementation requirements, not as verified internal systems of the reference game. Some entries are data types, UI views or sub-mechanics rather than independent services. Map each to the appropriate master section and registry ID; don't create redundant services just to match the number. Where names refer to the reference, replace them with original equivalents (Lantern Level→Extended Mastery; Lantern Shards→Crystal; Lantern Duel→original TCG). Every item below must have coverage or explicit documented deferral. The expanded requirements above are also mandatory, even if not present here.

## Legacy — Account and world

- [ ] L001 — Account
- [ ] L002 — Login
- [ ] L003 — World Selection
- [ ] L004 — World Isolation
- [ ] L005 — Character Creation
- [ ] L006 — Character Selection
- [ ] L007 — Character Appearance
- [ ] L008 — Account Shared Rewards
- [ ] L009 — Beta Progress
- [ ] L010 — Purchase Recovery

## Legacy — Class

- [ ] L011 — Class Selection
- [ ] L012 — Class Role
- [ ] L013 — Class Element
- [ ] L014 — Class Gauge
- [ ] L015 — Class Mechanics
- [ ] L016 — Ascension

## Legacy — Progression

- [ ] L017 — Base Level
- [ ] L018 — Base EXP
- [ ] L019 — Job Progression
- [ ] L020 — Stat Points
- [ ] L021 — Skill Points
- [ ] L022 — Skill Reset
- [ ] L023 — Ascension 1
- [ ] L024 — Ascension 2
- [ ] L025 — Ascension 3
- [ ] L026 — Lantern Level (original equivalent)
- [ ] L027 — Milestone Reward
- [ ] L028 — Combat Power

## Legacy — Stats

- [ ] L029 — Primary Stats
- [ ] L030 — HP
- [ ] L031 — MP
- [ ] L032 — ATK
- [ ] L033 — MATK
- [ ] L034 — DEF
- [ ] L035 — MDEF
- [ ] L036 — Hit
- [ ] L037 — Flee / Dodge
- [ ] L038 — Critical
- [ ] L039 — Attack Speed
- [ ] L040 — Movement Speed
- [ ] L041 — Cooldown Reduction
- [ ] L042 — Stat Modifier
- [ ] L043 — Stat Cap
- [ ] L044 — Stat Guide

## Legacy — Combat

- [ ] L045 — Target Selection
- [ ] L046 — Normal Attack
- [ ] L047 — Auto Attack
- [ ] L048 — Physical Damage
- [ ] L049 — Magical Damage
- [ ] L050 — Elemental Damage
- [ ] L051 — Melee Combat
- [ ] L052 — Ranged Combat
- [ ] L053 — Projectile
- [ ] L054 — Area of Effect
- [ ] L055 — Buff
- [ ] L056 — Debuff
- [ ] L057 — Damage Over Time
- [ ] L058 — Healing
- [ ] L059 — Shield / Guard
- [ ] L060 — Knockback
- [ ] L061 — Knockdown
- [ ] L062 — Death
- [ ] L063 — Revival
- [ ] L064 — Combat Reward
- [ ] L065 — Loot Distribution

## Legacy — Elements

- [ ] L066 — Character Element
- [ ] L067 — Monster Element
- [ ] L068 — Element Advantage
- [ ] L069 — Element Resistance
- [ ] L070 — Element Chart
- [ ] L071 — Light / Dark Interaction
- [ ] L072 — Spirit Element

## Legacy — Skills

- [ ] L073 — Skill Database
- [ ] L074 — Skill Level
- [ ] L075 — Skill Upgrade
- [ ] L076 — Active Skill
- [ ] L077 — Passive Skill
- [ ] L078 — Skill Cooldown
- [ ] L079 — Skill MP Cost
- [ ] L080 — Skill Duration
- [ ] L081 — Skill Target
- [ ] L082 — Skill Hotbar
- [ ] L083 — Skill Effect
- [ ] L084 — Skill Description
- [ ] L085 — Skill Stone Socket
- [ ] L086 — Blank Skill Stone
- [ ] L087 — Stone Inscription
- [ ] L088 — Stone Re-inscription
- [ ] L089 — Stone Refining
- [ ] L090 — Stone Embedding

## Legacy — World map

- [ ] L091 — Region
- [ ] L092 — Map
- [ ] L093 — Town
- [ ] L094 — Hunting Ground
- [ ] L095 — Dungeon Map
- [ ] L096 — NPC Placement
- [ ] L097 — Monster Spawn
- [ ] L098 — Monster Respawn
- [ ] L099 — Map Transition
- [ ] L100 — Pathfinding
- [ ] L101 — Auto Navigation
- [ ] L102 — Collision
- [ ] L103 — Minimap
- [ ] L104 — World Travel
- [ ] L105 — Resource Placement

## Legacy — Monsters

- [ ] L106 — Monster Database
- [ ] L107 — Normal Monster
- [ ] L108 — Elite Monster
- [ ] L109 — Boss Monster
- [ ] L110 — Monster Level
- [ ] L111 — Monster Stats
- [ ] L112 — Monster Element
- [ ] L113 — Monster Attack
- [ ] L114 — Monster AI
- [ ] L115 — Monster Skills
- [ ] L116 — Monster Guard
- [ ] L117 — Boss Phase
- [ ] L118 — Monster EXP Reward
- [ ] L119 — Monster Gold Reward
- [ ] L120 — Item Drop Table
- [ ] L121 — Monster Card Drop

## Legacy — Quests

- [ ] L122 — Main Quest
- [ ] L123 — Quest Objective
- [ ] L124 — Quest Progress
- [ ] L125 — Quest Tracking
- [ ] L126 — Quest Reward
- [ ] L127 — Quest Navigation
- [ ] L128 — NPC Dialogue
- [ ] L129 — Story Scene
- [ ] L130 — Story Skip
- [ ] L131 — Story Journal
- [ ] L132 — Tutorial

## Legacy — Items

- [ ] L133 — Item Database
- [ ] L134 — Item Category
- [ ] L135 — Item Rarity
- [ ] L136 — Equipment Item
- [ ] L137 — Consumable
- [ ] L138 — Material
- [ ] L139 — Quest Item
- [ ] L140 — Item Stack
- [ ] L141 — Inventory
- [ ] L142 — Inventory Capacity
- [ ] L143 — Item Binding
- [ ] L144 — Item Usage
- [ ] L145 — Item Tooltip
- [ ] L146 — Warehouse
- [ ] L147 — Warehouse Expansion
- [ ] L148 — Item Dismantling

## Legacy — Equipment

- [ ] L149 — Weapon
- [ ] L150 — Off-hand
- [ ] L151 — Armor
- [ ] L152 — Helmet
- [ ] L153 — Gloves
- [ ] L154 — Boots
- [ ] L155 — Belt
- [ ] L156 — Ring
- [ ] L157 — Outfit
- [ ] L158 — Wings
- [ ] L159 — Cosmetic Companion
- [ ] L160 — Wedding Ring
- [ ] L161 — Equipment Stats
- [ ] L162 — Equipment Requirements
- [ ] L163 — Equipment Durability
- [ ] L164 — Equipment Repair

## Legacy — Enhancement

- [ ] L165 — Gear Refining
- [ ] L166 — Refining Ore
- [ ] L167 — Refine Success / Failure
- [ ] L168 — Refine Downgrade
- [ ] L169 — Refine Ward
- [ ] L170 — Refine Blessing
- [ ] L171 — Hearth Ward (original equivalent)
- [ ] L172 — Lantern Ward (original equivalent)
- [ ] L173 — Random Option
- [ ] L174 — Option Stone
- [ ] L175 — Enchanter
- [ ] L176 — Crafting Option
- [ ] L177 — Gem Socket
- [ ] L178 — Stat Gem
- [ ] L179 — Gem Grade
- [ ] L180 — Gem Refining
- [ ] L181 — Gem Removal
- [ ] L182 — Cosmetic Enhancement

## Legacy — Monster cards

- [ ] L183 — Monster Card Collection
- [ ] L184 — Card Drop
- [ ] L185 — Card Effect
- [ ] L186 — Card Slot / Row
- [ ] L187 — Card Stat Calculation
- [ ] L188 — Card Bonus Cap

## Legacy — Pets

- [ ] L189 — Pet Collection
- [ ] L190 — Pet Egg
- [ ] L191 — Egg Hatching
- [ ] L192 — Pet Rarity
- [ ] L193 — Pet Level
- [ ] L194 — Pet EXP
- [ ] L195 — Pet Stats
- [ ] L196 — Pet Summon
- [ ] L197 — Pet Combat
- [ ] L198 — Pet Active Skill
- [ ] L199 — Pet Passive Skill
- [ ] L200 — Pet Feeding
- [ ] L201 — Regional Pet Food
- [ ] L202 — Pet Star Upgrade
- [ ] L203 — Pet Skill Rune
- [ ] L204 — Pet Dismantling
- [ ] L205 — Star Dust

## Legacy — Pet farm

- [ ] L206 — Personal Pet Farm
- [ ] L207 — Farm Capacity
- [ ] L208 — Farm Expansion
- [ ] L209 — Lantern Feeder (original equivalent)
- [ ] L210 — Feeder Expansion
- [ ] L211 — Feeder Upgrade
- [ ] L212 — Offline Pet EXP
- [ ] L213 — Farm Decoration
- [ ] L214 — Friend Farm Visit

## Legacy — Mount

- [ ] L215 — Mount Collection
- [ ] L216 — Mount Riding
- [ ] L217 — Mount Key
- [ ] L218 — Mount Stable
- [ ] L219 — Mount Enhancement
- [ ] L220 — Duplicate Mount Conversion
- [ ] L221 — Stable Seal Exchange

## Legacy — Dungeons

- [ ] L222 — Regular Dungeon
- [ ] L223 — Daily Dungeon
- [ ] L224 — Dungeon Entry
- [ ] L225 — Dungeon Instance
- [ ] L226 — Dungeon Party
- [ ] L227 — Dungeon Floor
- [ ] L228 — Floor Unlock
- [ ] L229 — Monster Wave
- [ ] L230 — Dungeon Boss
- [ ] L231 — Dungeon Timer
- [ ] L232 — Gem Dungeon
- [ ] L233 — Refine Mine
- [ ] L234 — Pet Dungeon
- [ ] L235 — EXP Dungeon
- [ ] L236 — Stone Dungeon
- [ ] L237 — Daily Reward Limit
- [ ] L238 — Additional Reward Purchase
- [ ] L239 — Dungeon Failure
- [ ] L240 — Daily Dungeon Reset

## Legacy — World boss

- [ ] L241 — World Boss Schedule
- [ ] L242 — Daily Boss Rotation
- [ ] L243 — Boss Entry
- [ ] L244 — Boss Scaling
- [ ] L245 — Boss Participation
- [ ] L246 — Damage / Contribution Ranking
- [ ] L247 — World Boss MVP
- [ ] L248 — World Boss Coin
- [ ] L249 — World Boss Reward
- [ ] L250 — World Boss Shop
- [ ] L251 — World Announcement

## Legacy — PvP

- [ ] L252 — Player Duel
- [ ] L253 — Timed Arena
- [ ] L254 — Arena Entry
- [ ] L255 — Arena Team Allocation
- [ ] L256 — Arena 1v1–10v10
- [ ] L257 — Lantern Siege (capture point equivalent)
- [ ] L258 — Last Light (last survivor equivalent)
- [ ] L259 — Ember Rush (resource capture equivalent)
- [ ] L260 — Arena Victory
- [ ] L261 — Arena MVP
- [ ] L262 — Arena Token
- [ ] L263 — Arena Reward
- [ ] L264 — Arena Shop
- [ ] L265 — Arena Season Ranking

## Legacy — Auto play

- [ ] L266 — Auto Play
- [ ] L267 — Automatic Combat
- [ ] L268 — Automatic Loot
- [ ] L269 — Auto Play Rewards
- [ ] L270 — Inventory Full Stop
- [ ] L271 — Automatic Repair

## Legacy — Life skills

- [ ] L272 — Life Skills
- [ ] L273 — Resource Gathering
- [ ] L274 — Mining
- [ ] L275 — Ore Vein
- [ ] L276 — Material Collection
- [ ] L277 — Crafting
- [ ] L278 — Equipment Crafting
- [ ] L279 — Crafting Material Cost
- [ ] L280 — Crafting Option Selection
- [ ] L281 — Life Skill Ranking

## Legacy — Economy

- [ ] L282 — Gold
- [ ] L283 — Lantern Shards (Crystal)
- [ ] L284 — Open Shards
- [ ] L285 — Waiting Shards
- [ ] L286 — Free Shards
- [ ] L287 — Arena Tokens
- [ ] L288 — World Boss Coins
- [ ] L289 — Pack Marks
- [ ] L290 — Stable Seals
- [ ] L291 — Gold Sources
- [ ] L292 — Gold Sinks
- [ ] L293 — Transaction Fee
- [ ] L294 — Market Tax

## Legacy — Market

- [ ] L295 — Market Overview
- [ ] L296 — Item Search
- [ ] L297 — Search Filters
- [ ] L298 — Best Seller
- [ ] L299 — Price Trend
- [ ] L300 — Item Price Chart
- [ ] L301 — Wishlist
- [ ] L302 — Sell Order / Stall
- [ ] L303 — Buy Shop
- [ ] L304 — Direct Market Purchase
- [ ] L305 — Auction
- [ ] L306 — Starting Bid
- [ ] L307 — Buy Now
- [ ] L308 — Auto Bid
- [ ] L309 — Auction Time Extension
- [ ] L310 — Anonymous Bidder
- [ ] L311 — My Shop
- [ ] L312 — Market History
- [ ] L313 — Sales Collection
- [ ] L314 — Shared Account Collection
- [ ] L315 — Market Slot Limit

## Legacy — Exchange

- [ ] L316 — Shard Order Book
- [ ] L317 — Limit Buy
- [ ] L318 — Limit Sell
- [ ] L319 — Instant Buy
- [ ] L320 — Instant Sell
- [ ] L321 — Order Matching
- [ ] L322 — Price History
- [ ] L323 — Price Chart Timeframe
- [ ] L324 — Exchange Fee
- [ ] L325 — Shard Eligibility
- [ ] L326 — Payment Holding Period
- [ ] L327 — World-based Exchange

## Legacy — Social

- [ ] L328 — Nearby Players
- [ ] L329 — Player Interaction
- [ ] L330 — Friend List
- [ ] L331 — Friend Online Status
- [ ] L332 — Chat
- [ ] L333 — Party
- [ ] L334 — Party Invitation
- [ ] L335 — Party Combat
- [ ] L336 — Party Dungeon
- [ ] L337 — Shared Loot Eligibility
- [ ] L338 — Guild
- [ ] L339 — Guild Membership
- [ ] L340 — Player Trading
- [ ] L341 — Mail
- [ ] L342 — Mail Attachment
- [ ] L343 — Mail Reward
- [ ] L344 — Marriage Proposal
- [ ] L345 — Engagement
- [ ] L346 — Wedding Ceremony
- [ ] L347 — Wedding Plaza
- [ ] L348 — Marriage Requirements
- [ ] L349 — Marriage Status
- [ ] L350 — Wedding Equipment

## Legacy — TCG

- [ ] L351 — Card Duel Game
- [ ] L352 — TCG Card Collection
- [ ] L353 — Card Set
- [ ] L354 — Card Element
- [ ] L355 — Card Rarity
- [ ] L356 — Starter Deck
- [ ] L357 — Deck Management
- [ ] L358 — Card Battle Tutorial
- [ ] L359 — AI Duel
- [ ] L360 — Duelists’ Tower
- [ ] L361 — Casual Duel
- [ ] L362 — Ranked Duel
- [ ] L363 — Friendly Duel
- [ ] L364 — Card Duel Rank
- [ ] L365 — Rank Stars
- [ ] L366 — Card Season
- [ ] L367 — Card Season Reward
- [ ] L368 — Card Pack
- [ ] L369 — Pack Opening
- [ ] L370 — Pack Marks
- [ ] L371 — Card Exchange
- [ ] L372 — Card Trading
- [ ] L373 — Bound Card
- [ ] L374 — Duplicate Card Dismantling
- [ ] L375 — Card Dust
- [ ] L376 — Card Back
- [ ] L377 — Playmat
- [ ] L378 — Animated Battle Table
- [ ] L379 — Classic Battle Table
- [ ] L380 — Card Duel Status

## Legacy — Commerce

- [ ] L381 — Lantern Market (original shop)
- [ ] L382 — Premium Currency Store
- [ ] L383 — Top-up
- [ ] L384 — Payment Processing
- [ ] L385 — Top-up Bonus
- [ ] L386 — Gacha
- [ ] L387 — Gacha Ticket
- [ ] L388 — Seasonal Gacha
- [ ] L389 — Fashion Box
- [ ] L390 — Gem Box
- [ ] L391 — Weekly Pass
- [ ] L392 — Monthly Pass
- [ ] L393 — Adventure Pass
- [ ] L394 — Adventure Pass Premium
- [ ] L395 — Festival Pass
- [ ] L396 — Permanent Hearth Pass (original membership)
- [ ] L397 — Grand Lantern Pass (original membership)
- [ ] L398 — Pass Reward
- [ ] L399 — Pass Benefit
- [ ] L400 — Seasonal Shop

## Legacy — Events

- [ ] L401 — Lantern Calendar (event calendar)
- [ ] L402 — Daily Reward
- [ ] L403 — Weekly Reward
- [ ] L404 — Seasonal Event
- [ ] L405 — Festival Event
- [ ] L406 — EXP Boost Event
- [ ] L407 — Gold Boost Event
- [ ] L408 — Event Countdown
- [ ] L409 — Achievement
- [ ] L410 — Achievement Reward
- [ ] L411 — Milestone Announcement
- [ ] L412 — Season Reset
- [ ] L413 — Unclaimed Reward Mail

## Legacy — Rankings

- [ ] L414 — Combat Power Ranking
- [ ] L415 — Class Ranking
- [ ] L416 — Level Ranking
- [ ] L417 — Stat Ranking
- [ ] L418 — Pet Ranking
- [ ] L419 — Life Skill Ranking
- [ ] L420 — Achievement Ranking
- [ ] L421 — Lantern Ranking (mastery ranking)
- [ ] L422 — Donor Ranking (optional)
- [ ] L423 — Arena Ranking
- [ ] L424 — Card Duel Ranking
- [ ] L425 — Creator Ranking
- [ ] L426 — Weekly Title
- [ ] L427 — Milestone Title
- [ ] L428 — MVP Title
- [ ] L429 — Title Display

## Legacy — Audio

- [ ] L430 — Background Music
- [ ] L431 — Combat Sound Effect
- [ ] L432 — Ambient Sound
- [ ] L433 — Sound Settings
- [ ] L434 — In-game Radio
- [ ] L435 — Music Player
- [ ] L436 — Playlist
- [ ] L437 — Favorite Songs
- [ ] L438 — Music Language Filter
- [ ] L439 — Music Mood Filter
- [ ] L440 — Instrumental Filter
- [ ] L441 — Lyrics Display (licensed only)

## Legacy — Creator

- [ ] L442 — Creator Registration
- [ ] L443 — Creator Code
- [ ] L444 — YouTube Video Submission
- [ ] L445 — View Milestone Tracking
- [ ] L446 — Creator Reward
- [ ] L447 — Creator Verification
- [ ] L448 — Creator Leaderboard
- [ ] L449 — Discord Integration / Link

## Legacy — UI

- [ ] L450 — Main HUD
- [ ] L451 — Character Profile
- [ ] L452 — HP / MP Bar
- [ ] L453 — EXP Bar
- [ ] L454 — Class Resource Bar
- [ ] L455 — Skill Shortcut
- [ ] L456 — Item Tooltip
- [ ] L457 — Character Window
- [ ] L458 — Inventory Window
- [ ] L459 — Skill Window
- [ ] L460 — Quest Window
- [ ] L461 — Party Window
- [ ] L462 — Guild Window
- [ ] L463 — Market Window
- [ ] L464 — Dungeon Window
- [ ] L465 — Ranking Window
- [ ] L466 — More Menu
- [ ] L467 — Notification
- [ ] L468 — Event Reminder
- [ ] L469 — Fullscreen
- [ ] L470 — Responsive Layout
- [ ] L471 — Game Settings
- [ ] L472 — Memory Saver
- [ ] L473 — Language Selection
- [ ] L474 — Wiki Access
- [ ] L475 — Gacha Reveal Animation
- [ ] L476 — Enhancement Result Reveal

## Legacy — Backend

- [ ] B01 — Authentication
- [ ] B02 — Session Management
- [ ] B03 — Account Database
- [ ] B04 — Character Database
- [ ] B05 — Game Content Database
- [ ] B06 — Real-time Networking
- [ ] B07 — Player Synchronization
- [ ] B08 — Combat Validation
- [ ] B09 — Server Tick
- [ ] B10 — Entity Management
- [ ] B11 — Spatial Partitioning
- [ ] B12 — Instance Management
- [ ] B13 — AI Processing
- [ ] B14 — Random Number Generator
- [ ] B15 — Transaction Validation
- [ ] B16 — Item Duplication Prevention
- [ ] B17 — Economy Ledger
- [ ] B18 — Order Matching Engine
- [ ] B19 — Payment Verification
- [ ] B20 — Scheduled Jobs
- [ ] B21 — Daily / Weekly Reset
- [ ] B22 — Offline Progress
- [ ] B23 — Data Persistence
- [ ] B24 — Anti-cheat
- [ ] B25 — Anti-bot
- [ ] B26 — Rate Limiting
- [ ] B27 — Reconnection
- [ ] B28 — Game Master Tools
- [ ] B29 — Ban Management
- [ ] B30 — Logging
- [ ] B31 — Analytics
- [ ] B32 — Monitoring
- [ ] B33 — Load Balancing
- [ ] B34 — Backup
- [ ] B35 — Data Recovery
- [ ] B36 — Asset Loading
- [ ] B37 — Asset Preloading
- [ ] B38 — Memory Management
- [ ] B39 — Version Control
- [ ] B40 — Content Management

# PART T — FINAL START COMMAND AND EXIT CRITERIA

## 88 — Execute now

If no repository exists, start at Phase 0 (§72). If one exists, execute resume protocol (§86). First inspect environment and repository; then create or update MASTER_PLAN, full SYSTEM_REGISTRY (516 legacy items plus every expanded requirement), ASSUMPTIONS, dependency graph, initial schema and architecture. Set up local stack and actual runnable code; proceed to Phase 1 and Phase 2 only after foundation gates. Continue in dependency order through Phase 11, never skipping a requirement silently. Work within actual available tools and permissions. Do not output only a plan if you can implement. Do not require the user to paste additional prompts to fill gaps. On each new session, this file alone is sufficient instruction together with repository state and docs.

## 89 — Final delivery package

Deliver source repository and reproducible local setup; environment template, pinned dependencies, migrations/seed, playable authenticated multiplayer game, complete UI and content, admin/worker, documentation, coverage registry with evidence, automated tests and actual results, balance and load test reports, security review, deployment/rollback/runbooks, backup/restore proof and final audit. Deliver staging build when possible; production release only after approval. Clearly state exact implemented scope, optional disabled systems, content counts, known flaws, blocked/unrun tests and launch capacity validated. Do not label the project complete until the final acceptance gate is passed. If user chooses a smaller release scope, preserve full long-term roadmap and explicitly identify excluded items.

# END MASTER PROMPT
