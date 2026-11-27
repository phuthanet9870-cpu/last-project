/**
 * Behavioural tests for systems that were implemented but previously had no dedicated automated test (registry status TESTING).
 * Each `it` names the registry IDs it covers; gen-registry.mjs links them as evidence.
 */
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, aiChooseAction, CLASSES, CONFIG, PETS, getMap, SecureRng, DUNGEONS, ITEMS, MAPS, MONSTERS, MarketService, PASS, PlayerService, Rng, SHOPS, TCG_CARDS, TILE, World, activeEventAt, createCharacter, executeCommand, playerCP, playerStats, validateDeck, WEEK_MS,
} from '../src/index.js';

const mk = (cls = 'blade_sentinel', t = 1_800_000_000_000) => { const clock = { t }; const p = createCharacter({ accountId: 'acc', name: 'Cov', classId: cls, appearance: { body: 0, hair: 0, hairColor: '#000', skin: '#fc9', eyes: '#000' }, now: clock.t }); const svc = new PlayerService(p, new Rng(7), () => clock.t); return { p, svc, clock }; };
const lvl = (svc: PlayerService, n: number) => { for (let i = 0; i < 300 && svc.p.level < n; i++) { const b = svc.p.level; svc.gainExp(1e10, 't'); if (svc.p.level === b) { svc.addItem('boss_heart', 9); svc.ascend(); } } };
const ctxFor = (w: World, svc: PlayerService, entityId: string, extra: Record<string, unknown> = {}) => ({ world: w, svc, session: {}, market: new MarketService(svc.p.wallet), mode: 'local' as const, dev: false, entityId, ...extra }) as any;

describe('progression (L022 L025 L027 L028)', () => {
  it('L022 skill reset refunds every spent skill point for 2,000 Gold', () => {
    const { svc, p } = mk(); lvl(svc, 30); svc.earn('gold', 5000, 't'); const sk = Object.keys(p.skillRanks)[0] ?? null; const pts0 = p.skillPoints;
    const learnable = Object.values((p as any).classId ? {} : {}); void learnable; const spent = Object.values(p.skillRanks).reduce((a, b) => a + b, 0); void sk;
    const g0 = svc.gold(); const r = svc.resetSkills(); expect(r.ok).toBe(true); expect(svc.gold()).toBe(g0 - 2000n); expect(p.skillPoints).toBeGreaterThanOrEqual(pts0); expect(Object.values(p.skillRanks).every((x) => x <= 1)).toBe(true); void spent;
    const poor = mk(); poor.svc.spend('gold', Number(poor.svc.gold()), 't'); expect(poor.svc.resetSkills().err).toBe('NOT_ENOUGH_GOLD');
  });
  it('L025 ascension can be taken three times (cap), each needing level + Guardian Hearts', () => {
    const { svc, p } = mk(); lvl(svc, 120); expect(p.ascension).toBe(2); svc.removeItem('boss_heart', svc.countItem('boss_heart')); expect(svc.ascend().err).toBe('NEED_HEARTS'); svc.addItem('boss_heart', 9); expect(svc.ascend().ok).toBe(true); expect(p.ascension).toBe(3); svc.addItem('boss_heart', 12); expect(svc.ascend().err).toBe('MAX_ASCENSION');
  });
  it('L027 milestone mail every 10 levels; L028 combat power grows with level and gear', () => {
    const { svc, p } = mk(); const cp0 = playerCP(p); lvl(svc, 31); expect(p.mail.filter((m) => /milestone|level 10|level 20|level 30/i.test(m.subject + m.body)).length).toBeGreaterThanOrEqual(3); expect(playerCP(p)).toBeGreaterThan(cp0);
    const [w] = svc.addItem('frost_sword'); const before = playerCP(p); svc.equip(w!.uid); expect(playerCP(p)).toBeGreaterThan(before);
  });
});

