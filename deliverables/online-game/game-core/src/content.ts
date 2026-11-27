import type { Element } from './config.js';
import type { L10n } from './classes.js';
import type { Modifier } from './stats.js';
import type { Rarity } from './items.js';

// ---------------- Monsters (§17) ----------------
export interface Drop { itemId: string; chance: number; min: number; max: number }
export interface MonsterDef {
  id: string; name: L10n; level: number; element: Element; maxHp: number; atk: number; def: number; mdef: number; moveSpeed: number;
  attackRange: number; aggroRange: number; leashRange: number; attackIntervalMs: number; respawnMs: number;
  ai: 'passive' | 'aggressive' | 'defensive' | 'ranged' | 'boss' | 'guard'; rank: 'normal' | 'elite' | 'rare' | 'boss' | 'world_boss';
  baseExp: number; goldMin: number; goldMax: number; drops: Drop[]; sprite: string; color: string; size: number;
  skills?: { id: string; name: L10n; power: number; radius: number; cdMs: number; telegraphMs: number; status?: string; element?: Element }[];
  capturable?: string; // pet species id
  phases?: { hpPct: number; enrage: number; summon?: string }[];
}
const mon = (m: Partial<MonsterDef> & Pick<MonsterDef, 'id' | 'name' | 'level' | 'element' | 'sprite' | 'color'>): MonsterDef => {
  const L = m.level;
  return {
    maxHp: Math.floor(60 + L * L * 9 + L * 25), atk: Math.floor(8 + L * 4.2), def: Math.floor(3 + L * 1.6), mdef: Math.floor(2 + L * 1.3), moveSpeed: 70,
    attackRange: 40, aggroRange: 150, leashRange: 360, attackIntervalMs: 1600, respawnMs: 12000, ai: 'passive', rank: 'normal',
    baseExp: Math.floor(10 + L * L * 1.6 + L * 6), goldMin: L * 2, goldMax: L * 5, drops: [], size: 1, ...m,
  };
};
const d = (itemId: string, chance: number, min = 1, max = 1): Drop => ({ itemId, chance, min, max });
export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries([
  mon({ id: 'forest_slime', name: { en: 'Moss Slime', th: 'สไลม์มอส' }, level: 2, element: 'earth', sprite: 'slime', color: '#6fcf5a', drops: [d('slime_gel', 0.65, 1, 3), d('potion_hp_s', 0.12), d('wood_sword', 0.02)], capturable: 'pet_slime' }),
  mon({ id: 'puff_bunny', name: { en: 'Puff Bunny', th: 'กระต่ายปุย' }, level: 3, element: 'wind', sprite: 'bunny', color: '#f0e8e0', moveSpeed: 90, drops: [d('soft_fur', 0.6, 1, 2), d('berry', 0.3)], capturable: 'pet_bunny' }),
  mon({ id: 'cap_shroom', name: { en: 'Capshroom', th: 'เห็ดหมวกแดง' }, level: 5, element: 'earth', sprite: 'mushroom', color: '#d04848', ai: 'defensive', drops: [d('mushroom_cap', 0.6, 1, 2), d('herb_green', 0.2), d('wood_staff', 0.03)] }),
  mon({ id: 'dusk_bat', name: { en: 'Dusk Bat', th: 'ค้างคาวสนธยา' }, level: 7, element: 'dark', sprite: 'bat', color: '#5a4870', ai: 'aggressive', moveSpeed: 95, drops: [d('bat_wing', 0.55, 1, 2), d('potion_mp_s', 0.15)], capturable: 'pet_bat' }),
  mon({ id: 'thorn_wolf', name: { en: 'Thorn Wolf', th: 'หมาป่าหนาม' }, level: 10, element: 'earth', sprite: 'wolf', color: '#8a7a6a', ai: 'aggressive', moveSpeed: 100, drops: [d('wolf_fang', 0.5, 1, 2), d('iron_sword', 0.02), d('iron_bow', 0.02)], capturable: 'pet_wolf' }),
  mon({ id: 'ember_sprite', name: { en: 'Ember Sprite', th: 'ภูตถ่านไฟ' }, level: 12, element: 'fire', sprite: 'wisp', color: '#ff7a30', ai: 'ranged', attackRange: 180, drops: [d('ember_core', 0.35), d('gem_ruby_1', 0.04)], capturable: 'pet_ember' }),
  mon({ id: 'shell_beetle', name: { en: 'Shellback Beetle', th: 'ด้วงกระดอง' }, level: 14, element: 'earth', sprite: 'beetle', color: '#40688a', def: 40, drops: [d('beetle_shell', 0.55, 1, 2), d('iron_ore', 0.3), d('iron_body', 0.02)] }),
  mon({ id: 'amber_golem', name: { en: 'Amber Golem', th: 'โกเลมอำพัน' }, level: 18, element: 'earth', sprite: 'golem', color: '#d0a050', moveSpeed: 50, size: 1.4, rank: 'elite', drops: [d('golem_core', 0.3), d('refine_ore', 0.25, 1, 2), d('amber_sword', 0.03), d('gem_emerald_1', 0.06)] }),
  mon({ id: 'hill_boar', name: { en: 'Hill Boar', th: 'หมูป่าเนินเขา' }, level: 16, element: 'neutral', sprite: 'boar', color: '#7a5030', ai: 'aggressive', drops: [d('soft_fur', 0.5, 1, 3), d('wheat', 0.3), d('amber_boots', 0.02)], capturable: 'pet_boar' }),
  mon({ id: 'gale_hawk', name: { en: 'Gale Hawk', th: 'เหยี่ยววายุ' }, level: 20, element: 'wind', sprite: 'bird', color: '#c0d0e0', ai: 'aggressive', moveSpeed: 120, drops: [d('wisp_dust', 0.3), d('amber_bow', 0.03), d('gem_topaz_1', 0.05)], capturable: 'pet_hawk' }),
  mon({ id: 'frost_pup', name: { en: 'Frost Pup', th: 'ลูกหมาหิมะ' }, level: 26, element: 'ice', sprite: 'wolf', color: '#d8f0ff', ai: 'aggressive', drops: [d('frost_shard', 0.4), d('silver_ore', 0.2), d('frost_dagger', 0.02)], capturable: 'pet_frostpup' }),
  mon({ id: 'snow_yeti', name: { en: 'Snowpaw Yeti', th: 'เยติตีนหิมะ' }, level: 30, element: 'ice', sprite: 'golem', color: '#f0f8ff', size: 1.5, rank: 'elite', drops: [d('frost_shard', 0.6, 1, 3), d('refine_ore', 0.3), d('frost_body', 0.03), d('gem_sapphire_2', 0.03)] }),
  mon({ id: 'ice_wisp', name: { en: 'Rime Wisp', th: 'ภูตเกล็ดน้ำแข็ง' }, level: 28, element: 'ice', sprite: 'wisp', color: '#a0f0ff', ai: 'ranged', attackRange: 200, drops: [d('frost_shard', 0.4), d('wisp_dust', 0.3), d('frost_staff', 0.02)] }),
  mon({ id: 'cave_spider', name: { en: 'Hollow Spider', th: 'แมงมุมโพรง' }, level: 9, element: 'dark', sprite: 'spider', color: '#503050', ai: 'aggressive', drops: [d('cloth', 0.4), d('bat_wing', 0.2)] }),
  mon({ id: 'moss_golem', name: { en: 'Moss Guardian', th: 'ผู้พิทักษ์มอส' }, level: 12, element: 'earth', sprite: 'golem', color: '#5a8a40', size: 1.3, rank: 'elite', drops: [d('golem_core', 0.25), d('refine_ore', 0.3)] }),
  mon({ id: 'lantern_ghost', name: { en: 'Lantern Ghost', th: 'ผีโคมไฟ' }, level: 22, element: 'spirit', sprite: 'ghost', color: '#e0f0ff', ai: 'aggressive', drops: [d('wisp_dust', 0.45), d('star_dust', 0.1)], capturable: 'pet_ghost' }),
  mon({ id: 'golden_slime', name: { en: 'Gilded Slime', th: 'สไลม์ทองคำ' }, level: 15, element: 'light', sprite: 'slime', color: '#ffd040', rank: 'rare', goldMin: 300, goldMax: 800, respawnMs: 90000, drops: [d('gem_opal_1', 0.4), d('enchant_stone', 0.5), d('pet_egg', 0.15)] }),
  mon({ id: 'river_crab', name: { en: 'Pebble Crab', th: 'ปูก้อนกรวด' }, level: 6, element: 'water', sprite: 'crab', color: '#e07050', ai: 'defensive', drops: [d('beetle_shell', 0.3), d('fish_carp', 0.2)], capturable: 'pet_crab' }),
  mon({ id: 'mire_toad', name: { en: 'Mire Toad', th: 'คางคกบึง' }, level: 11, element: 'water', sprite: 'slime', color: '#5a9a70', ai: 'passive', drops: [d('herb_blue', 0.35), d('slime_gel', 0.3)] }),
  mon({ id: 'crystal_moth', name: { en: 'Crystal Moth', th: 'ผีเสื้อคริสตัล' }, level: 24, element: 'light', sprite: 'bird', color: '#ffc0ff', ai: 'passive', drops: [d('star_dust', 0.2), d('gem_amethyst_1', 0.05)] }),
  mon({ id: 'thorn_sentry', name: { en: 'Thornwood Sentry', th: 'ยามป่าหนาม' }, level: 9, element: 'earth', sprite: 'golem', color: '#6a8a40', size: 1.3, rank: 'elite', ai: 'guard', aggroRange: 130, leashRange: 200, def: 45, mdef: 30, attackIntervalMs: 1900, drops: [d('golem_core', 0.25), d('oak_log', 0.6, 2, 4), d('refine_ore', 0.3)] }),
  mon({ id: 'amber_sentinel', name: { en: 'Amber Sentinel', th: 'ทหารยามอำพัน' }, level: 22, element: 'earth', sprite: 'golem', color: '#e0b050', size: 1.5, rank: 'elite', ai: 'guard', aggroRange: 140, leashRange: 220, def: 90, mdef: 60, attackIntervalMs: 2000, drops: [d('golem_core', 0.35), d('refine_ore_hi', 0.15), d('amber_off', 0.04)] }),
  mon({ id: 'hollow_king', name: { en: 'Hollow King Mossbeard', th: 'ราชาโพรงหนวดมอส' }, level: 15, element: 'earth', sprite: 'golem', color: '#3a7030', size: 2.2, rank: 'boss', ai: 'boss', maxHp: 9000, atk: 85, def: 30, respawnMs: 0, baseExp: 2500, goldMin: 600, goldMax: 1200,
    drops: [d('boss_heart', 1), d('amber_greatsword', 0.25), d('amber_staff', 0.25), d('refine_ore', 1, 3, 6), d('pet_egg', 0.3), d('skill_stone', 0.5)],
    skills: [{ id: 'slam', name: { en: 'Root Slam', th: 'กระแทกราก' }, power: 1.8, radius: 120, cdMs: 7000, telegraphMs: 1200, status: 'root' }, { id: 'spores', name: { en: 'Spore Cloud', th: 'หมอกสปอร์' }, power: 0.8, radius: 180, cdMs: 11000, telegraphMs: 1500, status: 'poison' }],
    phases: [{ hpPct: 50, enrage: 1.3, summon: 'cap_shroom' }, { hpPct: 20, enrage: 1.6 }] }),
  // ---- 0.10 content: Coral Coast (Lv 32–44), Starfall Ruins (47–62), Emberpeak Caldera (68–86) ----
  mon({ id: 'tide_crab', name: { en: 'Tideclaw Crab', th: 'ปูก้ามคลื่น' }, level: 33, element: 'water', sprite: 'crab', color: '#40a0c0', ai: 'defensive', drops: [d('coral_shard', 0.5, 1, 2), d('fish_carp', 0.25), d('frost_gloves', 0.02)] }),
  mon({ id: 'coral_naga', name: { en: 'Coral Naga', th: 'นาคปะการัง' }, level: 36, element: 'water', sprite: 'lizard', color: '#ff8a70', ai: 'aggressive', drops: [d('coral_shard', 0.45, 1, 2), d('brine_pearl', 0.05), d('frost_spear', 0.02)] }),
  mon({ id: 'reef_jelly', name: { en: 'Reef Jelly', th: 'แมงกะพรุนแนวปะการัง' }, level: 38, element: 'water', sprite: 'slime', color: '#c0a0ff', ai: 'passive', drops: [d('slime_gel', 0.4, 1, 3), d('potion_mp_m', 0.12), d('gem_aquamarine_1', 0.05)] }),
  mon({ id: 'gull_raider', name: { en: 'Gull Raider', th: 'นกนางนวลโจร' }, level: 40, element: 'wind', sprite: 'bird', color: '#f0f0f0', ai: 'aggressive', moveSpeed: 120, drops: [d('wisp_dust', 0.35), d('frost_bow', 0.02), d('gacha_ticket', 0.005)] }),
  mon({ id: 'brine_warden', name: { en: 'Brine Warden', th: 'ผู้คุมน้ำเค็ม' }, level: 44, element: 'water', sprite: 'golem', color: '#2a7a9a', size: 1.6, rank: 'elite', ai: 'guard', aggroRange: 150, leashRange: 220, def: 160, mdef: 120, drops: [d('brine_pearl', 0.5, 1, 2), d('frost_body', 0.05), d('refine_ore_hi', 0.3)] }),
  mon({ id: 'ruin_golem', name: { en: 'Ruinstone Golem', th: 'โกเลมหินซาก' }, level: 47, element: 'earth', sprite: 'golem', color: '#9a8a7a', moveSpeed: 55, size: 1.3, drops: [d('star_fragment', 0.3), d('iron_ore', 0.3, 1, 2), d('dawn_boots', 0.02)] }),
  mon({ id: 'star_wraith', name: { en: 'Star Wraith', th: 'วิญญาณดวงดาว' }, level: 52, element: 'spirit', sprite: 'ghost', color: '#c0c0ff', ai: 'aggressive', drops: [d('star_fragment', 0.4), d('star_dust', 0.2), d('dawn_staff', 0.02)] }),
  mon({ id: 'clockwork_knight', name: { en: 'Clockwork Knight', th: 'อัศวินจักรกล' }, level: 56, element: 'neutral', sprite: 'golem', color: '#c09a50', ai: 'aggressive', def: 220, drops: [d('iron_ore', 0.5, 1, 3), d('dawn_sword', 0.02), d('refine_ore', 0.3)] }),
  mon({ id: 'astral_eye', name: { en: 'Astral Eye', th: 'ดวงตาดารา' }, level: 60, element: 'light', sprite: 'wisp', color: '#ffe0ff', ai: 'ranged', attackRange: 210, drops: [d('star_fragment', 0.45, 1, 2), d('gem_opal_2', 0.05)] }),
  mon({ id: 'ruin_sentinel', name: { en: 'Ruin Sentinel', th: 'ทหารยามซากเมือง' }, level: 62, element: 'light', sprite: 'golem', color: '#e0d0a0', size: 1.7, rank: 'elite', ai: 'guard', aggroRange: 150, leashRange: 230, def: 300, mdef: 220, drops: [d('dawn_body', 0.05), d('refine_ore_hi', 0.4, 1, 2), d('star_fragment', 0.8, 2, 4)] }),
  mon({ id: 'magma_hound', name: { en: 'Magma Hound', th: 'สุนัขแมกมา' }, level: 68, element: 'fire', sprite: 'wolf', color: '#ff5020', ai: 'aggressive', moveSpeed: 105, drops: [d('magma_core', 0.25), d('astral_boots', 0.01), d('gem_ruby_2', 0.04)] }),
  mon({ id: 'cinder_drake', name: { en: 'Cinder Drake', th: 'มังกรถ่านเถ้า' }, level: 74, element: 'fire', sprite: 'lizard', color: '#c03010', size: 1.3, ai: 'ranged', attackRange: 190, drops: [d('magma_core', 0.3), d('astral_gloves', 0.01), d('refine_ore_hi', 0.15)] }),
  mon({ id: 'obsidian_titan', name: { en: 'Obsidian Titan', th: 'ไททันออบซิเดียน' }, level: 80, element: 'earth', sprite: 'golem', color: '#3a3040', size: 1.8, rank: 'elite', moveSpeed: 45, def: 420, drops: [d('magma_core', 0.6, 1, 2), d('refine_ore_hi', 0.4, 1, 2), d('astral_body', 0.02)] }),
  mon({ id: 'flame_djinn', name: { en: 'Flame Djinn', th: 'ญินเปลวไฟ' }, level: 86, element: 'fire', sprite: 'ghost', color: '#ffa040', ai: 'ranged', attackRange: 210, drops: [d('magma_core', 0.35), d('gem_ruby_3', 0.03), d('astral_staff', 0.01)] }),
  mon({ id: 'abyssal_kraken', name: { en: 'Abyssal Kraken', th: 'คราเคนห้วงลึก' }, level: 42, element: 'water', sprite: 'spider', color: '#204060', size: 2.4, rank: 'boss', ai: 'boss', maxHp: 60000, atk: 260, def: 120, respawnMs: 0,
    drops: [d('boss_heart', 1), d('brine_pearl', 1, 2, 4), d('frost_greatsword', 0.2), d('frost_tome', 0.2), d('refine_ore_hi', 1, 2, 3)],
    skills: [{ id: 'tidal', name: { en: 'Tidal Crush', th: 'คลื่นบดขยี้' }, power: 1.9, radius: 140, cdMs: 7000, telegraphMs: 1300, element: 'water' }, { id: 'ink', name: { en: 'Ink Cloud', th: 'หมอกหมึก' }, power: 0.7, radius: 180, cdMs: 11000, telegraphMs: 900, status: 'slow' }],
    phases: [{ hpPct: 50, enrage: 1.3, summon: 'reef_jelly' }, { hpPct: 20, enrage: 1.6 }] }),
  mon({ id: 'vault_archon', name: { en: 'Vault Archon Seraphel', th: 'อาร์คอนแห่งห้องนิรภัย เซราเฟล' }, level: 62, element: 'light', sprite: 'golem', color: '#ffe0a0', size: 2.4, rank: 'boss', ai: 'boss', maxHp: 180000, atk: 420, def: 260, mdef: 200, respawnMs: 0,
    drops: [d('boss_heart', 1, 1, 2), d('star_fragment', 1, 4, 8), d('dawn_greatsword', 0.2), d('dawn_staff', 0.2), d('refine_ore_hi', 1, 3, 5), d('gacha_ticket', 0.5)],
    skills: [{ id: 'nova', name: { en: 'Starfall', th: 'ดาวตก' }, power: 2.1, radius: 190, cdMs: 8000, telegraphMs: 1600, element: 'light' }, { id: 'beam', name: { en: 'Judgement Beam', th: 'ลำแสงพิพากษา' }, power: 1.5, radius: 100, cdMs: 5000, telegraphMs: 900, status: 'stun' }],
    phases: [{ hpPct: 66, enrage: 1.2, summon: 'astral_eye' }, { hpPct: 33, enrage: 1.5, summon: 'clockwork_knight' }] }),
  // ---- 0.11 content: Skyreach Isles (Lv 92–102), Shattered Rift (106–120), raid boss ----
  mon({ id: 'cloud_sprite', name: { en: 'Cloud Sprite', th: 'ภูตเมฆ' }, level: 92, element: 'wind', sprite: 'wisp', color: '#e0f0ff', ai: 'ranged', attackRange: 210, drops: [d('sky_feather', 0.2), d('wisp_dust', 0.4), d('origin_staff', 0.005)] }),
  mon({ id: 'nimbus_ram', name: { en: 'Nimbus Ram', th: 'แกะเมฆฝน' }, level: 94, element: 'wind', sprite: 'ram', color: '#ffffff', ai: 'passive', drops: [d('soft_fur', 0.6, 2, 4), d('sky_feather', 0.25)] }),
  mon({ id: 'storm_griffin', name: { en: 'Storm Griffin', th: 'กริฟฟินพายุ' }, level: 96, element: 'wind', sprite: 'bird', color: '#c0c8f0', size: 1.4, ai: 'aggressive', moveSpeed: 120, drops: [d('sky_feather', 0.35), d('origin_bow', 0.005), d('gem_topaz_3', 0.02)] }),
  mon({ id: 'thunder_roc', name: { en: 'Thunder Roc', th: 'นกรอคสายฟ้า' }, level: 102, element: 'wind', sprite: 'bird', color: '#f0e060', size: 1.8, rank: 'elite', ai: 'aggressive', drops: [d('sky_feather', 0.8, 2, 3), d('refine_ore_hi', 0.5, 1, 2), d('origin_gloves', 0.02)] }),
  mon({ id: 'sky_sentinel', name: { en: 'Sky Sentinel', th: 'ผู้เฝ้าเวหา' }, level: 100, element: 'light', sprite: 'golem', color: '#a0c0e0', size: 1.8, rank: 'elite', ai: 'guard', aggroRange: 160, leashRange: 240, def: 600, mdef: 450, drops: [d('sky_feather', 1, 2, 4), d('origin_body', 0.05), d('refine_ore_hi', 0.6, 2, 3)] }),
  mon({ id: 'void_stalker', name: { en: 'Void Stalker', th: 'นักล่าความว่างเปล่า' }, level: 106, element: 'dark', sprite: 'wolf', color: '#40205a', ai: 'aggressive', moveSpeed: 110, drops: [d('void_essence', 0.2), d('origin_dagger', 0.005)] }),
  mon({ id: 'rift_horror', name: { en: 'Rift Horror', th: 'สยองรอยแยก' }, level: 110, element: 'dark', sprite: 'spider', color: '#602080', size: 1.4, ai: 'aggressive', drops: [d('void_essence', 0.3), d('gem_onyx_3', 0.02), d('origin_boots', 0.005)] }),
  mon({ id: 'chrono_wraith', name: { en: 'Chrono Wraith', th: 'วิญญาณกาลเวลา' }, level: 114, element: 'spirit', sprite: 'ghost', color: '#80e0ff', ai: 'ranged', attackRange: 220, drops: [d('void_essence', 0.3), d('star_dust', 0.3), d('origin_tome', 0.005)] }),
  mon({ id: 'eclipse_knight', name: { en: 'Eclipse Knight', th: 'อัศวินสุริยุปราคา' }, level: 118, element: 'dark', sprite: 'golem', color: '#201828', ai: 'aggressive', def: 800, drops: [d('void_essence', 0.45, 1, 2), d('origin_sword', 0.008), d('refine_ore_hi', 0.2)] }),
  mon({ id: 'rift_colossus', name: { en: 'Rift Colossus', th: 'ยักษ์รอยแยก' }, level: 120, element: 'dark', sprite: 'golem', color: '#3a1a5a', size: 2, rank: 'elite', ai: 'guard', aggroRange: 170, leashRange: 250, def: 900, mdef: 700, drops: [d('void_essence', 1, 3, 5), d('origin_greatsword', 0.04), d('refine_ore_hi', 1, 2, 4)] }),
  mon({ id: 'first_flame_tyrant', name: { en: 'Ignarch, Tyrant of the First Flame', th: 'อิกนาร์ค ทรราชแห่งเปลวแรก' }, level: 120, element: 'fire', sprite: 'golem', color: '#ff3010', size: 3, rank: 'boss', ai: 'boss', maxHp: 400000, atk: 1400, def: 700, mdef: 600, respawnMs: 0, baseExp: 3000000, goldMin: 50000, goldMax: 80000,
    drops: [d('flame_relic', 0.5), d('boss_heart', 1, 2, 3), d('origin_greatsword', 0.15), d('origin_staff', 0.15), d('origin_body', 0.15), d('refine_ore_hi', 1, 5, 8), d('gacha_ticket', 1, 2, 4)],
    skills: [{ id: 'nova', name: { en: 'Primordial Flare', th: 'เปลวปฐมกาล' }, power: 2.4, radius: 220, cdMs: 9000, telegraphMs: 1800, element: 'fire' }, { id: 'stomp', name: { en: 'Molten Stomp', th: 'กระทืบหลอมละลาย' }, power: 1.6, radius: 120, cdMs: 5000, telegraphMs: 900, status: 'burn' }],
    phases: [{ hpPct: 75, enrage: 1.2, summon: 'eclipse_knight' }, { hpPct: 50, enrage: 1.4, summon: 'flame_djinn' }, { hpPct: 25, enrage: 1.8, summon: 'flame_djinn' }] }),
]
  .concat(([
    ['wb_pyre', 'Pyre Colossus', 'ยักษ์กองเพลิง', 'fire', '#ff5020'], ['wb_tidal', 'Tidal Leviathan', 'เลวีอาธานกระแสน้ำ', 'water', '#2080c0'], ['wb_quarry', 'Quarry Titan', 'ไททันเหมืองหิน', 'earth', '#a07040'],
    ['wb_squall', 'Squall Roc', 'นกยักษ์พายุ', 'wind', '#c0e0f0'], ['wb_rime', 'Rime Matriarch', 'มารดาน้ำแข็ง', 'ice', '#c0f0ff'], ['wb_aurora', 'Aurora Seraph', 'เทวทูตออโรรา', 'light', '#fff0a0'], ['wb_umbra', 'Umbra Devourer', 'ผู้กลืนเงา', 'dark', '#402050'],
  ] as const).map(([id, en, th, el, color]) => mon({ id, name: { en, th }, level: 30, element: el, sprite: 'golem', color, size: 3, rank: 'world_boss', ai: 'boss', maxHp: 120000, atk: 160, def: 60, mdef: 50, respawnMs: 0, baseExp: 20000, goldMin: 3000, goldMax: 5000,
    drops: [d('boss_heart', 1, 1, 2), d('frost_greatsword', 0.1), d('frost_staff', 0.1), d('refine_ore_hi', 1, 1, 3), d('gacha_ticket', 0.5)],
    skills: [{ id: 'nova', name: { en: 'Cataclysm', th: 'มหันตภัย' }, power: 2.0, radius: 200, cdMs: 9000, telegraphMs: 1800, element: el }, { id: 'stomp', name: { en: 'Stomp', th: 'กระทืบ' }, power: 1.4, radius: 110, cdMs: 5000, telegraphMs: 900, status: 'stun' }],
    phases: [{ hpPct: 66, enrage: 1.2 }, { hpPct: 33, enrage: 1.5 }] })))
  .map((m) => [m.id, m]));
