import { describe, expect, it } from 'vitest';
import {
  ALL_SKILLS, CLASSES, CLASS_IDS, ELEMENTS, ITEMS, Ledger, MONSTERS, MarketService, OrderBook, PlayerService, QUESTS, Rng, STARTER_DECKS, TCG_COLLECTIBLE, World,
  aiChooseAction, applyAction, computeHit, computeStats, createCharacter, deserializePlayer, elementMultiplier, getMap, findPath, legalActions, newMatch, placeBid, requiredExp,
  serializePlayer, settleAuction, validateDeck, viewFor, zeroPrimary, type Auction, MAPS, TILE, playerStats, DUNGEONS,
} from '../src/index.js';

const mk = (cls = 'blade_sentinel', t = 1_700_000_000_000) => { let now = t; const p = createCharacter({ accountId: 'acc1', name: 'Tester', classId: cls, appearance: { body: 0, hair: 0, hairColor: '#000', skin: '#fc9', eyes: '#000' }, now }); const svc = new PlayerService(p, new Rng(42), () => now); return { p, svc, adv: (ms: number) => { now += ms; }, now: () => now }; };

describe('content registry', () => {
  it('has 26 classes × 18 skills = 468 unique skill ids', () => { expect(CLASS_IDS.length).toBe(26); expect(Object.keys(ALL_SKILLS).length).toBe(468); for (const c of Object.values(CLASSES)) expect(c.skills.length).toBe(18); });
  it('has ≥100 items and ≥30 equipment, ≥20 monsters, ≥20 quests, ≥85 TCG cards', () => {
    expect(Object.keys(ITEMS).length).toBeGreaterThanOrEqual(100);
    expect(Object.values(ITEMS).filter((i) => i.slot).length).toBeGreaterThanOrEqual(30);
    expect(Object.keys(MONSTERS).length).toBeGreaterThanOrEqual(20); expect(Object.keys(QUESTS).length).toBeGreaterThanOrEqual(20); expect(TCG_COLLECTIBLE.length).toBeGreaterThanOrEqual(85);
  });
  it('monster drop tables reference real items', () => { for (const m of Object.values(MONSTERS)) for (const d of m.drops) expect(ITEMS[d.itemId], `${m.id}→${d.itemId}`).toBeTruthy(); });
  it('quest rewards reference real items', () => { for (const q of Object.values(QUESTS)) for (const r of [...(q.rewards.items ?? []).map((x) => x.itemId), ...(q.rewards.choice ?? [])]) expect(ITEMS[r], `${q.id}→${r}`).toBeTruthy(); });
  it('every map spawn and portal tile is walkable and portals reachable from spawn', () => {
    for (const id of Object.keys(MAPS)) { const m = getMap(id); const [sx, sy] = m.def.spawn; expect(m.solid[sy * m.w + sx], `${id} spawn`).toBe(0);
      for (const p of m.def.portals) { const px = Math.min(m.w - 2, Math.max(1, p.x)), py = Math.min(m.h - 2, Math.max(1, p.y)); expect(findPath(m, sx, sy, px, py, 20000), `${id}→${p.to}`).not.toBeNull(); } }
  });
});