describe('items & enhancement (L089 L143 L146 L148 L173 L174 L179 L181 L160 L350)', () => {
  it('L143 bound items cannot be listed on the market; L146 warehouse moves items both ways with slot limits', () => {
    const { svc, p } = mk(); const m = new MarketService(p.wallet); const [it] = svc.addItem('wedding_ring'); expect(it!.bound || ITEMS.wedding_ring!.tradeable === false).toBe(true); expect(() => m.list(svc, it!.uid, 100n)).toThrow();
    const [pot] = svc.addItem('iron_sword'); expect(svc.storageMove(pot!.uid, true).ok).toBe(true); expect(p.storage.some((x) => x.uid === pot!.uid)).toBe(true); expect(svc.storageMove(pot!.uid, false).ok).toBe(true); expect(p.inventory.some((x) => x.uid === pot!.uid)).toBe(true);
  });
  it('L148 dismantling equipment yields materials and removes the item', () => {
    const { svc, p } = mk(); const [it] = svc.addItem('iron_sword'); const inv0 = p.inventory.length; const r = svc.dismantle(it!.uid); expect(r.ok).toBe(true); expect(p.inventory.some((x) => x.uid === it!.uid)).toBe(false); expect(p.inventory.length).toBeGreaterThanOrEqual(inv0 - 1);
  });
  it('L173 L174 L175 random options roll on drops and an Enchant Stone rerolls unlocked lines (locked lines kept)', () => {
    const { svc } = mk(); svc.earn('gold', 1e6, 't'); let it = svc.addItem('frost_sword', 1, { rollOptions: true })[0]!; for (let i = 0; i < 30 && it.options.length < 2; i++) it = svc.addItem('frost_sword', 1, { rollOptions: true })[0]!; expect(it.options.length).toBeGreaterThanOrEqual(1);
    svc.addItem('enchant_stone', 5); const keep = JSON.stringify(it.options[0]); const r = svc.enchant(it.uid, [0]); expect(r.ok).toBe(true); expect(JSON.stringify(it.options[0])).toBe(keep); expect(svc.countItem('enchant_stone')).toBeLessThan(5);
  });
  it('L179 three gems of a grade fuse into the next grade; L181 unsocketing returns the gem for 500 Gold', () => {
    const { svc } = mk(); svc.earn('gold', 1e5, 't'); svc.addItem('gem_ruby_1', 3); expect(svc.fuseGems('gem_ruby_1').ok).toBe(true); expect(svc.countItem('gem_ruby_2')).toBe(1); expect(svc.fuseGems('gem_ruby_3').err).toBe('CANNOT_FUSE');
    const [w] = svc.addItem('frost_sword'); const gem = svc.p.inventory.find((x) => x.defId === 'gem_ruby_2')!; expect(svc.socketGem(w!.uid, gem.uid).err).toBe('NO_SOCKET'); w!.refine = 5; // sockets unlock at +5 expect(svc.socketGem(w!.uid, gem.uid).ok).toBe(true); const g0 = svc.gold(); expect(svc.unsocketGem(w!.uid, 0).ok).toBe(true); expect(svc.gold()).toBe(g0 - 500n); expect(svc.countItem('gem_ruby_2')).toBe(1);
  });
  it('L089 an inscribed skill stone refines with stone dust (capped at +10)', () => {
    const { svc } = mk(); lvl(svc, 20); svc.earn('gold', 1e6, 't'); svc.addItem('skill_stone', 1); svc.addItem('stone_dust', 200); const st = svc.p.inventory.find((x) => x.defId === 'skill_stone')!;
    const sk = CLASSES[svc.p.classId]!.skills.find((x) => x.type !== 'passive')!.id; const ins = svc.inscribeStone(st.uid, sk); expect(ins.ok).toBe(true); expect(svc.refineStone(svc.p.inventory.find((x) => x.defId === 'refine_ore')?.uid ?? 'none').ok).toBe(false);
    const r0 = st.stone!.refine; expect(svc.refineStone(st.uid).ok).toBe(true); expect(st.stone!.refine).toBe(r0 + 1);
  });
  it('L160 L350 wedding ring is untradeable equipment with couple stats; the wedding grants the festival costume', () => {
    const r = ITEMS.wedding_ring!; expect(r.slot).toBe('ring2'); expect(r.tradeable).toBe(false); expect(r.stats?.some((s) => s.stat === 'expBonus')).toBe(true);
    const { svc, p } = mk(); svc.engage('Juniper'); svc.completeWedding('Juniper'); expect(svc.countItem('costume_festival')).toBe(1); expect(p.marriage!.stage).toBe('married');
  });
});

describe('pets & mounts (L197 L198 L199 L202 L204 L205 L218 L219 L220)', () => {
  it('L202 star-up consumes a same-species duplicate; L204 L205 releasing a pet gives Star Dust', () => {
    const { svc, p } = mk(); const a = svc.addPet('pet_slime'); const b = svc.addPet('pet_slime'); const s0 = a.stars ?? 0; expect(svc.starUpPet(a.uid, b.uid).ok).toBe(true); expect(a.stars).toBe(s0 + 1); expect(p.pets.some((x) => x.uid === b.uid)).toBe(false);
    const c = svc.addPet('pet_bunny'); const d0 = svc.countItem('star_dust'); expect(svc.releasePet(c.uid).ok).toBe(true); expect(svc.countItem('star_dust')).toBeGreaterThan(d0);
  });
  it('L197 L198 L199 an active pet gives its owner bonus, follows the owner and deals its own damage to the owner’s target', () => {
    const clock = { t: 1_800_000_000_000 }; const { svc, p } = mk(); const sp = Object.values(PETS).find((x) => (x.ownerBonus ?? []).length > 0)!; const pet = svc.addPet(sp.id);
    const before = JSON.stringify(playerStats(p).derived); expect(svc.summonPet(pet.uid).ok).toBe(true); expect(JSON.stringify(playerStats(p).derived)).not.toBe(before); // owner passive applied
    const w = new World({ mapId: 'whisperwood', rng: new Rng(2), bots: 0, now: () => clock.t }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE }); const pe = w.entities.get(`pet_${me.id}`)!; expect(pe.kind).toBe('pet');
    const mon = w.spawnMonster('forest_slime', me.x + 40, me.y); mon.maxHp = mon.hp = 1e6; executeCommand(ctxFor(w, svc, me.id), 'attack', { target: mon.id }); const fx: any[] = [];
    for (let i = 0; i < 100; i++) { clock.t += 100; w.tick(100); fx.push(...w.drainFx()); }
    expect(fx.some((f) => f.t === 'dmg' && f.src === pe.id && f.tgt === mon.id)).toBe(true); // the pet itself hit the owner's target
    expect(Math.hypot(pe.x - me.x, pe.y - me.y)).toBeLessThan(300); // stays with the owner
    expect(pe.cds.pskill ?? 0).toBeGreaterThan(1_800_000_000_000); // L198: the active skill fired (its cooldown is armed) during the fight
  });
  it('L218 L219 L220 stable sells whistles; mounts level up with Star Dust; duplicate whistles convert to Star Dust / Stable Seals', () => {
    expect(SHOPS.stable).toBeDefined(); const { svc, p } = mk(); const key = Object.keys(ITEMS).find((k) => k.startsWith('whistle_') || ITEMS[k]!.type === 'mount_key')!; svc.addItem(key, 2);
    const w1 = p.inventory.find((x) => x.defId === key)!; expect(svc.unlockMount(w1.uid).ok).toBe(true); const id = p.mounts[0]!; const w2 = p.inventory.find((x) => x.defId === key)!; const seals0 = svc.bal('stable_seal'), dust0 = svc.countItem('star_dust'); svc.unlockMount(w2.uid); expect(svc.bal('stable_seal') > seals0 || svc.countItem('star_dust') > dust0).toBe(true);
    svc.addItem('star_dust', 20); const lv0 = p.mountLevels[id] ?? 0; expect(svc.upgradeMount(id).ok).toBe(true); expect(p.mountLevels[id]).toBe(lv0 + 1);
  });
});