export const WORLD_BOSS_ROTATION = ['wb_pyre', 'wb_tidal', 'wb_quarry', 'wb_squall', 'wb_rime', 'wb_aurora', 'wb_umbra'];

// ---------------- Maps (§16) ----------------
export type Biome = 'town' | 'forest' | 'hills' | 'snow' | 'cave' | 'arena' | 'farm' | 'house' | 'crater' | 'plaza' | 'coast' | 'ruins' | 'volcano' | 'sky' | 'rift';
export interface MapDef {
  id: string; name: L10n; biome: Biome; w: number; h: number; seed: number; safe: boolean; pvp: boolean; instanced: boolean; levelReq: number;
  spawn: [number, number]; portals: { x: number; y: number; to: string; tx: number; ty: number; label: L10n }[];
  monsters: { id: string; count: number; at?: [number, number] }[]; npcs: string[]; resources: { type: 'ore' | 'tree' | 'herb' | 'fish'; count: number }[]; bgm: string; weather: ('clear' | 'rain' | 'snow' | 'fog' | 'leaves')[];
}
export const MAPS: Record<string, MapDef> = Object.fromEntries(([
  { id: 'emberglen', name: { en: 'Emberglen Village', th: 'หมู่บ้านเอมเบอร์เกลน' }, biome: 'town', w: 56, h: 44, seed: 11, safe: true, pvp: false, instanced: false, levelReq: 1, spawn: [28, 24],
    portals: [{ x: 54, y: 22, to: 'whisperwood', tx: 2, ty: 22, label: { en: 'Whisperwood', th: 'ป่ากระซิบ' } }, { x: 28, y: 1, to: 'amber_hills', tx: 30, ty: 46, label: { en: 'Amber Hills', th: 'เนินอำพัน' } }, { x: 1, y: 22, to: 'pet_farm', tx: 18, ty: 14, label: { en: 'Your Farm', th: 'ฟาร์มของคุณ' } }, { x: 28, y: 43, to: 'wedding_plaza', tx: 15, ty: 20, label: { en: 'Wedding Plaza', th: 'ลานวิวาห์' } }],
    monsters: [], npcs: ['elder_rowan', 'merchant_pip', 'smith_brunhild', 'enchanter_isolde', 'healer_mae', 'teleporter_quill', 'banker_oswin', 'petkeeper_luma', 'stablemaster_hale', 'guild_clerk', 'dungeon_warden', 'arena_master', 'duelist_kit', 'crafter_juno', 'broker_vance', 'event_host', 'officiant_sol', 'board_quest'], resources: [{ type: 'fish', count: 4 }], bgm: 'town', weather: ['clear', 'clear', 'rain', 'leaves'] },
  { id: 'whisperwood', name: { en: 'Whisperwood', th: 'ป่ากระซิบ' }, biome: 'forest', w: 70, h: 46, seed: 23, safe: false, pvp: false, instanced: false, levelReq: 1, spawn: [3, 22],
    portals: [{ x: 0, y: 22, to: 'emberglen', tx: 52, ty: 22, label: { en: 'Emberglen', th: 'เอมเบอร์เกลน' } }, { x: 68, y: 8, to: 'mossy_hollow', tx: 15, ty: 28, label: { en: 'Mossy Hollow (Dungeon)', th: 'โพรงมอส (ดันเจี้ยน)' } }],
    monsters: [{ id: 'forest_slime', count: 10 }, { id: 'puff_bunny', count: 7 }, { id: 'cap_shroom', count: 7 }, { id: 'dusk_bat', count: 5 }, { id: 'river_crab', count: 4 }, { id: 'thorn_wolf', count: 4 }, { id: 'mire_toad', count: 3 }, { id: 'golden_slime', count: 1 }, { id: 'thorn_sentry', count: 1, at: [63, 10] }, { id: 'thorn_sentry', count: 1, at: [65, 13] }],
    npcs: ['ranger_fen'], resources: [{ type: 'tree', count: 12 }, { type: 'herb', count: 10 }, { type: 'ore', count: 5 }, { type: 'fish', count: 4 }], bgm: 'forest', weather: ['clear', 'rain', 'fog', 'leaves'] },
  { id: 'amber_hills', name: { en: 'Amber Hills', th: 'เนินอำพัน' }, biome: 'hills', w: 64, h: 50, seed: 37, safe: false, pvp: true, instanced: false, levelReq: 10, spawn: [30, 46],
    portals: [{ x: 30, y: 49, to: 'emberglen', tx: 28, ty: 3, label: { en: 'Emberglen', th: 'เอมเบอร์เกลน' } }, { x: 63, y: 40, to: 'coral_coast', tx: 3, ty: 25, label: { en: 'Coral Coast', th: 'ชายฝั่งปะการัง' } }, { x: 62, y: 10, to: 'frostmere', tx: 3, ty: 30, label: { en: 'Frostmere', th: 'ฟรอสต์เมียร์' } }, { x: 2, y: 6, to: 'sunken_crater', tx: 20, ty: 30, label: { en: 'Sunken Crater (World Boss)', th: 'หลุมยุบ (บอสโลก)' } }],
    monsters: [{ id: 'ember_sprite', count: 6 }, { id: 'shell_beetle', count: 6 }, { id: 'hill_boar', count: 7 }, { id: 'amber_golem', count: 3 }, { id: 'gale_hawk', count: 5 }, { id: 'lantern_ghost', count: 3 }, { id: 'amber_sentinel', count: 1, at: [6, 8] }],
    npcs: ['miner_dorn'], resources: [{ type: 'ore', count: 12 }, { type: 'tree', count: 6 }, { type: 'herb', count: 6 }], bgm: 'hills', weather: ['clear', 'clear', 'rain', 'fog'] },
  { id: 'frostmere', name: { en: 'Frostmere Steppe', th: 'ทุ่งฟรอสต์เมียร์' }, biome: 'snow', w: 60, h: 56, seed: 41, safe: false, pvp: true, instanced: false, levelReq: 25, spawn: [3, 30],
    portals: [{ x: 0, y: 30, to: 'amber_hills', tx: 60, ty: 10, label: { en: 'Amber Hills', th: 'เนินอำพัน' } }],
    monsters: [{ id: 'frost_pup', count: 8 }, { id: 'ice_wisp', count: 6 }, { id: 'snow_yeti', count: 3 }, { id: 'crystal_moth', count: 5 }],
    npcs: [], resources: [{ type: 'ore', count: 8 }, { type: 'tree', count: 6 }, { type: 'fish', count: 4 }], bgm: 'snow', weather: ['snow', 'snow', 'fog', 'clear'] },
  { id: 'mossy_hollow', name: { en: 'Mossy Hollow', th: 'โพรงมอส' }, biome: 'cave', w: 32, h: 32, seed: 53, safe: false, pvp: false, instanced: true, levelReq: 5, spawn: [15, 28],
    portals: [{ x: 15, y: 31, to: 'whisperwood', tx: 66, ty: 9, label: { en: 'Exit', th: 'ทางออก' } }], monsters: [], npcs: [], resources: [], bgm: 'dungeon', weather: ['clear'] },
  { id: 'sunken_crater', name: { en: 'Sunken Crater', th: 'หลุมยุบ' }, biome: 'crater', w: 40, h: 34, seed: 61, safe: false, pvp: false, instanced: false, levelReq: 15, spawn: [20, 30],
    portals: [{ x: 20, y: 33, to: 'amber_hills', tx: 4, ty: 7, label: { en: 'Amber Hills', th: 'เนินอำพัน' } }], monsters: [], npcs: [], resources: [], bgm: 'boss', weather: ['clear', 'fog'] },
  { id: 'arena', name: { en: 'Hearth Arena', th: 'สนามประลอง' }, biome: 'arena', w: 26, h: 20, seed: 71, safe: false, pvp: true, instanced: true, levelReq: 5, spawn: [6, 10],
    portals: [], monsters: [], npcs: [], resources: [], bgm: 'boss', weather: ['clear'] },
  { id: 'pet_farm', name: { en: 'Cozy Farm', th: 'ฟาร์มแสนสุข' }, biome: 'farm', w: 36, h: 28, seed: 83, safe: true, pvp: false, instanced: true, levelReq: 1, spawn: [18, 14],
    portals: [{ x: 35, y: 14, to: 'emberglen', tx: 3, ty: 22, label: { en: 'Emberglen', th: 'เอมเบอร์เกลน' } }, { x: 18, y: 1, to: 'house', tx: 10, ty: 12, label: { en: 'Your House', th: 'บ้านของคุณ' } }], monsters: [], npcs: [], resources: [{ type: 'tree', count: 3 }, { type: 'herb', count: 4 }], bgm: 'farm', weather: ['clear', 'rain', 'leaves'] },
  { id: 'coral_coast', name: { en: 'Coral Coast', th: 'ชายฝั่งปะการัง' }, biome: 'coast', w: 64, h: 50, seed: 211, safe: false, pvp: false, instanced: false, levelReq: 30, spawn: [4, 25],
    portals: [{ x: 0, y: 25, to: 'amber_hills', tx: 61, ty: 40, label: { en: 'Amber Hills', th: 'เนินอำพัน' } }, { x: 22, y: 49, to: 'starfall_ruins', tx: 30, ty: 2, label: { en: 'Starfall Ruins', th: 'ซากปรักหักพังดาวตก' } }, { x: 12, y: 0, to: 'tidal_grotto', tx: 15, ty: 28, label: { en: 'Tidal Grotto', th: 'ถ้ำน้ำขึ้น' } }],
    monsters: [{ id: 'tide_crab', count: 8 }, { id: 'coral_naga', count: 6 }, { id: 'reef_jelly', count: 6 }, { id: 'gull_raider', count: 5 }, { id: 'brine_warden', count: 1, at: [22, 45] }],
    npcs: ['captain_mara'], resources: [{ type: 'fish', count: 6 }, { type: 'ore', count: 4 }, { type: 'herb', count: 3 }], bgm: 'field', weather: ['clear', 'rain', 'fog'] },
  { id: 'starfall_ruins', name: { en: 'Starfall Ruins', th: 'ซากปรักหักพังดาวตก' }, biome: 'ruins', w: 62, h: 56, seed: 223, safe: false, pvp: false, instanced: false, levelReq: 45, spawn: [30, 3],
    portals: [{ x: 30, y: 0, to: 'coral_coast', tx: 22, ty: 47, label: { en: 'Coral Coast', th: 'ชายฝั่งปะการัง' } }, { x: 61, y: 40, to: 'emberpeak', tx: 3, ty: 28, label: { en: 'Emberpeak Caldera', th: 'ปล่องภูเขาไฟเอมเบอร์พีค' } }],
    monsters: [{ id: 'ruin_golem', count: 6 }, { id: 'star_wraith', count: 7 }, { id: 'clockwork_knight', count: 5 }, { id: 'astral_eye', count: 5 }, { id: 'ruin_sentinel', count: 1, at: [56, 40] }],
    npcs: ['scholar_ilya'], resources: [{ type: 'ore', count: 6 }, { type: 'herb', count: 4 }], bgm: 'field', weather: ['clear', 'fog', 'leaves'] },
  { id: 'emberpeak', name: { en: 'Emberpeak Caldera', th: 'ปล่องภูเขาไฟเอมเบอร์พีค' }, biome: 'volcano', w: 60, h: 56, seed: 239, safe: false, pvp: false, instanced: false, levelReq: 65, spawn: [3, 28],
    portals: [{ x: 0, y: 28, to: 'starfall_ruins', tx: 58, ty: 40, label: { en: 'Starfall Ruins', th: 'ซากปรักหักพังดาวตก' } }, { x: 59, y: 12, to: 'skyreach', tx: 3, ty: 30, label: { en: 'Skyreach Isles', th: 'หมู่เกาะเวหา' } }],
    monsters: [{ id: 'magma_hound', count: 8 }, { id: 'cinder_drake', count: 6 }, { id: 'obsidian_titan', count: 3 }, { id: 'flame_djinn', count: 5 }],
    npcs: ['smith_volka'], resources: [{ type: 'ore', count: 8 }], bgm: 'boss', weather: ['clear', 'fog'] },
  { id: 'skyreach', name: { en: 'Skyreach Isles', th: 'หมู่เกาะเวหา' }, biome: 'sky', w: 64, h: 56, seed: 271, safe: false, pvp: false, instanced: false, levelReq: 88, spawn: [3, 30],
    portals: [{ x: 0, y: 30, to: 'emberpeak', tx: 57, ty: 12, label: { en: 'Emberpeak Caldera', th: 'ปล่องภูเขาไฟเอมเบอร์พีค' } }, { x: 63, y: 20, to: 'shattered_rift', tx: 3, ty: 28, label: { en: 'Shattered Rift', th: 'รอยแยกแตกสลาย' } }],
    monsters: [{ id: 'cloud_sprite', count: 7 }, { id: 'nimbus_ram', count: 6 }, { id: 'storm_griffin', count: 6 }, { id: 'thunder_roc', count: 2 }, { id: 'sky_sentinel', count: 1, at: [60, 20] }],
    npcs: ['aeronaut_pell'], resources: [{ type: 'herb', count: 5 }, { type: 'ore', count: 4 }], bgm: 'field', weather: ['clear', 'fog', 'leaves'] },
  { id: 'shattered_rift', name: { en: 'Shattered Rift', th: 'รอยแยกแตกสลาย' }, biome: 'rift', w: 60, h: 56, seed: 283, safe: false, pvp: false, instanced: false, levelReq: 104, spawn: [3, 28],
    portals: [{ x: 0, y: 28, to: 'skyreach', tx: 61, ty: 20, label: { en: 'Skyreach Isles', th: 'หมู่เกาะเวหา' } }],
    monsters: [{ id: 'void_stalker', count: 8 }, { id: 'rift_horror', count: 6 }, { id: 'chrono_wraith', count: 5 }, { id: 'eclipse_knight', count: 4 }, { id: 'rift_colossus', count: 1, at: [50, 40] }],
    npcs: ['warden_nyx'], resources: [{ type: 'ore', count: 8 }], bgm: 'boss', weather: ['clear', 'fog'] },
  { id: 'flame_sanctum', name: { en: 'Sanctum of the First Flame', th: 'วิหารแห่งเปลวแรก' }, biome: 'volcano', w: 40, h: 36, seed: 293, safe: false, pvp: false, instanced: true, levelReq: 110, spawn: [20, 32],
    portals: [{ x: 20, y: 35, to: 'shattered_rift', tx: 5, ty: 28, label: { en: 'Exit', th: 'ทางออก' } }], monsters: [], npcs: [], resources: [], bgm: 'boss', weather: ['clear'] },
  { id: 'tidal_grotto', name: { en: 'Tidal Grotto', th: 'ถ้ำน้ำขึ้น' }, biome: 'cave', w: 32, h: 32, seed: 251, safe: false, pvp: false, instanced: true, levelReq: 35, spawn: [15, 28],
    portals: [{ x: 15, y: 31, to: 'coral_coast', tx: 12, ty: 2, label: { en: 'Exit', th: 'ทางออก' } }], monsters: [], npcs: [], resources: [], bgm: 'dungeon', weather: ['clear'] },
  { id: 'starfall_vault', name: { en: 'Starfall Vault', th: 'ห้องนิรภัยดาวตก' }, biome: 'ruins', w: 32, h: 32, seed: 263, safe: false, pvp: false, instanced: true, levelReq: 55, spawn: [15, 28],
    portals: [{ x: 15, y: 31, to: 'starfall_ruins', tx: 30, ty: 5, label: { en: 'Exit', th: 'ทางออก' } }], monsters: [], npcs: [], resources: [], bgm: 'boss', weather: ['clear'] },
  { id: 'wedding_plaza', name: { en: 'Blossom Wedding Plaza', th: 'ลานวิวาห์บุปผา' }, biome: 'plaza', w: 30, h: 24, seed: 97, safe: true, pvp: false, instanced: false, levelReq: 1, spawn: [15, 20],
    portals: [{ x: 15, y: 23, to: 'emberglen', tx: 28, ty: 41, label: { en: 'Emberglen', th: 'เอมเบอร์เกลน' } }], monsters: [], npcs: [], resources: [], bgm: 'farm', weather: ['clear', 'leaves'] },
  { id: 'house', name: { en: 'Your House', th: 'บ้านของคุณ' }, biome: 'house', w: 20, h: 15, seed: 91, safe: true, pvp: false, instanced: true, levelReq: 1, spawn: [10, 12],
    portals: [{ x: 10, y: 14, to: 'pet_farm', tx: 18, ty: 3, label: { en: 'Farm', th: 'ฟาร์ม' } }], monsters: [], npcs: [], resources: [], bgm: 'farm', weather: ['clear'] },
] as MapDef[]).map((m) => [m.id, m]));

