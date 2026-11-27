import type { Element } from './config.js';
import type { Primary, Modifier } from './stats.js';

export type Role = 'tank' | 'warrior' | 'assassin' | 'archer' | 'mage' | 'healer' | 'support' | 'summoner' | 'tech';
export type WeaponType = 'sword' | 'greatsword' | 'spear' | 'dagger' | 'bow' | 'staff' | 'tome' | 'knuckle' | 'gun' | 'lute' | 'cards' | 'whip';
export type L10n = { en: string; th: string };

export interface SkillEffect { s: string; d: number; c?: number; self?: boolean; party?: boolean }
export interface SkillDef {
  id: string; classId: string; name: L10n; desc: L10n; type: 'active' | 'passive' | 'ultimate';
  reqLevel: number; maxRank: number; mp: number; cdMs: number; castMs: number; range: number; radius: number;
  target: 'enemy' | 'self' | 'aoe_self' | 'aoe_target' | 'line' | 'cone' | 'party';
  dmgType: 'phys' | 'mag' | 'pure' | 'heal' | 'none'; power: number; perRank: number; hits: number; element: Element | null;
  effects: SkillEffect[]; dash?: number; shieldPct?: number; summon?: string; chain?: number; cleanse?: boolean; lifesteal?: number;
  passive?: Omit<Modifier, 'source'>[]; vfx: string; icon: number;
}
export interface ClassDef {
  id: string; name: L10n; role: Role; element: Element; weapons: WeaponType[]; base: Primary; growth: Primary;
  gauge: { name: L10n; max: number; perHit: number; effect: L10n }; mechanic: L10n;
  palette: { hair: string; body: string; trim: string; skin?: string }; skills: SkillDef[];
}

const P = (str: number, agi: number, vit: number, int: number, dex: number, luk: number): Primary => ({ str, agi, vit, int, dex, luk });

