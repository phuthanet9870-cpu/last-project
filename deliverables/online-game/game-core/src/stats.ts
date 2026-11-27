import { CONFIG, type Element } from './config.js';

export const PRIMARY = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const;
export type PrimaryKey = (typeof PRIMARY)[number];
export type Primary = Record<PrimaryKey, number>;

export const DERIVED = ['maxHp', 'maxMp', 'atk', 'matk', 'def', 'mdef', 'acc', 'eva', 'crit', 'critDmg', 'aspd', 'moveSpeed', 'cdr', 'hpRegen', 'mpRegen', 'pen', 'mpen', 'lifesteal', 'dmgReduce', 'block', 'healPower', 'dropBonus', 'goldBonus', 'expBonus', 'elemBonus', 'pvpBonus', 'pvpReduce', 'ccResist'] as const;
export type DerivedKey = (typeof DERIVED)[number];
export type Derived = Record<DerivedKey, number>;
export type StatKey = PrimaryKey | DerivedKey;

/** flat: added; pct: additive percentage group (+10 = +10%); mult: multiplicative group (1.1 = ×1.1). */
export interface Modifier { stat: StatKey; kind: 'flat' | 'pct' | 'mult'; value: number; source: string }

export function zeroPrimary(): Primary { return { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 }; }
export function zeroDerived(): Derived { const d = {} as Derived; for (const k of DERIVED) d[k] = 0; return d; }

export interface StatInput {
  level: number;
  base: Primary;
  growth: Primary; // per level
  allocated: Primary;
  modifiers: Modifier[]; // equipment, refine, options, gems, cards, pets, mounts, passives, buffs, titles (each tagged with source)
}
export interface StatResult { primary: Primary; derived: Derived; breakdown: Record<string, { stat: StatKey; value: number; kind: string }[]> }

const CAPS: Partial<Record<DerivedKey, [number, number]>> = {
  crit: [0, CONFIG.critCapPercent], cdr: [0, 20], dmgReduce: [0, 60], block: [0, 50], lifesteal: [0, 25],
  dropBonus: [0, 200], aspd: [0.3, 3], moveSpeed: [60, 260], eva: [0, 100000], ccResist: [0, 70],
};

/** Stat pipeline (§10). Order: primary(base+growth+alloc+flat) → pct → mult → derived formula + flat → pct → mult → clamp → round. */
export function computeStats(input: StatInput): StatResult {
  const L = input.level;
  const p = zeroPrimary();
  const breakdown: StatResult['breakdown'] = {};
  for (const m of input.modifiers) (breakdown[m.source] ??= []).push({ stat: m.stat, value: m.value, kind: m.kind });
  const flat = (k: StatKey) => input.modifiers.filter((m) => m.stat === k && m.kind === 'flat').reduce((s, m) => s + m.value, 0);
  const pct = (k: StatKey) => input.modifiers.filter((m) => m.stat === k && m.kind === 'pct').reduce((s, m) => s + m.value, 0);
  const mult = (k: StatKey) => input.modifiers.filter((m) => m.stat === k && m.kind === 'mult').reduce((s, m) => s * m.value, 1);
  for (const k of PRIMARY) {
    const raw = input.base[k] + Math.floor(input.growth[k] * (L - 1)) + input.allocated[k] + flat(k);
    p[k] = Math.max(1, Math.floor(raw * (1 + pct(k) / 100) * mult(k)));
  }
  const d = zeroDerived();
  // Base formulas from master prompt §10 (equipment enters via flat modifiers only, never twice).
  d.maxHp = 100 + L * 25 + p.vit * 18;
  d.maxMp = 50 + L * 8 + p.int * 12;
  d.atk = p.str * 2.5 + p.dex * 0.5 + L;
  d.matk = p.int * 3 + L;
  d.def = p.vit * 1.5;
  d.mdef = p.int * 0.8 + p.vit * 0.5;
  d.acc = 100 + p.dex * 2 + L;
  d.eva = p.agi * 1.5 + p.luk * 0.3 + L * 0.5;
  d.crit = 5 + p.luk * 0.2;
  d.critDmg = 0;
  d.aspd = 1 + p.agi * 0.004;
  d.moveSpeed = 120;
  d.cdr = p.dex * 0.1; // V4: CDR = min(20%, DEX×0.1% + equipment CDR) — PROVIDED_SPEC
  d.hpRegen = 1 + p.vit * 0.2;
  d.mpRegen = 1 + p.int * 0.15;
  d.healPower = p.int * 1.2;
  d.dropBonus = Math.min(30, p.luk * 0.1);
  for (const k of DERIVED) {
    let v = d[k] + flat(k);
    v = v * (1 + pct(k) / 100) * mult(k);
    const cap = CAPS[k];
    if (cap) v = Math.min(cap[1], Math.max(cap[0], v));
    if (!Number.isFinite(v)) v = 0;
    d[k] = k === 'aspd' ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
  }
  d.maxHp = Math.max(1, Math.floor(d.maxHp));
  d.maxMp = Math.max(0, Math.floor(d.maxMp));
  return { primary: p, derived: d, breakdown };
}

/** Combat power: single comparable number for rankings/matchmaking (assumption). */
export function combatPower(d: Derived, level: number): number {
  return Math.floor(d.atk * 2 + d.matk * 2 + d.def * 1.5 + d.mdef * 1.2 + d.maxHp * 0.25 + d.maxMp * 0.1 + d.crit * 8 + d.acc * 0.4 + d.eva * 0.6 + level * 10);
}

export interface CombatStats extends Derived { level: number; element: Element; armorElement: Element; }