// ---------------- NPCs (§18) ----------------
export type NpcRole = 'quest' | 'shop' | 'blacksmith' | 'enchanter' | 'healer' | 'teleport' | 'storage' | 'pet' | 'mount' | 'guild' | 'dungeon' | 'arena' | 'card' | 'crafting' | 'exchange' | 'event' | 'marriage' | 'board' | 'wedding';
export interface NpcDef { id: string; name: L10n; title: L10n; roles: NpcRole[]; map: string; x: number; y: number; palette: [string, string, string]; lines: L10n[]; shop?: string }
export const NPCS: Record<string, NpcDef> = Object.fromEntries(([
  ['elder_rowan', 'Elder Rowan', 'ผู้เฒ่าโรวัน', 'Village Elder', 'ผู้ใหญ่บ้าน', ['quest'], 'emberglen', 26, 20, ['#e0e0e0', '#6a4a8a', '#e0c060'], ['Welcome to Emberglen, traveler. The hearth-lanterns have been flickering…', 'ยินดีต้อนรับสู่เอมเบอร์เกลน นักเดินทาง โคมไฟเตาผิงเริ่มริบหรี่แล้ว…']],
  ['merchant_pip', 'Pip', 'พิพ', 'General Store', 'ร้านค้าทั่วไป', ['shop'], 'emberglen', 20, 26, ['#a05a2a', '#3a7a5a', '#f0d080'], ['Potions, tools, snacks — Pip has it all!', 'ยา เครื่องมือ ของกิน พิพมีครบ!'], 'general'],
  ['smith_brunhild', 'Brunhild', 'บรุนฮิลด์', 'Blacksmith', 'ช่างตีเหล็ก', ['blacksmith', 'shop'], 'emberglen', 34, 26, ['#c04020', '#5a5a5a', '#e08020'], ['Bring me ore and gold and I will make your steel sing.', 'เอาแร่กับทองมา แล้วข้าจะทำให้อาวุธเจ้าแกร่งขึ้น'], 'weapons'],
  ['enchanter_isolde', 'Isolde', 'อิโซลด์', 'Enchanter', 'นักเสกมนตร์', ['enchanter'], 'emberglen', 38, 20, ['#f0f0ff', '#5a3a9a', '#a080ff'], ['Gems, runes, whispers of power… sit, sit.', 'อัญมณี รูน และพลังกระซิบ… นั่งก่อนสิ'] ],
  ['healer_mae', 'Sister Mae', 'ซิสเตอร์เม', 'Healer', 'ผู้รักษา', ['healer'], 'emberglen', 22, 18, ['#f0e0b0', '#f8f4e8', '#e0b040'], ['Rest, child. Let the dawn mend you.', 'พักเถอะ ให้แสงอรุณเยียวยาเจ้า']],
  ['teleporter_quill', 'Quill', 'ควิลล์', 'Waygate Keeper', 'ผู้ดูแลประตูมิติ', ['teleport'], 'emberglen', 30, 16, ['#4080c0', '#2a3a6a', '#80e0ff'], ['Where shall the winds carry you?', 'อยากให้สายลมพาไปที่ใด?']],
  ['banker_oswin', 'Oswin', 'ออสวิน', 'Warehouse', 'คลังเก็บของ', ['storage'], 'emberglen', 18, 22, ['#606060', '#3a3a5a', '#c0c0c0'], ['Your belongings are safe with me.', 'ของของท่านปลอดภัยกับข้า']],
  ['petkeeper_luma', 'Luma', 'ลูมา', 'Pet Keeper', 'ผู้ดูแลสัตว์เลี้ยง', ['pet', 'shop'], 'emberglen', 14, 28, ['#f0a0c0', '#5a8a5a', '#ffe0a0'], ['Every critter deserves a cozy home!', 'สัตว์ทุกตัวสมควรได้บ้านแสนอบอุ่น!'], 'pets'],
  ['stablemaster_hale', 'Hale', 'เฮล', 'Stablemaster', 'ผู้ดูแลคอกม้า', ['mount', 'shop'], 'emberglen', 10, 24, ['#8a5a2a', '#6a4a2a', '#d0b070'], ['A good mount is a friend for life.', 'พาหนะดีคือเพื่อนตลอดชีวิต'], 'mounts'],
  ['guild_clerk', 'Clerk Ada', 'เสมียนเอด้า', 'Guild Registrar', 'นายทะเบียนกิลด์', ['guild'], 'emberglen', 40, 28, ['#3a2a1a', '#7a2a2a', '#e0c060'], ['Founding a guild? Sign here, and here.', 'จะตั้งกิลด์หรือ? เซ็นตรงนี้ และตรงนี้']],
  ['dungeon_warden', 'Warden Thorne', 'ผู้คุมธอร์น', 'Dungeon Warden', 'ผู้คุมดันเจี้ยน', ['dungeon'], 'emberglen', 44, 22, ['#2a2a2a', '#4a5a3a', '#a0a0a0'], ['The daily trials await the brave.', 'บททดสอบประจำวันรอผู้กล้าอยู่']],
  ['arena_master', 'Master Kaz', 'อาจารย์คาซ', 'Arena Master', 'ผู้คุมสนามประลอง', ['arena', 'shop'], 'emberglen', 46, 28, ['#c02020', '#3a3a3a', '#ffd040'], ['Test your mettle against other heroes!', 'ทดสอบฝีมือกับวีรชนคนอื่น!'], 'arena'],
  ['duelist_kit', 'Kit', 'คิท', 'Card Duelist', 'นักดวลการ์ด', ['card', 'shop'], 'emberglen', 32, 30, ['#4060c0', '#2a2a5a', '#f0f0f0'], ['Fancy a game of Hearthcards?', 'มาดวลฮาร์ธการ์ดกันไหม?'], 'cards'],
  ['crafter_juno', 'Juno', 'จูโน', 'Artisan', 'ช่างฝีมือ', ['crafting'], 'emberglen', 24, 30, ['#e0a040', '#7a5a3a', '#40a080'], ['Materials in, masterpieces out!', 'ใส่วัตถุดิบ ได้ผลงานชิ้นเอก!']],
  ['broker_vance', 'Vance', 'แวนซ์', 'Market Broker', 'นายหน้าตลาด', ['exchange'], 'emberglen', 36, 32, ['#e0e0a0', '#2a5a3a', '#ffd040'], ['The market never sleeps — and neither do I.', 'ตลาดไม่เคยหลับ ข้าก็เช่นกัน']],
  ['event_host', 'Festa', 'เฟสต้า', 'Festival Host', 'ผู้จัดเทศกาล', ['event'], 'emberglen', 28, 32, ['#ff80a0', '#ff6040', '#ffe060'], ['Festivals, prizes and daily gifts!', 'เทศกาล ของรางวัล และของขวัญรายวัน!']],
  ['officiant_sol', 'Officiant Sol', 'ผู้ประกอบพิธีโซล', 'Wedding Officiant', 'ผู้ประกอบพิธีแต่งงาน', ['marriage'], 'emberglen', 16, 16, ['#ffffff', '#f0f0f0', '#ffc0e0'], ['Two hearts, one hearth.', 'สองหัวใจ หนึ่งเตาผิง']],
  ['planner_rosa', 'Planner Rosa', 'ผู้จัดงานโรซา', 'Wedding Planner', 'ผู้จัดงานแต่งงาน', ['wedding'], 'wedding_plaza', 15, 5, ['#ffd0e0', '#ff90b0', '#fff0f0'], ['Every love story deserves a beautiful day.', 'ทุกเรื่องราวความรักควรมีวันที่งดงาม']],
  ['board_quest', 'Quest Board', 'กระดานเควสต์', 'Daily Bounties', 'ค่าหัวประจำวัน', ['board'], 'emberglen', 30, 22, ['#8a5a2a', '#8a5a2a', '#f0e0b0'], ['Notices flutter in the breeze.', 'ประกาศพลิ้วไหวตามลม']],
  ['aeronaut_pell', 'Aeronaut Pell', 'นักบินเพล', 'Sky Cartographer', 'นักทำแผนที่เวหา', ['quest'], 'skyreach', 6, 27, ['#3a6aa0', '#f0e0c0', '#a06030'], ['Mind the edges — the clouds don’t catch you twice.', 'ระวังขอบเกาะ เมฆไม่รับคุณได้สองครั้ง']],
  ['warden_nyx', 'Warden Nyx', 'ผู้คุมนิกซ์', 'Rift Warden', 'ผู้คุมรอยแยก', ['quest', 'dungeon'], 'shattered_rift', 6, 25, ['#2a1a40', '#a080ff', '#e0e0ff'], ['Beyond the rift, the First Flame still burns — and it hungers.', 'เลยรอยแยกไป เปลวแรกยังคงลุกโชน และมันหิวโหย']],
  ['captain_mara', 'Captain Mara', 'กัปตันมารา', 'Harbor Captain', 'กัปตันท่าเรือ', ['quest'], 'coral_coast', 6, 22, ['#2a4a7a', '#e0e0e0', '#c08040'], ['The tide brings treasure — and trouble.', 'น้ำขึ้นนำพาทั้งสมบัติและปัญหา']],
  ['scholar_ilya', 'Scholar Ilya', 'นักปราชญ์อิลยา', 'Ruin Scholar', 'นักปราชญ์ซากเมือง', ['quest'], 'starfall_ruins', 33, 6, ['#5a3a8a', '#e0d0a0', '#f0e0c0'], ['These stones remember the night the stars fell.', 'หินเหล่านี้จำคืนที่ดาวร่วงหล่นได้']],
  ['smith_volka', 'Volka the Forgewarden', 'โวลกาผู้พิทักษ์เตาหลอม', 'Caldera Smith', 'ช่างตีเหล็กปล่องภูเขาไฟ', ['quest', 'blacksmith'], 'emberpeak', 6, 25, ['#7a2a1a', '#3a3030', '#ffb060'], ['Only magma-tempered steel survives up here.', 'มีเพียงเหล็กที่ชุบแมกมาเท่านั้นที่อยู่รอดที่นี่']],
  ['ranger_fen', 'Ranger Fen', 'เรนเจอร์เฟน', 'Forest Ranger', 'ผู้พิทักษ์ป่า', ['quest'], 'whisperwood', 8, 20, ['#3a5a2a', '#4a7a3a', '#c0a060'], ['Watch your step — the slimes are restless.', 'ระวังตัวด้วย สไลม์ช่วงนี้กระสับกระส่าย']],
  ['miner_dorn', 'Dorn', 'ดอร์น', 'Prospector', 'นักสำรวจแร่', ['quest'], 'amber_hills', 32, 42, ['#5a3a1a', '#6a6a3a', '#e0a040'], ['These hills hide amber and danger alike.', 'เนินเขานี้ซ่อนทั้งอำพันและอันตราย']],
] as const).map(([id, en, th, ten, tth, roles, map, x, y, pal, lines, shop]) => [id, { id, name: { en, th }, title: { en: ten, th: tth }, roles: [...roles], map, x, y, palette: [...pal] as [string, string, string], lines: [{ en: lines[0], th: lines[1] }], shop } as NpcDef]));