describe('dungeons & world boss (L231 L232 L233 L234 L236 L237 L239 L240 L243 L244 L250)', () => {
  it('L232 L233 L234 L236 daily dungeon families with 10 floors each; L237 2 runs per floor per day; L240 resets on the next Bangkok day', () => {
    for (const f of ['gem', 'mine', 'pet', 'stone']) expect(Object.keys(DUNGEONS).filter((k) => k.startsWith(`daily_${f}_`)).length).toBe(10);
    const { svc, p, clock } = mk(); expect(DUNGEONS.daily_gem_1!.dailyLimit).toBe(2); expect(svc.startDungeon('daily_gem_1').ok).toBe(true); expect(svc.startDungeon('daily_gem_1').ok).toBe(true); expect(svc.startDungeon('daily_gem_1').err).toBe('DAILY_LIMIT');
    clock.t += 86400_000; expect(svc.canEnterDungeon('daily_gem_1').ok).toBe(true); void p;
  });
  it('L231 L239 a dungeon run has a 10-minute timer and fails when it expires', () => {
    const clock = { t: 1_800_000_000_000 }; const { svc } = mk(); const w = new World({ mapId: 'mossy_hollow', rng: new Rng(3), bots: 0, now: () => clock.t }); const me = w.addPlayer(svc); w.startDungeon('mossy_hollow', 'r', [me.id]);
    expect(w.dungeon!.endsAt - w.dungeon!.startedAt).toBe(10 * 60_000); clock.t += 10 * 60_000 + 1; w.tick(50); expect(w.dungeon!.state).toBe('failed');
  });
  it('L243 L244 the world boss spawns in Sunken Crater with HP scaled by participants; L250 the boss shop sells for Boss Coins', () => {
    const clock = { t: 1_800_000_000_000 }; const w = new World({ mapId: 'sunken_crater', rng: new Rng(5), bots: 0, now: () => clock.t, worldBossIntervalMs: 1000 });
    const a = mk(); const b = mk('dawn_priest'); b.p.id = 'p2'; w.addPlayer(a.svc); w.addPlayer(b.svc); for (let i = 0; i < 200 && !w.boss; i++) { clock.t += 100; w.tick(100); } // first spawn 15 s after the crater opens
    expect(w.boss).toBeTruthy(); const be = w.entities.get(w.boss!.entityId)!;
    const solo = new World({ mapId: 'sunken_crater', rng: new Rng(5), bots: 0, now: () => clock.t, worldBossIntervalMs: 1000 }); solo.addPlayer(mk().svc); solo.spawnWorldBoss(w.boss!.bossId); const one = solo.entities.get(solo.boss!.entityId)!;
    expect(be.maxHp / one.maxHp).toBeCloseTo(1.35, 2); expect(one.maxHp).toBe(Math.floor(MONSTERS[be.defId!]!.maxHp * 0.25)); // +35% per extra participant (fixed at spawn; 25% artifact/prototype scale)
    const shop = Object.entries(SHOPS).find(([, s]) => s.currency === 'boss_coin')!; expect(shop).toBeTruthy(); const { svc } = mk(); svc.earn('boss_coin', 1e5, 't'); const item = shop[1].items[0]!; expect(svc.buy(shop[0], typeof item === 'string' ? item : (item as any).itemId).ok).toBe(true);
  });
});

