import type { Element } from './config.js';
import type { L10n, WeaponType } from './classes.js';
import type { Modifier, StatKey } from './stats.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_COLOR: Record<Rarity, string> = { common: '#d8d8d8', uncommon: '#6fdc6f', rare: '#5aa8ff', epic: '#c07aff', legendary: '#ffb340', mythic: '#ff5a7a' };

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'gem' | 'skill_stone' | 'monster_card' | 'quest' | 'pet_egg' | 'pet_food' | 'mount_key' | 'costume' | 'decoration' | 'ticket' | 'card_pack' | 'tool' | 'enchant' | 'protection';
export type Slot = 'main' | 'off' | 'head' | 'body' | 'gloves' | 'boots' | 'belt' | 'ring1' | 'ring2' | 'necklace' | 'earring' | 'costume' | 'wings';
export const EQUIP_SLOTS: Slot[] = ['main', 'off', 'head', 'body', 'gloves', 'boots', 'belt', 'ring1', 'ring2', 'necklace', 'earring', 'costume', 'wings'];

export interface ItemDef {
  id: string; name: L10n; type: ItemType; rarity: Rarity; icon: string; color: string; stack: number; price: number;
  tradeable: boolean; reqLevel: number; slot?: Slot; weapon?: WeaponType; stats?: Omit<Modifier, 'source'>[]; element?: Element;
  use?: { hp?: number; mp?: number; status?: string; durationMs?: number; grant?: string; exp?: number }; setId?: string; desc?: L10n;
}
export interface ItemInstance {
  uid: string; defId: string; qty: number; refine: number; options: Omit<Modifier, 'source'>[]; sockets: (string | null)[];
  cards: (string | null)[]; gemRefine?: number[]; cosmetic?: number; stone?: { skillId: string | null; mods: { key: 'power' | 'cd' | 'mp' | 'radius'; value: number }[]; refine: number }; locked: boolean; bound: boolean; durability: number;
}

const D: ItemDef[] = [];
const add = (d: Partial<ItemDef> & Pick<ItemDef, 'id' | 'name' | 'type' | 'icon' | 'color'>) => { D.push({ rarity: 'common', stack: 1, price: 10, tradeable: true, reqLevel: 1, ...d }); };
const st = (...m: [StatKey, number][]): Omit<Modifier, 'source'>[] => m.map(([stat, value]) => ({ stat, kind: 'flat', value }));