describe('stats & combat formulas', () => {
  it('matches master prompt base formulas at level 1 with no modifiers', () => {
    const base = { str: 10, agi: 5, vit: 8, int: 4, dex: 6, luk: 5 };
    const r = computeStats({ level: 1, base, growth: zeroPrimary(), allocated: zeroPrimary(), modifiers: [] });
    expect(r.derived.maxHp).toBe(100 + 25 + 8 * 18); expect(r.derived.maxMp).toBe(50 + 8 + 4 * 12); expect(r.derived.atk).toBe(10 * 2.5 + 6 * 0.5 + 1); expect(r.derived.crit).toBe(6);
  });
  it('crit capped at 50%', () => { const r = computeStats({ level: 1, base: { ...zeroPrimary(), luk: 9999 }, growth: zeroPrimary(), allocated: zeroPrimary(), modifiers: [] }); expect(r.derived.crit).toBe(50); });
  it('81 element pairs all defined and in [0.25, 2]', () => { let n = 0; for (const a of ELEMENTS) for (const d of ELEMENTS) { const m = elementMultiplier(a, d); expect(m).toBeGreaterThanOrEqual(0.25); expect(m).toBeLessThanOrEqual(2); n++; } expect(n).toBe(81); expect(elementMultiplier('fire', 'ice')).toBe(2); expect(elementMultiplier('neutral', 'fire')).toBe(1); });
  it('damage formula is positive, finite, shields defense properly', () => {
    const rng = new Rng(1); const base = computeStats({ level: 10, base: { str: 20, agi: 5, vit: 5, int: 5, dex: 10, luk: 0 }, growth: zeroPrimary(), allocated: zeroPrimary(), modifiers: [] }).derived;
    const A = { ...base, level: 10, element: 'neutral' as const, armorElement: 'neutral' as const };
    for (let i = 0; i < 200; i++) { const h = computeHit(rng, { attacker: A, defender: { ...A, def: 1e9 }, power: 1, dmgType: 'phys', element: null }); expect(Number.isFinite(h.damage)).toBe(true); expect(h.damage).toBeGreaterThanOrEqual(0); }
    const pure = computeHit(new Rng(3), { attacker: A, defender: { ...A, def: 1e9 }, power: 1, dmgType: 'pure', element: null, canMiss: false });
    expect(pure.damage).toBeGreaterThan(10);
  });
});

describe('progression', () => {
  it('requiredExp(L)=floor(100*L^2.2)', () => { expect(requiredExp(1)).toBe(100); expect(requiredExp(10)).toBe(Math.floor(100 * Math.pow(10, 2.2))); });
  it('single EXP grant can raise multiple levels and grants points', () => { const { svc, p } = mk(); svc.gainExp(50_000, 'test'); expect(p.level).toBeGreaterThan(5); expect(p.statPoints).toBeGreaterThan(5 + 3 * 4); });
  it('ascension gate caps level at 60 until ascended', () => { const { svc, p } = mk(); svc.gainExp(1e12, 'test'); expect(p.level).toBe(60); svc.addItem('boss_heart', 3); expect(svc.ascend().ok).toBe(true); svc.gainExp(1e12, 'test'); expect(p.level).toBe(90); });
});

describe('items, equipment, refine', () => {
  it('equip enforces class weapon restriction and recomputes stats', () => {
    const { svc, p } = mk('blade_sentinel'); const before = playerStats(p).derived.atk; const [bow] = svc.addItem('iron_bow'); expect(svc.equip(bow!.uid).err).toBe('LEVEL_TOO_LOW');
    svc.gainExp(1e6, 't'); expect(svc.equip(bow!.uid).err).toBe('CLASS_RESTRICTED'); const [sw] = svc.addItem('iron_sword'); expect(svc.equip(sw!.uid).ok).toBe(true); expect(playerStats(p).derived.atk).toBeGreaterThan(before);
  });
  it('inventory overflow is mailed, never lost', () => { const { svc, p } = mk(); while (svc.freeSlots() > 0) svc.addItem('iron_sword'); const mail = p.mail.length; svc.addItem('iron_bow'); expect(p.mail.length).toBe(mail + 1); expect(p.mail[0]!.items[0]!.itemId).toBe('iron_bow'); });
  it('refine +1..+5 always succeeds and spends gold+ore exactly', () => {
    const { svc, p } = mk(); svc.earn('gold', 100000, 'test'); svc.addItem('refine_ore', 20); const w = p.equipment.main!; const g0 = svc.gold();
    for (let i = 0; i < 5; i++) expect(svc.refine(w.uid).data!.success).toBe(true);
    expect(w.refine).toBe(5); const spent = [1, 2, 3, 4, 5].reduce((s, l) => s + (200 + l * l * 150), 0); expect(g0 - svc.gold()).toBe(BigInt(spent));
  });
  it('refine never goes below +10 on downgrade and never destroys the item', () => { const { svc, p } = mk(); svc.earn('gold', 1e9, 't'); svc.addItem('refine_ore_hi', 999); svc.addItem('refine_ore', 99); const w = p.equipment.main!; w.refine = 15; for (let i = 0; i < 60; i++) svc.refine(w.uid); expect(w.refine).toBeGreaterThanOrEqual(10); expect(p.equipment.main).toBe(w); });
  it('gem socket requires +5', () => { const { svc, p } = mk(); const [g] = svc.addItem('gem_ruby_1'); expect(svc.socketGem(p.equipment.main!.uid, g!.uid).err).toBe('NO_SOCKET'); p.equipment.main!.refine = 5; expect(svc.socketGem(p.equipment.main!.uid, g!.uid).ok).toBe(true); expect(svc.countItem('gem_ruby_1')).toBe(0); });
});