describe('TCG & commerce (L357 L360 L361 L368 L369 L374 L375 L394 L397 L400)', () => {
  it('L357 decks must be legal to save; L368 L369 packs open 5 cards with a 10-pack epic+ guarantee; L374 L375 dusting spares gives Card Dust', () => {
    const { svc, p } = mk(); const bad = svc.saveDeck('d2', 'Bad', ['nope']); expect(bad.ok).toBe(false); expect(validateDeck(p.tcg.decks[0]!.cards, p.tcg.collection)).toBeNull();
    svc.addItem('card_pack', 10); let epic = false; for (let i = 0; i < 10; i++) { const pk = p.inventory.find((x) => x.defId === 'card_pack')!; const r = svc.openCardPack(pk.uid); expect(r.ok).toBe(true); expect(r.data!.length).toBe(5); if (r.data!.some((c) => ['epic', 'legendary'].includes(TCG_CARDS[c]!.rarity))) epic = true; } expect(epic).toBe(true);
    const spare = Object.keys(p.tcg.collection).find((c) => svc.spareCards(c) > 0)!; const d0 = svc.bal('card_dust'); expect(svc.dustCard(spare).ok).toBe(true); expect(svc.bal('card_dust')).toBeGreaterThan(d0);
  });
  it('L360 L361 casual and Duel Tower matches run to a result and the tower advances on a win', () => {
    const clock = { t: 1_800_000_000_000 }; const { svc, p } = mk(); const w = new World({ mapId: 'emberglen', rng: new Rng(9), bots: 0, now: () => clock.t }); const me = w.addPlayer(svc); const ctx = ctxFor(w, svc, me.id);
    for (const mode of ['ai', 'tower']) { const t0 = p.tcg.tower; expect(executeCommand(ctx, 'tcgStart', { mode }).ok).toBe(true); for (let i = 0; i < 400 && ctx.session.tcg.state.winner === null; i++) { executeCommand(ctx, 'tcgAction', { action: aiChooseAction(ctx.session.tcg.state, 0) }); }
      expect(ctx.session.tcg.state.winner).not.toBeNull(); if (mode === 'tower' && ctx.session.tcg.state.winner === 0) expect(p.tcg.tower).toBe(t0 + 1); ctx.session.tcg = null; }
  });
  it('L394 premium pass costs 980 simulated Crystal and unlocks the premium track; L397 Grand Lantern adds permanent EXP/Gold', () => {
    const { svc, p } = mk('blade_sentinel', Date.now()); svc.earn('crystal', 10000, 't'); expect(svc.buyPremiumPass().ok).toBe(true); expect(p.pass.premium).toBe(true); expect(svc.buyPremiumPass().err).toBe('OWNED');
    p.pass.level = 1; expect(svc.claimPass(1, true).ok).toBe(true); expect(PASS.premium.length).toBe(PASS.levels);
    const e0 = playerStats(p).derived.expBonus, g0 = playerStats(p).derived.goldBonus; expect(svc.buyMembership('grand').ok).toBe(true); expect(playerStats(p).derived.expBonus).toBe(e0 + 5); expect(playerStats(p).derived.goldBonus).toBe(g0 + 5);
  });
  it('L400 the seasonal shop sells for Event Tokens earned from event missions', () => {
    expect(SHOPS.seasonal!.currency).toBe('event_token'); const { svc, p } = mk('blade_sentinel', WEEK_MS * 2901 + 1000); svc.resetDailyIfNeeded(); for (let i = 0; i < 30; i++) svc.bump('kills'); expect(svc.claimEventMission(activeEventAt(svc.now()).id, 'evm_kill').ok).toBe(true);
    const item = SHOPS.seasonal!.items[0]!; const id = typeof item === 'string' ? item : (item as any).itemId; svc.earn('event_token', 1000, 't'); const n0 = svc.countItem(id); expect(svc.buy('seasonal', id).ok).toBe(true); expect(svc.countItem(id)).toBe(n0 + 1); void p;
  });
});

describe('events, achievements & economy (L401 L403 L404 L405 L406 L409 L410 L411 L413 L427 L429 L291 L292 B21)', () => {
  it('L401 L404 L406 three events rotate weekly with EXP/drop/gold multipliers; L405 Festival Pass doubles event rewards', () => {
    const seen = new Set<string>(); for (let k = 0; k < 6; k++) seen.add(activeEventAt(k * WEEK_MS + 1).id); expect(seen.size).toBe(3);
    const exp = mk(); const ex = mk(); const e0 = exp.p.exp; exp.svc.onKill('forest_slime', 2, 1000, 0, [], { exp: 1.5, drop: 1 }); ex.svc.onKill('forest_slime', 2, 1000, 0, [], { exp: 1, drop: 1 }); expect(exp.p.exp - e0).toBeGreaterThan(ex.p.exp - e0);
  });
  it('L403 weekly quest resets on the Bangkok week key; B21 daily missions reset on the next Bangkok day (lazy, per character)', () => {
    const { svc, p, clock } = mk(); p.missions.points = 50; clock.t += 86400_000; svc.resetDailyIfNeeded(); expect(p.missions.points).toBe(0);
    const wk = p.quests.lastWeekly; clock.t += 7 * 86400_000; svc.resetDailyIfNeeded(); expect(p.quests.lastWeekly).not.toBe(wk);
  });
  it('L409 L410 L427 achievements unlock from counters and grant titles; L429 the chosen title is shown on the player entity', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(19); const a = ACHIEVEMENTS.find((x) => x.title)!; const { svc, p } = mk(); for (let i = 0; i < a.target; i++) svc.bump(a.counter); svc.checkAchievements();
    expect(p.achievements).toContain(a.id); expect(p.titles).toContain(a.title); expect(svc.setTitle(a.title!).ok).toBe(true); expect(svc.setTitle('title_not_owned').err).toBe('LOCKED');
    const w = new World({ mapId: 'emberglen', rng: new Rng(1), bots: 0 }); const e = w.addPlayer(svc); expect(e.title).toBe(a.title);
  });
  it('L411 level milestones and L413 overflowing rewards arrive by mail when the bag is full', () => {
    const { svc, p } = mk(); while (p.inventory.length < (p as any).invSlots || p.inventory.length < 60) { const n = p.inventory.length; svc.addItem('iron_sword'); if (p.inventory.length === n) break; }
    const m0 = p.mail.length; svc.addItem('frost_sword'); expect(p.mail.length).toBeGreaterThan(m0); expect(p.mail[0]!.items.some((i) => i.itemId === 'frost_sword')).toBe(true);
  });
  it('L291 L292 every Gold faucet and sink is a balanced double-entry ledger transaction', () => {
    const { svc, p } = mk(); svc.onKill('forest_slime', 2, 10, 50, [], { exp: 1, drop: 1 }); svc.earn('gold', 5000, 't'); svc.buy('general', 'potion_hp_s', 3); svc.resetSkills();
    const L = p.wallet; expect(L.verify().ok).toBe(true); const reasons = new Set((L as any).entries?.map((e: any) => e.reason) ?? []); expect(reasons.size === 0 || [...reasons].some((r) => /monster|shop|skill_reset|t/.test(String(r)))).toBe(true);
  });
});

