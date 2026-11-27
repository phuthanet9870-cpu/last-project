import type { Modifier, StatKey } from './stats.js';

export type StackPolicy = 'refresh' | 'stack' | 'ignore';
export interface StatusDef {
  id: string; name: { en: string; th: string }; kind: 'buff' | 'debuff';
  cc?: 'stun' | 'silence' | 'root' | 'sleep' | 'freeze' | 'fear' | 'disarm' | 'confusion';
  tickMs?: number; dotPctOfPower?: number; hotPctOfPower?: number; // per tick, scaled by applier power
  mods?: { stat: StatKey; kind: Modifier['kind']; value: number }[]; // per stack
  slowPct?: number; shield?: boolean; maxStacks: number; stack: StackPolicy; dispellable: boolean; color: string;
  stealth?: boolean; invuln?: boolean; taunt?: boolean;
}
const s = (d: Partial<StatusDef> & Pick<StatusDef, 'id' | 'name' | 'kind' | 'color'>): StatusDef => ({ maxStacks: 1, stack: 'refresh', dispellable: true, ...d });

export const STATUSES: Record<string, StatusDef> = Object.fromEntries([
  s({ id: 'poison', name: { en: 'Poison', th: 'พิษ' }, kind: 'debuff', tickMs: 1000, dotPctOfPower: 0.12, maxStacks: 5, stack: 'stack', color: '#7bd45a' }),
  s({ id: 'burn', name: { en: 'Burn', th: 'ไหม้' }, kind: 'debuff', tickMs: 1000, dotPctOfPower: 0.18, maxStacks: 3, stack: 'stack', color: '#ff7a2f' }),
  s({ id: 'bleed', name: { en: 'Bleed', th: 'เลือดไหล' }, kind: 'debuff', tickMs: 1000, dotPctOfPower: 0.15, maxStacks: 5, stack: 'stack', color: '#c8243a' }),
  s({ id: 'chill', name: { en: 'Chill', th: 'หนาวเย็น' }, kind: 'debuff', slowPct: 30, mods: [{ stat: 'aspd', kind: 'pct', value: -15 }], color: '#9fe3ff' }),
  s({ id: 'freeze', name: { en: 'Freeze', th: 'แช่แข็ง' }, kind: 'debuff', cc: 'freeze', color: '#c8f2ff' }),
  s({ id: 'knockdown', name: { en: 'Knocked Down', th: 'ล้มลง' }, kind: 'debuff', cc: 'stun', stack: 'ignore', color: '#d08040' }),
  s({ id: 'stun', name: { en: 'Stun', th: 'มึนงง' }, kind: 'debuff', cc: 'stun', color: '#ffe066' }),
  s({ id: 'silence', name: { en: 'Silence', th: 'ใบ้' }, kind: 'debuff', cc: 'silence', color: '#b58cff' }),
  s({ id: 'root', name: { en: 'Root', th: 'ตรึง' }, kind: 'debuff', cc: 'root', color: '#8a6b3d' }),
  s({ id: 'slow', name: { en: 'Slow', th: 'ช้าลง' }, kind: 'debuff', slowPct: 40, color: '#7aa0c8' }),
  s({ id: 'blind', name: { en: 'Blind', th: 'ตาบอด' }, kind: 'debuff', mods: [{ stat: 'acc', kind: 'pct', value: -40 }], color: '#555' }),
  s({ id: 'fear', name: { en: 'Fear', th: 'หวาดกลัว' }, kind: 'debuff', cc: 'fear', color: '#5d3b7a' }),
  s({ id: 'sleep', name: { en: 'Sleep', th: 'หลับ' }, kind: 'debuff', cc: 'sleep', color: '#a9b7ff' }),
  s({ id: 'confusion', name: { en: 'Confusion', th: 'สับสน' }, kind: 'debuff', cc: 'confusion', color: '#ff9fe0' }),
  s({ id: 'curse', name: { en: 'Curse', th: 'คำสาป' }, kind: 'debuff', mods: [{ stat: 'def', kind: 'pct', value: -20 }, { stat: 'mdef', kind: 'pct', value: -20 }], color: '#6b2a5e' }),
  s({ id: 'disarm', name: { en: 'Disarm', th: 'ปลดอาวุธ' }, kind: 'debuff', cc: 'disarm', color: '#999' }),
  s({ id: 'taunt', name: { en: 'Taunt', th: 'ยั่วยุ' }, kind: 'debuff', taunt: true, color: '#ff4444' }),
  s({ id: 'weaken', name: { en: 'Weaken', th: 'อ่อนแรง' }, kind: 'debuff', mods: [{ stat: 'atk', kind: 'pct', value: -20 }, { stat: 'matk', kind: 'pct', value: -20 }], color: '#a08060' }),
  s({ id: 'armor_break', name: { en: 'Armor Break', th: 'เกราะแตก' }, kind: 'debuff', mods: [{ stat: 'def', kind: 'pct', value: -30 }], maxStacks: 3, stack: 'stack', color: '#b0b0b0' }),
  s({ id: 'heal_cut', name: { en: 'Grievous', th: 'ลดการฟื้นฟู' }, kind: 'debuff', mods: [{ stat: 'healPower', kind: 'pct', value: -50 }], color: '#702020' }),
  s({ id: 'regen', name: { en: 'Regeneration', th: 'ฟื้นฟู' }, kind: 'buff', tickMs: 1000, hotPctOfPower: 0.15, color: '#6fe07a' }),
  s({ id: 'shield', name: { en: 'Shield', th: 'โล่' }, kind: 'buff', shield: true, color: '#7fd0ff' }),
  s({ id: 'matk_up', name: { en: 'Arcane Surge', th: 'พลังเวทพุ่ง' }, kind: 'buff', mods: [{ stat: 'matk', kind: 'pct', value: 20 }], color: '#b98cff' }),
  s({ id: 'mdef_break', name: { en: 'Ward Break', th: 'เกราะเวทแตก' }, kind: 'debuff', mods: [{ stat: 'mdef', kind: 'pct', value: -25 }], color: '#8a5cff' }),
  s({ id: 'atk_up', name: { en: 'Might', th: 'พลังโจมตี' }, kind: 'buff', mods: [{ stat: 'atk', kind: 'pct', value: 20 }, { stat: 'matk', kind: 'pct', value: 20 }], color: '#ff9b3d' }),
  s({ id: 'def_up', name: { en: 'Bulwark', th: 'ป้อมปราการ' }, kind: 'buff', mods: [{ stat: 'def', kind: 'pct', value: 35 }, { stat: 'mdef', kind: 'pct', value: 25 }, { stat: 'dmgReduce', kind: 'flat', value: 10 }], color: '#c0a060' }),
  s({ id: 'haste', name: { en: 'Haste', th: 'เร่งความเร็ว' }, kind: 'buff', mods: [{ stat: 'aspd', kind: 'pct', value: 25 }, { stat: 'moveSpeed', kind: 'pct', value: 25 }], color: '#ffffff' }),
  s({ id: 'focus', name: { en: 'Focus', th: 'สมาธิ' }, kind: 'buff', mods: [{ stat: 'crit', kind: 'flat', value: 15 }, { stat: 'acc', kind: 'pct', value: 20 }], color: '#ffd84a' }),
  s({ id: 'evasion_up', name: { en: 'Blur', th: 'ภาพลวง' }, kind: 'buff', mods: [{ stat: 'eva', kind: 'pct', value: 50 }], color: '#d0d0ff' }),
  s({ id: 'stealth', name: { en: 'Stealth', th: 'ล่องหน' }, kind: 'buff', stealth: true, mods: [{ stat: 'crit', kind: 'flat', value: 25 }], color: '#404060' }),
  s({ id: 'invuln', name: { en: 'Invulnerable', th: 'อมตะ' }, kind: 'buff', invuln: true, dispellable: false, color: '#fff6a0' }),
  s({ id: 'lifesteal_up', name: { en: 'Bloodthirst', th: 'กระหายเลือด' }, kind: 'buff', mods: [{ stat: 'lifesteal', kind: 'flat', value: 12 }], color: '#d02040' }),
  s({ id: 'mp_regen_up', name: { en: 'Clarity', th: 'ใจสงบ' }, kind: 'buff', mods: [{ stat: 'mpRegen', kind: 'pct', value: 150 }], color: '#6080ff' }),
  s({ id: 'song', name: { en: 'Battle Hymn', th: 'บทเพลงศึก' }, kind: 'buff', mods: [{ stat: 'atk', kind: 'pct', value: 12 }, { stat: 'matk', kind: 'pct', value: 12 }, { stat: 'aspd', kind: 'pct', value: 10 }], color: '#ffb0e0' }),
].map((d) => [d.id, d]));