// ---- Equipment: 6 tiers × weapons/armor/accessories (generated with distinct stat profiles) ----
const TIERS: { key: string; en: string; th: string; lvl: number; r: Rarity; mul: number; color: string }[] = [
  { key: 'wood', en: 'Oakwood', th: 'ไม้โอ๊ค', lvl: 1, r: 'common', mul: 1, color: '#a87a4a' },
  { key: 'iron', en: 'Ironbound', th: 'เหล็กหล่อ', lvl: 10, r: 'uncommon', mul: 2.2, color: '#a0a8b0' },
  { key: 'amber', en: 'Amberforged', th: 'อำพัน', lvl: 20, r: 'rare', mul: 3.8, color: '#e0a040' },
  { key: 'frost', en: 'Frostsilver', th: 'เงินน้ำแข็ง', lvl: 35, r: 'epic', mul: 6, color: '#a0e0ff' },
  { key: 'dawn', en: 'Dawnsteel', th: 'เหล็กรุ่งอรุณ', lvl: 55, r: 'legendary', mul: 9, color: '#ffe080' },
  { key: 'astral', en: 'Astral', th: 'ดารา', lvl: 80, r: 'mythic', mul: 14, color: '#ff80c0' },
];
const WEAPONS: { w: WeaponType; en: string; th: string; atk: number; matk: number; extra: [StatKey, number][] }[] = [
  { w: 'sword', en: 'Sword', th: 'ดาบ', atk: 12, matk: 0, extra: [['def', 2]] },
  { w: 'greatsword', en: 'Greatsword', th: 'ดาบใหญ่', atk: 17, matk: 0, extra: [['crit', 1]] },
  { w: 'spear', en: 'Spear', th: 'หอก', atk: 14, matk: 0, extra: [['acc', 4]] },
  { w: 'dagger', en: 'Dagger', th: 'มีดสั้น', atk: 10, matk: 0, extra: [['crit', 2], ['eva', 3]] },
  { w: 'bow', en: 'Bow', th: 'ธนู', atk: 13, matk: 0, extra: [['acc', 6]] },
  { w: 'staff', en: 'Staff', th: 'คทา', atk: 3, matk: 15, extra: [['maxMp', 15]] },
  { w: 'tome', en: 'Tome', th: 'คัมภีร์', atk: 2, matk: 13, extra: [['healPower', 4]] },
  { w: 'knuckle', en: 'Knuckle', th: 'สนับมือ', atk: 11, matk: 4, extra: [['aspd', 0.03]] },
  { w: 'gun', en: 'Arcgun', th: 'ปืนอาร์ค', atk: 14, matk: 2, extra: [['pen', 2]] },
  { w: 'lute', en: 'Lute', th: 'พิณ', atk: 5, matk: 10, extra: [['mpRegen', 1]] },
  { w: 'cards', en: 'Deck', th: 'สำรับไพ่', atk: 8, matk: 8, extra: [['crit', 3]] },
  { w: 'whip', en: 'Whip', th: 'แส้', atk: 11, matk: 3, extra: [['acc', 3]] },
];
const ARMOR: { s: Slot; en: string; th: string; icon: string; def: number; mdef: number; hp: number; extra?: [StatKey, number][] }[] = [
  { s: 'head', en: 'Helm', th: 'หมวก', icon: 'helm', def: 3, mdef: 2, hp: 15 },
  { s: 'body', en: 'Armor', th: 'เกราะ', icon: 'armor', def: 7, mdef: 4, hp: 40 },
  { s: 'gloves', en: 'Gloves', th: 'ถุงมือ', icon: 'gloves', def: 2, mdef: 1, hp: 8, extra: [['acc', 3]] },
  { s: 'boots', en: 'Boots', th: 'รองเท้า', icon: 'boots', def: 2, mdef: 1, hp: 8, extra: [['moveSpeed', 4]] },
  { s: 'belt', en: 'Belt', th: 'เข็มขัด', icon: 'belt', def: 2, mdef: 2, hp: 20 },
  { s: 'off', en: 'Shield', th: 'โล่', icon: 'shield', def: 6, mdef: 3, hp: 25, extra: [['block', 3]] },
];
const ACCS: { s: Slot; en: string; th: string; icon: string; extra: [StatKey, number][] }[] = [
  { s: 'ring1', en: 'Ring', th: 'แหวน', icon: 'ring', extra: [['atk', 3], ['matk', 3]] },
  { s: 'necklace', en: 'Amulet', th: 'สร้อย', icon: 'amulet', extra: [['maxHp', 25], ['maxMp', 10]] },
  { s: 'earring', en: 'Earring', th: 'ต่างหู', icon: 'earring', extra: [['crit', 1], ['eva', 3]] },
];
for (const t of TIERS) {
  for (const w of WEAPONS) add({ id: `${t.key}_${w.w}`, name: { en: `${t.en} ${w.en}`, th: `${w.th}${t.th}` }, type: 'weapon', slot: 'main', weapon: w.w, rarity: t.r, reqLevel: t.lvl, icon: w.w, color: t.color, price: Math.floor(80 * t.mul * t.mul), stats: [...st(['atk', Math.round(w.atk * t.mul)], ['matk', Math.round(w.matk * t.mul)]), ...st(...w.extra.map(([k, v]) => [k, k === 'aspd' ? v : Math.round(v * t.mul)] as [StatKey, number]))].filter((m) => m.value !== 0), setId: t.key });
  for (const a of ARMOR) add({ id: `${t.key}_${a.s}`, name: { en: `${t.en} ${a.en}`, th: `${a.th}${t.th}` }, type: 'armor', slot: a.s, rarity: t.r, reqLevel: t.lvl, icon: a.icon, color: t.color, price: Math.floor(60 * t.mul * t.mul), stats: st(['def', Math.round(a.def * t.mul)], ['mdef', Math.round(a.mdef * t.mul)], ['maxHp', Math.round(a.hp * t.mul)], ...(a.extra ?? []).map(([k, v]) => [k, Math.round(v * Math.sqrt(t.mul))] as [StatKey, number])), setId: t.key });
  for (const a of ACCS) add({ id: `${t.key}_${a.s}`, name: { en: `${t.en} ${a.en}`, th: `${a.th}${t.th}` }, type: 'accessory', slot: a.s, rarity: t.r, reqLevel: t.lvl, icon: a.icon, color: t.color, price: Math.floor(70 * t.mul * t.mul), stats: st(...a.extra.map(([k, v]) => [k, Math.round(v * t.mul)] as [StatKey, number])), setId: t.key });
}
export const SET_BONUS: Record<string, { pieces: number; mods: Omit<Modifier, 'source'>[] }[]> = Object.fromEntries(TIERS.map((t) => [t.key, [
  { pieces: 3, mods: [{ stat: 'maxHp', kind: 'pct', value: 5 }] },
  { pieces: 5, mods: [{ stat: 'atk', kind: 'pct', value: 6 }, { stat: 'matk', kind: 'pct', value: 6 }] },
  { pieces: 8, mods: [{ stat: 'crit', kind: 'flat', value: 5 }, { stat: 'dmgReduce', kind: 'flat', value: 5 }] },
]]));

