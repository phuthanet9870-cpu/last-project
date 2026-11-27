/** Skill System V4 — data, tree rules, atomic commit, migration, gauges, class identity. */
import { describe, expect, it } from 'vitest';
import {
  ALL_SKILLS, CLASSES, CLASS_IDS, MarketService, PlayerService, Rng, TILE, World, classKit, createCharacter, deserializePlayer, executeCommand, gaugeCast, playerStats,
  serializePlayer, skillPointBudget, validateKit, valuesAt, autoAllocateDraft, validateSkillDraft,
} from '../src/index.js';

const mk = (cls = 'blade_sentinel') => { const clock = { t: 1_800_000_000_000 }; const p = createCharacter({ accountId: 'acc', name: 'Vfour', classId: cls, appearance: { body: 0, hair: 0, hairColor: '#000', skin: '#fc9', eyes: '#000' }, now: clock.t }); const svc = new PlayerService(p, new Rng(7), () => clock.t); return { p, svc, clock }; };
const ctxFor = (w: World, svc: PlayerService, entityId: string) => ({ world: w, svc, session: {}, market: new MarketService(svc.p.wallet), mode: 'local' as const, dev: false, entityId }) as any;

describe('V4 data', () => {
  it('26 classes × 18 authored skills = 468, every tree valid (no cycles, prereqs exist, unique cells)', () => {
    expect(CLASS_IDS.length).toBe(26); expect(Object.keys(ALL_SKILLS).length).toBe(468);
    for (const id of CLASS_IDS) { const kit = classKit(id)!; expect(kit, id).toBeTruthy(); expect(validateKit(kit), id).toEqual([]); }
  });
  it('no two classes share a skill name (HB-003: no generic kits with element words)', () => {
    const names = Object.values(ALL_SKILLS).map((s) => s.name.en); expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => /^(Steel|Iron|Valor|Ember|Shade|Gale) (Strike|Sweep|Rush|Resolve|Bolt|Burst|Smite|Mend)$/.test(n))).toBe(false);
  });
  it('Fortune Dealer uses cards / dice / reroll, not warrior skills', () => {
    const fd = CLASSES.fortune_dealer!.skills.map((s) => s.key);
    for (const k of ['card_toss', 'roll_dice', 'reroll', 'wild_card', 'royal_flush', 'loaded_dice', 'jackpot', 'all_in']) expect(fd).toContain(k);
    expect(CLASSES.fortune_dealer!.gauge.def.effect).toBe('gamble');
  });
  it('26 distinct gauges and ≥ 52 recommended builds (2 per class) that reference real skills', () => {
    expect(new Set(CLASS_IDS.map((c) => CLASSES[c]!.gauge.def.key)).size).toBe(26);
    expect(CLASS_IDS.reduce((a, c) => a + CLASSES[c]!.builds.length, 0)).toBeGreaterThanOrEqual(52);
  });
  it('3 ascension stages per class; passives have modifiers, normal attack is separate from the tree', () => {
    for (const c of CLASS_IDS) { const k = CLASSES[c]!; expect(new Set(k.skills.map((s) => s.asc)).size).toBe(3); expect(k.normal.p).toBeGreaterThan(0); expect(k.skills.some((s) => s.key === 'normal')).toBe(false); }
  });
  it('rank table: next rank costs more MP and hits harder; detail UI and combat read the same values', () => {
    const s = CLASSES.vanguard!.skills.find((x) => x.type === 'active' && x.maxRank >= 5)!;
    const r4 = valuesAt(s.src, 4), r5 = valuesAt(s.src, 5); expect(r5.power).toBeGreaterThan(r4.power); expect(r5.mp).toBeGreaterThanOrEqual(r4.mp);
    const { svc, p } = mk('vanguard'); p.jobLevel = 70; p.skillRanks[s.id] = 5; const e = svc.effectiveSkill(s.id)!; expect(e.power).toBe(r5.power); expect(e.mp).toBe(r5.mp); expect(e.cdMs).toBe(r5.cdMs);
  });
});

