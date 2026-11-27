/**
 * Skill System V4 — per-class gauge engine (spec §13). Pure functions; world.ts calls them and applies the results.
 * Every class gauge is defined in data (GaugeDef in skills/classdata_*.ts). Numbers are INITIAL BALANCE (CUSTOM_DESIGN).
 *
 *  kind      value range         meaning
 *  resource  0..max (100)        spent by skills with g.cost, gained by events
 *  stacks    0..max (int)        same, integer stacks
 *  charge    0..max (fractional) same, fractional gains (e.g. +0.34 per hit → 3 hits = 1 charge)
 *  combo     0..max (int)        builders add, finishers spend
 *  phase     0..max-1 (cyclic)   index of the current phase; each cast advances it
 */
import type { GaugeDef, GaugeUse } from './v4.js';

export type GaugeEvent = 'hit' | 'hurt' | 'heal' | 'cast' | 'kill' | 'crit' | 'still';
export interface CastMods {
  /** damage multiplier */ mult: number; healMult: number; ccMult: number;
  extraChain: number; critBonus: number; extraFreezeChance: number;
  selfHpCostPct: number; blindAll: boolean; resetLastCd: boolean; summonMult: number; summonDurMult: number;
  spent: number; phase: number | null;
}
export function gaugeMax(def: GaugeDef): number { return def.max; }
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Phase names shown in UI. */
export function phaseName(def: GaugeDef, value: number): [string, string] | null {
  if (def.kind !== 'phase') return null;
  const i = Math.floor(value) % def.max;
  if (def.key === 'lunar') return ([['New Moon', 'เดือนมืด'], ['Waxing', 'ข้างขึ้น'], ['Full Moon', 'จันทร์เต็มดวง'], ['Waning', 'ข้างแรม']] as [string, string][])[i]!;
  if (def.key === 'tide') return ([['High Tide', 'น้ำขึ้น'], ['Low Tide', 'น้ำลง']] as [string, string][])[i]!;
  return [`Phase ${i + 1}`, `ช่วง ${i + 1}`];
}

/** Can the skill be cast with the current gauge? (g.need) */
export function gaugeCheck(def: GaugeDef, value: number, use: GaugeUse | undefined): string | null {
  if (!use?.need || def.kind === 'phase') return null;
  return value + 1e-9 >= use.need ? null : 'NOT_ENOUGH_GAUGE';
}

/**
 * Compute cast modifiers and the new gauge value. Called once per cast, after cost/cooldown are committed.
 * `element` lets Heat apply only to fire spells; `isDamage` / `isHeal` restrict empower bonuses.
 */
