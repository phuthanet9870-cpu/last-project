import type { Element } from './config.js';
import type { Primary, Modifier } from './stats.js';
import { PX_PER_M, valuesAt, type BuildSrc, type ClassKitSrc, type GaugeDef, type GaugeUse, type NormalAttackDef, type SkillSrc } from './skills/v4.js';
import { KITS_A } from './skills/classdata_a.js';
import { KITS_B } from './skills/classdata_b.js';
import { KITS_C } from './skills/classdata_c.js';

export type Role = 'tank' | 'warrior' | 'assassin' | 'archer' | 'mage' | 'healer' | 'support' | 'summoner' | 'tech';
export type WeaponType = 'sword' | 'greatsword' | 'spear' | 'dagger' | 'bow' | 'staff' | 'tome' | 'knuckle' | 'gun' | 'lute' | 'cards' | 'whip';
export type L10n = { en: string; th: string };

export interface SkillEffect { s: string; d: number; c?: number; self?: boolean; party?: boolean }
export interface SkillDef {
  id: string; classId: string; name: L10n; desc: L10n; type: 'active' | 'passive' | 'ultimate';
  reqLevel: number; maxRank: number; mp: number; cdMs: number; castMs: number; range: number; radius: number;
  target: 'enemy' | 'self' | 'aoe_self' | 'aoe_target' | 'line' | 'cone' | 'party';
  dmgType: 'phys' | 'mag' | 'pure' | 'heal' | 'none'; power: number; perRank: number; hits: number; element: Element | null;
  effects: SkillEffect[]; dash?: number; knockback?: number; knockdown?: boolean; shieldPct?: number; summon?: string; chain?: number; cleanse?: boolean; lifesteal?: number;
  passive?: Omit<Modifier, 'source'>[]; vfx: string; icon: number;
  /** V4 tree data */ key: string; jobReq: number; asc: 1 | 2 | 3; tree: [number, number]; pre: [string, number][]; preAny: boolean; gauge?: GaugeUse; src: SkillSrc;
}
export interface ClassDef {
  id: string; name: L10n; role: Role; element: Element; weapons: WeaponType[]; base: Primary; growth: Primary;
  gauge: { name: L10n; max: number; perHit: number; effect: L10n; def: GaugeDef }; mechanic: L10n; normal: NormalAttackDef; builds: BuildSrc[];
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

// ---- Skill System V4: every class has its own authored kit (skills/classdata_*.ts). The old 4 shared role kits were removed (HB-003). ----
const KITS: Record<string, ClassKitSrc> = Object.fromEntries([...KITS_A, ...KITS_B, ...KITS_C].map((k) => [k.classId, k]));
const ROLE_ICON: Record<string, number> = { A: 0, P: 3, U: 17 };
/** Converts an authored V4 skill into the runtime SkillDef the combat engine executes (metres → px, seconds → ms). */
function toSkillDef(classId: string, el: Element, src: SkillSrc, idx: number): SkillDef {
  const type = src.ty === 'P' ? 'passive' : src.ty === 'U' ? 'ultimate' : 'active';
  const effects: SkillEffect[] = [
    ...(src.fx ?? []).map(([id, d, c]) => ({ s: id, d: Math.round(d * 1000), ...(c !== undefined ? { c } : {}) })),
    ...(src.fxSelf ?? []).map(([id, d]) => ({ s: id, d: Math.round(d * 1000), self: true })),
    ...(src.fxParty ?? []).map(([id, d]) => ({ s: id, d: Math.round(d * 1000), party: true })),
  ];
  const rv = valuesAt(src, 1);
  const x = src.x ?? {};
  const def: SkillDef = {
    id: `${classId}.${src.k}`, key: src.k, classId, name: { en: src.n[0], th: src.n[1] }, desc: { en: src.how[0], th: src.how[1] }, type,
    reqLevel: src.j, jobReq: src.j, asc: src.a, tree: src.at, pre: src.pre ?? [], preAny: !!src.any, maxRank: src.mx,
    mp: rv.mp, cdMs: rv.cdMs, castMs: x.castMs ?? 0, range: Math.round((src.r ?? 0) * PX_PER_M), radius: Math.round((src.rad ?? 0) * PX_PER_M),
    target: src.t ?? 'self', dmgType: src.d ?? 'none', power: src.p ?? 0, perRank: src.pr ?? 0.1, hits: src.h ?? 1,
    element: src.el === undefined ? (src.d === 'mag' || src.d === 'heal' ? el : null) : src.el,
    effects, vfx: src.v ?? 'none', icon: ROLE_ICON[src.ty]! + (idx % 3), gauge: src.g, src,
  };
  if (x.dash) def.dash = 1; if (x.knockback) def.knockback = x.knockback; if (x.knockdown) def.knockdown = true; if (x.shieldPct) def.shieldPct = x.shieldPct;
  if (x.summon) def.summon = x.summon; if (x.chain) def.chain = x.chain; if (x.cleanse) def.cleanse = true; if (x.lifesteal) def.lifesteal = x.lifesteal;
  if (src.ps) def.passive = src.ps.map(([stat, kind, value]) => ({ stat, kind, value }));
  return def;
}
function buildSkills(classId: string, el: Element): SkillDef[] {
  const kit = KITS[classId]; if (!kit) throw new Error(`No V4 skill kit for ${classId}`);
  return kit.skills.map((src, i) => toSkillDef(classId, el, src, i));
}

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(RAW.map(([id, en, th, role, el, weapons, base, growth, , , pal]) => [id, {
  id, name: { en, th }, role, element: el, weapons, base, growth,
  gauge: { name: { en: KITS[id]!.gauge.name[0], th: KITS[id]!.gauge.name[1] }, max: KITS[id]!.gauge.max, perHit: KITS[id]!.gauge.gain.hit ?? 0, effect: { en: KITS[id]!.gauge.desc[0], th: KITS[id]!.gauge.desc[1] }, def: KITS[id]!.gauge },
  mechanic: { en: KITS[id]!.gauge.desc[0], th: KITS[id]!.gauge.desc[1] }, normal: KITS[id]!.normal, builds: KITS[id]!.builds,
  palette: { hair: pal[0], body: pal[1], trim: pal[2] }, skills: buildSkills(id, el),
} satisfies ClassDef]));
export const CLASS_IDS = Object.keys(CLASSES);
export const ALL_SKILLS: Record<string, SkillDef> = Object.fromEntries(Object.values(CLASSES).flatMap((c) => c.skills.map((s) => [s.id, s])));
export const STARTER_CLASSES = ['vanguard', 'blade_sentinel', 'wild_archer', 'shadow_rogue', 'dawn_priest', 'flame_weaver', 'frost_sage', 'beast_tamer', 'melody_bard', 'fortune_dealer'];
/** V4 kit source for a class (gauge, normal attack, 18 skills, builds). */
export function classKit(classId: string): ClassKitSrc | undefined { return KITS[classId]; }
export const skillId = (classId: string, key: string) => `${classId}.${key}`;
