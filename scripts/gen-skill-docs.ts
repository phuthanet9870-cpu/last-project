/**
 * Generates the Skill System V4 data documents from the code (single source of truth):
 *   docs/skills/CLASS_SKILL_DATABASE.json, SKILL_TREE_REGISTRY.json, RECOMMENDED_BUILDS.json, SKILL_STONE_MODIFIERS.json,
 *   docs/skills/SKILL_BALANCE_REPORT.md (+ .json)
 * Balance numbers come from a deterministic headless combat simulation (World + real castSkill), not from estimates.
 * Run: npx tsx scripts/gen-skill-docs.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CLASSES, CLASS_IDS, PX_PER_M, PlayerService, Rng, STONE_BEHAVIORS, STONE_MODS, STONE_RULES, TILE, World, autoAllocateDraft, createCharacter, valuesAt,
} from '../packages/game-core/src/index.js';

const out = resolve(import.meta.dirname, '../docs/skills'); mkdirSync(out, { recursive: true });
const w = (f: string, d: unknown) => writeFileSync(resolve(out, f), typeof d === 'string' ? d : JSON.stringify(d, null, 1) + '\n');
const PROV = 'CUSTOM_DESIGN/NEEDS_BALANCING'; // nothing here was verified against the reference game (site unreachable)

// ---- CLASS_SKILL_DATABASE.json ----
const db = CLASS_IDS.map((c) => { const k = CLASSES[c]!; return {
  classId: c, name: k.name, role: k.role, element: k.element, weapons: k.weapons, provenance: PROV,
  gauge: { ...k.gauge.def, provenance: 'PROVIDED_SPEC (name) / CUSTOM_DESIGN (rules)' },
  normalAttack: { ...k.normal, rangePx: Math.round(k.normal.r * PX_PER_M), note: 'separate from the skill tree' },
  skills: k.skills.map((s) => ({ id: s.id, key: s.key, name: s.name, type: s.type, ascension: s.asc, tree: s.tree, jobReq: s.jobReq, maxRank: s.maxRank, prerequisites: s.pre, prerequisiteMode: s.preAny ? 'OR' : 'AND',
    target: s.target, damageType: s.dmgType, element: s.element, rangeM: s.range / PX_PER_M, radiusM: s.radius / PX_PER_M, effects: s.effects, gauge: s.gauge ?? null, vfx: s.vfx, description: s.desc,
    ranks: Array.from({ length: s.maxRank }, (_, i) => valuesAt(s.src, i + 1)), provenance: PROV })),
}; });
w('CLASS_SKILL_DATABASE.json', { generated: 'scripts/gen-skill-docs.ts', classes: db.length, skills: db.reduce((a, c) => a + c.skills.length, 0), data: db });
// ---- SKILL_TREE_REGISTRY.json ----
w('SKILL_TREE_REGISTRY.json', { generated: 'scripts/gen-skill-docs.ts', rules: { stages: 3, ascensionLevels: [40, 80], ascensionProvenance: 'CUSTOM_DESIGN (V4 fallback 40/80)', skillPoints: '1 per job level (job 1 = 1 point, spent on the starter skill); base level gives stat points only', jobLevelCap: 70, prerequisiteModes: ['AND', 'OR'] },
  trees: CLASS_IDS.map((c) => ({ classId: c, stages: [1, 2, 3].map((a) => ({ ascension: a, nodes: CLASSES[c]!.skills.filter((s) => s.asc === a).map((s) => ({ id: s.id, cell: s.tree, maxRank: s.maxRank, jobReq: s.jobReq, pre: s.pre, mode: s.preAny ? 'OR' : 'AND' })) })) })) });
// ---- RECOMMENDED_BUILDS.json ----
w('RECOMMENDED_BUILDS.json', { generated: 'scripts/gen-skill-docs.ts', count: CLASS_IDS.reduce((a, c) => a + CLASSES[c]!.builds.length, 0), note: 'Auto Allocate fills a draft in this order, then the ultimate path, passives, remaining skills; every step legal. Nothing is committed until Confirm.',
  builds: CLASS_IDS.flatMap((c) => CLASSES[c]!.builds.map((b) => ({ classId: c, ...b, finalDraftAtJob70: autoAllocateDraft({ classId: c, jobLevel: 70, ascension: 2, skillRanks: { [CLASSES[c]!.skills[0]!.id]: 1 } }, b.seq), provenance: PROV }))) });
// ---- SKILL_STONE_MODIFIERS.json ----
w('SKILL_STONE_MODIFIERS.json', { generated: 'scripts/gen-skill-docs.ts', rules: { ...STONE_RULES, refine: { max: STONE_RULES.refine.max, dustCost: 'L → 5 + 3L', successChance: 'max(30%, 100% − 7%·L)', bonusPerLevel: '+10% of each modifier' } }, modifiers: STONE_MODS,
  legendaryBehaviors: Object.fromEntries(Object.entries(STONE_BEHAVIORS).map(([k, v]) => [k, { name: v.name, desc: v.desc }])), provenance: PROV });

// ---- Balance simulation ----
// Each class at Lv 80 / job 70 / Ascension III with its first recommended build, no gear, all stat points into the build's first stat.
// 60 s against a stationary high-HP neutral training dummy (DEF = MDEF), casting the strongest ready damage skill, else normal attack.
// Also a 10-target pack test (AoE) and healing output on a damaged self. Deterministic RNG seed per class.
type Row = { classId: string; build: string; role: string; dps1: number; dpsPack: number; hps: number; skillsUsed: number; ccApplied: number };
const rows: Row[] = [];
for (const c of CLASS_IDS) {
  const cls = CLASSES[c]!; const build = cls.builds[0]!;
  const run = (pack: number) => {
    const clock = { t: 1_800_000_000_000 }; const p = createCharacter({ accountId: 'sim', name: 'Sim', classId: c, appearance: { body: 0, hair: 0, hairColor: '#000', skin: '#fc9', eyes: '#000' }, now: clock.t });
    const svc = new PlayerService(p, new Rng(42), () => clock.t); p.level = 80; p.jobLevel = 70; p.ascension = 2;
    const stat = (build.stats.split(' ')[0] ?? 'STR').toLowerCase() as 'str'; p.allocated[stat] = 240; svc.commitSkills(autoAllocateDraft(p, build.seq));
    const wd = new World({ mapId: 'whisperwood', rng: new Rng(7), bots: 0, now: () => clock.t }); const me = wd.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE }); me.mp = me.maxMp = 1e6;
    const mons = Array.from({ length: pack }, (_, i) => { const m = wd.spawnMonster('training_dummy', me.x + 40 + (i % 4) * 10, me.y - 15 + Math.floor(i / 4) * 10); m.maxHp = m.hp = 1e9; m.atkMult = 0; m.speedMult = 0; return m; });
    for (const e of wd.entities.values()) if (e.kind === 'monster' && !mons.includes(e)) wd.entities.delete(e.id);
    const actives = cls.skills.filter((s) => s.type !== 'passive' && (p.skillRanks[s.id] ?? 0) > 0);
    let used = 0, cc = 0; const hp0 = mons.reduce((a, m) => a + m.hp, 0); me.hp = me.maxHp * 0.3; let healed = 0;
    for (let t = 0; t < 600; t++) { // 60 s in 100 ms ticks
      clock.t += 100; wd.tick(100); me.hp = Math.min(me.hp, me.maxHp * 0.3); // keep the caster hurt so healing is measured
      const tg = mons[0]!; let cast = false;
      for (const s of actives.slice().sort((x, y) => (valuesAt(y.src, p.skillRanks[y.id]!).power * valuesAt(y.src, p.skillRanks[y.id]!).hits) - (valuesAt(x.src, p.skillRanks[x.id]!).power * valuesAt(x.src, p.skillRanks[x.id]!).hits))) {
        const before = me.hp; const r = wd.castSkill(me.id, s.id, tg.id); if (r === null) { used++; cast = true; if (s.dmgType === 'heal') healed += Math.max(0, me.hp - before); break; }
      }
      if (!cast) wd.basicAttack(me.id, tg.id);
      for (const m of mons) cc += m.effects.filter((e) => ['stun', 'freeze', 'root', 'sleep', 'silence', 'fear', 'knockdown', 'slow'].includes(e.id) && e.remainingMs > 0).length > 0 ? 0.1 / pack : 0;
    }
    const dmg = hp0 - mons.reduce((a, m) => a + Math.max(0, m.hp), 0);
    return { dps: dmg / 60, used, cc, hps: healed / 60 };
  };
  const one = run(1), pack = run(10);
  rows.push({ classId: c, build: build.id, role: cls.role, dps1: Math.round(one.dps), dpsPack: Math.round(pack.dps), hps: Math.round(one.hps), skillsUsed: one.used, ccApplied: Math.round(one.cc * 10) / 10 });
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
const m1 = med(rows.map((r) => r.dps1)), mp = med(rows.map((r) => r.dpsPack));
const flag = (r: Row) => [r.dps1 > m1 * 1.6 ? 'single-target HIGH' : '', r.dps1 < m1 * 0.5 && !['healer', 'support', 'tank'].includes(r.role) ? 'single-target LOW' : '', r.dpsPack > mp * 1.8 ? 'AoE HIGH' : ''].filter(Boolean).join(', ');
w('SKILL_BALANCE_REPORT.json', { generated: 'scripts/gen-skill-docs.ts', method: 'deterministic headless simulation (see header)', medianDps1: m1, medianDpsPack: mp, rows: rows.map((r) => ({ ...r, flags: flag(r) })) });
w('SKILL_BALANCE_REPORT.md', `# Skill balance report (V4) — SIMULATION_ONLY

Generated by \`npx tsx scripts/gen-skill-docs.ts\` from the real combat code (World.castSkill, gauges, ranks, passives).
**This is a headless simulation, not live-player data.** Every value is INITIAL BALANCE (CUSTOM_DESIGN / NEEDS_BALANCING).

Setup per class: Lv 80, job 70, Ascension III, first recommended build auto-allocated (70 points), 240 points in the build's main stat, no gear,
infinite MP, 60 s against Lv-60 neutral training dummies (DEF 240 = MDEF 240) that do not fight back. "Pack" = 10 dummies stacked within 2 m. HPS = self-healing while held at 30% HP.
Flags: single-target > 1.6× median, < 0.5× median (damage roles only), pack > 1.8× median.

Median single-target DPS: **${m1}** · median pack DPS: **${mp}**

| Class | Build | Role | DPS (1) | DPS (pack of 10) | HPS | Casts / 60 s | Flags |
|---|---|---|---:|---:|---:|---:|---|
${rows.map((r) => `| ${CLASSES[r.classId]!.name.en} | ${r.build} | ${r.role} | ${r.dps1} | ${r.dpsPack} | ${r.hps} | ${r.skillsUsed} | ${flag(r)} |`).join('\n')}

## What this does not cover
- No gear, cards, gems, stones, pets or party buffs; no movement, positioning or enemy defence variety.
- Summons only count if their hits land on the dummy within the window; support value (buffs/shields/CC) is not converted into damage.
- Numbers are for relative comparison between classes, to find outliers to tune. They are not final balance.
`);
if (process.argv.includes('--calibrate')) { // one calibration pass: move each class toward its role target, clamped to ×0.5…×2 per pass
  const dmgRoles = ['warrior', 'assassin', 'archer', 'mage', 'tech', 'summoner'];
  const dr = rows.filter((r) => dmgRoles.includes(r.role)); const M1 = med(dr.map((r) => r.dps1)), MP = med(dr.map((r) => r.dpsPack));
  const target: Record<string, number> = { tank: 0.45, support: 0.8, healer: 0, summoner: 0.9 };
  const { CLASS_POWER_SCALE } = await import('../packages/game-core/src/skills/balance.js');
  const next: Record<string, number> = {};
  for (const r of rows) { const t = target[r.role] ?? 1; const cur = CLASS_POWER_SCALE[r.classId] ?? 1; if (!t) { next[r.classId] = cur; continue; }
    const score = 0.7 * (r.dps1 / M1) + 0.3 * (r.dpsPack / MP); next[r.classId] = Math.round(cur * Math.max(0.5, Math.min(2, t / Math.max(0.05, score))) * 100) / 100; }
  writeFileSync(resolve(import.meta.dirname, '../packages/game-core/src/skills/balance.ts'), `/**\n * Per-class damage scale applied to every damaging skill's base power (and normal attack) of that class.\n * Produced by the calibration pass in scripts/gen-skill-docs.ts (--calibrate) from the headless combat simulation.\n * INITIAL BALANCE — SIMULATION_ONLY / NEEDS_BALANCING. 1 = unchanged.\n */\nexport const CLASS_POWER_SCALE: Record<string, number> = ${JSON.stringify(next, null, 1)};\n`);
  console.log('calibrated → packages/game-core/src/skills/balance.ts');
}
console.log(`wrote docs/skills: ${db.length} classes, ${rows.length} sim rows; median dps ${m1}, pack ${mp}`);
for (const r of rows) console.log(r.classId.padEnd(16), String(r.dps1).padStart(7), String(r.dpsPack).padStart(8), String(r.hps).padStart(6), flag(r));