describe('economy ledger & order matching', () => {
  it('market buy: 100,000 → seller 95,000 + 5,000 fee, ledger balanced', () => {
    const L = new Ledger(); L.mint('buyer', 'gold', 100000n, 'test'); L.post([{ account: 'buyer', currency: 'gold', amount: -100000n }, { account: 'seller', currency: 'gold', amount: 95000n }, { account: 'system:burn:tax', currency: 'gold', amount: 5000n }], 'buy');
    expect(L.available('seller', 'gold')).toBe(95000n); expect(L.verify().ok).toBe(true);
  });
  it('rejects unbalanced and negative-balance transactions; idempotent by key', () => {
    const L = new Ledger(); expect(() => L.post([{ account: 'a', currency: 'gold', amount: 5n }], 'x')).toThrow(/UNBALANCED|unbalanced/); expect(() => L.transfer('a', 'b', 'gold', 1n, 'x')).toThrow();
    L.mint('a', 'gold', 10n, 'r', 'k1'); L.mint('a', 'gold', 10n, 'r', 'k1'); expect(L.available('a', 'gold')).toBe(10n);
  });
  it('master prompt order book example: buy 300 @152 fills 100@150 + 200@152 = 45,400G', () => {
    const b = new OrderBook(); let t = 0; for (const [p, q] of [[150, 100], [152, 250], [155, 400], [158, 300], [160, 500]] as const) b.place({ id: `s${p}`, owner: `seller${p}`, side: 'sell', price: BigInt(p), qty: BigInt(q), ts: t++ });
    const r = b.place({ id: 'b1', owner: 'buyer', side: 'buy', price: 152n, qty: 300n, ts: t++ });
    expect(r.fills.map((f) => [Number(f.price), Number(f.qty)])).toEqual([[150, 100], [152, 200]]); expect(r.fills.reduce((s, f) => s + f.price * f.qty, 0n)).toBe(45400n); expect(r.order.status).toBe('filled');
    expect(b.depth().asks[0]).toEqual({ price: 152n, qty: 50n });
  });
  it('auction: outbid refunds reservation, settles exactly once', () => {
    const L = new Ledger(); L.mint('b1', 'gold', 1000n, 't'); L.mint('b2', 'gold', 1000n, 't');
    const a: Auction = { id: 'a1', seller: 's', itemUid: 'i', itemDefId: 'iron_sword', start: 100n, buyNow: null, current: 0n, bidder: null, endsAt: 1000, status: 'active', bids: [] };
    placeBid(L, a, 'b1', 100n, 0, 500, 30000); placeBid(L, a, 'b2', 200n, 10, 500, 30000);
    expect(L.available('b1', 'gold')).toBe(1000n); expect(L.bal('b2', 'gold').reserved).toBe(200n);
    expect(settleAuction(L, a, a.endsAt + 1, 500)).toBe('sold'); expect(settleAuction(L, a, a.endsAt + 2, 500)).toBeNull();
    expect(L.available('s', 'gold')).toBe(190n); expect(L.verify().ok).toBe(true);
  });
  it('market service list/buy/cancel race: second buy fails, item has single owner', () => {
    const A = mk(); const B = mk('dawn_priest'); const L = A.p.wallet; B.p.wallet = L; B.p.id = 'other'; L.mint(`p:${B.p.id}`, 'gold', 10000n, 't');
    const m = new MarketService(L); const [it] = A.svc.addItem('iron_sword'); const lst = m.list(A.svc, it!.uid, 500n);
    expect(A.svc.findInv(it!.uid)).toBeUndefined(); m.buy(B.svc, lst.id); expect(() => m.buy(B.svc, lst.id)).toThrow(); expect(() => m.cancel(A.svc, lst.id)).toThrow();
    expect(B.svc.findInv(it!.uid)).toBeTruthy(); expect(L.verify().ok).toBe(true);
  });
});

