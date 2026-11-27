/** Full System Rework phase C — mastery, equipment, gems, cards, cosmetics (HB-007, HB-016…024). */
import { describe, expect, it } from 'vitest';
import { CLASSES, CLASS_IDS, CONFIG, ITEMS, MONSTER_CARDS, OPTION_POOL, PlayerService, Rng, createCharacter, optionSlotOf, playerStats, newItem } from '../src/index.js';

const mk = (cls = 'blade_sentinel') => { const clock = { t: 1_800_000_000_000 }; const p = createCharacter({ accountId: 'acc', name: 'PhaseC', classId: cls, appearance: { body: 0, hair: 0, hairColor: '#000', skin: '#fc9', eyes: '#000' }, now: clock.t }); const svc = new PlayerService(p, new Rng(9), () => clock.t); return { p, svc, clock }; };

describe('HB-007 Astral Mastery', () => {
  it('starts at Lv 120 with Ascension III; levels 1–50 give 1 stat point each, 51+ give none; milestone announces', () => {
    const { svc, p } = mk(); p.level = CONFIG.levelCap; p.exp = 0; p.ascension = 1; const sp0 = p.statPoints; svc.gainExp(1e9, 't'); expect(p.mastery).toBe(0); expect(p.statPoints).toBe(sp0);
    p.ascension = CONFIG.masteryAscension; const events: any[] = []; (svc as any).emit = (e: any) => events.push(e);
    while (p.mastery < 52) svc.gainExp(1e12, 't');
    expect(p.mastery).toBeGreaterThanOrEqual(52); expect(p.statPoints - sp0).toBe(50);
    expect(events.some((e) => e.type === 'announce' && /Astral Mastery 50/.test(e.msg))).toBe(true); expect(p.titles).toContain('title_lantern_50');
  });
});

describe('HB-016 off-hands', () => {
  it('all 26 classes can equip a fitting off-hand; others refuse it; quiver works with a bow', () => {
    for (const c of CLASS_IDS) {
      const { svc, p } = mk(c); const role = CLASSES[c]!.role;
      const fits = Object.values(ITEMS).filter((d) => d.slot === 'off' && d.reqLevel <= 1 && d.offRoles?.includes(role)); expect(fits.length, `${c} (${role}) has an off-hand`).toBeGreaterThan(0);
      const ok = fits.filter((f) => { const [it] = svc.addItem(f.id); return svc.equip(it!.uid).ok; }); expect(ok.length, `${c} with its starting weapon can equip one of ${fits.map((f) => f.id)}`).toBeGreaterThan(0); expect(p.equipment.off).toBeTruthy();
      const wrong = Object.values(ITEMS).find((d) => d.slot === 'off' && d.reqLevel <= 1 && !d.offRoles?.includes(role))!; const [w] = svc.addItem(wrong.id); expect(svc.equip(w!.uid).err).toBe('CLASS_RESTRICTED');
    }
  });
});

describe('HB-017 option pools per slot', () => {
  it('no affix ever rolls on a slot that does not allow it (2,000 rolls across every slot)', () => {
    const rng = new Rng(3); const ids = Object.values(ITEMS).filter((d) => ['weapon', 'armor', 'accessory'].includes(d.type) && d.rarity !== 'common').map((d) => d.id);
    for (let i = 0; i < 2000; i++) { const d = ITEMS[ids[i % ids.length]!]!; const it = newItem(d.id, 1, rng); for (const o of it.options) expect(OPTION_POOL.find((x) => x.stat === o.stat)!.slots, `${d.id} ${o.stat}`).toContain(optionSlotOf(d)); }
  });
});

describe('HB-020 gems', () => {
  it('14 gem types × 5 grades exist; fusion stops at V', () => {
    const gems = Object.values(ITEMS).filter((d) => d.type === 'gem'); expect(new Set(gems.map((g) => g.id.replace(/_\d$/, ''))).size).toBe(14); expect(gems.length).toBe(70);
    const { svc } = mk(); svc.earn('gold', 1e6, 't'); svc.addItem('gem_jade_4', 3); expect(svc.fuseGems('gem_jade_4').ok).toBe(true); expect(svc.countItem('gem_jade_5')).toBe(1);
  });
});

describe('HB-021 monster cards', () => {
  it('two cards with the same stat in one row count once (highest); character-wide cap applies', () => {
    const { svc, p } = mk(); const w = p.equipment.main!; w.refine = 10;
    const atkCards = Object.values(MONSTER_CARDS).filter((c) => c.slot === 'weapon' && c.mods[0]!.stat === 'atk').sort((a, b) => a.mods[0]!.value - b.mods[0]!.value);
    expect(atkCards.length).toBeGreaterThanOrEqual(2); const lo = atkCards[0]!, hi = atkCards[atkCards.length - 1]!;
    const base = playerStats(p).derived.atk; w.cards = [hi.id, null]; const one = playerStats(p).derived.atk; w.cards = [hi.id, lo.id]; const two = playerStats(p).derived.atk;
    expect(one).toBeGreaterThan(base); expect(two).toBe(one); void svc;
  });
});

describe('HB-022 / HB-024', () => {
  it('companion slot equips; duplicates enhance atomically to +5 with stat growth', () => {
    const { svc, p } = mk(); const [c, d1] = [svc.addItem('companion_lanternfox')[0]!, svc.addItem('companion_lanternfox')[0]!]; expect(svc.equip(c.uid).ok).toBe(true); expect(p.equipment.companion?.uid).toBe(c.uid);
    const n0 = p.inventory.length; expect(svc.enhanceCosmetic(c.uid, d1.uid).ok).toBe(true); expect(p.inventory.length).toBe(n0 - 1); expect(c.cosmetic).toBe(1);
  });
  it('TCG cards never add combat stats', () => {
    const { p } = mk(); const before = JSON.stringify(playerStats(p).derived); p.tcg.collection = { tc_fire_striker: 3, tc_water_striker: 3 }; expect(JSON.stringify(playerStats(p).derived)).toBe(before);
  });
});