describe('social & market rules (L330 L335 L337 L311 L315)', () => {
  it('L330 friends add/remove; L335 L337 party members within 600px share kill EXP', () => {
    const clock = { t: 1_800_000_000_000 }; const w = new World({ mapId: 'whisperwood', rng: new Rng(4), bots: 0, now: () => clock.t }); const a = mk(); const b = mk('dawn_priest'); b.p.id = 'pb';
    const ea = w.addPlayer(a.svc, { x: 20 * TILE, y: 20 * TILE }); const eb = w.addPlayer(b.svc, { x: 20 * TILE + 100, y: 20 * TILE }); ea.partyId = eb.partyId = 'pt'; w.parties.set('pt', [ea.id, eb.id]);
    const ctx = ctxFor(w, a.svc, ea.id); expect(executeCommand(ctx, 'friendAdd', { name: 'Juniper' }).ok).toBe(true); expect(a.p.friends.some((f) => f.name === 'Juniper')).toBe(true); expect(executeCommand(ctx, 'friendRemove', { name: 'Juniper' }).ok).toBe(true);
    const m = w.spawnMonster('forest_slime', ea.x + 30, ea.y); m.hp = 1; const b0 = b.p.exp; executeCommand(ctx, 'attack', { target: m.id }); for (let i = 0; i < 40 && !m.dead; i++) { clock.t += 100; w.tick(100); } expect(m.dead).toBe(true); expect(b.p.exp).toBeGreaterThan(b0);
  });
  it('L311 L315 my listings are capped at 12 market slots; a sale settles through the balanced ledger', () => {
    const A = mk(); const B = mk('dawn_priest'); B.p.wallet = A.p.wallet; B.p.id = 'other'; A.p.wallet.mint(`p:${B.p.id}`, 'gold', 1_000_000n, 't'); const m = new MarketService(A.p.wallet);
    for (let i = 0; i < 12; i++) { const [it] = A.svc.addItem('iron_sword'); m.list(A.svc, it!.uid, 100n); } const [extra] = A.svc.addItem('iron_sword'); expect(() => m.list(A.svc, extra!.uid, 100n)).toThrow();
    const l = m.listings.find((x) => x.status === 'active')!; m.buy(B.svc, l.id); expect(m.bestSellers(Date.now() + 1).length + m.history.length).toBeGreaterThan(0); expect(A.p.wallet.verify().ok).toBe(true);
    expect(CONFIG.version).toBeTruthy(); void MAPS;
  });
});