// ---- Consumables ----
add({ id: 'potion_hp_s', name: { en: 'Apple Tonic', th: 'ยาแอปเปิล' }, type: 'consumable', icon: 'potion', color: '#e04848', stack: 99, price: 12, use: { hp: 120 } });
add({ id: 'potion_hp_m', name: { en: 'Rosehip Draught', th: 'ยาโรสฮิป' }, type: 'consumable', icon: 'potion', color: '#ff3060', stack: 99, price: 40, reqLevel: 15, rarity: 'uncommon', use: { hp: 450 } });
add({ id: 'potion_hp_l', name: { en: 'Heartbloom Elixir', th: 'น้ำอมฤตบุปผา' }, type: 'consumable', icon: 'potion', color: '#ff80a0', stack: 99, price: 120, reqLevel: 40, rarity: 'rare', use: { hp: 1500 } });
add({ id: 'potion_mp_s', name: { en: 'Blueberry Tea', th: 'ชาบลูเบอร์รี' }, type: 'consumable', icon: 'potion', color: '#4880e0', stack: 99, price: 15, use: { mp: 60 } });
add({ id: 'potion_mp_m', name: { en: 'Moonwater', th: 'น้ำจันทรา' }, type: 'consumable', icon: 'potion', color: '#60a0ff', stack: 99, price: 50, reqLevel: 15, rarity: 'uncommon', use: { mp: 220 } });
add({ id: 'food_stew', name: { en: 'Hearth Stew', th: 'สตูว์เตาผิง' }, type: 'consumable', icon: 'food', color: '#c08040', stack: 50, price: 30, use: { hp: 200, status: 'regen', durationMs: 20000 } });
add({ id: 'food_pie', name: { en: 'Berry Pie', th: 'พายเบอร์รี' }, type: 'consumable', icon: 'food', color: '#a03060', stack: 50, price: 45, rarity: 'uncommon', use: { status: 'atk_up', durationMs: 60000 } });
add({ id: 'food_soup', name: { en: 'Frost Soup', th: 'ซุปหิมะ' }, type: 'consumable', icon: 'food', color: '#c0e0ff', stack: 50, price: 45, rarity: 'uncommon', use: { status: 'def_up', durationMs: 60000 } });
add({ id: 'scroll_haste', name: { en: 'Swiftwind Scroll', th: 'ม้วนคัมภีร์ลมเร็ว' }, type: 'consumable', icon: 'scroll', color: '#e0f0e0', stack: 30, price: 60, rarity: 'uncommon', use: { status: 'haste', durationMs: 30000 } });
add({ id: 'scroll_return', name: { en: 'Hearth Scroll', th: 'ม้วนกลับบ้าน' }, type: 'consumable', icon: 'scroll', color: '#ffc080', stack: 30, price: 25, use: { grant: 'teleport_town' } });
add({ id: 'repair_kit', name: { en: 'Tinker Kit', th: 'ชุดซ่อมพกพา' }, type: 'consumable', icon: 'pickaxe', color: '#c0a070', stack: 20, price: 150, use: { grant: 'repair' }, desc: { en: 'Fully repairs all equipped gear.', th: 'ซ่อมอุปกรณ์ที่สวมใส่ทั้งหมด' } });
add({ id: 'blessing_scroll', name: { en: 'Emberlight Blessing', th: 'คัมภีร์พรแสงถ่าน' }, type: 'protection', icon: 'scroll', color: '#ffd080', stack: 99, price: 800, rarity: 'rare', desc: { en: '+10% refine success for one attempt.', th: 'เพิ่มโอกาสตีบวกสำเร็จ 10% หนึ่งครั้ง' } });
add({ id: 'food_forest', name: { en: 'Mossberry Kibble', th: 'อาหารเบอร์รีมอส' }, type: 'pet_food', icon: 'food', color: '#70c060', stack: 999, price: 25, rarity: 'uncommon', desc: { en: 'Whisperwood food: double effect for earth & wind pets.', th: 'อาหารป่ากระซิบ: ผลสองเท่ากับสัตว์ธาตุดินและลม' } });
add({ id: 'food_hills', name: { en: 'Amber Jerky', th: 'เนื้อแห้งอำพัน' }, type: 'pet_food', icon: 'food', color: '#e0a040', stack: 999, price: 25, rarity: 'uncommon', desc: { en: 'Amber Hills food: double effect for fire & neutral pets.', th: 'อาหารเนินอำพัน: ผลสองเท่ากับสัตว์ธาตุไฟและกลาง' } });
add({ id: 'food_snow', name: { en: 'Frostfish Bites', th: 'ปลาหิมะชิ้นเล็ก' }, type: 'pet_food', icon: 'food', color: '#a0e0ff', stack: 999, price: 25, rarity: 'uncommon', desc: { en: 'Frostmere food: double effect for ice & water pets.', th: 'อาหารฟรอสต์เมียร์: ผลสองเท่ากับสัตว์ธาตุน้ำแข็งและน้ำ' } });
add({ id: 'rune_fang', name: { en: 'Fang Rune', th: 'รูนเขี้ยว' }, type: 'material', icon: 'stone', color: '#ff7060', stack: 50, price: 600, rarity: 'rare', desc: { en: 'Pet rune: +25% pet attack.', th: 'รูนสัตว์เลี้ยง: พลังโจมตีสัตว์เลี้ยง +25%' } });
add({ id: 'rune_shell', name: { en: 'Shell Rune', th: 'รูนกระดอง' }, type: 'material', icon: 'stone', color: '#60a0ff', stack: 50, price: 600, rarity: 'rare', desc: { en: 'Pet rune: +25% pet HP and +3% owner DEF.', th: 'รูนสัตว์เลี้ยง: HP สัตว์ +25% และ DEF เจ้าของ +3%' } });
add({ id: 'rune_wind', name: { en: 'Wind Rune', th: 'รูนลม' }, type: 'material', icon: 'stone', color: '#a0ffb0', stack: 50, price: 600, rarity: 'rare', desc: { en: 'Pet rune: pet skill cooldown −30%.', th: 'รูนสัตว์เลี้ยง: คูลดาวน์สกิลสัตว์ −30%' } });
add({ id: 'exp_tome', name: { en: 'Tome of Insight', th: 'ตำราปัญญา' }, type: 'consumable', icon: 'book', color: '#ffe080', stack: 30, price: 500, rarity: 'rare', use: { exp: 2000 } });