describe('V4 allocation', () => {
  it('new character: starter skill rank 1, 0 points, base levels give no skill points (job level does)', () => {
    const { svc, p } = mk(); expect(Object.values(p.skillRanks)).toEqual([1]); expect(p.skillPoints).toBe(0);
    const lv0 = p.level; svc.gainExp(5000, 't'); expect(p.level).toBeGreaterThan(lv0); expect(p.skillPoints).toBe(skillPointBudget(p) - 1);
  });
  it('job level, prerequisite and ascension rules are enforced server-side', () => {
    const { svc, p } = mk('blade_sentinel'); const cls = CLASSES.blade_sentinel!;
    const gated = cls.skills.find((s) => s.asc === 1 && s.pre.length && !s.preAny)!; p.jobLevel = 70; p.skillPoints = 69;
    expect(svc.learnSkill(gated.id).err).toBe('PREREQUISITE');
    const late = cls.skills.find((s) => s.asc === 2 && s.pre.length === 0) ?? cls.skills.find((s) => s.asc === 2)!;
    const r = svc.commitSkills({ [late.id]: 1 }); expect(['ASCENSION_REQUIRED', 'PREREQUISITE']).toContain(r.err);
    p.jobLevel = 1; p.skillPoints = 5; const j = cls.skills.find((s) => s.jobReq > 1 && !s.pre.length)!; if (j) expect(svc.learnSkill(j.id).err).toBe('JOB_LEVEL_TOO_LOW');
  });
  it('atomic draft commit: all-or-nothing, revision check, idempotent retry', () => {
    const { svc, p } = mk('blade_sentinel'); p.jobLevel = 20; p.skillPoints = 19; const cls = CLASSES.blade_sentinel!; const first = cls.skills[0]!;
    const rev = p.skillRev!;
    const bad = svc.commitSkills({ [first.id]: 3, [cls.skills.find((s) => s.asc === 3)!.id]: 1 }, rev, 'op1'); expect(bad.ok).toBe(false); expect(p.skillRanks[first.id]).toBe(1); // nothing applied
    const good = svc.commitSkills({ [first.id]: 3 }, rev, 'op2'); expect(good.ok).toBe(true); expect(p.skillRanks[first.id]).toBe(3); expect(p.skillPoints).toBe(20 - 3);
    const replay = svc.commitSkills({ [first.id]: 3 }, rev, 'op2'); expect(replay.ok).toBe(true); expect((replay as any).data.duplicate).toBe(true); expect(p.skillPoints).toBe(17);
    expect(svc.commitSkills({ [first.id]: 4 }, rev, 'op3').err).toBe('STALE_REVISION');
    expect(svc.commitSkills({ [first.id]: 2 }, p.skillRev, 'op4').err).toBe('CANNOT_LOWER');
  });
  it('command skillCommit applies a whole recommended build draft that is legal', () => {
    const { svc, p } = mk('fortune_dealer'); p.jobLevel = 30; p.skillPoints = 29; const w = new World({ mapId: 'whisperwood', rng: new Rng(3), bots: 0 }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE });
    const id = (k: string) => `fortune_dealer.${k}`;
    const r = executeCommand(ctxFor(w, svc, me.id), 'skillCommit', { draft: { [id('card_toss')]: 4, [id('stacked_deck')]: 3, [id('lucky_streak')]: 5 }, rev: p.skillRev, opId: 'x1' });
    expect(r.ok).toBe(true); expect(p.skillRanks[id('stacked_deck')]).toBe(3);
  });
  it('passives apply only after commit', () => {
    const { svc, p } = mk('vanguard'); p.jobLevel = 10; p.skillPoints = 9; const pas = CLASSES.vanguard!.skills.find((s) => s.type === 'passive' && !s.pre.length && s.asc === 1)!;
    const before = playerStats(p).derived; svc.commitSkills({ [pas.id]: 3 }); const after = playerStats(p).derived;
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });
  it('reset refunds all points (scroll first, else gold)', () => {
    const { svc, p } = mk('vanguard'); p.jobLevel = 10; p.skillPoints = 9; svc.commitSkills({ [CLASSES.vanguard!.skills[0]!.id]: 5 }); svc.earn('gold', 5000, 't');
    svc.addItem('skill_reset_scroll', 1); const g0 = svc.gold(); const r = svc.resetSkills(); expect(r.ok).toBe(true); expect(p.skillPoints).toBe(9); expect(svc.gold()).toBe(g0); expect(svc.countItem('skill_reset_scroll')).toBe(0);
  });
});

