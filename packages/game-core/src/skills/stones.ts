/**
 * Skill stones (Skill System V4 §24): one socket per active skill, free to embed/remove, first inscription free,
 * re-inscription costs Stone Dust + gold and offers keep-old / take-new, refine +0…+10, legendary stones add a behaviour.
 * Single source for SKILL_STONE_MODIFIERS.json (scripts/gen-skill-docs.mjs). Values: CUSTOM_DESIGN / NEEDS_BALANCING.
 */
export type StoneModKey = 'power' | 'cd' | 'mp' | 'radius';
export const STONE_MODS: Record<StoneModKey, { min: number; max: number; name: [string, string]; desc: [string, string] }> = {
  power: { min: 5, max: 15, name: ['Potency', 'พลัง'], desc: ['+x% skill damage/healing', 'ดาเมจ/การรักษาของสกิล +x%'] },
  cd: { min: 5, max: 12, name: ['Haste', 'เร่ง'], desc: ['−x% cooldown', 'คูลดาวน์ −x%'] },
  mp: { min: 5, max: 20, name: ['Thrift', 'ประหยัด'], desc: ['−x% MP cost', 'ค่า MP −x%'] },
  radius: { min: 5, max: 20, name: ['Reach', 'ขยาย'], desc: ['+x% area radius', 'รัศมีพื้นที่ +x%'] },
};
export type StoneBehavior = 'echo' | 'swift' | 'frugal' | 'expanse' | 'fork';
/** Legendary behaviours change how the skill works, not only its numbers. `fits` decides which skills can roll it. */
export const STONE_BEHAVIORS: Record<StoneBehavior, { name: [string, string]; desc: [string, string]; fits: (s: { hits: number; radius: number; chain?: number; dmgType: string }) => boolean }> = {
  echo: { name: ['Echo', 'เสียงสะท้อน'], desc: ['+1 hit; each hit deals 85% of normal', 'ตีเพิ่ม 1 ครั้ง แต่ละครั้งแรง 85%'], fits: (s) => s.dmgType === 'phys' || s.dmgType === 'mag' },
  swift: { name: ['Quicksilver', 'ปรอทเร็ว'], desc: ['Cooldown −30%', 'คูลดาวน์ −30%'], fits: () => true },
  frugal: { name: ['Hollow Cost', 'ไร้ต้นทุน'], desc: ['MP cost −50%', 'ค่า MP −50%'], fits: () => true },
  expanse: { name: ['Expanse', 'แผ่ขยาย'], desc: ['Area radius +50%', 'รัศมีพื้นที่ +50%'], fits: (s) => s.radius > 0 },
  fork: { name: ['Forked Path', 'ทางแยก'], desc: ['Chains to 2 more targets', 'กระโดดเพิ่ม 2 เป้าหมาย'], fits: (s) => (s.chain ?? 0) > 0 },
};
export const STONE_RULES = {
  firstInscriptionFree: true,
  reinscribe: { dust: 5, gold: 500 },
  refine: { max: 10, dust: (lvl: number) => 5 + lvl * 3, chance: (lvl: number) => Math.max(0.3, 1 - lvl * 0.07), perLevel: 0.1 },
  modsPerStone: 2,
} as const;
export interface StoneRng { int(a: number, b: number): number; shuffle<T>(a: T[]): T[] }
export function rollStoneMods(rng: StoneRng): { key: StoneModKey; value: number }[] {
  return rng.shuffle(Object.keys(STONE_MODS) as StoneModKey[]).slice(0, STONE_RULES.modsPerStone).map((key) => ({ key, value: rng.int(STONE_MODS[key].min, STONE_MODS[key].max) }));
}
export function rollBehavior(rng: StoneRng, s: Parameters<(typeof STONE_BEHAVIORS)['echo']['fits']>[0]): StoneBehavior {
  const ok = (Object.keys(STONE_BEHAVIORS) as StoneBehavior[]).filter((b) => STONE_BEHAVIORS[b].fits(s));
  return ok[rng.int(0, ok.length - 1)]!;
}
/** Apply one socketed stone to a skill instance (mutates). Refine adds +10% of each modifier per level. */
export function applyStone<T extends { power: number; cdMs: number; mp: number; radius: number; hits: number; chain?: number }>(e: T, stone: { mods: { key: StoneModKey; value: number }[]; refine: number; behavior?: StoneBehavior | null }): T {
  for (const m of stone.mods) { const v = (m.value * (1 + stone.refine * STONE_RULES.refine.perLevel)) / 100;
    if (m.key === 'power') e.power *= 1 + v; if (m.key === 'cd') e.cdMs = Math.max(500, Math.floor(e.cdMs * (1 - v))); if (m.key === 'mp') e.mp = Math.max(0, Math.floor(e.mp * (1 - v))); if (m.key === 'radius') e.radius = Math.floor(e.radius * (1 + v)); }
  switch (stone.behavior) {
    case 'echo': e.hits += 1; e.power *= 0.85; break;
    case 'swift': e.cdMs = Math.max(500, Math.floor(e.cdMs * 0.7)); break;
    case 'frugal': e.mp = Math.floor(e.mp * 0.5); break;
    case 'expanse': e.radius = Math.floor(e.radius * 1.5); break;
    case 'fork': if (e.chain) e.chain += 2; break;
    default: break;
  }
  return e;
}