// ---------------- Shops (§34) ----------------
export const SHOPS: Record<string, { currency: 'gold' | 'arena_token' | 'boss_coin' | 'card_dust' | 'stable_seal' | 'event_token'; items: { itemId: string; price: number; dailyLimit?: number }[] }> = {
  general: { currency: 'gold', items: ['repair_kit', 'potion_hp_s', 'potion_hp_m', 'potion_mp_s', 'potion_mp_m', 'food_stew', 'scroll_return', 'scroll_haste', 'tool_pickaxe', 'tool_axe', 'tool_rod', 'tool_sickle', 'capture_net', 'dungeon_ticket', 'cloth', 'blessing_scroll'].map((itemId) => ({ itemId, price: 0 })) },
  weapons: { currency: 'gold', items: ['wood_sword', 'wood_greatsword', 'wood_spear', 'wood_dagger', 'wood_bow', 'wood_staff', 'wood_tome', 'wood_knuckle', 'wood_gun', 'wood_lute', 'wood_cards', 'wood_whip', 'wood_body', 'wood_head', 'wood_boots', 'wood_off', 'iron_sword', 'iron_bow', 'iron_staff', 'iron_body', 'refine_ore'].map((itemId) => ({ itemId, price: 0 })) },
  stable: { currency: 'stable_seal', items: [{ itemId: 'mount_key_owl', price: 60 }, { itemId: 'mount_key_ram', price: 120 }, { itemId: 'mount_key_lizard', price: 40 }] },
  pets: { currency: 'gold', items: [{ itemId: 'food_forest', price: 0 }, { itemId: 'food_hills', price: 0 }, { itemId: 'food_snow', price: 0 }, { itemId: 'pet_food', price: 0 }, { itemId: 'pet_food_fine', price: 0 }, { itemId: 'capture_net', price: 0 }, { itemId: 'pet_egg', price: 0, dailyLimit: 3 }] },
  mounts: { currency: 'gold', items: [{ itemId: 'mount_key_pony', price: 2000 }, { itemId: 'mount_key_lizard', price: 8000 }] },
  arena: { currency: 'arena_token', items: [{ itemId: 'potion_hp_m', price: 2 }, { itemId: 'enchant_stone', price: 10 }, { itemId: 'amber_dagger', price: 40 }, { itemId: 'mount_key_owl', price: 120 }, { itemId: 'ward_scroll', price: 60 }] },
  seasonal: { currency: 'event_token', items: [{ itemId: 'deco_lantern', price: 20 }, { itemId: 'blessing_scroll', price: 60 }, { itemId: 'gacha_ticket', price: 80 }, { itemId: 'costume_festival', price: 200 }, { itemId: 'wings_fairy', price: 400 }] },
  boss: { currency: 'boss_coin', items: [{ itemId: 'refine_ore_hi', price: 5 }, { itemId: 'gacha_ticket', price: 20 }, { itemId: 'mount_key_ram', price: 150 }, { itemId: 'wings_ember', price: 200 }] },
  cards: { currency: 'gold', items: [{ itemId: 'card_pack', price: 0 }] },
};

