import { CONFIG, elementMultiplier, type Element } from './config.js';
import type { Rng } from './rng.js';
import type { CombatStats } from './stats.js';

export interface HitResult { damage: number; crit: boolean; miss: boolean; elementMult: number; blocked: boolean }

export interface DamageInput {
  attacker: CombatStats; defender: CombatStats; power: number; dmgType: 'phys' | 'mag' | 'pure';
  element: Element | null; buffMult?: number; pvp?: boolean; canMiss?: boolean;
}

/** Canonical damage formula (§12). Pure function with injected RNG; server and local adapter call the same code. */
export function computeHit(rng: Rng, i: DamageInput): HitResult {
  const a = i.attacker, d = i.defender;
  if (i.canMiss !== false && i.dmgType === 'phys') {
    const hit = Math.min(CONFIG.hitMax, Math.max(CONFIG.hitMin, 0.8 + (a.acc - d.eva) / 400));
    if (!rng.chance(hit)) return { damage: 0, crit: false, miss: true, elementMult: 1, blocked: false };
  }
  const el = i.element ?? a.element;
  const elementMult = elementMultiplier(el, d.armorElement);
  const attack = i.dmgType === 'mag' ? a.matk : a.atk;
  const defense = i.dmgType === 'pure' ? 0 : i.dmgType === 'mag' ? d.mdef : d.def;
  const pen = i.dmgType === 'mag' ? a.mpen : a.pen;
  const effDef = Math.max(0, defense - pen);
  const crit = rng.chance(Math.min(CONFIG.critCapPercent, a.crit) / 100);
  const critMult = crit ? CONFIG.critMultiplier + a.critDmg / 100 : 1;
  const variance = 1 + (rng.next() * 2 - 1) * CONFIG.damageVariance;
  const elemBonus = 1 + (a.elemBonus ?? 0) / 100;
  const pvpMult = i.pvp ? CONFIG.pvpDamageMultiplier * (1 + (a.pvpBonus - d.pvpReduce) / 100) : 1;
  let dmg = attack * i.power * (100 / (100 + effDef)) * elementMult * critMult * (i.buffMult ?? 1) * variance * elemBonus * pvpMult;
  dmg *= 1 - Math.min(60, d.dmgReduce) / 100;
  let blocked = false;
  if (d.block > 0 && rng.chance(d.block / 100)) { dmg *= 0.5; blocked = true; }
  const damage = Number.isFinite(dmg) ? Math.max(elementMult === 0 ? 0 : 1, Math.floor(dmg)) : 0;
  return { damage, crit, miss: false, elementMult, blocked };
}

/** Healing cannot exceed missing HP (§12). */
export function computeHeal(rng: Rng, healer: CombatStats, power: number, missingHp: number): { amount: number; crit: boolean } {
  const crit = rng.chance(Math.min(CONFIG.critCapPercent, healer.crit) / 200);
  const raw = (healer.matk * 0.6 + healer.healPower * 2 + 20) * power * (crit ? 1.5 : 1);
  return { amount: Math.max(0, Math.min(Math.floor(missingHp), Math.floor(raw))), crit };
}

export function skillPower(base: number, perRank: number, rank: number): number { return base * (1 + perRank * Math.max(0, rank - 1)); }