describe('pets & farm', () => {
  it('offline farm settlement is capped, food-limited and idempotent', () => {
    const { svc, p, adv } = mk(); const pet = svc.addPet('pet_slime'); svc.addItem('pet_food', 100); expect(svc.farmAssign(pet.uid, true).ok).toBe(true); expect(svc.farmAddFood(100).ok).toBe(true);
    adv(60 * 60_000); const r1 = svc.settleFarm(); expect(r1.minutes).toBe(60); const lvl = pet.level; const r2 = svc.settleFarm(); expect(r2.minutes).toBe(0); expect(pet.level).toBe(lvl);
    adv(48 * 3600_000); const r3 = svc.settleFarm(); expect(r3.minutes).toBeLessThanOrEqual(12 * 60); expect(p.farm.food).toBeGreaterThanOrEqual(0);
  });
  it('active pet cannot be on farm simultaneously', () => { const { svc, p } = mk(); const pet = svc.addPet('pet_wolf'); svc.summonPet(pet.uid); svc.farmAssign(pet.uid, true); expect(p.activePet).toBeNull(); expect(svc.summonPet(pet.uid).err).toBe('ON_FARM'); });
});

describe('quests', () => {
  it('tutorial chain: talk → kill 5 slimes → rewards once', () => {
    const { svc, p } = mk(); expect(svc.acceptQuest('mq01').ok).toBe(true); svc.talkTo('merchant_pip'); expect(svc.completeQuest('mq01').ok).toBe(true); expect(svc.completeQuest('mq01').ok).toBe(false);
    svc.acceptQuest('mq02'); for (let i = 0; i < 5; i++) svc.onKill('forest_slime', 2, 10, 0, []); const exp = p.exp; expect(svc.completeQuest('mq02').ok).toBe(true); expect(p.quests.done).toContain('mq02'); expect(p.exp + p.level).not.toBe(exp);
  });
});

describe('TCG', () => {
  it('7 starter decks are legal', () => { expect(Object.keys(STARTER_DECKS).length).toBe(7); for (const d of Object.values(STARTER_DECKS)) expect(validateDeck(d.cards)).toBeNull(); });
  it('AI vs AI match always terminates with a winner; illegal actions rejected; hidden info redacted', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const decks = Object.values(STARTER_DECKS); const s = newMatch(decks[seed % 7]!.cards, decks[(seed + 3) % 7]!.cards, seed);
      expect(applyAction(s, (1 - s.active) as 0 | 1, { type: 'end' })).toBe('NOT_YOUR_TURN');
      let n = 0; while (s.winner === null && n++ < 2000) { const a = aiChooseAction(s, s.active); expect(applyAction(s, s.active, a)).toBeNull(); }
      expect(s.winner).not.toBeNull();
      const v = viewFor(s, 0) as any; expect(typeof v.sides[1].hand).toBe('number'); expect(typeof v.sides[1].deck).toBe('number');
    }
  });
  it('legalActions empty for inactive player', () => { const d = Object.values(STARTER_DECKS)[0]!.cards; const s = newMatch(d, d, 5); expect(legalActions(s, (1 - s.active) as 0 | 1)).toEqual([]); });
});

describe('gacha (simulated currency)', () => {
  it('pity guarantees legendary+ within 50 draws', () => { const { svc, p } = mk(); svc.earn('crystal', 1e7, 't'); let got = false; for (let i = 0; i < 5; i++) { const r = svc.gachaDraw(10, false); if (r.data!.some((x) => x.rarity === 'legendary' || x.rarity === 'mythic')) got = true; } expect(got).toBe(true); expect(p.gacha.pity).toBeLessThan(50); });
});

