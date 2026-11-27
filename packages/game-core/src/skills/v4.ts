/**
 * Skill System V4 — data model, rank math and tree validation (spec "HEARTHBOUND — COMPLETE SKILL SYSTEM REWORK V4").
 * Authored per-class data lives in ./classdata*.ts; this file turns it into runtime SkillDef records that the
 * existing combat engine already understands, plus the V4 fields (ascension stage, tree position, prerequisites,
 * job-level requirement, per-skill max rank, gauge cost/gain, stone compatibility).
 *
 * Units: range/radius are authored in metres; 1 m = 24 px in the combat engine (PX_PER_M). The UI converts back.
 * All numbers are Hearthbound INITIAL BALANCE (CUSTOM_DESIGN) unless docs/SKILL_REFERENCE_MATRIX.md says otherwise.
 */
import type { Element } from '../config.js';
import type { Modifier } from '../stats.js';

export const PX_PER_M = 24;
export type Kind = 'A' | 'P' | 'U'; // active, passive, ultimate
export type Tgt = 'enemy' | 'self' | 'aoe_self' | 'aoe_target' | 'line' | 'cone' | 'party';
export type DmgT = 'phys' | 'mag' | 'pure' | 'heal' | 'none';
export interface GaugeUse { gain?: number; cost?: number; need?: number; scale?: number } // scale: +x% damage per gauge point spent
/** Authoring record (compact). */
export interface SkillSrc {
  k: string; n: [string, string]; ty: Kind; a: 1 | 2 | 3; at: [number, number]; mx: number; j: number;
  pre?: [string, number][]; any?: boolean; // any=true → OR prerequisites, else AND
  t?: Tgt; d?: DmgT; p?: number; pr?: number; h?: number; mp?: number; mpr?: number; cd?: number; cdr?: number; r?: number; rad?: number;
  fx?: [string, number, number?][]; fxSelf?: [string, number][]; fxParty?: [string, number][]; g?: GaugeUse;
  x?: { dash?: boolean; knockback?: number; knockdown?: boolean; shieldPct?: number; summon?: string; chain?: number; cleanse?: boolean; lifesteal?: number; castMs?: number; hitsPerRank?: number };
  ps?: [Modifier['stat'], Modifier['kind'], number][]; // passive mods, value per rank
  el?: Element | null; v?: string; how: [string, string];
}
export interface ClassKitSrc {
  classId: string; gauge: GaugeDef; normal: NormalAttackDef; skills: SkillSrc[]; builds: BuildSrc[];
}
export interface GaugeDef {
  key: string; name: [string, string]; kind: 'resource' | 'stacks' | 'phase' | 'combo' | 'charge';
  max: number; gain: { hit?: number; hurt?: number; heal?: number; cast?: number; kill?: number; crit?: number; still?: number }; decayPerSec?: number;
  /** what the full / spent gauge does — implemented in world.ts gaugeEffect() */
  effect: 'empower' | 'shield' | 'crit' | 'haste' | 'heal' | 'cdReset' | 'phase' | 'gamble' | 'selfburn' | 'summonBoost' | 'pierce' | 'freezeChance' | 'chainBoost';
  desc: [string, string];
}
export interface NormalAttackDef { n: [string, string]; style: 'melee' | 'ranged' | 'magic' | 'projectile'; d: 'phys' | 'mag'; p: number; hits: number; r: number; gaugeGain: number }
export interface BuildSrc { id: string; n: [string, string]; desc: [string, string]; pros: [string, string]; cons: [string, string]; stats: string; weapon: string; seq: [string, number][] }