describe('V4 builds', () => {
  it('every one of the 52 builds auto-allocates into a legal draft at job 70 / Ascension III using all points', () => {
    for (const c of CLASS_IDS) for (const b of CLASSES[c]!.builds) {
      const p = { classId: c, jobLevel: 70, ascension: 2, skillRanks: { [CLASSES[c]!.skills[0]!.id]: 1 } };
      const d = autoAllocateDraft(p, b.seq); expect(validateSkillDraft(p, d), `${c}/${b.id}`).toBeNull();
      const spent = Object.values(d).reduce((x, y) => x + y, 0); expect(spent, `${c}/${b.id}`).toBe(70); expect(Object.keys(d).some((k) => CLASSES[c]!.skills.find((x) => x.id === k)?.type === 'ultimate'), `${c}/${b.id} reaches ultimate`).toBe(true);
    }
  });
  it('auto allocate at low job level only takes legal ranks (no commit)', () => {
    const { p } = mk('frost_sage'); p.jobLevel = 6; const before = JSON.stringify(p.skillRanks);
    const d = autoAllocateDraft(p, CLASSES.frost_sage!.builds[0]!.seq); expect(validateSkillDraft(p, d)).toBeNull(); expect(JSON.stringify(p.skillRanks)).toBe(before);
  });
});

describe('V4 skill stones', () => {
  it('first inscription free; one socket per skill (free swap/remove); re-inscribe keeps old unless the player takes new; legendary behaviour changes the skill', () => {
    const { svc, p } = mk('storm_caller'); p.jobLevel = 10; p.skillPoints = 9; const sk = CLASSES.storm_caller!.skills.find((s) => s.key === 'chain_lightning')!; svc.commitSkills({ [sk.id]: 1 }); svc.earn('gold', 10000, 't'); svc.addItem('stone_dust', 30);
    const [a] = svc.addItem('skill_stone'); const [b] = svc.addItem('skill_stone'); const g0 = svc.gold();
    expect(svc.inscribeStone(a!.uid, sk.id).ok).toBe(true); expect(svc.gold()).toBe(g0); expect(svc.inscribeStone(a!.uid, sk.id).err).toBe('ALREADY_INSCRIBED');
    svc.inscribeStone(b!.uid, sk.id);
    expect(svc.socketStone(sk.id, a!.uid).ok).toBe(true); expect(svc.socketStone(sk.id, b!.uid).ok).toBe(true); expect(a!.locked).toBe(false); expect(p.skillSockets![sk.id]).toBe(b!.uid);
    const old = JSON.stringify(b!.stone!.mods); const r = svc.reinscribeStone(b!.uid); expect(r.ok).toBe(true); expect(JSON.stringify(b!.stone!.mods)).toBe(old); expect(b!.stone!.pending).toBeTruthy();
    expect(svc.gold()).toBe(g0 - 500n); svc.chooseInscription(b!.uid, 'old'); expect(JSON.stringify(b!.stone!.mods)).toBe(old); expect(b!.stone!.pending).toBeNull();
    const [L] = svc.addItem('skill_stone_legendary'); svc.inscribeStone(L!.uid, sk.id); expect(L!.stone!.behavior).toBeTruthy(); svc.socketStone(sk.id, L!.uid);
    L!.stone!.behavior = 'fork'; L!.stone!.mods = []; expect(svc.effectiveSkill(sk.id)!.chain).toBe((sk.chain ?? 0) + 2);
    expect(svc.socketStone(sk.id, null).ok).toBe(true); expect(svc.effectiveSkill(sk.id)!.chain).toBe(sk.chain);
  });
});