// ---- Materials (monster drops / gathering) ----
const MATS: [string, string, string, string, string, Rarity?][] = [
  ['slime_gel', 'Slime Gel', 'เจลสไลม์', 'gel', '#7be07b'], ['soft_fur', 'Soft Fur', 'ขนนุ่ม', 'fur', '#d0b090'], ['mushroom_cap', 'Mushroom Cap', 'หมวกเห็ด', 'mushroom', '#e05050'],
  ['bat_wing', 'Bat Wing', 'ปีกค้างคาว', 'wing', '#504060'], ['wolf_fang', 'Wolf Fang', 'เขี้ยวหมาป่า', 'fang', '#f0f0e0'], ['beetle_shell', 'Beetle Shell', 'กระดองด้วง', 'shell', '#406080'],
  ['ember_core', 'Ember Core', 'แกนถ่านไฟ', 'orb', '#ff6020', 'uncommon'], ['frost_shard', 'Frost Shard', 'เศษน้ำแข็ง', 'crystal', '#a0e8ff', 'uncommon'], ['wisp_dust', 'Wisp Dust', 'ฝุ่นภูต', 'dust', '#f0f0a0', 'uncommon'],
  ['golem_core', 'Golem Core', 'แกนโกเลม', 'orb', '#a08060', 'rare'], ['dragon_scale', 'Wyrm Scale', 'เกล็ดมังกร', 'shell', '#e04040', 'epic'], ['boss_heart', 'Guardian Heart', 'หัวใจผู้พิทักษ์', 'heart', '#ff4080', 'epic'],
  ['copper_ore', 'Copper Ore', 'แร่ทองแดง', 'ore', '#d08040'], ['iron_ore', 'Iron Ore', 'แร่เหล็ก', 'ore', '#a0a0b0'], ['silver_ore', 'Silver Ore', 'แร่เงิน', 'ore', '#e0e8f0', 'uncommon'], ['star_ore', 'Starmetal Ore', 'แร่ดาว', 'ore', '#c080ff', 'rare'],
  ['oak_log', 'Oak Log', 'ท่อนไม้โอ๊ค', 'log', '#8a5a2a'], ['pine_log', 'Pine Log', 'ท่อนไม้สน', 'log', '#5a4020'], ['moon_log', 'Moonwood', 'ไม้จันทรา', 'log', '#a0a0e0', 'uncommon'],
  ['herb_green', 'Greenleaf', 'ใบเขียว', 'herb', '#50c050'], ['herb_blue', 'Bluebell', 'ระฆังฟ้า', 'herb', '#5080e0'], ['herb_gold', 'Sunpetal', 'กลีบสุริยา', 'herb', '#f0d040', 'uncommon'],
  ['fish_carp', 'River Carp', 'ปลาตะเพียน', 'fish', '#c0a060'], ['fish_trout', 'Silver Trout', 'ปลาเทราต์', 'fish', '#c0d0e0'], ['fish_koi', 'Lantern Koi', 'ปลาคาร์ปโคมไฟ', 'fish', '#ff8040', 'rare'],
  ['berry', 'Wild Berry', 'เบอร์รีป่า', 'berry', '#c03060'], ['wheat', 'Wheat', 'ข้าวสาลี', 'wheat', '#e0c060'], ['cloth', 'Linen Cloth', 'ผ้าลินิน', 'cloth', '#e0e0d0'],
  ['refine_ore', 'Lumen Ore', 'แร่ลูเมน', 'ore', '#80ffe0', 'uncommon'], ['refine_ore_hi', 'Radiant Ore', 'แร่เปล่งประกาย', 'ore', '#ffff80', 'rare'], ['stone_dust', 'Stone Dust', 'ผงศิลา', 'dust', '#b0a090'], ['star_dust', 'Star Dust', 'ผงดาว', 'dust', '#ffe0ff', 'uncommon'],
  ['card_dust', 'Card Dust', 'ผงการ์ด', 'dust', '#80c0ff'], ['gem_dust', 'Gem Dust', 'ผงอัญมณี', 'dust', '#ff80ff'],
];
for (const [id, en, th, icon, color, r] of MATS) add({ id, name: { en, th }, type: 'material', icon, color, stack: 999, price: r === 'epic' ? 400 : r === 'rare' ? 120 : r === 'uncommon' ? 30 : 6, rarity: r ?? 'common' });