// ---------------- Quests (§18) ----------------
export type Objective = { kind: 'kill'; target: string; count: number } | { kind: 'dungeon'; count: number; id?: string } | { kind: 'collect'; item: string; count: number } | { kind: 'talk'; npc: string } | { kind: 'visit'; map: string }
  | { kind: 'gather'; node: 'ore' | 'tree' | 'herb' | 'fish'; count: number } | { kind: 'craft'; count: number } | { kind: 'refine'; count: number } | { kind: 'capture'; count: number }
  | { kind: 'dungeon'; count: number } | { kind: 'boss'; count: number } | { kind: 'pvp_win'; count: number } | { kind: 'card_win'; count: number } | { kind: 'level'; level: number } | { kind: 'equip'; count: number } | { kind: 'hatch'; count: number };
export interface QuestDef { id: string; type: 'main' | 'side' | 'daily' | 'weekly' | 'class' | 'ascension' | 'tutorial'; name: L10n; desc: L10n; giver: string; reqLevel: number; prereq?: string; objectives: Objective[]; rewards: { exp: number; gold: number; items?: { itemId: string; qty: number }[]; choice?: string[] } }
const q = (id: string, type: QuestDef['type'], en: string, th: string, giver: string, reqLevel: number, objectives: Objective[], exp: number, gold: number, items?: { itemId: string; qty: number }[], prereq?: string, de?: string, dth?: string, choice?: string[]): QuestDef =>
  ({ id, type, name: { en, th }, desc: { en: de ?? en, th: dth ?? th }, giver, reqLevel, objectives, rewards: { exp, gold, items, choice }, prereq });
export const QUESTS: Record<string, QuestDef> = Object.fromEntries([
  q('mq01', 'tutorial', 'A Flickering Hearth', 'เตาผิงที่ริบหรี่', 'elder_rowan', 1, [{ kind: 'talk', npc: 'merchant_pip' }], 120, 50, [{ itemId: 'potion_hp_s', qty: 5 }], undefined, 'Introduce yourself to Pip at the general store.', 'ไปทักทายพิพที่ร้านค้าทั่วไป'),
  q('mq02', 'main', 'Slime Trouble', 'ปัญหาสไลม์', 'elder_rowan', 1, [{ kind: 'kill', target: 'forest_slime', count: 5 }], 300, 120, [{ itemId: 'wood_body', qty: 1 }], 'mq01', 'Defeat 5 Moss Slimes in Whisperwood (east gate).', 'กำจัดสไลม์มอส 5 ตัวในป่ากระซิบ (ประตูตะวันออก)'),
  q('mq03', 'main', 'Gear Up', 'เตรียมอุปกรณ์', 'elder_rowan', 2, [{ kind: 'equip', count: 1 }], 200, 80, [{ itemId: 'refine_ore', qty: 3 }], 'mq02', 'Equip any piece of gear from your bag (I → double-click).', 'สวมใส่อุปกรณ์ชิ้นใดก็ได้จากกระเป๋า'),
  q('mq04', 'main', 'Steel that Sings', 'เหล็กที่ขับขาน', 'smith_brunhild', 3, [{ kind: 'refine', count: 1 }], 350, 150, [{ itemId: 'gem_ruby_1', qty: 1 }], 'mq03', 'Refine any equipment once at Brunhild.', 'ตีบวกอุปกรณ์ 1 ครั้งที่บรุนฮิลด์'),
  q('mq05', 'main', 'A Furry Friend', 'เพื่อนขนปุย', 'petkeeper_luma', 4, [{ kind: 'capture', count: 1 }], 400, 150, [{ itemId: 'pet_food', qty: 20 }], 'mq04', 'Capture a weakened critter with a Silk Net (or hatch an egg).', 'จับสัตว์ที่อ่อนแรงด้วยตาข่ายไหม (หรือฟักไข่)'),
  q('mq06', 'main', 'Into the Hollow', 'สู่โพรงมอส', 'dungeon_warden', 5, [{ kind: 'dungeon', count: 1 }], 1200, 400, [{ itemId: 'skill_stone', qty: 1 }], 'mq05', 'Clear Mossy Hollow, deep in Whisperwood.', 'พิชิตโพรงมอส ลึกเข้าไปในป่ากระซิบ'),
  q('mq07', 'main', 'The Amber Road', 'ถนนอำพัน', 'elder_rowan', 10, [{ kind: 'visit', map: 'amber_hills' }, { kind: 'talk', npc: 'miner_dorn' }], 900, 300, undefined, 'mq06', 'Travel north to Amber Hills and meet Dorn.', 'เดินทางขึ้นเหนือไปเนินอำพันพบดอร์น'),
  q('mq08', 'main', 'Golem Hearts', 'หัวใจโกเลม', 'miner_dorn', 12, [{ kind: 'kill', target: 'amber_golem', count: 3 }], 2500, 700, [{ itemId: 'amber_ring1', qty: 1 }], 'mq07'),
  q('mq09', 'main', 'Crater of Titans', 'หลุมแห่งไททัน', 'miner_dorn', 15, [{ kind: 'boss', count: 1 }], 6000, 2000, [{ itemId: 'gacha_ticket', qty: 3 }], 'mq08', 'Participate in a World Boss battle at Sunken Crater.', 'ร่วมต่อสู้บอสโลกที่หลุมยุบ'),
  q('mq11', 'main', 'Salt on the Wind', 'กลิ่นเกลือในสายลม', 'elder_rowan', 30, [{ kind: 'visit', map: 'coral_coast' }, { kind: 'talk', npc: 'captain_mara' }], 15000, 3000, [{ itemId: 'potion_hp_m', qty: 10 }], 'mq09', 'Rumours of a sea beast: travel east from Amber Hills to Coral Coast and find Captain Mara.', 'ข่าวลือเรื่องสัตว์ทะเล: เดินทางไปทางตะวันออกของเนินอำพันสู่ชายฝั่งปะการังและพบกัปตันมารา'),
  q('mq12', 'main', 'Scales in the Surf', 'เกล็ดในคลื่น', 'captain_mara', 34, [{ kind: 'kill', target: 'coral_naga', count: 10 }], 26000, 4000, [{ itemId: 'refine_ore', qty: 5 }], 'mq11', 'The naga are raiding the docks. Drive back 10 Coral Naga.', 'นาคบุกท่าเรือ ขับไล่นาคปะการัง 10 ตัว'),
  q('mq13', 'main', 'Into the Tidal Grotto', 'สู่ถ้ำน้ำขึ้น', 'captain_mara', 38, [{ kind: 'dungeon', count: 1 }], 40000, 6000, [{ itemId: 'gacha_ticket', qty: 2 }], 'mq12', 'Clear a dungeon — the Abyssal Kraken waits in the Tidal Grotto (north of the coast).', 'เคลียร์ดันเจียน — คราเคนห้วงลึกรออยู่ในถ้ำน้ำขึ้น (ทางเหนือของชายฝั่ง)'),
  q('mq14', 'main', 'Where the Stars Fell', 'ที่ซึ่งดวงดาวร่วงหล่น', 'captain_mara', 45, [{ kind: 'visit', map: 'starfall_ruins' }, { kind: 'talk', npc: 'scholar_ilya' }], 52000, 7000, undefined, 'mq13', 'The Kraken guarded a star-map. Follow it south to the Starfall Ruins and meet Scholar Ilya.', 'คราเคนเฝ้าแผนที่ดาว ตามไปทางใต้สู่ซากปรักหักพังดาวตกและพบนักปราชญ์อิลยา'),
  q('mq15', 'main', 'Fragments of Night', 'เศษเสี้ยวแห่งรัตติกาล', 'scholar_ilya', 50, [{ kind: 'collect', item: 'star_fragment', count: 8 }], 70000, 9000, [{ itemId: 'refine_ore_hi', qty: 2 }], 'mq14', 'Bring 8 Star Fragments so Ilya can read the vault seal.', 'นำเศษดาว 8 ชิ้นมาให้อิลยาอ่านตราผนึกห้องนิรภัย'),
  q('mq16', 'main', 'The Sentinel’s Key', 'กุญแจของทหารยาม', 'scholar_ilya', 56, [{ kind: 'kill', target: 'ruin_sentinel', count: 1 }], 95000, 12000, [{ itemId: 'skill_stone', qty: 2 }], 'mq15', 'Defeat the Ruin Sentinel at the eastern gate to claim its key.', 'ปราบทหารยามซากเมืองที่ประตูตะวันออกเพื่อชิงกุญแจ'),
  q('mq17', 'main', 'The Burning Road', 'เส้นทางเพลิง', 'scholar_ilya', 65, [{ kind: 'visit', map: 'emberpeak' }, { kind: 'talk', npc: 'smith_volka' }], 140000, 15000, undefined, 'mq16', 'The key points to Emberpeak Caldera. Find Volka the Forgewarden.', 'กุญแจชี้ไปยังปล่องภูเขาไฟเอมเบอร์พีค ตามหาโวลกาผู้พิทักษ์เตาหลอม'),
  q('mq18', 'main', 'Heart of Obsidian', 'หัวใจออบซิเดียน', 'smith_volka', 75, [{ kind: 'kill', target: 'obsidian_titan', count: 3 }, { kind: 'collect', item: 'magma_core', count: 5 }], 260000, 25000, [{ itemId: 'refine_ore_hi', qty: 5 }, { itemId: 'gacha_ticket', qty: 3 }], 'mq17', 'Break 3 Obsidian Titans and bring 5 Magma Cores to temper the First Flame’s blade.', 'ทลายไททันออบซิเดียน 3 ตัวและนำแกนแมกมา 5 ชิ้นมาหลอมดาบแห่งเปลวแรก'),
  q('mq19', 'main', 'Above the Ash', 'เหนือเถ้าถ่าน', 'smith_volka', 88, [{ kind: 'visit', map: 'skyreach' }, { kind: 'talk', npc: 'aeronaut_pell' }], 420000, 30000, [{ itemId: 'potion_hp_m', qty: 20 }], 'mq18', 'The blade’s glow points to the sky. Climb past the caldera to the Skyreach Isles and find Aeronaut Pell.', 'แสงของดาบชี้ขึ้นฟ้า ปีนผ่านปล่องภูเขาไฟไปยังหมู่เกาะเวหาและพบนักบินเพล'),
  q('mq20', 'main', 'Wings of the Storm', 'ปีกแห่งพายุ', 'aeronaut_pell', 94, [{ kind: 'kill', target: 'storm_griffin', count: 10 }], 560000, 36000, [{ itemId: 'refine_ore_hi', qty: 5 }], 'mq19', 'Storm Griffins tear Pell’s maps. Ground 10 of them.', 'กริฟฟินพายุฉีกแผนที่ของเพล ปราบ 10 ตัว'),
  q('mq21', 'main', 'The Sentinel of Clouds', 'ผู้เฝ้าเมฆ', 'aeronaut_pell', 100, [{ kind: 'kill', target: 'sky_sentinel', count: 1 }, { kind: 'collect', item: 'sky_feather', count: 6 }], 760000, 45000, [{ itemId: 'blessing_scroll', qty: 2 }], 'mq20', 'Defeat the Sky Sentinel at the eastern bridge and gather 6 Skyreach Feathers for the crossing.', 'ปราบผู้เฝ้าเวหาที่สะพานตะวันออกและรวบรวมขนนกเวหา 6 ชิ้นเพื่อข้ามไป'),
  q('mq22', 'main', 'Where the World Breaks', 'ที่ซึ่งโลกแตกร้าว', 'aeronaut_pell', 104, [{ kind: 'visit', map: 'shattered_rift' }, { kind: 'talk', npc: 'warden_nyx' }], 900000, 50000, undefined, 'mq21', 'Cross into the Shattered Rift and meet Warden Nyx.', 'ข้ามไปยังรอยแยกแตกสลายและพบผู้คุมนิกซ์'),
  q('mq23', 'main', 'Eclipse Vanguard', 'ทัพหน้าสุริยุปราคา', 'warden_nyx', 110, [{ kind: 'kill', target: 'eclipse_knight', count: 6 }, { kind: 'collect', item: 'void_essence', count: 8 }], 1200000, 65000, [{ itemId: 'gacha_ticket', qty: 5 }], 'mq22', 'Break the Eclipse Knights and collect 8 Void Essences to open the Sanctum.', 'ทลายอัศวินสุริยุปราคาและเก็บแก่นความว่างเปล่า 8 ชิ้นเพื่อเปิดวิหาร'),
  q('mq24', 'main', 'The First Flame', 'เปลวแรก', 'warden_nyx', 115, [{ kind: 'dungeon', count: 1, id: 'flame_sanctum' }], 2500000, 120000, [{ itemId: 'flame_relic', qty: 1 }], 'mq23', 'Gather a raid group (up to 8) and defeat the First Flame Tyrant in its Sanctum.', 'รวมทีมเรด (สูงสุด 8 คน) และปราบทรราชเปลวแรกในวิหาร'),
  q('mq10', 'ascension', 'Trial of the First Flame', 'บททดสอบเปลวแรก', 'elder_rowan', 60, [{ kind: 'level', level: 60 }, { kind: 'collect', item: 'boss_heart', count: 3 }], 50000, 10000, undefined, 'mq09', 'Ascension I: reach level 60 and bring 3 Guardian Hearts.', 'อัสเซนชัน 1: ถึงเลเวล 60 และนำหัวใจผู้พิทักษ์ 3 ชิ้น'),
  q('sq01', 'side', 'Bunny Fluff', 'ขนกระต่าย', 'ranger_fen', 2, [{ kind: 'collect', item: 'soft_fur', count: 5 }], 220, 90, [{ itemId: 'food_stew', qty: 3 }]),
  q('sq02', 'side', 'Mushroom Supper', 'มื้อเห็ด', 'ranger_fen', 4, [{ kind: 'kill', target: 'cap_shroom', count: 6 }], 380, 140, [{ itemId: 'wood_boots', qty: 1 }]),
  q('sq03', 'side', 'Timber!', 'ตัดไม้!', 'crafter_juno', 2, [{ kind: 'gather', node: 'tree', count: 4 }], 250, 100, [{ itemId: 'tool_pickaxe', qty: 1 }]),
  q('sq04', 'side', 'First Craft', 'งานฝีมือแรก', 'crafter_juno', 3, [{ kind: 'craft', count: 1 }], 300, 120, [{ itemId: 'cloth', qty: 5 }]),
  q('sq05', 'side', 'Gone Fishing', 'ไปตกปลา', 'merchant_pip', 3, [{ kind: 'gather', node: 'fish', count: 3 }], 260, 110, [{ itemId: 'tool_rod', qty: 1 }]),
  q('sq06', 'side', 'Card Shark', 'เซียนการ์ด', 'duelist_kit', 3, [{ kind: 'card_win', count: 1 }], 400, 200, [{ itemId: 'card_pack', qty: 2 }]),
  q('sq07', 'side', 'Prove Yourself', 'พิสูจน์ตัวเอง', 'arena_master', 5, [{ kind: 'pvp_win', count: 1 }], 600, 250, [{ itemId: 'potion_hp_m', qty: 5 }]),
  q('sq08', 'side', 'Egg Sitter', 'คนเฝ้าไข่', 'petkeeper_luma', 3, [{ kind: 'hatch', count: 1 }], 350, 100, [{ itemId: 'pet_food_fine', qty: 5 }]),
  q('sq09', 'side', 'Bat Problem', 'ปัญหาค้างคาว', 'ranger_fen', 6, [{ kind: 'kill', target: 'dusk_bat', count: 5 }], 520, 180, undefined, undefined, undefined, undefined, ['iron_dagger', 'iron_staff', 'iron_bow']),
  q('sq11', 'side', 'Pinch Patrol', 'ลาดตระเวนก้ามปู', 'captain_mara', 32, [{ kind: 'kill', target: 'tide_crab', count: 12 }], 18000, 2500, [{ itemId: 'potion_hp_m', qty: 5 }]),
  q('sq12', 'side', 'Pearls for the Harbor', 'ไข่มุกเพื่อท่าเรือ', 'captain_mara', 38, [{ kind: 'collect', item: 'brine_pearl', count: 3 }], 30000, 4000, [{ itemId: 'gem_aquamarine_2', qty: 1 }]),
  q('sq13', 'side', 'Quiet the Wraiths', 'สงบวิญญาณ', 'scholar_ilya', 50, [{ kind: 'kill', target: 'star_wraith', count: 10 }], 60000, 7000, [{ itemId: 'star_dust', qty: 3 }]),
  q('sq14', 'side', 'Gears and Grudges', 'เฟืองกับความแค้น', 'scholar_ilya', 56, [{ kind: 'kill', target: 'clockwork_knight', count: 6 }], 80000, 9000, [{ itemId: 'enchant_stone', qty: 2 }]),
  q('sq15', 'side', 'Hounds at the Forge', 'หมาไฟหน้าเตาหลอม', 'smith_volka', 68, [{ kind: 'kill', target: 'magma_hound', count: 12 }], 160000, 16000, [{ itemId: 'refine_ore_hi', qty: 2 }]),
  q('sq16', 'side', 'Fuel for the Furnace', 'เชื้อเพลิงเตาหลอม', 'smith_volka', 78, [{ kind: 'collect', item: 'magma_core', count: 10 }], 240000, 22000, [{ itemId: 'blessing_scroll', qty: 1 }]),
  q('sq17', 'side', 'Ram Roundup', 'ต้อนแกะเมฆ', 'aeronaut_pell', 92, [{ kind: 'kill', target: 'nimbus_ram', count: 10 }], 480000, 30000, [{ itemId: 'sky_feather', qty: 2 }]),
  q('sq18', 'side', 'Lightning in a Bottle', 'สายฟ้าในขวด', 'aeronaut_pell', 100, [{ kind: 'kill', target: 'thunder_roc', count: 2 }], 700000, 42000, [{ itemId: 'enchant_stone', qty: 3 }]),
  q('sq19', 'side', 'Stalkers in the Dark', 'นักล่าในความมืด', 'warden_nyx', 106, [{ kind: 'kill', target: 'void_stalker', count: 12 }], 950000, 52000, [{ itemId: 'void_essence', qty: 2 }]),
  q('sq20', 'side', 'Borrowed Time', 'เวลาที่ยืมมา', 'warden_nyx', 114, [{ kind: 'kill', target: 'chrono_wraith', count: 8 }], 1300000, 70000, [{ itemId: 'blessing_scroll', qty: 2 }]),
  q('sq10', 'side', 'Frozen Fangs', 'เขี้ยวเยือกแข็ง', 'miner_dorn', 25, [{ kind: 'kill', target: 'frost_pup', count: 8 }], 9000, 1500, [{ itemId: 'frost_ring1', qty: 1 }]),
  q('dq01', 'daily', 'Daily: Pest Control', 'รายวัน: กำจัดศัตรูพืช', 'board_quest', 1, [{ kind: 'kill', target: 'any', count: 15 }], 500, 300, [{ itemId: 'dungeon_ticket', qty: 1 }]),
  q('dq02', 'daily', 'Daily: Gatherer', 'รายวัน: นักเก็บของ', 'board_quest', 1, [{ kind: 'gather', node: 'herb', count: 3 }], 400, 250, [{ itemId: 'pet_food', qty: 10 }]),
  q('wq01', 'weekly', 'Weekly: Hollow Delver', 'รายสัปดาห์: นักสำรวจโพรง', 'board_quest', 5, [{ kind: 'dungeon', count: 3 }], 4000, 2000, [{ itemId: 'gacha_ticket', qty: 2 }]),
].map((x) => [x.id, x]));