export interface ActiveEffect { id: string; sourceId: string; remainingMs: number; stacks: number; tickAccMs: number; power: number; shieldHp: number }

/** Apply with stack policy; returns the effect instance (idempotent per call). CC duration reduced by ccResist (diminishing). */
export function applyStatus(list: ActiveEffect[], id: string, sourceId: string, durationMs: number, power: number, ccResist = 0, shieldHp = 0): ActiveEffect | null {
  const def = STATUSES[id];
  if (!def) return null;
  if (def.cc) durationMs = Math.floor(durationMs * (1 - Math.min(70, ccResist) / 100));
  const existing = list.find((e) => e.id === id);
  if (existing) {
    if (def.stack === 'ignore') return existing;
    if (def.stack === 'stack') existing.stacks = Math.min(def.maxStacks, existing.stacks + 1);
    existing.remainingMs = Math.max(existing.remainingMs, durationMs);
    existing.power = Math.max(existing.power, power);
    if (def.shield) existing.shieldHp = Math.max(existing.shieldHp, shieldHp);
    return existing;
  }
  const e: ActiveEffect = { id, sourceId, remainingMs: durationMs, stacks: 1, tickAccMs: 0, power, shieldHp };
  list.push(e);
  return e;
}

export interface TickResult { damage: number; heal: number; expired: string[] }
/** Advance effects by dt; DoT/HoT return totals, expired removed (modifiers removed exactly once by recomputation). */
export function tickStatuses(list: ActiveEffect[], dtMs: number): TickResult {
  const r: TickResult = { damage: 0, heal: 0, expired: [] };
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]!; const def = STATUSES[e.id]!;
    e.remainingMs -= dtMs;
    if (def.tickMs) {
      e.tickAccMs += dtMs;
      while (e.tickAccMs >= def.tickMs) {
        e.tickAccMs -= def.tickMs;
        if (def.dotPctOfPower) r.damage += Math.max(1, Math.floor(e.power * def.dotPctOfPower * e.stacks));
        if (def.hotPctOfPower) r.heal += Math.max(1, Math.floor(e.power * def.hotPctOfPower * e.stacks));
      }
    }
    if (e.remainingMs <= 0 || (def.shield && e.shieldHp <= 0)) { list.splice(i, 1); r.expired.push(e.id); }
  }
  return r;
}