type Raw = [id: string, en: string, th: string, role: Role, el: Element, weapons: WeaponType[], base: Primary, growth: Primary, gauge: [string, string], mech: [string, string], pal: [string, string, string]];
const RAW: Raw[] = [
  ['vanguard', 'Vanguard', 'แวนการ์ด', 'tank', 'earth', ['sword'], P(8, 3, 10, 2, 4, 3), P(0.7, 0.2, 1.0, 0.1, 0.3, 0.2), ['Resolve', 'ความมุ่งมั่น'], ['Gains Resolve when hit; full Resolve grants a shield of 20% max HP.', 'สะสมความมุ่งมั่นเมื่อถูกโจมตี เต็มแล้วได้โล่ 20% ของ HP สูงสุด'], ['#5a3a22', '#7a8ca8', '#e0c060']],
  ['blade_sentinel', 'Blade Sentinel', 'เบลดเซนทิเนล', 'warrior', 'neutral', ['greatsword', 'sword'], P(10, 5, 7, 1, 5, 3), P(1.0, 0.4, 0.6, 0.1, 0.4, 0.2), ['Fury', 'โทสะ'], ['Fury builds on hits; at full, next skill deals 150%.', 'โทสะสะสมเมื่อโจมตี เต็มแล้วสกิลถัดไปแรง 150%'], ['#2a2a2a', '#a83a32', '#d0d0d0']],
  ['rune_knight', 'Rune Knight', 'รูนไนท์', 'warrior', 'spirit', ['sword', 'spear'], P(8, 3, 7, 7, 4, 2), P(0.7, 0.2, 0.6, 0.6, 0.3, 0.1), ['Runes', 'รูน'], ['Physical hits etch runes; magic skills detonate them for bonus damage.', 'การโจมตีกายภาพสลักรูน สกิลเวทระเบิดรูนเพิ่มความเสียหาย'], ['#c0c8ff', '#3a4a7a', '#8fd0ff']],
  ['wild_archer', 'Wild Archer', 'ไวลด์อาร์เชอร์', 'archer', 'wind', ['bow'], P(5, 7, 4, 2, 10, 4), P(0.4, 0.6, 0.3, 0.1, 1.0, 0.3), ['Focus', 'สมาธิ'], ['Standing still builds Focus, increasing crit chance.', 'ยืนนิ่งสะสมสมาธิ เพิ่มโอกาสคริติคอล'], ['#3a6a2a', '#5a8a3a', '#d0b070']],
  ['falcon_scout', 'Falcon Scout', 'ฟัลคอนสเกาต์', 'archer', 'wind', ['bow'], P(5, 9, 4, 2, 8, 4), P(0.4, 0.8, 0.3, 0.1, 0.7, 0.3), ['Talon', 'กรงเล็บ'], ['A falcon companion strikes marked targets.', 'เหยี่ยวคู่ใจโจมตีเป้าหมายที่ถูกทำเครื่องหมาย'], ['#8a6a3a', '#6a5a3a', '#f0e0a0']],
  ['shadow_rogue', 'Shadow Rogue', 'ชาโดว์โร้ก', 'assassin', 'dark', ['dagger'], P(7, 10, 4, 1, 6, 6), P(0.6, 1.0, 0.3, 0.1, 0.5, 0.5), ['Combo', 'คอมโบ'], ['Builds combo points; finishers consume them.', 'สะสมแต้มคอมโบ สกิลปิดท้ายใช้แต้มทั้งหมด'], ['#1a1a2a', '#2a2a3a', '#8a2a5a']],
  ['phantom_dancer', 'Phantom Dancer', 'แฟนทอมแดนเซอร์', 'assassin', 'wind', ['dagger', 'whip'], P(5, 12, 4, 2, 6, 5), P(0.4, 1.1, 0.3, 0.2, 0.5, 0.4), ['Rhythm', 'จังหวะ'], ['Dodging builds Rhythm, empowering the next strike.', 'การหลบหลีกสะสมจังหวะ เสริมการโจมตีครั้งถัดไป'], ['#e080c0', '#7a3a8a', '#ffd0f0']],
  ['dawn_priest', 'Dawn Priest', 'ดอว์นพรีสต์', 'healer', 'light', ['staff', 'tome'], P(2, 3, 6, 10, 5, 4), P(0.1, 0.2, 0.5, 1.0, 0.4, 0.3), ['Grace', 'พระคุณ'], ['Healing builds Grace; full Grace makes next heal cleanse debuffs.', 'การรักษาสะสมพระคุณ เต็มแล้วฮีลถัดไปล้างสถานะผิดปกติ'], ['#f0e0a0', '#f8f4e8', '#e0b040']],
  ['spirit_monk', 'Spirit Monk', 'สปิริตมังก์', 'support', 'spirit', ['knuckle'], P(8, 7, 7, 4, 5, 3), P(0.7, 0.6, 0.6, 0.3, 0.4, 0.2), ['Chi', 'ปราณ'], ['Strikes generate Chi used to heal allies.', 'การโจมตีสร้างปราณเพื่อรักษาพันธมิตร'], ['#2a1a0a', '#e09a3a', '#a03a2a']],
  ['moon_oracle', 'Moon Oracle', 'มูนออราเคิล', 'support', 'dark', ['staff', 'cards'], P(2, 4, 5, 9, 6, 6), P(0.1, 0.3, 0.4, 0.9, 0.5, 0.5), ['Lunar Phase', 'ข้างขึ้น'], ['Cycles moon phases that alternate buffs and debuffs.', 'วนข้างขึ้นข้างแรม สลับระหว่างบัฟและดีบัฟ'], ['#d0d8ff', '#3a3a6a', '#c0c0ff']],
  ['flame_weaver', 'Flame Weaver', 'เฟลมวีฟเวอร์', 'mage', 'fire', ['staff', 'tome'], P(2, 4, 4, 11, 6, 3), P(0.1, 0.3, 0.3, 1.1, 0.5, 0.2), ['Heat', 'ความร้อน'], ['Fire spells raise Heat; at full Heat spells ignite in an area.', 'เวทไฟเพิ่มความร้อน เต็มแล้วเวทระเบิดเป็นวง'], ['#c03a1a', '#7a1a1a', '#ffb040']],
  ['frost_sage', 'Frost Sage', 'ฟรอสต์เซจ', 'mage', 'ice', ['staff'], P(2, 3, 5, 11, 6, 3), P(0.1, 0.2, 0.4, 1.1, 0.5, 0.2), ['Frost', 'น้ำแข็ง'], ['Chilled enemies take extra damage; shatter frozen targets.', 'ศัตรูที่หนาวเย็นรับความเสียหายเพิ่ม'], ['#e0f0ff', '#3a6a9a', '#a0e0ff']],
  ['storm_caller', 'Storm Caller', 'สตอร์มคอลเลอร์', 'mage', 'wind', ['staff', 'tome'], P(2, 6, 4, 10, 6, 3), P(0.1, 0.5, 0.3, 1.0, 0.5, 0.2), ['Charge', 'ประจุ'], ['Lightning chains to extra targets with Charge.', 'สายฟ้ากระโดดไปยังเป้าหมายเพิ่มตามประจุ'], ['#f0f080', '#3a3a8a', '#ffff60']],
  ['earth_keeper', 'Earth Keeper', 'เอิร์ธคีปเปอร์', 'mage', 'earth', ['staff'], P(4, 2, 7, 9, 4, 3), P(0.3, 0.1, 0.6, 0.9, 0.3, 0.2), ['Stone', 'ศิลา'], ['Earth spells grant stone skin stacks.', 'เวทดินมอบผิวศิลา'], ['#6a4a2a', '#5a6a3a', '#c0a060']],
  ['tide_witch', 'Tide Witch', 'ไทด์วิตช์', 'mage', 'water', ['staff', 'whip'], P(2, 5, 5, 10, 5, 4), P(0.1, 0.4, 0.4, 1.0, 0.4, 0.3), ['Tide', 'กระแสน้ำ'], ['High tide heals, low tide drowns.', 'น้ำขึ้นรักษา น้ำลงจมดิ่ง'], ['#2a8aa0', '#1a4a6a', '#80f0f0']],
  ['void_scholar', 'Void Scholar', 'วอยด์สกอลาร์', 'mage', 'dark', ['tome'], P(2, 3, 4, 12, 5, 4), P(0.1, 0.2, 0.3, 1.2, 0.4, 0.3), ['Entropy', 'เอนโทรปี'], ['Spends HP to empower spells.', 'ใช้ HP เพื่อเสริมพลังเวท'], ['#4a2a6a', '#1a0a2a', '#a060ff']],
  ['sun_herald', 'Sun Herald', 'ซันเฮรัลด์', 'mage', 'light', ['staff', 'tome'], P(3, 3, 5, 10, 6, 3), P(0.2, 0.2, 0.4, 1.0, 0.5, 0.2), ['Radiance', 'รัศมี'], ['Light damage stacks Radiance, blinding foes at full.', 'ความเสียหายแสงสะสมรัศมี เต็มแล้วทำให้ศัตรูตาบอด'], ['#ffe080', '#f0a020', '#fff0c0']],
  ['beast_tamer', 'Beast Tamer', 'บีสต์เทมเมอร์', 'summoner', 'earth', ['whip', 'spear'], P(6, 6, 6, 5, 5, 4), P(0.5, 0.5, 0.5, 0.4, 0.4, 0.3), ['Bond', 'สายสัมพันธ์'], ['Pets deal more damage as Bond rises.', 'สัตว์เลี้ยงแรงขึ้นตามสายสัมพันธ์'], ['#7a4a1a', '#8a6a2a', '#40a040']],
  ['grove_warden', 'Grove Warden', 'โกรฟวอร์เดน', 'summoner', 'earth', ['staff'], P(3, 4, 6, 9, 5, 3), P(0.2, 0.3, 0.5, 0.9, 0.4, 0.2), ['Bloom', 'บุปผา'], ['Summons treants that root enemies.', 'อัญเชิญภูตไม้ที่ตรึงศัตรู'], ['#3a7a2a', '#2a5a1a', '#a0e060']],
  ['soul_binder', 'Soul Binder', 'โซลไบน์เดอร์', 'summoner', 'spirit', ['tome', 'staff'], P(2, 4, 5, 10, 5, 4), P(0.1, 0.3, 0.4, 1.0, 0.4, 0.3), ['Souls', 'วิญญาณ'], ['Defeated enemies grant souls for spirit summons.', 'ศัตรูที่ล้มมอบวิญญาณเพื่ออัญเชิญ'], ['#a0f0e0', '#2a4a4a', '#60e0c0']],
  ['iron_engineer', 'Iron Engineer', 'ไอรอนเอ็นจิเนียร์', 'tech', 'neutral', ['gun'], P(4, 5, 5, 6, 10, 3), P(0.3, 0.4, 0.4, 0.5, 1.0, 0.2), ['Heat Sink', 'ระบายความร้อน'], ['Deploys turrets; overheat empowers gadgets.', 'วางป้อมปืน ร้อนเกินเสริมพลังอุปกรณ์'], ['#3a3a3a', '#8a6a3a', '#e08a2a']],
  ['cannon_smith', 'Cannon Smith', 'แคนนอนสมิธ', 'tech', 'fire', ['gun'], P(8, 2, 8, 3, 8, 3), P(0.7, 0.1, 0.7, 0.2, 0.7, 0.2), ['Powder', 'ดินปืน'], ['Slow heavy shots; Powder boosts splash radius.', 'กระสุนหนักช้า ดินปืนขยายวงระเบิด'], ['#5a2a1a', '#4a4a4a', '#ffb060']],
  ['sky_dragoon', 'Sky Dragoon', 'สกายดรากูน', 'warrior', 'wind', ['spear'], P(9, 7, 6, 2, 5, 3), P(0.8, 0.6, 0.5, 0.1, 0.4, 0.2), ['Altitude', 'ระดับความสูง'], ['Leaping attacks build Altitude for a plunging finisher.', 'การกระโดดโจมตีสะสมความสูงสำหรับท่าดิ่ง'], ['#2a4a8a', '#5a7aaa', '#c0e0ff']],
  ['chrono_adept', 'Chrono Adept', 'โครโนแอดเดปต์', 'mage', 'spirit', ['tome', 'staff'], P(2, 5, 4, 10, 7, 3), P(0.1, 0.4, 0.3, 1.0, 0.6, 0.2), ['Time', 'กาลเวลา'], ['Full Time gauge resets one cooldown.', 'มาตรเวลาเต็มรีเซ็ตคูลดาวน์หนึ่งสกิล'], ['#e0d0a0', '#4a3a6a', '#f0c040']],
  ['fortune_dealer', 'Fortune Dealer', 'ฟอร์จูนดีลเลอร์', 'assassin', 'neutral', ['cards'], P(4, 7, 4, 6, 5, 12), P(0.3, 0.6, 0.3, 0.5, 0.4, 1.1), ['Luck', 'โชค'], ['Each skill rolls a random multiplier 0.5×–2.5×.', 'ทุกสกิลสุ่มตัวคูณ 0.5–2.5 เท่า'], ['#2a6a3a', '#1a1a1a', '#f0d040']],
  ['melody_bard', 'Melody Bard', 'เมโลดี้บาร์ด', 'support', 'wind', ['lute'], P(3, 6, 5, 7, 6, 6), P(0.2, 0.5, 0.4, 0.6, 0.5, 0.5), ['Tempo', 'ทำนอง'], ['Songs grant party buffs; Tempo extends them.', 'บทเพลงบัฟปาร์ตี้ ทำนองยืดระยะเวลา'], ['#a04a2a', '#3a6a3a', '#f0e080']],
];