// ---- Gems (grades 1–3) ----
const GEMS: [string, string, string, string, StatKey, number][] = [
  ['ruby', 'Ruby', 'ทับทิม', '#e02040', 'str', 3], ['topaz', 'Topaz', 'บุษราคัม', '#f0c020', 'agi', 3], ['emerald', 'Emerald', 'มรกต', '#20c060', 'vit', 3],
  ['sapphire', 'Sapphire', 'ไพลิน', '#2060e0', 'int', 3], ['amethyst', 'Amethyst', 'อเมทิสต์', '#a040e0', 'dex', 3], ['opal', 'Opal', 'โอปอล', '#f0f0f0', 'luk', 3],
  ['garnet', 'Garnet', 'โกเมน', '#a02020', 'maxHp', 60], ['aquamarine', 'Aquamarine', 'พลอยน้ำทะเล', '#60e0e0', 'maxMp', 30], ['onyx', 'Onyx', 'นิล', '#303030', 'crit', 2],
];
for (const [id, en, th, color, stat, v] of GEMS) for (let g = 1; g <= 3; g++) add({ id: `gem_${id}_${g}`, name: { en: `${en} ${'I'.repeat(g)}`, th: `${th} ขั้น ${g}` }, type: 'gem', icon: 'gem', color, stack: 99, price: 100 * g * g, rarity: (['uncommon', 'rare', 'epic'] as Rarity[])[g - 1], stats: [{ stat, kind: 'flat', value: v * g }] });