/** Runtime skill at a given rank — the single source for combat AND the skill detail UI. */
export interface RankValues { rank: number; mp: number; cdMs: number; power: number; hits: number; rangeM: number; radiusM: number; durS: number; gaugeCost: number; gaugeGain: number; passive: { stat: string; kind: string; value: number }[] }
export function valuesAt(s: SkillSrc, rank: number): RankValues {
  const r = Math.max(1, Math.min(rank, s.mx)); const k = r - 1;
  const pw = s.p ?? 0; const power = Math.round(pw * (1 + (s.pr ?? 0.1) * k) * 1000) / 1000;
  const hits = (s.h ?? 1) + Math.floor((s.x?.hitsPerRank ?? 0) * k);
  const mp = Math.max(0, Math.round((s.mp ?? 0) + (s.mpr ?? (s.ty === 'P' ? 0 : 0.6)) * k));
  const cdMs = Math.max(s.ty === 'P' ? 0 : 500, Math.round(((s.cd ?? 0) - (s.cdr ?? 0) * k) * 1000));
  const durS = (s.fx?.[0]?.[1] ?? s.fxSelf?.[0]?.[1] ?? s.fxParty?.[0]?.[1] ?? 0);
  return { rank: r, mp, cdMs, power, hits, rangeM: s.r ?? 0, radiusM: s.rad ?? 0, durS, gaugeCost: s.g?.cost ?? 0, gaugeGain: s.g?.gain ?? 0, passive: (s.ps ?? []).map(([stat, kind, v]) => ({ stat, kind, value: Math.round(v * r * 100) / 100 })) };
}

/** Throws with a readable message when a class tree is invalid (used by tests and at module load in dev). */
export function validateKit(kit: ClassKitSrc): string[] {
  const errs: string[] = []; const by = new Map(kit.skills.map((s) => [s.k, s]));
  if (kit.skills.length !== 18) errs.push(`${kit.classId}: ${kit.skills.length} skills (need 18)`);
  if (by.size !== kit.skills.length) errs.push(`${kit.classId}: duplicate skill keys`);
  const stages = [1, 2, 3].map((a) => kit.skills.filter((s) => s.a === a).length); if (stages.some((n) => n === 0)) errs.push(`${kit.classId}: every ascension needs skills (${stages})`);
  const cells = new Set<string>();
  for (const s of kit.skills) {
    const cell = `${s.a}:${s.at[0]}:${s.at[1]}`; if (cells.has(cell)) errs.push(`${kit.classId}.${s.k}: tree cell ${cell} used twice`); cells.add(cell);
    for (const [pk, pr] of s.pre ?? []) { const p = by.get(pk); if (!p) errs.push(`${kit.classId}.${s.k}: unknown prerequisite ${pk}`); else { if (pr > p.mx) errs.push(`${kit.classId}.${s.k}: needs ${pk} rank ${pr} > max ${p.mx}`); if (p.a > s.a) errs.push(`${kit.classId}.${s.k}: prerequisite ${pk} is in a later ascension`); } }
    if (s.ty !== 'P' && (s.p === undefined && !s.fxSelf && !s.fxParty && !s.x?.summon && !s.x?.shieldPct)) errs.push(`${kit.classId}.${s.k}: active skill without any effect`);
    if (s.ty === 'P' && !(s.ps?.length)) errs.push(`${kit.classId}.${s.k}: passive without modifiers`);
    if (s.mx < 1 || s.mx > 10) errs.push(`${kit.classId}.${s.k}: max rank ${s.mx}`);
  }
  // cycle check (DFS)
  const state = new Map<string, number>(); const visit = (k: string, path: string[]): void => { if (state.get(k) === 2) return; if (state.get(k) === 1) { errs.push(`${kit.classId}: circular prerequisite ${[...path, k].join(' → ')}`); return; } state.set(k, 1); for (const [pk] of by.get(k)?.pre ?? []) visit(pk, [...path, k]); state.set(k, 2); };
  for (const s of kit.skills) visit(s.k, []);
  for (const b of kit.builds) for (const [k] of b.seq) if (!by.has(k)) errs.push(`${kit.classId} build ${b.id}: unknown skill ${k}`);
  return errs;
}
/** Minimum skill points needed to unlock a skill at rank 1 (prerequisite chain cost), for budget checks. */
export function unlockCost(kit: ClassKitSrc, key: string): number {
  const by = new Map(kit.skills.map((s) => [s.k, s])); const need = new Map<string, number>();
  const walk = (k: string, rank: number) => { if ((need.get(k) ?? 0) >= rank) return; need.set(k, rank); const s = by.get(k)!; for (const [pk, pr] of s.pre ?? []) { walk(pk, pr); if (s.any) break; } };
  walk(key, 1); return [...need.values()].reduce((a, b) => a + b, 0);
}