export function gaugeCast(def: GaugeDef, value: number, use: GaugeUse | undefined, o: { element: string | null; isDamage: boolean; isHeal: boolean; summons: boolean }): { mods: CastMods; value: number } {
  const m: CastMods = { mult: 1, healMult: 1, ccMult: 1, extraChain: 0, critBonus: 0, extraFreezeChance: 0, selfHpCostPct: 0, blindAll: false, resetLastCd: false, summonMult: 1, summonDurMult: 1, spent: 0, phase: null };
  let v = value;
  // --- phase gauges: the CURRENT phase modifies this cast, then the phase advances (or is set by g.gain) ---
  if (def.kind === 'phase') {
    const ph = Math.floor(v) % def.max; m.phase = ph;
    if (def.key === 'lunar') { if (ph === 2) m.mult *= 1.3; if (ph === 0) m.ccMult *= 1.2; }
    else if (def.key === 'tide') { if (ph === 0) m.mult *= 1.25; else { m.healMult *= 1.25; m.ccMult *= 1.25; } }
    v = (ph + (def.gain.cast ?? 1)) % def.max;
    if (use?.gain !== undefined) v = use.gain % def.max; // "jump to phase"
    return { mods: m, value: v };
  }
  // --- passive effects that depend on the current value (before spending) ---
  const full = v >= def.max - 1e-9;
  const consumeFull = () => { if (!use?.cost) v = 0; }; // a full-gauge bonus empties the gauge unless the skill itself spends it (then it also gets the spend bonus)
  switch (def.effect) {
    case 'crit': if (def.kind === 'stacks') m.critBonus += v * 5; else if (def.kind === 'resource' && full && o.isDamage) { m.critBonus += 100; consumeFull(); } break;
    case 'heal': if (full && o.isHeal) { m.healMult *= 1.5; consumeFull(); } break;
    case 'selfburn':
      if (def.key === 'heat') { if (v >= 70 && o.element === 'fire') m.mult *= 1.2; if (full) m.selfHpCostPct = 5; }
      else { if (o.isDamage) m.mult *= 1 + 0.3 * (v / def.max); if (v >= 60) m.selfHpCostPct = 3; }
      break;
    case 'freezeChance': m.extraFreezeChance = v * 0.04; break;
    case 'chainBoost': if (v >= 5) m.extraChain = 1; break;
    case 'summonBoost':
      if (def.kind === 'stacks') m.summonMult = 1 + v * 0.15; else m.summonMult = 1 + v * 0.005;
      if (def.key === 'battery' && full && o.summons) { m.summonDurMult = 1.5; consumeFull(); }
      if (def.key === 'bond' && full && o.isDamage) { m.mult *= 2; consumeFull(); }
      break;
    case 'empower': if (def.key === 'radiance' && full && o.isDamage) { m.blindAll = true; consumeFull(); } break;
    default: break;
  }
  // --- spend (g.cost) → scale bonus ---
  if (use?.cost) {
    const spent = Math.min(v, use.cost); m.spent = round(spent); v -= spent;
    if (use.scale) { if (o.isDamage) m.mult *= 1 + (spent * use.scale) / 100; if (o.isHeal) m.healMult *= 1 + (spent * use.scale) / 100; }
    if (def.effect === 'cdReset' && use.need && spent + 1e-9 >= use.need) m.resetLastCd = true;
  }
  // --- gain on cast ---
  v += (def.gain.cast ?? 0) + (use?.gain ?? 0);
  return { mods: m, value: round(clamp(v, def.max)) };
}

/** Generic gain from a combat event. Returns the new value and whether the gauge just became full. */
export function gaugeGain(def: GaugeDef, value: number, ev: GaugeEvent, n = 1): { value: number; becameFull: boolean } {
  if (def.kind === 'phase') return { value, becameFull: false };
  const g = (def.gain[ev] ?? 0) * n; if (!g) return { value, becameFull: false };
  const v = round(clamp(value + g, def.max));
  return { value: v, becameFull: value < def.max && v >= def.max };
}
export function gaugeDecay(def: GaugeDef, value: number, dtSec: number): number {
  if (!def.decayPerSec || def.kind === 'phase' || value <= 0) return value;
  return round(Math.max(0, value - def.decayPerSec * dtSec));
}
/** Attack-speed bonus from Rhythm-like gauges (effect 'haste'): +3% per stack. */
export function gaugeAspdBonus(def: GaugeDef, value: number): number { return def.effect === 'haste' ? value * 0.03 : 0; }

// ---- Fortune Dealer: dice (spec §14 — cards / dice / reroll, never warrior skills) ----
export interface DiceRng { int(a: number, b: number): number; next(): number }
/** Roll a d6 whose lowest faces are removed by Fortune (each 25 Fortune → floor +1, max floor 5). Reroll keeps the better roll. */
export function fortuneDie(rng: DiceRng, fortune: number, reroll: boolean, bonusFloor = 0): number {
  const floor = Math.min(5, 1 + Math.floor(fortune / 25) + bonusFloor);
  const r = () => rng.int(floor, 6);
  return reroll ? Math.max(r(), r()) : r();
}
/** Generic damage multiplier for Fortune Dealer skills: 0.8× (roll 1) … 1.3× (roll 6). */
export const fortuneMult = (die: number) => 0.7 + die * 0.1;