// ---------------- Recipes (§32) ----------------
export type Profession = 'blacksmithing' | 'alchemy' | 'cooking' | 'tailoring' | 'jewelcrafting' | 'woodworking' | 'engineering' | 'enchanting' | 'runecrafting';
export interface RecipeDef { id: string; profession: Profession; level: number; inputs: { itemId: string; qty: number }[]; gold: number; output: { itemId: string; qty: number }; timeMs: number; success: number; exp: number }
const r = (id: string, profession: Profession, level: number, inputs: [string, number][], gold: number, out: [string, number], success = 1, timeMs = 1500): RecipeDef => ({ id, profession, level, inputs: inputs.map(([itemId, qty]) => ({ itemId, qty })), gold, output: { itemId: out[0], qty: out[1] }, timeMs, success, exp: 20 + level * 8 });
export const RECIPES: Record<string, RecipeDef> = Object.fromEntries([
  r('rc_potion', 'alchemy', 1, [['herb_green', 2], ['slime_gel', 1]], 5, ['potion_hp_s', 3]),
  r('rc_mpotion', 'alchemy', 1, [['herb_blue', 2], ['berry', 1]], 5, ['potion_mp_s', 3]),
  r('rc_potion_m', 'alchemy', 5, [['herb_gold', 1], ['potion_hp_s', 3]], 30, ['potion_hp_m', 2]),
  r('rc_stew', 'cooking', 1, [['fish_carp', 1], ['wheat', 1]], 5, ['food_stew', 2]),
  r('rc_pie', 'cooking', 3, [['berry', 3], ['wheat', 2]], 15, ['food_pie', 1]),
  r('rc_soup', 'cooking', 4, [['fish_trout', 1], ['frost_shard', 1]], 20, ['food_soup', 1]),
  r('rc_iron_sword', 'blacksmithing', 1, [['iron_ore', 5], ['oak_log', 2]], 200, ['iron_sword', 1], 0.9),
  r('rc_iron_body', 'blacksmithing', 2, [['iron_ore', 6], ['beetle_shell', 3]], 250, ['iron_body', 1], 0.9),
  r('rc_refine_ore', 'blacksmithing', 1, [['copper_ore', 3], ['iron_ore', 1]], 30, ['refine_ore', 1]),
  r('rc_cloth', 'tailoring', 1, [['soft_fur', 3]], 5, ['cloth', 2]),
  r('rc_iron_boots', 'tailoring', 2, [['cloth', 4], ['soft_fur', 4]], 120, ['iron_boots', 1], 0.9),
  r('rc_ring', 'jewelcrafting', 2, [['silver_ore', 3], ['gem_dust', 2]], 300, ['amber_ring1', 1], 0.8),
  r('rc_gem_ruby', 'jewelcrafting', 1, [['ember_core', 2], ['gem_dust', 3]], 100, ['gem_ruby_1', 1], 0.85),
  r('rc_bow', 'woodworking', 1, [['oak_log', 6], ['soft_fur', 2]], 150, ['iron_bow', 1], 0.9),
  r('rc_staff', 'woodworking', 2, [['pine_log', 4], ['wisp_dust', 2]], 150, ['iron_staff', 1], 0.9),
  r('rc_gun', 'engineering', 2, [['iron_ore', 4], ['ember_core', 1], ['pine_log', 2]], 220, ['iron_gun', 1], 0.85),
  r('rc_enchant', 'enchanting', 1, [['wisp_dust', 2], ['stone_dust', 3]], 60, ['enchant_stone', 1]),
  r('rc_skillstone', 'runecrafting', 2, [['stone_dust', 10], ['star_dust', 2]], 300, ['skill_stone', 1], 0.8),
  r('rc_food_forest', 'cooking', 2, [['berry', 2], ['herb_green', 1]], 10, ['food_forest', 3]),
  r('rc_food_hills', 'cooking', 2, [['soft_fur', 1], ['wheat', 2]], 10, ['food_hills', 3]),
  r('rc_food_snow', 'cooking', 3, [['fish_trout', 1], ['frost_shard', 1]], 15, ['food_snow', 3]),
  r('rc_rune_fang', 'runecrafting', 2, [['wolf_fang', 4], ['star_dust', 1]], 400, ['rune_fang', 1], 0.8),
  r('rc_rune_shell', 'runecrafting', 2, [['beetle_shell', 4], ['star_dust', 1]], 400, ['rune_shell', 1], 0.8),
  r('rc_rune_wind', 'runecrafting', 2, [['bat_wing', 4], ['star_dust', 1]], 400, ['rune_wind', 1], 0.8),
  r('rc_lantern', 'woodworking', 1, [['cloth', 2], ['oak_log', 1]], 40, ['deco_lantern', 1]),
].map((x) => [x.id, x]));

// ---------------- Pets (§25) ----------------
export interface PetSpecies { id: string; name: L10n; rarity: Rarity; element: Element; role: 'tank' | 'dps' | 'healer' | 'support' | 'farming' | 'utility'; sprite: string; color: string; base: { hp: number; atk: number }; growth: number; skill: { name: L10n; power: number; cdMs: number; heal?: boolean; buff?: string }; ownerBonus: Omit<Modifier, 'source'>[]; evolvesTo?: string }
const pet = (id: string, en: string, th: string, rarity: Rarity, el: Element, role: PetSpecies['role'], sprite: string, color: string, hp: number, atk: number, skill: PetSpecies['skill'], ownerBonus: Omit<Modifier, 'source'>[], evolvesTo?: string): PetSpecies => ({ id, name: { en, th }, rarity, element: el, role, sprite, color, base: { hp, atk }, growth: 1 + ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarity) * 0.15, skill, ownerBonus, evolvesTo });
export const PETS: Record<string, PetSpecies> = Object.fromEntries([
  pet('pet_slime', 'Mossy', 'มอสซี่', 'common', 'earth', 'tank', 'slime', '#6fcf5a', 200, 10, { name: { en: 'Gel Guard', th: 'เจลคุ้มกัน' }, power: 0.8, cdMs: 8000, buff: 'def_up' }, [{ stat: 'maxHp', kind: 'pct', value: 3 }], 'pet_slime_king'),
  pet('pet_slime_king', 'Moss Monarch', 'ราชามอส', 'rare', 'earth', 'tank', 'slime', '#3aa03a', 400, 18, { name: { en: 'Royal Gel', th: 'เจลราชา' }, power: 1.2, cdMs: 7000, buff: 'def_up' }, [{ stat: 'maxHp', kind: 'pct', value: 7 }]),
  pet('pet_bunny', 'Puff', 'พัฟ', 'common', 'wind', 'farming', 'bunny', '#f0e8e0', 140, 8, { name: { en: 'Lucky Hop', th: 'กระโดดโชคดี' }, power: 0.6, cdMs: 6000 }, [{ stat: 'dropBonus', kind: 'flat', value: 3 }]),
  pet('pet_bat', 'Echo', 'เอคโค่', 'uncommon', 'dark', 'dps', 'bat', '#5a4870', 150, 16, { name: { en: 'Sonic Bite', th: 'กัดคลื่นเสียง' }, power: 1.4, cdMs: 5000 }, [{ stat: 'lifesteal', kind: 'flat', value: 2 }]),
  pet('pet_wolf', 'Thistle', 'ทิสเซิล', 'uncommon', 'earth', 'dps', 'wolf', '#8a7a6a', 220, 20, { name: { en: 'Pounce', th: 'ตะครุบ' }, power: 1.6, cdMs: 6000 }, [{ stat: 'atk', kind: 'pct', value: 4 }]),
  pet('pet_ember', 'Cinder', 'ซินเดอร์', 'rare', 'fire', 'dps', 'wisp', '#ff7a30', 160, 26, { name: { en: 'Flicker', th: 'ไฟวูบ' }, power: 1.8, cdMs: 5000 }, [{ stat: 'matk', kind: 'pct', value: 5 }]),
  pet('pet_boar', 'Truffle', 'ทรัฟเฟิล', 'uncommon', 'neutral', 'tank', 'boar', '#7a5030', 300, 14, { name: { en: 'Tusk Wall', th: 'กำแพงงา' }, power: 1, cdMs: 9000, buff: 'def_up' }, [{ stat: 'def', kind: 'pct', value: 5 }]),
  pet('pet_hawk', 'Skye', 'สกาย', 'rare', 'wind', 'support', 'bird', '#c0d0e0', 170, 18, { name: { en: 'Tailwind', th: 'ลมส่ง' }, power: 0, cdMs: 15000, buff: 'haste' }, [{ stat: 'moveSpeed', kind: 'pct', value: 5 }]),
  pet('pet_frostpup', 'Flurry', 'เฟลอร์รี่', 'rare', 'ice', 'dps', 'wolf', '#d8f0ff', 210, 24, { name: { en: 'Frost Nip', th: 'กัดเยือก' }, power: 1.7, cdMs: 6000 }, [{ stat: 'crit', kind: 'flat', value: 2 }]),
  pet('pet_ghost', 'Wisp', 'วิสป์', 'epic', 'spirit', 'healer', 'ghost', '#e0f0ff', 180, 14, { name: { en: 'Soothing Glow', th: 'แสงปลอบโยน' }, power: 1.2, cdMs: 7000, heal: true }, [{ stat: 'hpRegen', kind: 'pct', value: 30 }]),
  pet('pet_crab', 'Pebble', 'เพบเบิล', 'common', 'water', 'utility', 'crab', '#e07050', 190, 10, { name: { en: 'Pinch', th: 'หนีบ' }, power: 1, cdMs: 5000 }, [{ stat: 'goldBonus', kind: 'flat', value: 4 }]),
  pet('pet_phoenix', 'Ashwing', 'แอชวิง', 'legendary', 'fire', 'support', 'bird', '#ff6020', 260, 30, { name: { en: 'Rebirth Flame', th: 'เปลวไฟเกิดใหม่' }, power: 1.5, cdMs: 10000, heal: true }, [{ stat: 'atk', kind: 'pct', value: 6 }, { stat: 'matk', kind: 'pct', value: 6 }]),
].map((x) => [x.id, x]));
export const EGG_POOL: { id: string; weight: number }[] = [{ id: 'pet_slime', weight: 25 }, { id: 'pet_bunny', weight: 25 }, { id: 'pet_crab', weight: 15 }, { id: 'pet_bat', weight: 10 }, { id: 'pet_wolf', weight: 9 }, { id: 'pet_boar', weight: 6 }, { id: 'pet_ember', weight: 4 }, { id: 'pet_hawk', weight: 3 }, { id: 'pet_frostpup', weight: 1.5 }, { id: 'pet_ghost', weight: 1 }, { id: 'pet_phoenix', weight: 0.5 }];