// ---- Skill stones, enchant, protection, tools, eggs, mount keys, costumes, tickets, card packs, decorations ----
add({ id: 'skill_stone', name: { en: 'Blank Skill Stone', th: 'ศิลาสกิลเปล่า' }, type: 'skill_stone', icon: 'stone', color: '#80a0c0', stack: 1, price: 300, rarity: 'rare' });
add({ id: 'enchant_stone', name: { en: 'Enchant Stone', th: 'หินเอนชานต์' }, type: 'enchant', icon: 'crystal', color: '#ff80ff', stack: 99, price: 150, rarity: 'uncommon' });
add({ id: 'ward_scroll', name: { en: 'Hearthward Charm', th: 'เครื่องรางคุ้มกัน' }, type: 'protection', icon: 'scroll', color: '#80ffff', stack: 99, price: 2000, rarity: 'epic', desc: { en: 'Prevents downgrade on refine failure.', th: 'ป้องกันระดับลดเมื่อตีบวกล้มเหลว' } });
add({ id: 'tool_pickaxe', name: { en: 'Pickaxe', th: 'จอบขุดแร่' }, type: 'tool', icon: 'pickaxe', color: '#a0a0a0', price: 50 });
add({ id: 'tool_axe', name: { en: 'Woodaxe', th: 'ขวานตัดไม้' }, type: 'tool', icon: 'axe', color: '#a08060', price: 50 });
add({ id: 'tool_rod', name: { en: 'Fishing Rod', th: 'คันเบ็ด' }, type: 'tool', icon: 'rod', color: '#c0a060', price: 50 });
add({ id: 'tool_sickle', name: { en: 'Sickle', th: 'เคียว' }, type: 'tool', icon: 'sickle', color: '#c0c0c0', price: 50 });
add({ id: 'pet_egg', name: { en: 'Mystery Egg', th: 'ไข่ปริศนา' }, type: 'pet_egg', icon: 'egg', color: '#f0e0c0', stack: 10, price: 800, rarity: 'rare' });
add({ id: 'capture_net', name: { en: 'Silk Net', th: 'ตาข่ายไหม' }, type: 'consumable', icon: 'net', color: '#f0f0f0', stack: 50, price: 80, use: { grant: 'capture' } });
add({ id: 'pet_food', name: { en: 'Pet Biscuit', th: 'ขนมสัตว์เลี้ยง' }, type: 'pet_food', icon: 'food', color: '#e0b080', stack: 999, price: 5 });
add({ id: 'pet_food_fine', name: { en: 'Gourmet Treat', th: 'ขนมพรีเมียม' }, type: 'pet_food', icon: 'food', color: '#ff80c0', stack: 999, price: 40, rarity: 'uncommon' });
for (const [id, en, th, color] of [['mount_key_pony', 'Meadow Pony Whistle', 'นกหวีดม้าทุ่ง', '#c09060'], ['mount_key_owl', 'Night Owl Whistle', 'นกหวีดนกฮูก', '#806040'], ['mount_key_lizard', 'Sand Strider Whistle', 'นกหวีดกิ้งก่า', '#60a060'], ['mount_key_ram', 'Frost Ram Whistle', 'นกหวีดแกะหิมะ', '#e0e8ff']] as const) add({ id, name: { en, th }, type: 'mount_key', icon: 'whistle', color, price: 5000, rarity: 'rare' });
for (const [id, en, th, color, slot] of [['costume_festival', 'Lantern Festival Robe', 'ชุดเทศกาลโคมไฟ', '#ff6040', 'costume'], ['costume_witch', 'Starlight Witch Hat', 'หมวกแม่มดดาว', '#6040a0', 'costume'], ['wings_fairy', 'Fairy Wings', 'ปีกนางฟ้า', '#c0f0ff', 'wings'], ['wings_ember', 'Ember Wings', 'ปีกถ่านไฟ', '#ff8040', 'wings']] as const) add({ id, name: { en, th }, type: 'costume', slot, icon: slot === 'wings' ? 'wings' : 'robe', color, price: 3000, rarity: 'epic', stats: [{ stat: 'maxHp', kind: 'flat', value: 20 }] });
add({ id: 'gacha_ticket', name: { en: 'Wish Ticket', th: 'ตั๋วอธิษฐาน' }, type: 'ticket', icon: 'ticket', color: '#ffd040', stack: 999, price: 0, tradeable: false, rarity: 'rare' });
add({ id: 'dungeon_ticket', name: { en: 'Dungeon Pass', th: 'บัตรดันเจี้ยน' }, type: 'ticket', icon: 'ticket', color: '#80c0ff', stack: 99, price: 200, tradeable: false });
add({ id: 'card_pack', name: { en: 'Duel Card Pack', th: 'ซองการ์ดดวล' }, type: 'card_pack', icon: 'pack', color: '#4080ff', stack: 99, price: 300, rarity: 'uncommon' });
for (const [id, en, th, color] of [['deco_lantern', 'Paper Lantern', 'โคมกระดาษ', '#ff8040'], ['deco_bench', 'Wooden Bench', 'ม้านั่งไม้', '#a07040'], ['deco_flowers', 'Flower Pot', 'กระถางดอกไม้', '#ff80c0'], ['deco_fountain', 'Small Fountain', 'น้ำพุเล็ก', '#80c0ff']] as const) add({ id, name: { en, th }, type: 'decoration', icon: 'deco', color, stack: 20, price: 400 });
add({ id: 'quest_letter', name: { en: 'Sealed Letter', th: 'จดหมายผนึก' }, type: 'quest', icon: 'scroll', color: '#f0e0b0', tradeable: false, price: 0 });
add({ id: 'wedding_ring', name: { en: 'Hearthbound Ring', th: 'แหวนผูกใจ' }, type: 'accessory', slot: 'ring2', icon: 'ring', color: '#ffc0e0', price: 10000, rarity: 'epic', tradeable: false, stats: [{ stat: 'maxHp', kind: 'pct', value: 3 }, { stat: 'expBonus', kind: 'flat', value: 5 }] });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(D.map((d) => [d.id, d]));