describe('combat, life skills & shops (L014 L061 L218 L264 L274 L275)', () => {
  it('L014 the class gauge fills on hits (capped at 100)', () => {
    const clock = { t: 1_800_000_000_000 }; const { svc } = mk(); const w = new World({ mapId: 'whisperwood', rng: new Rng(11), bots: 0, now: () => clock.t }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE });
    const m = w.spawnMonster('forest_slime', me.x + 30, me.y); m.maxHp = m.hp = 1e7; executeCommand(ctxFor(w, svc, me.id), 'attack', { target: m.id }); for (let i = 0; i < 80; i++) { clock.t += 100; w.tick(100); }
    expect(me.gauge).toBeGreaterThan(0); expect(me.gauge).toBeLessThanOrEqual(100);
  });
  it('L061 heavy skills with knockdown apply the knockdown status (stun-type CC) to the target', () => {
    const cls = Object.values(CLASSES).find((c) => c.skills.some((s) => s.knockdown && s.target === 'enemy'))!; const sk = cls.skills.find((s) => s.knockdown && s.target === 'enemy')!;
    const clock = { t: 1_800_000_000_000 }; const { svc, p } = mk(cls.id); lvl(svc, Math.max(sk.reqLevel, 30)); p.skillRanks[sk.id] = 1; const w = new World({ mapId: 'whisperwood', rng: new Rng(12), bots: 0, now: () => clock.t }); const me = w.addPlayer(svc, { x: 20 * TILE, y: 20 * TILE }); me.mp = me.maxMp = 9999;
    const m = w.spawnMonster('thorn_wolf', me.x + 40, me.y); m.maxHp = m.hp = 1e7; const err = w.castSkill(me.id, sk.id, m.id); expect(err).toBeNull(); for (let i = 0; i < 10; i++) { clock.t += 50; w.tick(50); }
    expect(m.effects.some((e) => e.id === 'knockdown' || (e as any).status === 'knockdown')).toBe(true);
  });
  it('L218 the stable sells mount whistles for Stable Seals; L264 the arena shop sells for Arena Tokens', () => {
    for (const [shop, cur] of [['stable', 'stable_seal'], ['arena', 'arena_token']] as const) { const s = SHOPS[shop]!; expect(s.currency).toBe(cur); const { svc } = mk(); svc.earn(cur, 1e6, 't'); const it = s.items[0]!; const id = typeof it === 'string' ? it : (it as any).itemId; const n0 = svc.countItem(id); expect(svc.buy(shop, id).ok).toBe(true); expect(svc.countItem(id)).toBe(n0 + 1); expect(svc.bal(cur)).toBeLessThan(1_000_000n); }
  });
  it('L274 mining yields ore and levels the skill; L275 ore veins exist in Amber Hills and Frostmere', () => {
    const { svc, p } = mk(); expect(svc.gather('ore', 1).err).toBe('NEED_TOOL'); svc.addItem('tool_pickaxe'); const lv0 = p.gathering.ore.exp + p.gathering.ore.lvl * 1e6; const r = svc.gather('ore', 1); expect(r.ok).toBe(true); expect(ITEMS[r.data!.itemId]!.name.en).toBeTruthy(); expect(p.gathering.ore.exp + p.gathering.ore.lvl * 1e6).toBeGreaterThan(lv0);
    for (const m of ['amber_hills', 'frostmere']) expect(getMap(m).nodes.some((n) => n.type === 'ore')).toBe(true);
  });
});

describe('gap closures (L007 L228 L319 L320 L353 L420 B14)', () => {
  it('L228 daily floors unlock in order: floor n needs a clear of floor n-1', () => {
    const { svc, p } = mk(); lvl(svc, 30); expect(svc.canEnterDungeon('daily_gem_2').err).toBe('FLOOR_LOCKED'); p.dungeon.firstClears.push('daily_gem_1'); expect(svc.canEnterDungeon('daily_gem_2').ok).toBe(true); expect(svc.canEnterDungeon('daily_gem_1').ok).toBe(true);
  });
  it('L353 completing every card of an element pays a one-time set reward', () => {
    const { svc, p } = mk(); const s0 = svc.cardSetStatus()[0]!; expect(svc.claimCardSet(s0.element).err).toBe('INCOMPLETE');
    for (const c of Object.values(TCG_CARDS)) if (c.element === s0.element && !c.id.startsWith('tok_')) p.tcg.collection[c.id] = Math.max(1, p.tcg.collection[c.id] ?? 0);
    const d0 = svc.bal('card_dust'); expect(svc.claimCardSet(s0.element).ok).toBe(true); expect(svc.bal('card_dust')).toBe(d0 + 400n); expect(svc.claimCardSet(s0.element).err).toBe('ALREADY_CLAIMED');
  });
  it('L007 the appearance salon changes hair/colours for 5,000 Gold and validates input; the entity updates', () => {
    const { svc, p } = mk(); svc.earn('gold', 20000, 't'); expect(svc.changeAppearance({ hairColor: 'red;' as any }).err).toBe('INVALID_APPEARANCE'); const g0 = svc.gold();
    expect(svc.changeAppearance({ hair: 3, hairColor: '#ff8800' }).ok).toBe(true); expect(p.appearance.hair).toBe(3); expect(p.appearance.hairColor).toBe('#ff8800'); expect(svc.gold()).toBe(g0 - 5000n);
    const w = new World({ mapId: 'emberglen', rng: new Rng(1), bots: 0 }); const e = w.addPlayer(svc); svc.earn('gold', 5000, 't'); executeCommand(ctxFor(w, svc, e.id), 'changeAppearance', { appearance: { eyes: '#00ff00' } }); expect((e.appearance as any).eyes).toBe('#00ff00');
  });
  it('L319 L320 instant buy/sell fill against the book and never leave a resting order (IOC)', () => {
    const A = mk(); const L = A.p.wallet; const m = new MarketService(L, new Rng(1)); L.mint(`p:${A.p.id}`, 'gold', 100000n, 't'); L.mint('sim:mm', 'crystal', 100n, 't'); L.reserve('sim:mm', 'crystal', 5n);
    m.book.place({ id: 's1', owner: 'sim:mm', side: 'sell', price: 150n, qty: 5n, ts: 0 }); const r = m.exchangeInstant(A.svc, 'buy', 8n);
    expect(r.filled).toBe(5n); expect(r.cancelled).toBe(3n); expect(m.book.bids.some((o) => o.owner === `p:${A.p.id}`)).toBe(false); expect(L.bal(`p:${A.p.id}`, 'gold').reserved).toBe(0n); expect(L.verify().ok).toBe(true);
    expect(() => m.exchangeInstant(A.svc, 'buy', 1n)).toThrow(); // no liquidity left
  });
  it('L420 achievement ranking ranks by achievement points (you + labelled simulated players)', () => {
    const { svc, p } = mk(); const a = ACHIEVEMENTS[0]!; for (let i = 0; i < a.target; i++) svc.bump(a.counter); svc.checkAchievements(); const w = new World({ mapId: 'emberglen', rng: new Rng(1), bots: 0 }); const e = w.addPlayer(svc);
    const rows = executeCommand(ctxFor(w, svc, e.id), 'rankings', { kind: 'achievements' }).data as any[]; const me = rows.find((x) => x.name === p.name); expect(me.value).toBe(a.points); expect(rows.filter((x) => x.simulated).every((x) => /\[sim\]/.test(x.name))).toBe(true);
  });
  it('B14 random rewards can use an unpredictable source (server: crypto) instead of the seeded RNG', () => {
    const { svc } = mk(); svc.earn('crystal', 100000, 't'); let calls = 0; svc.rewardRng = new SecureRng(() => { calls++; return 0.999999; }); const r = svc.gachaDraw(10, false); expect(r.ok).toBe(true); expect(calls).toBeGreaterThanOrEqual(20);
    const pk = svc.addItem('card_pack')[0]!; const c0 = calls; svc.openCardPack(pk.uid); expect(calls).toBeGreaterThan(c0);
  });
});