const ELEMENT_WORDS: Record<Element, [string, string][]> = {
  neutral: [['Steel', 'เหล็กกล้า'], ['Iron', 'เหล็ก'], ['Valor', 'กล้าหาญ']],
  fire: [['Ember', 'ถ่านไฟ'], ['Blaze', 'เพลิง'], ['Inferno', 'นรกไฟ']],
  water: [['Tide', 'กระแส'], ['Ripple', 'ระลอก'], ['Deluge', 'อุทกภัย']],
  earth: [['Stone', 'ศิลา'], ['Root', 'ราก'], ['Quake', 'ธรณี']],
  wind: [['Gale', 'วายุ'], ['Zephyr', 'ลมเย็น'], ['Tempest', 'พายุ']],
  ice: [['Frost', 'น้ำค้างแข็ง'], ['Glacier', 'ธารน้ำแข็ง'], ['Rime', 'เกล็ดน้ำแข็ง']],
  light: [['Dawn', 'รุ่งอรุณ'], ['Halo', 'รัศมี'], ['Solar', 'สุริยา']],
  dark: [['Shade', 'เงา'], ['Umbral', 'มืดมิด'], ['Night', 'ราตรี']],
  spirit: [['Soul', 'วิญญาณ'], ['Astral', 'ดารา'], ['Ether', 'อีเธอร์']],
};