export function statusModifiers(list: ActiveEffect[]): Modifier[] {
  const out: Modifier[] = [];
  for (const e of list) for (const m of STATUSES[e.id]?.mods ?? []) out.push({ stat: m.stat, kind: m.kind, value: m.value * e.stacks, source: `status:${e.id}` });
  return out;
}
export function hasCC(list: ActiveEffect[], ...cc: NonNullable<StatusDef['cc']>[]): boolean {
  return list.some((e) => { const c = STATUSES[e.id]?.cc; return !!c && (cc.length === 0 || cc.includes(c)); });
}
export function slowPct(list: ActiveEffect[]): number { return Math.min(80, list.reduce((s, e) => s + (STATUSES[e.id]?.slowPct ?? 0), 0)); }
export function absorbShield(list: ActiveEffect[], dmg: number): number {
  for (const e of list) if (STATUSES[e.id]?.shield && e.shieldHp > 0) { const a = Math.min(e.shieldHp, dmg); e.shieldHp -= a; dmg -= a; if (dmg <= 0) break; }
  return dmg;
}
export function cleanse(list: ActiveEffect[], kind: 'buff' | 'debuff'): number {
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) { const d = STATUSES[list[i]!.id]!; if (d.kind === kind && d.dispellable) { list.splice(i, 1); n++; } }
  return n;
}