// ---------------- Mounts (§27) ----------------
export interface MountDef { id: string; name: L10n; speed: number; rarity: Rarity; color: string; sprite: 'pony' | 'owl' | 'lizard' | 'ram'; bonus: Omit<Modifier, 'source'>[]; key: string }
export const MOUNTS: Record<string, MountDef> = {
  pony: { id: 'pony', name: { en: 'Meadow Pony', th: 'ม้าทุ่งหญ้า' }, speed: 40, rarity: 'uncommon', color: '#c09060', sprite: 'pony', bonus: [{ stat: 'maxHp', kind: 'pct', value: 2 }], key: 'mount_key_pony' },
  owl: { id: 'owl', name: { en: 'Night Owl', th: 'นกฮูกราตรี' }, speed: 55, rarity: 'rare', color: '#806040', sprite: 'owl', bonus: [{ stat: 'eva', kind: 'pct', value: 4 }], key: 'mount_key_owl' },
  lizard: { id: 'lizard', name: { en: 'Sand Strider', th: 'กิ้งก่าทราย' }, speed: 60, rarity: 'rare', color: '#60a060', sprite: 'lizard', bonus: [{ stat: 'def', kind: 'pct', value: 3 }], key: 'mount_key_lizard' },
  ram: { id: 'ram', name: { en: 'Frost Ram', th: 'แกะหิมะ' }, speed: 70, rarity: 'epic', color: '#e0e8ff', sprite: 'ram', bonus: [{ stat: 'maxHp', kind: 'pct', value: 5 }, { stat: 'atk', kind: 'pct', value: 2 }], key: 'mount_key_ram' },
};

// ---------------- Monster cards (§24) — one per monster, separate from TCG ----------------
export interface MonsterCardDef { id: string; monster: string; name: L10n; rarity: Rarity; slot: 'weapon' | 'armor' | 'accessory'; mods: Omit<Modifier, 'source'>[]; dropChance: number }
const CARD_STATS: [Modifier['stat'], number, MonsterCardDef['slot']][] = [['atk', 6, 'weapon'], ['maxHp', 80, 'armor'], ['crit', 2, 'accessory'], ['def', 6, 'armor'], ['matk', 6, 'weapon'], ['eva', 6, 'accessory'], ['acc', 8, 'weapon'], ['mdef', 6, 'armor'], ['dropBonus', 3, 'accessory'], ['lifesteal', 1, 'weapon']];
export const MONSTER_CARDS: Record<string, MonsterCardDef> = Object.fromEntries(Object.values(MONSTERS).map((m, i) => {
  const [stat, v, slot] = CARD_STATS[i % CARD_STATS.length]!;
  const mult = m.rank === 'world_boss' ? 4 : m.rank === 'boss' ? 3 : m.rank === 'elite' || m.rank === 'rare' ? 2 : 1;
  return [`mc_${m.id}`, { id: `mc_${m.id}`, monster: m.id, name: { en: `${m.name.en} Card`, th: `การ์ด${m.name.th}` }, rarity: (['common', 'rare', 'epic', 'legendary'] as Rarity[])[mult - 1]!, slot, mods: [{ stat, kind: 'flat', value: v * mult }], dropChance: m.rank === 'normal' ? 0.01 : 0.05 }];
}));
export const CARD_SET_BONUS = [{ count: 5, mods: [{ stat: 'maxHp' as const, kind: 'pct' as const, value: 2 }] }, { count: 10, mods: [{ stat: 'atk' as const, kind: 'pct' as const, value: 3 }, { stat: 'matk' as const, kind: 'pct' as const, value: 3 }] }, { count: 20, mods: [{ stat: 'crit' as const, kind: 'flat' as const, value: 3 }] }];

// ---------------- Dungeons (§28) ----------------
export interface DungeonDef { raid?: { maxPlayers: number; hpPerExtra: number; enrageMs: number }; id: string; name: L10n; type: 'story' | 'daily' | 'raid'; map: string; levelReq: number; waves: { monster: string; count: number }[][]; boss: string; dailyLimit: number; reward: { exp: number; gold: number; items: { itemId: string; qty: number }[] } }
const DAILY_TYPES: [string, string, string, string, string][] = [['gem', 'Gem Dungeon', 'ดันเจี้ยนอัญมณี', 'gem_dust', 'cave_spider'], ['mine', 'Refinement Mine', 'เหมืองตีบวก', 'refine_ore', 'shell_beetle'], ['pet', 'Pet Dungeon', 'ดันเจี้ยนสัตว์เลี้ยง', 'pet_food_fine', 'puff_bunny'], ['exp', 'EXP Dungeon', 'ดันเจี้ยนประสบการณ์', 'exp_tome', 'forest_slime'], ['stone', 'Skill Stone Dungeon', 'ดันเจี้ยนศิลาสกิล', 'stone_dust', 'moss_golem']];
export const DUNGEONS: Record<string, DungeonDef> = Object.fromEntries([
  { id: 'flame_sanctum', name: { en: 'Sanctum of the First Flame (Raid)', th: 'วิหารแห่งเปลวแรก (เรด)' }, type: 'raid', raid: { maxPlayers: 8, hpPerExtra: 0.6, enrageMs: 8 * 60_000 }, map: 'flame_sanctum', levelReq: 110, waves: [[{ monster: 'eclipse_knight', count: 4 }, { monster: 'chrono_wraith', count: 3 }, { monster: 'rift_colossus', count: 1 }]], boss: 'first_flame_tyrant', dailyLimit: 3, reward: { exp: 2000000, gold: 100000, items: [{ itemId: 'flame_relic', qty: 1 }, { itemId: 'refine_ore_hi', qty: 6 }] } } as DungeonDef,
  { id: 'tidal_grotto', name: { en: 'Tidal Grotto', th: 'ถ้ำน้ำขึ้น' }, type: 'story', map: 'tidal_grotto', levelReq: 35, waves: [[{ monster: 'tide_crab', count: 5 }, { monster: 'reef_jelly', count: 3 }], [{ monster: 'coral_naga', count: 5 }, { monster: 'brine_warden', count: 1 }]], boss: 'abyssal_kraken', dailyLimit: 3, reward: { exp: 30000, gold: 5000, items: [{ itemId: 'refine_ore_hi', qty: 2 }, { itemId: 'brine_pearl', qty: 2 }] } } as DungeonDef,
  { id: 'starfall_vault', name: { en: 'Starfall Vault', th: 'ห้องนิรภัยดาวตก' }, type: 'story', map: 'starfall_vault', levelReq: 55, waves: [[{ monster: 'ruin_golem', count: 4 }, { monster: 'star_wraith', count: 4 }], [{ monster: 'clockwork_knight', count: 4 }, { monster: 'astral_eye', count: 3 }]], boss: 'vault_archon', dailyLimit: 2, reward: { exp: 120000, gold: 15000, items: [{ itemId: 'refine_ore_hi', qty: 4 }, { itemId: 'boss_heart', qty: 1 }] } } as DungeonDef,
  { id: 'mossy_hollow', name: { en: 'Mossy Hollow', th: 'โพรงมอส' }, type: 'story', map: 'mossy_hollow', levelReq: 5, waves: [[{ monster: 'cave_spider', count: 4 }, { monster: 'cap_shroom', count: 3 }], [{ monster: 'dusk_bat', count: 5 }, { monster: 'moss_golem', count: 1 }]], boss: 'hollow_king', dailyLimit: 5, reward: { exp: 1500, gold: 500, items: [{ itemId: 'refine_ore', qty: 3 }] } } as DungeonDef,
  ...DAILY_TYPES.flatMap(([k, en, th, item, mon]) => Array.from({ length: 10 }, (_, f) => ({ id: `daily_${k}_${f + 1}`, name: { en: `${en} F${f + 1}`, th: `${th} ชั้น ${f + 1}` }, type: 'daily' as const, map: 'mossy_hollow', levelReq: 1 + f * 8,
    waves: [[{ monster: mon, count: 4 + f }]], boss: f >= 4 ? 'moss_golem' : mon, dailyLimit: 2, reward: { exp: 300 * (f + 1) ** 2, gold: 150 * (f + 1), items: [{ itemId: item, qty: k === 'exp' ? 1 : 2 + f }] } }))),
].map((x) => [x.id, x]));

// ---------------- Achievements & titles (§49) ----------------
export interface AchievementDef { id: string; name: L10n; counter: string; target: number; points: number; title?: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_kill_10', name: { en: 'Pest Patrol', th: 'หน่วยลาดตระเวน' }, counter: 'kills', target: 10, points: 5 },
  { id: 'ach_kill_100', name: { en: 'Monster Hunter', th: 'นักล่าอสูร' }, counter: 'kills', target: 100, points: 15, title: 'title_hunter' },
  { id: 'ach_kill_1000', name: { en: 'Legend of the Wilds', th: 'ตำนานแห่งพงไพร' }, counter: 'kills', target: 1000, points: 40 },
  { id: 'ach_lvl_10', name: { en: 'Seasoned', th: 'มีประสบการณ์' }, counter: 'level', target: 10, points: 10 },
  { id: 'ach_lvl_30', name: { en: 'Veteran', th: 'ทหารผ่านศึก' }, counter: 'level', target: 30, points: 25, title: 'title_veteran' },
  { id: 'ach_refine_10', name: { en: 'Spark of Steel', th: 'ประกายเหล็ก' }, counter: 'refine_success', target: 10, points: 10 },
  { id: 'ach_refine_p10', name: { en: 'Master Refiner', th: 'ปรมาจารย์ตีบวก' }, counter: 'max_refine', target: 10, points: 30, title: 'title_smith' },
  { id: 'ach_pets_3', name: { en: 'Critter Collector', th: 'นักสะสมสัตว์' }, counter: 'pets', target: 3, points: 10 },
  { id: 'ach_pets_8', name: { en: 'Menagerie', th: 'สวนสัตว์ส่วนตัว' }, counter: 'pets', target: 8, points: 25, title: 'title_tamer' },
  { id: 'ach_craft_10', name: { en: 'Handy', th: 'มือดี' }, counter: 'crafts', target: 10, points: 10 },
  { id: 'ach_gather_30', name: { en: 'Forager', th: 'นักหาของป่า' }, counter: 'gathers', target: 30, points: 10 },
  { id: 'ach_dungeon_5', name: { en: 'Delver', th: 'นักสำรวจใต้ดิน' }, counter: 'dungeons', target: 5, points: 15 },
  { id: 'ach_boss_1', name: { en: 'Titan Slayer', th: 'ผู้สังหารไททัน' }, counter: 'world_boss', target: 1, points: 20, title: 'title_titan' },
  { id: 'ach_pvp_5', name: { en: 'Duelist', th: 'นักดวล' }, counter: 'pvp_wins', target: 5, points: 15, title: 'title_duelist' },
  { id: 'ach_tcg_5', name: { en: 'Card Sharp', th: 'เซียนไพ่' }, counter: 'tcg_wins', target: 5, points: 15, title: 'title_cards' },
  { id: 'ach_market_1', name: { en: 'Entrepreneur', th: 'ผู้ประกอบการ' }, counter: 'market_sales', target: 1, points: 5 },
  { id: 'ach_mount_1', name: { en: 'Rider', th: 'นักขี่' }, counter: 'mounts', target: 1, points: 5 },
  { id: 'ach_cards_10', name: { en: 'Bestiary Scholar', th: 'นักปราชญ์อสูร' }, counter: 'monster_cards', target: 10, points: 20 },
  { id: 'ach_quest_10', name: { en: 'Helpful Soul', th: 'ผู้มีน้ำใจ' }, counter: 'quests', target: 10, points: 15, title: 'title_helper' },
];
export const TITLES: Record<string, { name: L10n; mods: Omit<Modifier, 'source'>[] }> = {
  title_newcomer: { name: { en: 'Newcomer', th: 'ผู้มาใหม่' }, mods: [] },
  title_hunter: { name: { en: 'Monster Hunter', th: 'นักล่าอสูร' }, mods: [{ stat: 'atk', kind: 'flat', value: 5 }] },
  title_veteran: { name: { en: 'Veteran', th: 'ทหารผ่านศึก' }, mods: [{ stat: 'maxHp', kind: 'flat', value: 100 }] },
  title_smith: { name: { en: 'Master Refiner', th: 'ปรมาจารย์ตีบวก' }, mods: [{ stat: 'def', kind: 'flat', value: 8 }] },
  title_tamer: { name: { en: 'Beastfriend', th: 'สหายสัตว์' }, mods: [{ stat: 'hpRegen', kind: 'flat', value: 5 }] },
  title_titan: { name: { en: 'Titan Slayer', th: 'ผู้สังหารไททัน' }, mods: [{ stat: 'crit', kind: 'flat', value: 2 }] },
  title_duelist: { name: { en: 'Duelist', th: 'นักดวล' }, mods: [{ stat: 'pvpBonus', kind: 'flat', value: 3 }] },
  title_cards: { name: { en: 'Card Sharp', th: 'เซียนไพ่' }, mods: [{ stat: 'luk', kind: 'flat', value: 3 }] },
  title_helper: { name: { en: 'Helpful Soul', th: 'ผู้มีน้ำใจ' }, mods: [{ stat: 'expBonus', kind: 'flat', value: 3 }] },
  title_mvp: { name: { en: 'Arena MVP', th: 'ผู้เล่นยอดเยี่ยม' }, mods: [{ stat: 'pvpBonus', kind: 'flat', value: 2 }] },
  title_gladiator: { name: { en: 'Diamond Gladiator', th: 'นักสู้เพชร' }, mods: [{ stat: 'pvpReduce', kind: 'flat', value: 3 }] },
  title_flamebreaker: { name: { en: 'Flamebreaker', th: 'ผู้ทลายเปลวแรก' }, mods: [{ stat: 'atk', kind: 'pct', value: 3 }, { stat: 'matk', kind: 'pct', value: 3 }] },
  title_weekly: { name: { en: 'Champion of the Week', th: 'แชมป์ประจำสัปดาห์' }, mods: [{ stat: 'expBonus', kind: 'flat', value: 2 }] },
  title_hearthbound: { name: { en: 'Hearthbound', th: 'ผูกพันเตาผิง' }, mods: [{ stat: 'maxHp', kind: 'pct', value: 2 }] },
};