type T = { n: [string, string]; type?: SkillDef['type']; tg: SkillDef['target']; dt: SkillDef['dmgType']; pw: number; cd: number; mp: number; rg: number; rad?: number; hits?: number; fx?: SkillEffect[]; x?: Partial<SkillDef>; v: string };
const REQ = [1, 1, 3, 6, 10, 14, 18, 22, 28, 34, 40, 48, 56, 65, 75, 85, 100, 115];
const mods = (...m: [Modifier['stat'], Modifier['kind'], number][]) => m.map(([stat, kind, value]) => ({ stat, kind, value }));

const KIT_MELEE: T[] = [
  { n: ['Strike', 'ฟัน'], tg: 'enemy', dt: 'phys', pw: 1.6, cd: 2500, mp: 6, rg: 60, v: 'slash' },
  { n: ['Sweep', 'กวาด'], tg: 'aoe_self', dt: 'phys', pw: 1.1, cd: 5000, mp: 12, rg: 0, rad: 90, v: 'whirl' },
  { n: ['Rush', 'พุ่งชน'], tg: 'enemy', dt: 'phys', pw: 1.3, cd: 8000, mp: 10, rg: 220, fx: [{ s: 'stun', d: 1200 }], x: { dash: 1 }, v: 'dash' },
  { n: ['Resolve', 'ปณิธาน'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['atk', 'pct', 4], ['maxHp', 'pct', 3]) }, v: 'none' },
  { n: ['Rend', 'ฉีก'], tg: 'enemy', dt: 'phys', pw: 1.2, cd: 6000, mp: 10, rg: 60, fx: [{ s: 'bleed', d: 5000 }], v: 'slash' },
  { n: ['War Cry', 'เสียงคำราม'], tg: 'party', dt: 'none', pw: 0, cd: 25000, mp: 20, rg: 0, rad: 300, fx: [{ s: 'atk_up', d: 12000, party: true }], v: 'buff' },
  { n: ['Cleave', 'ผ่า'], tg: 'cone', dt: 'phys', pw: 1.8, cd: 7000, mp: 16, rg: 100, rad: 100, v: 'arc' },
  { n: ['Guard', 'ป้องกัน'], tg: 'self', dt: 'none', pw: 0, cd: 20000, mp: 15, rg: 0, fx: [{ s: 'def_up', d: 8000, self: true }], v: 'buff' },
  { n: ['Sunder', 'ทลายเกราะ'], tg: 'enemy', dt: 'phys', pw: 1.5, cd: 9000, mp: 14, rg: 60, fx: [{ s: 'armor_break', d: 8000 }], v: 'slash' },
  { n: ['Mastery', 'ชำนาญ'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['crit', 'flat', 4], ['acc', 'pct', 6]) }, v: 'none' },
  { n: ['Quake', 'กระแทกพื้น'], tg: 'aoe_self', dt: 'phys', pw: 2.0, cd: 12000, mp: 24, rg: 0, rad: 130, fx: [{ s: 'slow', d: 3000 }], v: 'shock' },
  { n: ['Bloodlust', 'กระหายเลือด'], tg: 'self', dt: 'none', pw: 0, cd: 30000, mp: 20, rg: 0, fx: [{ s: 'lifesteal_up', d: 10000, self: true }], v: 'buff' },
  { n: ['Piercer', 'แทงทะลุ'], tg: 'line', dt: 'phys', pw: 2.4, cd: 10000, mp: 22, rg: 220, rad: 30, v: 'beam' },
  { n: ['Fortitude', 'ทรหด'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['def', 'pct', 8], ['ccResist', 'flat', 10]) }, v: 'none' },
  { n: ['Flurry', 'พายุฟัน'], tg: 'enemy', dt: 'phys', pw: 0.9, cd: 11000, mp: 26, rg: 70, hits: 4, v: 'slash' },
  { n: ['Aegis', 'อีจิส'], tg: 'self', dt: 'none', pw: 0, cd: 40000, mp: 30, rg: 0, x: { shieldPct: 0.3 }, fx: [{ s: 'shield', d: 10000, self: true }], v: 'shield' },
  { n: ['Executioner', 'เพชฌฆาต'], tg: 'enemy', dt: 'phys', pw: 4.0, cd: 20000, mp: 40, rg: 70, v: 'big' },
  { n: ['Cataclysm', 'มหาวิบัติ'], type: 'ultimate', tg: 'aoe_self', dt: 'phys', pw: 5.0, cd: 60000, mp: 60, rg: 0, rad: 180, fx: [{ s: 'stun', d: 1500 }], v: 'nova' },
];
const KIT_RANGED: T[] = [
  { n: ['Shot', 'ยิง'], tg: 'enemy', dt: 'phys', pw: 1.5, cd: 2000, mp: 5, rg: 320, v: 'arrow' },
  { n: ['Volley', 'ห่าธนู'], tg: 'aoe_target', dt: 'phys', pw: 1.0, cd: 6000, mp: 14, rg: 300, rad: 90, v: 'rain' },
  { n: ['Leap Back', 'กระโดดถอย'], tg: 'self', dt: 'none', pw: 0, cd: 9000, mp: 8, rg: 0, fx: [{ s: 'haste', d: 3000, self: true }], v: 'buff' },
  { n: ['Keen Eye', 'ตาเหยี่ยว'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['acc', 'pct', 10], ['crit', 'flat', 3]) }, v: 'none' },
  { n: ['Crippling Shot', 'ยิงขา'], tg: 'enemy', dt: 'phys', pw: 1.2, cd: 7000, mp: 10, rg: 320, fx: [{ s: 'slow', d: 4000 }], v: 'arrow' },
  { n: ['Pierce', 'ทะลวง'], tg: 'line', dt: 'phys', pw: 2.0, cd: 8000, mp: 16, rg: 360, rad: 24, v: 'beam' },
  { n: ['Focus', 'เพ่งเล็ง'], tg: 'self', dt: 'none', pw: 0, cd: 22000, mp: 15, rg: 0, fx: [{ s: 'focus', d: 10000, self: true }], v: 'buff' },
  { n: ['Snare Trap', 'กับดัก'], tg: 'aoe_target', dt: 'phys', pw: 0.8, cd: 12000, mp: 14, rg: 250, rad: 60, fx: [{ s: 'root', d: 2500 }], v: 'trap' },
  { n: ['Twin Shot', 'ยิงคู่'], tg: 'enemy', dt: 'phys', pw: 1.1, cd: 5000, mp: 12, rg: 320, hits: 2, v: 'arrow' },
  { n: ['Steady Aim', 'เล็งมั่น'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['atk', 'pct', 6], ['pen', 'flat', 5]) }, v: 'none' },
  { n: ['Blast', 'ระเบิด'], tg: 'aoe_target', dt: 'phys', pw: 2.0, cd: 11000, mp: 22, rg: 300, rad: 110, fx: [{ s: 'burn', d: 4000, c: 0.5 }], v: 'explosion' },
  { n: ['Blinding Flash', 'แสงวาบ'], tg: 'aoe_target', dt: 'phys', pw: 0.6, cd: 15000, mp: 16, rg: 280, rad: 100, fx: [{ s: 'blind', d: 4000 }], v: 'flash' },
  { n: ['Headshot', 'ยิงหัว'], tg: 'enemy', dt: 'phys', pw: 3.0, cd: 14000, mp: 26, rg: 380, v: 'arrow' },
  { n: ['Windwalk', 'เดินลม'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['moveSpeed', 'pct', 8], ['eva', 'pct', 8]) }, v: 'none' },
  { n: ['Barrage', 'สาดกระสุน'], tg: 'enemy', dt: 'phys', pw: 0.8, cd: 12000, mp: 28, rg: 320, hits: 5, v: 'arrow' },
  { n: ['Hunter Mark', 'ตราล่า'], tg: 'enemy', dt: 'phys', pw: 0.5, cd: 18000, mp: 18, rg: 380, fx: [{ s: 'curse', d: 10000 }], v: 'mark' },
  { n: ['Siege Round', 'กระสุนปิดล้อม'], tg: 'aoe_target', dt: 'phys', pw: 3.5, cd: 22000, mp: 42, rg: 340, rad: 130, v: 'explosion' },
  { n: ['Skyfall', 'ฟ้าถล่ม'], type: 'ultimate', tg: 'aoe_target', dt: 'phys', pw: 5.5, cd: 60000, mp: 60, rg: 360, rad: 170, v: 'rain' },
];
const KIT_CASTER: T[] = [
  { n: ['Bolt', 'ลูกศรเวท'], tg: 'enemy', dt: 'mag', pw: 1.7, cd: 2000, mp: 8, rg: 300, v: 'bolt' },
  { n: ['Burst', 'ระเบิดเวท'], tg: 'aoe_target', dt: 'mag', pw: 1.3, cd: 6000, mp: 18, rg: 280, rad: 90, v: 'explosion' },
  { n: ['Blink', 'วาร์ป'], tg: 'self', dt: 'none', pw: 0, cd: 10000, mp: 12, rg: 0, fx: [{ s: 'evasion_up', d: 3000, self: true }], v: 'buff' },
  { n: ['Arcane Mind', 'จิตเวท'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['matk', 'pct', 5], ['maxMp', 'pct', 8]) }, v: 'none' },
  { n: ['Hex', 'คำสาป'], tg: 'enemy', dt: 'mag', pw: 1.0, cd: 7000, mp: 14, rg: 300, fx: [{ s: 'weaken', d: 6000 }], v: 'mark' },
  { n: ['Wave', 'คลื่น'], tg: 'cone', dt: 'mag', pw: 1.8, cd: 8000, mp: 20, rg: 160, rad: 160, fx: [{ s: 'chill', d: 3000, c: 0.5 }], v: 'arc' },
  { n: ['Mana Shield', 'โล่มานา'], tg: 'self', dt: 'none', pw: 0, cd: 25000, mp: 25, rg: 0, x: { shieldPct: 0.25 }, fx: [{ s: 'shield', d: 10000, self: true }], v: 'shield' },
  { n: ['Chain', 'ลูกโซ่'], tg: 'enemy', dt: 'mag', pw: 1.4, cd: 9000, mp: 22, rg: 300, x: { chain: 3 }, v: 'chain' },
  { n: ['Lance', 'หอกเวท'], tg: 'line', dt: 'mag', pw: 2.3, cd: 9000, mp: 24, rg: 340, rad: 28, v: 'beam' },
  { n: ['Attunement', 'ประสานธาตุ'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['elemBonus', 'flat', 10], ['mpen', 'flat', 6]) }, v: 'none' },
  { n: ['Nova', 'โนวา'], tg: 'aoe_self', dt: 'mag', pw: 2.2, cd: 12000, mp: 30, rg: 0, rad: 140, fx: [{ s: 'stun', d: 800, c: 0.4 }], v: 'nova' },
  { n: ['Drain', 'ดูดพลัง'], tg: 'enemy', dt: 'mag', pw: 1.6, cd: 10000, mp: 18, rg: 280, x: { lifesteal: 0.4 }, v: 'drain' },
  { n: ['Meteor', 'อุกกาบาต'], tg: 'aoe_target', dt: 'mag', pw: 3.2, cd: 16000, mp: 40, rg: 320, rad: 120, castMsX: 0, v: 'explosion' } as T,
  { n: ['Clarity', 'ปัญญาใส'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['mpRegen', 'pct', 30], ['cdr', 'flat', 4]) }, v: 'none' },
  { n: ['Storm', 'พายุเวท'], tg: 'aoe_target', dt: 'mag', pw: 1.0, cd: 14000, mp: 36, rg: 300, rad: 130, hits: 4, v: 'rain' },
  { n: ['Silence', 'ปิดผนึก'], tg: 'enemy', dt: 'mag', pw: 0.8, cd: 18000, mp: 20, rg: 300, fx: [{ s: 'silence', d: 4000 }], v: 'mark' },
  { n: ['Annihilate', 'ทำลายล้าง'], tg: 'enemy', dt: 'mag', pw: 4.2, cd: 22000, mp: 50, rg: 320, v: 'big' },
  { n: ['Apocalypse', 'อวสาน'], type: 'ultimate', tg: 'aoe_target', dt: 'mag', pw: 6.0, cd: 60000, mp: 80, rg: 340, rad: 190, v: 'nova' },
];
const KIT_SUPPORT: T[] = [
  { n: ['Smite', 'ทัณฑ์'], tg: 'enemy', dt: 'mag', pw: 1.4, cd: 2200, mp: 6, rg: 280, v: 'bolt' },
  { n: ['Mend', 'ประสาน'], tg: 'party', dt: 'heal', pw: 1.6, cd: 4000, mp: 14, rg: 0, rad: 260, v: 'heal' },
  { n: ['Blessing', 'พร'], tg: 'party', dt: 'none', pw: 0, cd: 20000, mp: 18, rg: 0, rad: 300, fx: [{ s: 'def_up', d: 12000, party: true }], v: 'buff' },
  { n: ['Devotion', 'ศรัทธา'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['healPower', 'pct', 12], ['maxMp', 'pct', 6]) }, v: 'none' },
  { n: ['Renew', 'ฟื้นคืน'], tg: 'party', dt: 'none', pw: 0, cd: 12000, mp: 16, rg: 0, rad: 260, fx: [{ s: 'regen', d: 8000, party: true }], v: 'heal' },
  { n: ['Purify', 'ชำระล้าง'], tg: 'party', dt: 'heal', pw: 0.6, cd: 15000, mp: 14, rg: 0, rad: 260, x: { cleanse: true }, v: 'heal' },
  { n: ['Ward', 'ปราการ'], tg: 'party', dt: 'none', pw: 0, cd: 22000, mp: 26, rg: 0, rad: 260, x: { shieldPct: 0.15 }, fx: [{ s: 'shield', d: 8000, party: true }], v: 'shield' },
  { n: ['Judgement', 'พิพากษา'], tg: 'aoe_target', dt: 'mag', pw: 1.6, cd: 9000, mp: 20, rg: 280, rad: 90, fx: [{ s: 'blind', d: 2500, c: 0.4 }], v: 'explosion' },
  { n: ['Hymn', 'บทสวด'], tg: 'party', dt: 'none', pw: 0, cd: 24000, mp: 22, rg: 0, rad: 300, fx: [{ s: 'song', d: 15000, party: true }], v: 'buff' },
  { n: ['Serenity', 'สงบ'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['mpRegen', 'pct', 25], ['mdef', 'pct', 10]) }, v: 'none' },
  { n: ['Great Heal', 'มหาฮีล'], tg: 'party', dt: 'heal', pw: 3.0, cd: 14000, mp: 34, rg: 0, rad: 280, v: 'heal' },
  { n: ['Quicken', 'เร่ง'], tg: 'party', dt: 'none', pw: 0, cd: 26000, mp: 20, rg: 0, rad: 300, fx: [{ s: 'haste', d: 8000, party: true }], v: 'buff' },
  { n: ['Binding', 'พันธนาการ'], tg: 'aoe_target', dt: 'mag', pw: 1.0, cd: 14000, mp: 22, rg: 280, rad: 100, fx: [{ s: 'root', d: 2500 }], v: 'trap' },
  { n: ['Grace', 'พระคุณ'], type: 'passive', tg: 'self', dt: 'none', pw: 0, cd: 0, mp: 0, rg: 0, x: { passive: mods(['vit', 'pct', 8], ['hpRegen', 'pct', 30]) }, v: 'none' },
  { n: ['Clarion', 'แตรศึก'], tg: 'party', dt: 'none', pw: 0, cd: 30000, mp: 24, rg: 0, rad: 300, fx: [{ s: 'mp_regen_up', d: 15000, party: true }, { s: 'focus', d: 10000, party: true }], v: 'buff' },
  { n: ['Radiant Ray', 'ลำแสง'], tg: 'line', dt: 'mag', pw: 2.6, cd: 12000, mp: 30, rg: 340, rad: 28, v: 'beam' },
  { n: ['Sanctuary', 'สถานศักดิ์สิทธิ์'], tg: 'party', dt: 'heal', pw: 2.0, cd: 30000, mp: 50, rg: 0, rad: 300, fx: [{ s: 'invuln', d: 1500, party: true }], v: 'heal' },
  { n: ['Miracle', 'ปาฏิหาริย์'], type: 'ultimate', tg: 'party', dt: 'heal', pw: 6.0, cd: 90000, mp: 80, rg: 0, rad: 320, x: { cleanse: true }, fx: [{ s: 'regen', d: 10000, party: true }], v: 'heal' },
];