describe('V4 migration', () => {
  it('old generic skill ids are refunded, never remapped; hotbar items kept; idempotent', () => {
    const { p } = mk('fortune_dealer'); p.jobLevel = 25; delete (p as any).skillV; p.skillRanks = { fortune_dealer_s01: 5, fortune_dealer_s02: 3 }; p.skillPoints = 0; p.hotbar = ['fortune_dealer_s01', 'potion_hp_s', null, null, null, null, null, null];
    const q = deserializePlayer(serializePlayer(p)); expect(q.skillV).toBe(4); expect(Object.keys(q.skillRanks)).toEqual([CLASSES.fortune_dealer!.skills[0]!.id]); expect(q.skillPoints).toBe(24);
    expect(q.hotbar[1]).toBe('potion_hp_s'); expect(q.skillMigration!.refunded).toBe(8);
    const again = deserializePlayer(serializePlayer(q)); expect(again.skillRev).toBe(q.skillRev);
  });
});

describe('V4 gauges in combat', () => {
  it('Moon Oracle phase advances each cast and Full Moon boosts damage', () => {
    const def = CLASSES.moon_oracle!.gauge.def; let v = 0; const m: number[] = [];
    for (let i = 0; i < 4; i++) { const r = gaugeCast(def, v, undefined, { element: 'dark', isDamage: true, isHeal: false, summons: false }); m.push(r.mods.mult); v = r.value; }
    expect(m[2]).toBeCloseTo(1.3); expect(v).toBe(0);
  });
  it('skills with a gauge requirement fail without it (NOT_ENOUGH_GAUGE), succeed with it', () => {
    const { svc, p } = mk('spirit_monk'); const sk = CLASSES.spirit_monk!.skills.find((s) => s.key === 'asura_strike')!; p.jobLevel = 70; p.ascension = 2; p.skillRanks[sk.id] = 1;
    const w = new World({ mapId: 'whisperwood', rng: new Rng(5), bots: 0 }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE }); me.mp = me.maxMp = 9999;
    const m = w.spawnMonster('forest_slime', me.x + 30, me.y); m.maxHp = m.hp = 1e7;
    expect(w.castSkill(me.id, sk.id, m.id)).toBe('NOT_ENOUGH_GAUGE'); me.gauge = 5; expect(w.castSkill(me.id, sk.id, m.id)).toBeNull(); expect(me.gauge).toBeLessThan(1);
  });
  it('Fortune Dealer Roll the Dice records the dice it rolled', () => {
    const { svc, p } = mk('fortune_dealer'); const sk = CLASSES.fortune_dealer!.skills.find((s) => s.key === 'roll_dice')!; p.jobLevel = 5; p.skillRanks[sk.id] = 1;
    const w = new World({ mapId: 'whisperwood', rng: new Rng(9), bots: 0 }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE }); me.mp = me.maxMp = 9999;
    const m = w.spawnMonster('forest_slime', me.x + 30, me.y); m.maxHp = m.hp = 1e7; expect(w.castSkill(me.id, sk.id, m.id)).toBeNull();
    expect(me.lastRoll!.length).toBe(2); for (const d of me.lastRoll!) { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(6); }
  });
  it('cooldown reduction is capped at 20%', () => {
    const { p } = mk('wild_archer'); p.allocated.dex = 999; expect(playerStats(p).derived.cdr).toBeLessThanOrEqual(20);
  });
});