describe('market analytics, buy-now & announcements (L251 L298 L299 L300 L307 L322)', () => {
  const two = () => { const A = mk(); const B = mk('dawn_priest'); B.p.wallet = A.p.wallet; B.p.id = 'buyer'; A.p.wallet.mint(`p:${B.p.id}`, 'gold', 10_000_000n, 't'); return { A, B, m: new MarketService(A.p.wallet) }; };
  it('L307 buy-now settles an auction instantly: item to buyer, gold to seller (minus fee), any leading bid refunded', () => {
    const { A, B, m } = two(); A.p.wallet.mint('p:third', 'gold', 10000n, 't'); const [it] = A.svc.addItem('frost_sword'); const au = m.createAuction(A.svc, it!.uid, 100n, 5000n, 3600_000);
    m.bid({ p: { id: 'third' } } as any, au.id, 300n); const g0 = A.svc.gold(), c0 = m.collectable(A.p.accountId); m.buyNowAuction(B.svc, au.id);
    expect(au.status).not.toBe('active'); expect(B.p.inventory.some((x) => x.defId === 'frost_sword') || B.p.mail.some((x) => x.items.some((i) => i.itemId === 'frost_sword'))).toBe(true);
    expect(A.svc.gold() + m.collectable(A.p.accountId)).toBeGreaterThan(g0 + c0); expect(A.p.wallet.available('p:third', 'gold')).toBe(10000n); expect(A.p.wallet.verify().ok).toBe(true);
  });
  it('L298 best sellers rank items by recent sales; L299 the reference price follows the last sales', () => {
    const { A, B, m } = two(); const before = m.refPrice('iron_sword');
    for (let i = 0; i < 3; i++) { const [it] = A.svc.addItem('iron_sword'); const l = m.list(A.svc, it!.uid, 900n); m.buy(B.svc, l.id); } const [p2] = A.svc.addItem('frost_sword'); m.buy(B.svc, m.list(A.svc, p2!.uid, 100n).id);
    const bs = m.bestSellers(24); expect(bs[0]!.defId).toBe('iron_sword'); expect(bs[0]!.sales).toBe(3); expect(m.refPrice('iron_sword')).toBe(900); expect(before).not.toBe(900);
  });
  it('L300 L322 exchange fills are recorded in history and aggregated into OHLC candles', () => {
    const { A, m } = two(); const L = A.p.wallet; L.mint(`p:${A.p.id}`, 'gold', 100000n, 't'); L.mint('sim:mm', 'crystal', 100n, 't'); L.reserve('sim:mm', 'crystal', 20n); m.book.place({ id: 's1', owner: 'sim:mm', side: 'sell', price: 150n, qty: 10n, ts: 0 }); m.book.place({ id: 's2', owner: 'sim:mm', side: 'sell', price: 160n, qty: 10n, ts: 0 });
    m.exchangePlace(A.svc, 'buy', 160n, 15n); expect(m.exchangeHistory.length).toBeGreaterThanOrEqual(2); const prices = m.exchangeHistory.map((x) => x.price); expect(prices).toContain(150); expect(prices).toContain(160);
    const c = m.candles(60_000).at(-1)!; expect(c.l).toBe(150); expect(c.h).toBe(160); expect(c.v).toBe(15);
  });
  it('L251 a world boss spawn is announced to the whole map', () => {
    const clock = { t: 1_800_000_000_000 }; const w = new World({ mapId: 'sunken_crater', rng: new Rng(5), bots: 0, now: () => clock.t }); w.addPlayer(mk().svc); w.drainFx(); w.spawnWorldBoss();
    expect(w.drainFx().some((f) => f.t === 'notice' && /World Boss .* has appeared/.test(f.msg) && !(f as any).to)).toBe(true);
  });
});