describe('world simulation', () => {
  it('player kills a monster: EXP, gold, death processed once, loot owned by killer', () => {
    const { svc, p } = mk(); let now = 1_700_000_000_000; const w = new World({ mapId: 'whisperwood', rng: new Rng(9), now: () => now }); const e = w.addPlayer(svc);
    const m = [...w.entities.values()].find((x) => x.kind === 'monster' && x.defId === 'forest_slime')!; m.x = e.x + 30; m.y = e.y; m.hp = 1;
    const gold0 = svc.gold(); let err: string | null = 'x'; for (let i = 0; i < 20 && !m.dead; i++) { err = w.basicAttack(e.id, m.id); now += 2000; w.tick(50); }
    expect(m.dead).toBe(true); expect(p.exp).toBeGreaterThan(0); expect(svc.gold()).toBeGreaterThan(gold0); expect(p.counters.kills).toBe(1);
    w.kill(m, e); expect(p.counters.kills).toBe(1); void err;
  });
  it('server-side movement respects collision (cannot walk through border cliffs)', () => { const { svc } = mk(); const w = new World({ mapId: 'emberglen', rng: new Rng(1) }); const e = w.addPlayer(svc); w.setInput(e.id, -1, 0); for (let i = 0; i < 400; i++) w.tick(50); expect(e.x).toBeGreaterThan(TILE); });
  it('dungeon run grants completion reward exactly once', () => { const { svc, p } = mk(); svc.gainExp(1e5, 't'); expect(svc.startDungeon('mossy_hollow').ok).toBe(true); const r1 = svc.completeDungeon('mossy_hollow', 'run1'); const r2 = svc.completeDungeon('mossy_hollow', 'run1'); expect(r1.ok).toBe(true); expect(r2.ok).toBe(false); expect(p.dungeon.firstClears).toContain('mossy_hollow'); expect(Object.keys(DUNGEONS).length).toBe(51); });
});

describe('save/load', () => {
  it('round-trips BigInt wallet and full state', () => { const { svc, p } = mk(); svc.earn('gold', 12345, 't'); const s = serializePlayer(p); const q = deserializePlayer(s); expect(q.wallet.available(`p:${p.id}`, 'gold')).toBe(svc.gold()); expect(q.equipment.main!.defId).toBe(p.equipment.main!.defId); });
  it('rejects unknown save versions', () => { expect(() => deserializePlayer('{"v":99}')).toThrow(); });
});

import { applyStatus, tickStatuses, absorbShield, hasCC, statusModifiers, cleanse } from '../src/index.js';
describe('status effect engine', () => {
  it('stacking, DoT ticks, expiry and modifier removal', () => {
    const l: any[] = []; applyStatus(l, 'poison', 'src', 3000, 100); applyStatus(l, 'poison', 'src', 3000, 100); expect(l[0].stacks).toBe(2);
    const r = tickStatuses(l, 1000); expect(r.damage).toBe(24); tickStatuses(l, 2500); expect(l.length).toBe(0);
    applyStatus(l, 'atk_up', 's', 5000, 0); expect(statusModifiers(l).some((m) => m.stat === 'atk' && m.value === 20)).toBe(true); tickStatuses(l, 6000); expect(statusModifiers(l)).toEqual([]);
  });
  it('shield absorbs before HP; CC resist shortens duration; cleanse removes debuffs only', () => {
    const l: any[] = []; applyStatus(l, 'shield', 's', 5000, 0, 0, 50); expect(absorbShield(l, 80)).toBe(30); expect(l[0].shieldHp).toBe(0);
    const c: any[] = []; applyStatus(c, 'stun', 's', 2000, 0, 50); expect(c[0].remainingMs).toBe(1000); expect(hasCC(c, 'stun')).toBe(true);
    applyStatus(c, 'regen', 's', 2000, 10); expect(cleanse(c, 'debuff')).toBe(1); expect(c.map((x) => x.id)).toEqual(['regen']);
  });
});