// ---------------- Events, login calendar, pass (§47–48) ----------------
export const LOGIN_CALENDAR: { itemId: string; qty: number }[] = [
  { itemId: 'potion_hp_s', qty: 10 }, { itemId: 'pet_food', qty: 20 }, { itemId: 'refine_ore', qty: 3 }, { itemId: 'enchant_stone', qty: 1 }, { itemId: 'gacha_ticket', qty: 1 }, { itemId: 'card_pack', qty: 1 }, { itemId: 'pet_egg', qty: 1 },
];
export const EVENTS = [
  { id: 'ev_lantern_festival', name: { en: 'Lantern Festival', th: 'เทศกาลโคมไฟ' }, desc: { en: '+50% EXP and festival missions.', th: 'EXP +50% และภารกิจเทศกาล' }, expMult: 1.5, dropMult: 1, goldMult: 1, missions: [{ id: 'evm_kill', counter: 'kills', target: 30, reward: { itemId: 'costume_festival', qty: 1 } }, { id: 'evm_craft', counter: 'crafts', target: 3, reward: { itemId: 'deco_lantern', qty: 3 } }] },
  { id: 'ev_harvest_moon', name: { en: 'Harvest Moon', th: 'จันทร์เก็บเกี่ยว' }, desc: { en: '+30% drop rate and gathering missions.', th: 'อัตราดรอป +30% และภารกิจเก็บของ' }, expMult: 1, dropMult: 1.3, goldMult: 1, missions: [{ id: 'evm_gather', counter: 'gathers', target: 15, reward: { itemId: 'gacha_ticket', qty: 2 } }] },
  { id: 'ev_gold_rush', name: { en: 'Gold Rush Week', th: 'สัปดาห์ตื่นทอง' }, desc: { en: '+50% Gold from monsters and crafting missions.', th: 'ทองจากมอนสเตอร์ +50% และภารกิจคราฟต์' }, expMult: 1, dropMult: 1, goldMult: 1.5, missions: [{ id: 'evm_gold_kill', counter: 'kills', target: 40, reward: { itemId: 'refine_ore_hi', qty: 2 } }, { id: 'evm_gold_craft', counter: 'crafts', target: 5, reward: { itemId: 'blessing_scroll', qty: 1 } }] },
];
/** Events rotate weekly (Monday 00:00 UTC boundaries); one active at a time. */
export const WEEK_MS = 7 * 86400_000;
export function activeEventAt(now: number) { return EVENTS[Math.floor(now / WEEK_MS) % EVENTS.length]!; }
export function eventEndsAt(now: number) { return (Math.floor(now / WEEK_MS) + 1) * WEEK_MS; }
export const PASS = { levels: 30, expPerLevel: 100, free: Array.from({ length: 30 }, (_, i) => ({ itemId: i % 5 === 4 ? 'gacha_ticket' : i % 3 === 0 ? 'refine_ore' : 'potion_hp_m', qty: i % 5 === 4 ? 1 : 3 })), premium: Array.from({ length: 30 }, (_, i) => ({ itemId: i === 29 ? 'wings_fairy' : i % 5 === 4 ? 'pet_egg' : i % 2 ? 'enchant_stone' : 'card_pack', qty: 1 })) };
export const MISSIONS_DAILY = [
  { id: 'md_kill', counter: 'kills', target: 20, points: 20 }, { id: 'md_gather', counter: 'gathers', target: 5, points: 15 }, { id: 'md_dungeon', counter: 'dungeons', target: 1, points: 25 }, { id: 'md_tcg', counter: 'tcg_games', target: 1, points: 15 }, { id: 'md_refine', counter: 'refines', target: 1, points: 10 }, { id: 'md_feed', counter: 'pet_feeds', target: 1, points: 15 },
];
export const ACTIVITY_CHESTS = [{ points: 40, itemId: 'potion_hp_m', qty: 5 }, { points: 70, itemId: 'refine_ore', qty: 3 }, { points: 100, itemId: 'gacha_ticket', qty: 1 }];

// ---------------- Gacha banners (§46) — simulated currency only in artifact ----------------
/** Passes & memberships (§47). Bought with SIMULATED Crystal only (real payments disabled). */
export const MEMBERSHIPS: Record<string, { name: { en: string; th: string }; cost: number; days: number | null; daily?: { currency: 'crystal_free' | 'gold'; amount: number }; bonus?: { stat: 'expBonus' | 'dropBonus' | 'goldBonus'; value: number }[]; festival?: boolean; desc: { en: string; th: string } }> = {
  weekly: { name: { en: 'Weekly Pass', th: 'พาสรายสัปดาห์' }, cost: 300, days: 7, daily: { currency: 'crystal_free', amount: 60 }, desc: { en: '60 Free Crystal every day for 7 days.', th: 'รับคริสตัลฟรี 60 ทุกวัน 7 วัน' } },
  monthly: { name: { en: 'Monthly Pass', th: 'พาสรายเดือน' }, cost: 980, days: 30, daily: { currency: 'crystal_free', amount: 50 }, bonus: [{ stat: 'expBonus', value: 5 }], desc: { en: '50 Free Crystal daily + 5% EXP for 30 days.', th: 'คริสตัลฟรี 50 ต่อวัน + EXP 5% นาน 30 วัน' } },
  festival: { name: { en: 'Festival Pass', th: 'พาสเทศกาล' }, cost: 480, days: 7, festival: true, desc: { en: 'Doubles event mission rewards and Event Tokens for this week’s event.', th: 'รางวัลภารกิจอีเวนต์และโทเคนอีเวนต์เป็นสองเท่าในสัปดาห์นี้' } },
  hearth: { name: { en: 'Permanent Hearth Pass', th: 'พาสเตาผิงถาวร' }, cost: 2980, days: null, daily: { currency: 'gold', amount: 500 }, bonus: [{ stat: 'dropBonus', value: 3 }], desc: { en: 'Forever: 500 Gold daily + 3% drop rate.', th: 'ถาวร: ทอง 500 ต่อวัน + อัตราดรอป 3%' } },
  grand: { name: { en: 'Grand Lantern Pass', th: 'พาสโคมไฟใหญ่' }, cost: 4980, days: null, bonus: [{ stat: 'expBonus', value: 5 }, { stat: 'goldBonus', value: 5 }], desc: { en: 'Forever: +5% EXP and +5% Gold.', th: 'ถาวร: EXP +5% และทอง +5%' } },
};
export const TCG_COSMETICS: Record<string, { kind: 'back' | 'mat' | 'table'; name: { en: string; th: string }; cost: number; css: string }> = {
  back_classic: { kind: 'back', name: { en: 'Classic Back', th: 'หลังการ์ดคลาสสิก' }, cost: 0, css: 'linear-gradient(135deg,#5a3e2e,#3e2a20)' },
  back_ember: { kind: 'back', name: { en: 'Ember Back', th: 'หลังการ์ดถ่านไฟ' }, cost: 200, css: 'linear-gradient(135deg,#ff7030,#802010)' },
  back_tide: { kind: 'back', name: { en: 'Tide Back', th: 'หลังการ์ดกระแสน้ำ' }, cost: 200, css: 'linear-gradient(135deg,#40a0e0,#103060)' },
  back_starry: { kind: 'back', name: { en: 'Starry Back', th: 'หลังการ์ดดวงดาว' }, cost: 400, css: 'radial-gradient(circle at 30% 30%,#fff 1px,transparent 2px),linear-gradient(135deg,#302060,#100820)' },
  mat_wood: { kind: 'mat', name: { en: 'Oak Table Mat', th: 'แผ่นรองไม้โอ๊ค' }, cost: 0, css: '#1a1420' },
  mat_moss: { kind: 'mat', name: { en: 'Moss Mat', th: 'แผ่นรองมอส' }, cost: 300, css: 'linear-gradient(#1e3a22,#122416)' },
  mat_night: { kind: 'mat', name: { en: 'Night Sky Mat', th: 'แผ่นรองฟ้าราตรี' }, cost: 300, css: 'linear-gradient(#141a3a,#06081a)' },
  table_classic: { kind: 'table', name: { en: 'Classic Table', th: 'โต๊ะคลาสสิก' }, cost: 0, css: '' },
  table_animated: { kind: 'table', name: { en: 'Lantern-lit Table (animated)', th: 'โต๊ะแสงโคม (เคลื่อนไหว)' }, cost: 600, css: 'linear-gradient(120deg,#3a2410,#7a5420,#3a2410,#6a4818)' },
};
export const GACHA_BANNERS = {
  standard: { name: { en: 'Hearth Wishes', th: 'คำอธิษฐานเตาผิง' }, cost: { ticket: 1, crystal: 150 }, pools: {
    mythic: ['pet_phoenix_egg', 'astral_greatsword', 'astral_staff'], legendary: ['dawn_sword', 'dawn_staff', 'dawn_bow', 'wings_fairy'], epic: ['frost_sword', 'frost_staff', 'costume_witch', 'ward_scroll'],
    rare: ['pet_egg', 'enchant_stone', 'skill_stone', 'gem_opal_2'], uncommon: ['refine_ore', 'potion_hp_m', 'card_pack', 'pet_food_fine'] } },
  seasonal: { name: { en: 'Seasonal Wishes', th: 'คำอธิษฐานตามฤดูกาล' }, cost: { ticket: 1, crystal: 150 }, rotating: true, pools: {
    mythic: ['astral_bow', 'astral_dagger', 'astral_lute', 'astral_cards'], legendary: ['dawn_greatsword', 'dawn_spear', 'dawn_gun', 'dawn_tome'], epic: ['frost_bow', 'frost_greatsword', 'wings_ember', 'blessing_scroll'],
    rare: ['pet_egg', 'skill_stone', 'gem_garnet_2', 'gem_onyx_2'], uncommon: ['refine_ore', 'card_pack', 'food_forest', 'potion_mp_m'] } },
  fashion: { name: { en: 'Fashion Box', th: 'กล่องแฟชั่น' }, cost: { ticket: 1, crystal: 120 }, pools: {
    mythic: ['wings_fairy'], legendary: ['wings_ember'], epic: ['costume_witch', 'costume_festival'], rare: ['deco_fountain', 'deco_bench'], uncommon: ['deco_lantern', 'deco_flowers', 'star_dust'] } },
  gems: { name: { en: 'Gem Box', th: 'กล่องอัญมณี' }, cost: { ticket: 1, crystal: 100 }, pools: {
    mythic: ['gem_onyx_3', 'gem_ruby_3', 'gem_sapphire_3'], legendary: ['gem_topaz_3', 'gem_emerald_3', 'gem_amethyst_3', 'gem_opal_3'], epic: ['gem_garnet_2', 'gem_aquamarine_2', 'gem_ruby_2', 'gem_sapphire_2'],
    rare: ['gem_ruby_1', 'gem_topaz_1', 'gem_emerald_1', 'gem_sapphire_1', 'gem_amethyst_1', 'gem_opal_1'], uncommon: ['gem_dust'] } },
};
/** Seasonal banner features one mythic per calendar month (rotating). */
export function seasonalFeatured(now: number) { const pool = GACHA_BANNERS.seasonal.pools.mythic; return pool[new Date(now).getUTCMonth() % pool.length]!; }