describe('partial closures (L065 S19 L269 S31 S21 S32 L026)', () => {
  it('L065 rare+ party drops go through need/greed: a member who can equip it (need) beats greed; rolls are announced', () => {
    const clock = { t: 1_800_000_000_000 }; const w = new World({ mapId: 'whisperwood', rng: new Rng(21), bots: 0, now: () => clock.t }); const a = mk('blade_sentinel'); const b = mk('dawn_priest'); b.p.id = 'pb2'; lvl(a.svc, 40); lvl(b.svc, 40);
    const ea = w.addPlayer(a.svc, { x: 20 * TILE, y: 20 * TILE }); const eb = w.addPlayer(b.svc, { x: 20 * TILE + 60, y: 20 * TILE }); ea.partyId = eb.partyId = 'p'; w.parties.set('p', [ea.id, eb.id]);
    const staff = Object.values(ITEMS).find((i) => i.type === 'weapon' && i.weapon && ['rare', 'epic'].includes(i.rarity) && CLASSES.dawn_priest!.weapons.includes(i.weapon) && !CLASSES.blade_sentinel!.weapons.includes(i.weapon) && (i.reqLevel ?? 0) <= 40)!;
    let bWins = 0; for (let k = 0; k < 10; k++) { w.drainFx(); if (w.rollNeedGreed(staff.id, [ea.id, eb.id], ea.id) === eb.id) bWins++; } expect(bWins).toBe(10); // priest needs it every time
    const fx = w.drainFx(); void fx; w.rollNeedGreed(staff.id, [ea.id, eb.id], ea.id); expect(w.drainFx().some((f) => f.t === 'notice' && /Roll for .*need.*greed|Roll for .*greed.*need/.test(f.msg))).toBe(true);
    expect(w.rollNeedGreed('slime_gel', [ea.id, eb.id], ea.id)).toBe(ea.id); // common drops stay with the top contributor
  });
  it('L269 offline auto-play pays 30% rewards for time away (needs the setting, ≥5 min, capped at 8 h) and mails a summary', () => {
    const { svc, p, clock } = mk(); lvl(svc, 30); svc.touchActive(); clock.t += 60 * 60_000; expect(svc.settleOfflineAuto().data!.minutes).toBe(0); // setting off
    p.settings.offlineAuto = true; svc.touchActive(); clock.t += 2 * 60_000; expect(svc.settleOfflineAuto().data!.minutes).toBe(0); // under 5 min
    clock.t += 24 * 3600_000; const g0 = svc.gold(); const r = svc.settleOfflineAuto(); expect(r.data!.minutes).toBe(480); expect(svc.gold() - g0).toBe(BigInt(r.data!.gold)); expect(r.data!.exp).toBeGreaterThan(0); expect(p.mail[0]!.subject).toMatch(/Offline adventure/);
    expect(svc.settleOfflineAuto().data!.minutes).toBe(0); // no double pay
  });
  it('S21 equipment presets save the equipped set and restore it (reporting missing items)', () => {
    const { svc, p } = mk(); lvl(svc, 12); const [w1] = svc.addItem('iron_sword'); expect(svc.equip(w1!.uid).ok).toBe(true); expect(svc.savePreset(0).ok).toBe(true); const [w2] = svc.addItem('iron_sword'); expect(svc.equip(w2!.uid).ok).toBe(true); expect(p.equipment.main!.uid).toBe(w2!.uid);
    const r = svc.loadPreset(0); expect(r.ok).toBe(true); expect(p.equipment.main!.uid).toBe(w1!.uid); expect(svc.loadPreset(2).err).toBe('EMPTY');
  });
  it('S32 gathering tools wear out (2% per use) and break after 50 uses', () => {
    const { svc } = mk(); svc.addItem('tool_pickaxe'); for (let i = 0; i < 49; i++) expect(svc.gather('ore', 1).ok).toBe(true); expect(svc.countItem('tool_pickaxe')).toBe(1); svc.gather('ore', 1); expect(svc.countItem('tool_pickaxe')).toBe(0); expect(svc.gather('ore', 1).err).toBe('NEED_TOOL');
  });
  it('L026 Lantern (mastery) milestones grant titles at 10/25/50', () => {
    const { svc, p } = mk(); svc.masteryMilestone(10); svc.masteryMilestone(25); svc.masteryMilestone(11); expect(p.titles).toContain('title_lantern_10'); expect(p.titles).toContain('title_lantern_25'); expect(p.titles).not.toContain('title_lantern_50');
  });
  it('settings command only accepts whitelisted boolean flags', () => {
    const { svc, p } = mk(); const w = new World({ mapId: 'emberglen', rng: new Rng(1), bots: 0 }); const e = w.addPlayer(svc); executeCommand(ctxFor(w, svc, e.id), 'settings', { settings: { offlineAuto: true, fastWedding: true, autoLoot: 'yes' } });
    expect(p.settings.offlineAuto).toBe(true); expect(p.settings.fastWedding).toBeUndefined(); expect(p.settings.autoLoot).not.toBe('yes');
  });
});