describe('combat additions (v0.3)', () => {
  const setup = (cls = 'wild_archer') => { const t = mk(cls); let now = 1_700_000_000_000; const w = new World({ mapId: 'whisperwood', rng: new Rng(5), now: () => now }); const e = w.addPlayer(t.svc); for (const x of [...w.entities.values()]) if (x.kind === 'monster') w.entities.delete(x.id); return { ...t, w, e, tick: (ms: number) => { now += ms; w.tick(ms); }, at: () => now }; };
  it('ranged attacks travel as projectiles and hit on arrival, not instantly', () => {
    const { w, e, tick } = setup(); const m = w.spawnMonster('forest_slime', e.x + 200, e.y); m.ai!.state = 'idle';
    const hp0 = m.hp; expect(w.basicAttack(e.id, m.id)).toBeNull(); expect(m.hp).toBe(hp0); expect([...w.entities.values()].some((x) => x.kind === 'projectile')).toBe(true);
    for (let i = 0; i < 20; i++) tick(50); expect([...w.entities.values()].some((x) => x.kind === 'projectile')).toBe(false); expect(m.hp < hp0 || w.fx.some((f) => f.t === 'dmg' && f.miss)).toBe(true);
  });
  it('monster projectiles are dodgeable by moving away', () => {
    const { w, e, tick } = setup('vanguard'); const m = w.spawnMonster('ember_sprite', e.x + 170, e.y);
    const hp0 = e.hp; w.spawnProjectile(m, e, { homing: false, speed: 300, color: '#f00', kind: 'bolt', onHit: (v) => { v.hp -= 50; } });
    w.setInput(e.id, 0, 1); for (let i = 0; i < 14; i++) tick(50); expect(e.hp).toBeGreaterThanOrEqual(hp0 - 1);
  });
  it('knockback moves targets but stops at walls; bosses are immune', () => {
    const t = mk('vanguard'); const w = new World({ mapId: 'arena', rng: new Rng(2) }); const e = w.addPlayer(t.svc, { x: 13 * TILE, y: 10 * TILE }); const m = w.spawnMonster('forest_slime', e.x + 30, e.y); const x0 = m.x; w.knockback(m, e.x, e.y, 80); expect(m.x).toBeGreaterThan(x0 + 40);
    const b = w.spawnMonster('hollow_king', e.x + 40, e.y); const bx = b.x; w.knockback(b, e.x, e.y, 80); expect(b.x).toBe(bx);
    const wallX = 0.5 * TILE + 2; const n = w.spawnMonster('forest_slime', 1.5 * TILE, e.y); w.knockback(n, n.x + 10, n.y, 500); expect(n.x).toBeGreaterThan(wallX);
  });
  it('guard monsters hold their post and raise defense when hurt', () => {
    const { w, tick } = setup('vanguard'); const g = w.spawnMonster('thorn_sentry'); const hx = g.x; for (let i = 0; i < 100; i++) tick(100); expect(Math.abs(g.x - hx)).toBeLessThan(8);
    const attacker = [...w.entities.values()].find((x) => x.kind === 'player')!; w.dealDamage(attacker, g, Math.floor(g.maxHp * 0.6), false, false, 'neutral'); expect(g.effects.some((x) => x.id === 'def_up')).toBe(true);
  });
  it('durability: broken weapon gives no stats; repair restores and costs gold; kit repairs equipped', () => {
    const { svc, p } = mk(); const atk0 = playerStats(p).derived.atk; p.equipment.main!.durability = 0; expect(playerStats(p).derived.atk).toBeLessThan(atk0);
    const g0 = svc.gold(); const r = svc.repairAll(); expect(r.ok).toBe(true); expect(svc.gold()).toBeLessThan(g0); expect(p.equipment.main!.durability).toBe(100); expect(playerStats(p).derived.atk).toBe(atk0);
    p.equipment.body!.durability = 3; const [kit] = svc.addItem('repair_kit'); expect(svc.useItem(kit!.uid).ok).toBe(true); expect(p.equipment.body!.durability).toBe(100); expect(svc.countItem('repair_kit')).toBe(0);
  });
  it('hits wear durability down', () => { const { w, e } = setup('blade_sentinel'); const m = w.spawnMonster('forest_slime', e.x + 30, e.y); const svc = w.services.get(e.id)!; for (let i = 0; i < 5; i++) w.dealDamage(e, m, 1, false, false, 'neutral'); expect(svc.p.equipment.main!.durability).toBeLessThan(100); });
});

import { perspective, absoluteAction } from '../src/index.js';
describe('TCG PvP perspective', () => {
  it('side 1 sees itself as side 0 with opponent hand hidden; actions translate back', () => {
    const d = Object.values(STARTER_DECKS)[0]!.cards; const s = newMatch(d, d, 11); const v1: any = perspective(s, 1);
    expect(Array.isArray(v1.sides[0].hand)).toBe(true); expect(typeof v1.sides[1].hand).toBe('number'); expect(v1.active).toBe(1 - s.active);
    expect(absoluteAction({ type: 'attack', attacker: 3, target: { side: 1, unit: 'hero' } }, 1)).toEqual({ type: 'attack', attacker: 3, target: { side: 0, unit: 'hero' } });
  });
});