/** Random option pool (§23). */
export const OPTION_POOL: { stat: StatKey; min: number; max: number; slots: ItemType[] }[] = [
  { stat: 'atk', min: 2, max: 12, slots: ['weapon', 'accessory'] }, { stat: 'matk', min: 2, max: 12, slots: ['weapon', 'accessory'] },
  { stat: 'crit', min: 1, max: 4, slots: ['weapon', 'accessory'] }, { stat: 'maxHp', min: 15, max: 90, slots: ['armor', 'accessory'] },
  { stat: 'def', min: 2, max: 10, slots: ['armor'] }, { stat: 'mdef', min: 2, max: 10, slots: ['armor'] }, { stat: 'acc', min: 3, max: 12, slots: ['weapon', 'armor'] },
  { stat: 'eva', min: 3, max: 12, slots: ['armor', 'accessory'] }, { stat: 'lifesteal', min: 1, max: 3, slots: ['weapon'] }, { stat: 'moveSpeed', min: 2, max: 6, slots: ['armor'] },
  { stat: 'cdr', min: 1, max: 3, slots: ['accessory'] }, { stat: 'elemBonus', min: 2, max: 8, slots: ['weapon'] }, { stat: 'dropBonus', min: 1, max: 5, slots: ['accessory'] },
];