function kitFor(role: Role): T[] {
  if (role === 'archer' || role === 'tech') return KIT_RANGED;
  if (role === 'mage') return KIT_CASTER;
  if (role === 'healer' || role === 'support' || role === 'summoner') return KIT_SUPPORT;
  return KIT_MELEE;
}

function buildSkills(classId: string, role: Role, el: Element): SkillDef[] {
  const kit = kitFor(role);
  const words = ELEMENT_WORDS[el];
  return kit.map((t, i) => {
    const w = words[i % words.length]!;
    const fx = [...(t.fx ?? [])];
    // Role-specific transformations so classes sharing a kit still differ.
    let pw = t.pw; let target = t.tg; const x: Partial<SkillDef> = { ...(t.x ?? {}) };
    if (role === 'tank' && i === 1) fx.push({ s: 'taunt', d: 4000 });
    if (role === 'tank') pw *= 0.8;
    if (role === 'assassin' && t.dt === 'phys') { pw *= 1.15; if (i === 7) fx.splice(0, fx.length, { s: 'stealth', d: 5000, self: true }); }
    if (role === 'summoner' && (i === 4 || i === 12)) { x.summon = `${el}_spirit`; target = 'self'; }
    if (role === 'support' && t.dt === 'mag') pw *= 1.1;
    if (el === 'fire' && t.dt !== 'none' && t.dt !== 'heal' && i % 3 === 0) fx.push({ s: 'burn', d: 4000, c: 0.35 });
    if (el === 'ice' && t.dt !== 'none' && t.dt !== 'heal' && i % 3 === 0) fx.push({ s: 'chill', d: 3000, c: 0.5 });
    if (el === 'dark' && t.dt !== 'none' && t.dt !== 'heal' && i % 4 === 0) fx.push({ s: 'curse', d: 5000, c: 0.3 });
    if (el === 'earth' && t.dt !== 'none' && t.dt !== 'heal' && i % 4 === 1) fx.push({ s: 'slow', d: 3000, c: 0.4 });
    if (el === 'water' && t.dt !== 'none' && t.dt !== 'heal' && i % 4 === 2) fx.push({ s: 'poison', d: 5000, c: 0.4 });
    const isPassive = t.type === 'passive';
    const name: L10n = isPassive ? { en: `${w[0]} ${t.n[0]}`, th: `${t.n[1]}${w[1]}` } : { en: `${w[0]} ${t.n[0]}`, th: `${t.n[1]}${w[1]}` };
    return {
      id: `${classId}_s${String(i + 1).padStart(2, '0')}`, classId, name,
      desc: { en: describe(t, pw), th: describe(t, pw, true) },
      type: t.type ?? 'active', reqLevel: REQ[i]!, maxRank: t.type === 'ultimate' ? 3 : isPassive ? 5 : 10,
      mp: t.mp, cdMs: t.cd, castMs: t.dt === 'mag' && t.pw >= 3 ? 600 : 0, range: t.rg, radius: t.rad ?? 0, target,
      dmgType: t.dt, power: Math.round(pw * 100) / 100, perRank: 0.08, hits: t.hits ?? 1,
      element: t.dt === 'phys' && role !== 'warrior' && role !== 'assassin' ? null : el,
      effects: fx, vfx: t.v, icon: i, ...x,
    } satisfies SkillDef;
  });
}
function describe(t: T, pw: number, th = false): string {
  const tgt: Record<string, [string, string]> = { enemy: ['single target', 'เป้าหมายเดียว'], aoe_self: ['area around you', 'รอบตัว'], aoe_target: ['area at target', 'พื้นที่เป้าหมาย'], line: ['line', 'แนวเส้นตรง'], cone: ['cone', 'รูปกรวย'], party: ['party', 'ปาร์ตี้'], self: ['self', 'ตนเอง'] };
  if (t.type === 'passive') return th ? 'สกิลติดตัว เพิ่มค่าสถานะถาวร' : 'Passive: permanently improves stats.';
  const kind = t.dt === 'heal' ? (th ? 'รักษา' : 'Heals') : t.dt === 'none' ? (th ? 'เสริมพลัง' : 'Empowers') : (th ? 'โจมตี' : 'Deals');
  const pct = t.dt === 'none' ? '' : ` ${Math.round(pw * 100)}%${t.hits && t.hits > 1 ? ` ×${t.hits}` : ''}`;
  const fx = (t.fx ?? []).map((f) => f.s).join(', ');
  return th ? `${kind}${pct} (${tgt[t.tg]![1]})${fx ? ` + ${fx}` : ''}` : `${kind}${pct} ${t.dt === 'phys' ? 'physical' : t.dt === 'mag' ? 'magic' : ''} (${tgt[t.tg]![0]})${fx ? ` + ${fx}` : ''}`;
}

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(RAW.map(([id, en, th, role, el, weapons, base, growth, g, m, pal]) => [id, {
  id, name: { en, th }, role, element: el, weapons, base, growth,
  gauge: { name: { en: g[0], th: g[1] }, max: 100, perHit: role === 'tank' ? 8 : 6, effect: { en: m[0], th: m[1] } }, mechanic: { en: m[0], th: m[1] },
  palette: { hair: pal[0], body: pal[1], trim: pal[2] }, skills: buildSkills(id, role, el),
} satisfies ClassDef]));
export const CLASS_IDS = Object.keys(CLASSES);
export const ALL_SKILLS: Record<string, SkillDef> = Object.fromEntries(Object.values(CLASSES).flatMap((c) => c.skills.map((s) => [s.id, s])));
export const STARTER_CLASSES = ['vanguard', 'blade_sentinel', 'wild_archer', 'shadow_rogue', 'dawn_priest', 'flame_weaver', 'frost_sage', 'beast_tamer', 'melody_bard', 'fortune_dealer'];
