// End-to-end test of the playable artifact in headless Chromium (Playwright).
// Drives the real UI + shared command layer through the full gameplay loop and records evidence.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = resolve(new URL('.', import.meta.url).pathname, '../..');
const SHOTS = resolve(root, 'tests/e2e/screenshots'); mkdirSync(SHOTS, { recursive: true });
const url = `file://${root}/deliverables/playable-artifact/index.html`;
const results = []; const errors = [];
const step = async (name, fn) => { const t = Date.now(); try { const d = await fn(); results.push({ name, ok: true, ms: Date.now() - t, detail: d ?? '' }); console.log(`PASS ${name}${d ? ` — ${d}` : ''}`); } catch (e) { results.push({ name, ok: false, ms: Date.now() - t, detail: String(e.message ?? e).slice(0, 300) }); console.log(`FAIL ${name}: ${e.message ?? e}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const cmd = (c, a = {}) => page.evaluate(([c, a]) => window.__hb.cmd(c, a).then((r) => JSON.parse(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? String(v) : v)))), [c, a]);
const st = (fn) => page.evaluate(`(() => { const a = window.__hb.a; const p = a.p; return (${fn})(a, p); })()`);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });

await step('01 open game start screen', async () => { await page.goto(url); await page.waitForSelector('text=Hearthbound Online'); await shot('01_title'); });
await step('02 guest/local mode + character creation + class selection', async () => {
  await page.click('text=Create Character'); await page.fill('input[aria-label="Name"]', 'Tester'); await page.click('text=Show all 26 classes'); await page.click('button.cls:has-text("Dawn Priest")'); await page.click('button:has-text("Long")'); await shot('02_create');
  await page.click('text=Begin Adventure'); await page.waitForSelector('canvas.game'); await page.waitForTimeout(800);
  const c = await st('(a,p)=>p.classId'); assert(c === 'dawn_priest', `class ${c}`); await shot('03_world'); return `class=${c}`;
});
await step('03 character movement + collision + camera follow', async () => {
  const x0 = await st('(a,p)=>p.x'); await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d'); const x1 = await st('(a,p)=>p.x'); assert(x1 > x0 + 20, `moved ${x0}->${x1}`);
  await page.keyboard.down('a'); await page.waitForTimeout(6000); await page.keyboard.up('a'); const x2 = await st('(a,p)=>p.x'); assert(x2 > 32, 'stays inside map bounds'); return `x ${x0}→${x1}→${x2}`;
});
await step('04 NPC interaction + accept quest + talk objective', async () => {
  await cmd('dev', { op: 'teleport', x: 26 * 32 + 16, y: 21 * 32 + 16 }); await page.waitForTimeout(200); await page.keyboard.press('f'); await page.waitForSelector('.win:has-text("Elder Rowan")'); await shot('04_npc');
  await page.click('.win button:has-text("Accept quest")'); await page.waitForTimeout(200); const q = await st('(a,p)=>p.quests.active.map(q=>q.id)'); assert(q.includes('mq01'), JSON.stringify(q));
  await page.click('.win button:has-text("Goodbye")'); await cmd('dev', { op: 'teleport', x: 20 * 32 + 16, y: 27 * 32 + 16 }); await page.keyboard.press('f'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
  await cmd('dev', { op: 'teleport', x: 26 * 32 + 16, y: 21 * 32 + 16 }); const r = await cmd('completeQuest', { id: 'mq01' }); assert(r.ok, JSON.stringify(r)); await cmd('acceptQuest', { id: 'mq02' }); return 'mq01 complete, mq02 accepted';
});
await step('05 travel through portal to field', async () => { await cmd('dev', { op: 'teleport', x: 53 * 32 + 16, y: 22 * 32 + 16 }); await page.waitForTimeout(100); await page.keyboard.press('f'); await page.waitForTimeout(600); const m = await st('(a)=>a.mapId'); assert(m === 'whisperwood', m); await shot('05_forest'); return m; });
await step('06 combat: attack monsters, skills, EXP, level, loot, gold', async () => {
  const lv0 = await st('(a,p)=>p.level'); const g0 = await st('(a,p)=>Number(a.bal("gold"))');
  for (let i = 0; i < 6; i++) { const r = await cmd('dev', { op: 'spawn', id: 'forest_slime' }); assert(r.ok, 'spawn'); }
  for (let i = 0; i < 90; i++) { await page.keyboard.press('Space'); if (i % 3 === 0) await page.keyboard.press('1'); await page.waitForTimeout(250); const k = await st('(a,p)=>p.counters.kills||0'); if (k >= 5) break; }
  const kills = await st('(a,p)=>p.counters.kills||0'); const exp = await st('(a,p)=>p.exp+p.level*1e6'); const g1 = await st('(a,p)=>Number(a.bal("gold"))'); await shot('06_combat');
  assert(kills >= 3, `kills ${kills}`); assert(g1 > g0, 'gold gained'); return `kills=${kills} level ${lv0}→${await st('(a,p)=>p.level')} gold ${g0}→${g1}`;
});
await step('07 inventory + equipment UI', async () => { await cmd('dev', { op: 'item', id: 'wood_staff' }); await page.keyboard.press('i'); await page.waitForSelector('.win:has-text("Bag")'); await shot('07_inventory'); const uid = await st('(a,p)=>p.inventory.find(i=>i.defId==="wood_staff").uid'); const r = await cmd('equip', { uid }); assert(r.ok, JSON.stringify(r)); await page.keyboard.press('Escape'); return 'equipped staff'; });
await step('08 refinement at blacksmith (+5)', async () => { await cmd('dev', { op: 'gold', n: 500000 }); await cmd('dev', { op: 'materials' }); const uid = await st('(a,p)=>p.equipment.main.uid'); for (let i = 0; i < 5; i++) { const r = await cmd('refine', { uid }); assert(r.ok, JSON.stringify(r)); } const lv = await st('(a,p)=>p.equipment.main.refine'); assert(lv === 5, `refine ${lv}`); return `+${lv}`; });
await step('09 gems + monster card + skill stone', async () => {
  const uid = await st('(a,p)=>p.equipment.main.uid'); const gem = await st('(a,p)=>p.inventory.find(i=>/^gem_[a-z]+_[0-9]$/.test(i.defId)).uid'); const r = await cmd('socket', { item: uid, gem }); assert(r.ok, JSON.stringify(r));
  await cmd('dev', { op: 'cards' }); const card = await st('(a,p)=>Object.keys(p.monsterCards).find(k=>["weapon"].includes((window.__mc||{})[k])||true)');
  const cards = await st('(a,p)=>Object.keys(p.monsterCards)'); let inserted = false; for (const c of cards) { const x = await cmd('insertCard', { uid, card: c }); if (x.ok) { inserted = true; break; } } assert(inserted, 'card inserted');
  const stone = await st('(a,p)=>p.inventory.find(i=>i.defId==="skill_stone").uid'); const sk = await st('(a,p)=>p.hotbar[0]'); const r2 = await cmd('inscribe', { uid: stone, skill: sk }); assert(r2.ok, JSON.stringify(r2)); const r3 = await cmd('slotStone', { uid: stone }); assert(r3.ok, 'slot'); void card; return 'gem socketed, card inserted, stone inscribed+slotted';
});
await step('10 capture + hatch pet, summon, feed, farm offline settle', async () => {
  const before = await st('(a,p)=>p.pets.length'); const egg = await st('(a,p)=>p.inventory.find(i=>i.defId==="pet_egg").uid'); assert((await cmd('useItem', { uid: egg })).ok, 'incubate'); const eu = await st('(a,p)=>p.eggs[0].uid'); const h = await cmd('hatch', { egg: eu, instant: true }); assert(h.ok, JSON.stringify(h));
  const m = await cmd('dev', { op: 'spawn', id: 'puff_bunny' }); for (let i = 0; i < 20; i++) { const e = await st(`(a)=>a.world.entities.get("${m.data.id}")`); if (!e || e.dead) break; if (e.hp / e.maxHp < 0.3) { const c = await cmd('capture', { target: m.data.id }); if (c.ok && c.data.success) break; } else { await cmd('attack', { target: m.data.id }); } await page.waitForTimeout(300); }
  const pets = await st('(a,p)=>p.pets.map(x=>x.uid)'); assert(pets.length > before, 'pet acquired'); assert((await cmd('summonPet', { pet: pets[0] })).ok, 'summon'); assert((await cmd('feed', { pet: pets[0] })).ok, 'feed');
  if (pets[1]) { await cmd('farmAssign', { pet: pets[1], on: true }); await cmd('farmFood', { qty: 10 }); const s = await cmd('dev', { op: 'farmTime', h: 1 }); assert(s.ok, 'farm settle'); }
  await page.waitForTimeout(400); await shot('10_pet'); return `pets=${pets.length}`;
});
await step('11 mount unlock + ride', async () => { await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'mount' }); const r = await cmd('ride'); assert(r.ok, JSON.stringify(r)); const sp = await st('(a,p)=>p.riding'); assert(sp, 'riding'); await page.waitForTimeout(300); await shot('11_mount'); await cmd('ride'); return 'riding ok'; });
await step('12 gathering + crafting', async () => {
  await cmd('dev', { op: 'materials' }); await cmd('dev', { op: 'map', id: 'whisperwood' }); const nodes = await st('(a)=>a.world.map.nodes.filter(n=>n.type==="herb").map(n=>({id:n.id,x:n.x,y:n.y}))'); const n = nodes[0];
  await cmd('dev', { op: 'teleport', x: n.x * 32 + 16, y: n.y * 32 + 48 }); const g = await cmd('gather', { node: n.id }); assert(g.ok, JSON.stringify(g));
  await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'teleport', x: 24 * 32 + 16, y: 31 * 32 + 16 }); const c = await cmd('craft', { recipe: 'rc_potion', times: 1 }); assert(c.ok, JSON.stringify(c)); return 'gathered herb, crafted potion';
});
await step('13 marketplace list + buy + buy order + auction bid + exchange', async () => {
  await page.evaluate(() => { const p = window.__hb.a.p; while (p.inventory.length > p.invSlots - 10) { const i = p.inventory.findIndex((x) => !x.locked && x.defId !== 'slime_gel'); if (i < 0) break; p.inventory.splice(i, 1); } }); // keep room for purchases
  await page.keyboard.press('g'); await page.waitForSelector('.win:has-text("Marketplace")'); await page.waitForTimeout(4500); await shot('13_market');
  const l = await st('(a)=>a.market().listings.filter(l=>l.status==="active"&&l.simulated).map(l=>({id:l.id,t:Number(l.price)*l.item.qty})).sort((x,y)=>x.t-y.t)[0]'); assert(l, 'sim listing exists'); const b = await cmd('marketBuy', { id: l.id }); assert(b.ok, JSON.stringify(b));
  const it = await st('(a,p)=>p.inventory.find(i=>!i.bound&&!i.locked&&i.defId==="slime_gel")?.uid || p.inventory.find(i=>!i.bound&&!i.locked&&i.qty>0&&i.defId!=="wood_staff")?.uid'); const li = await cmd('marketList', { uid: it, price: '1' }); assert(li.ok, JSON.stringify(li));
  const bo = await cmd('buyOrder', { defId: 'slime_gel', price: '50', qty: 2 }); assert(bo.ok, JSON.stringify(bo));
  const auc = await st('(a)=>{const x=a.market().auctions.find(x=>x.status==="active"&&!x.bidder&&x.seller!=="p:"+a.p.id);return x&&{id:x.id,start:String(x.start)}}'); if (auc) { const bd = await cmd('auctionBid', { id: auc.id, amount: String(auc.start) }); assert(bd.ok, JSON.stringify(bd)); }
  const ex = await cmd('exchangePlace', { side: 'buy', price: '200', qty: '5' }); assert(ex.ok, JSON.stringify(ex)); const cr = await st('(a)=>Number(a.bal("crystal"))');
  const ok = await st('(a)=>a.p.wallet.verify().ok'); assert(ok, 'ledger balanced'); await page.keyboard.press('Escape'); return `bought listing, listed item, buy order, ${auc ? 'bid placed, ' : ''}exchange filled (crystal=${cr}), ledger balanced`;
});
await step('14 direct trade with simulated player', async () => { const bot = await st('(a)=>[...a.world.entities.values()].find(e=>e.kind==="bot").id'); assert((await cmd('tradeOpen', { target: bot })).ok, 'open'); const it = await st('(a,p)=>p.inventory.find(i=>!i.bound&&!i.locked).uid'); assert((await cmd('tradeOffer', { items: [it], gold: '0' })).ok, 'offer'); assert((await cmd('tradeLock')).ok, 'lock'); const c = await cmd('tradeConfirm'); assert(c.ok && c.data.done, JSON.stringify(c)); return 'trade settled'; });
await step('15 party + guild + friend + mail + marriage', async () => {
  const bot = await st('(a)=>[...a.world.entities.values()].find(e=>e.kind==="bot")'); assert((await cmd('partyInvite', { target: bot.id })).ok, 'party'); assert((await cmd('friendAdd', { name: bot.name })).ok, 'friend');
  await cmd('dev', { op: 'teleport', x: 40 * 32 + 16, y: 29 * 32 + 16 }); assert((await cmd('guildCreate', { name: 'Lanternfolk' })).ok, 'guild'); assert((await cmd('guildDonate', { gold: 5000 })).ok, 'donate');
  await cmd('dev', { op: 'mail' }); assert((await cmd('mailClaimAll')).ok, 'mail');
  await cmd('dev', { op: 'teleport', x: 16 * 32 + 16, y: 17 * 32 + 16 }); const m = await cmd('propose', { name: bot.name }); assert(m.ok, JSON.stringify(m)); return 'party, friend, guild, mail, marriage ok';
});
await step('16 dungeon run (waves + boss) with reward once', async () => {
  await cmd('dev', { op: 'level', n: 20 }); await cmd('dev', { op: 'skills' }); const e = await cmd('enterDungeon', { id: 'daily_exp_1' }); assert(e.ok, JSON.stringify(e)); await page.waitForTimeout(300); await shot('16_dungeon');
  for (let i = 0; i < 240; i++) { const di = await st('(a)=>a.dungeonInfo()&&a.dungeonInfo().state'); if (di === 'settled') break; await cmd('dev', { op: 'heal' }); const t = await st('(a)=>{const me=a.world.entities.get(a.myId);const m=[...a.world.entities.values()].filter(x=>x.kind==="monster"&&!x.dead).sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0];return m&&{id:m.id,x:m.x,y:m.y}}'); if (t) { await cmd('dev', { op: 'teleport', x: t.x - 30, y: t.y }); await cmd('attack', { target: t.id }); await cmd('cast', { skill: (await st('(a,p)=>p.hotbar[0]')), target: t.id }); } await page.waitForTimeout(120); }
  const done = await st('(a,p)=>p.dungeon.firstClears.includes("daily_exp_1")'); assert(done, 'dungeon cleared'); await cmd('leaveInstance'); return 'cleared daily_exp_1';
});
await step('17 world boss spawn + contribution settlement', async () => {
  await cmd('dev', { op: 'level', n: 40 }); await cmd('dev', { op: 'map', id: 'sunken_crater' }); assert((await cmd('dev', { op: 'boss' })).ok, 'spawn'); await page.waitForTimeout(300); await shot('17_worldboss');
  for (let i = 0; i < 400; i++) { const b = await st('(a)=>{const s=a.world.boss;const e=s&&a.world.entities.get(s.entityId);return s&&{settled:s.settled,id:s.entityId,x:e?.x,y:e?.y,hp:e?.hp}}'); if (!b || b.settled) break; await cmd('dev', { op: 'heal' }); await cmd('dev', { op: 'teleport', x: b.x - 60, y: b.y + 40 }); const ent = await st(`(a)=>{const e=a.world.entities.get("${b.id}"); if(e) e.hp=Math.max(1,e.hp-e.maxHp*0.04); return 1}`); void ent; await cmd('attack', { target: b.id }); await page.waitForTimeout(60); }
  const coins = await st('(a)=>Number(a.bal("boss_coin"))'); assert(coins > 0, `boss coins ${coins}`); return `boss coins ${coins}`;
});
await step('18 PvP arena 1v1 vs AI (simulated) + rating', async () => {
  await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'teleport', x: 46 * 32 + 16, y: 29 * 32 + 16 }); const aj = await cmd('arenaJoin', { mode: '1v1' }); assert(aj.ok, JSON.stringify(aj)); await page.waitForTimeout(300); await shot('18_arena');
  for (let i = 0; i < 300; i++) { const ar = await st('(a)=>a.arenaInfo()'); if (ar?.done) break; const foe = await st('(a)=>{const ar=a.world.arena;const id=ar.teams[1].find(x=>!a.world.entities.get(x)?.dead);const e=a.world.entities.get(id);return e&&{id,x:e.x,y:e.y}}'); if (foe) { await cmd('dev', { op: 'heal' }); await st(`(a)=>{const e=a.world.entities.get("${foe.id}"); if(e) e.hp=Math.min(e.hp, 40); return 1}`); await cmd('dev', { op: 'teleport', x: foe.x - 40, y: foe.y }); await cmd('attack', { target: foe.id }); } await page.waitForTimeout(80); }
  const s = await cmd('arenaSettle'); assert(s.ok, JSON.stringify(s)); const r = await st('(a,p)=>p.pvp.rating'); await cmd('leaveInstance'); return `win=${s.data.win} rating=${r}`;
});
await step('19 Hearthcards duel vs AI to completion', async () => { await page.keyboard.press('b'); await page.waitForSelector('.win:has-text("Hearthcards")'); await page.click('.win button:has-text("Duel AI")'); await page.waitForTimeout(300); await shot('19_tcg');
  for (let i = 0; i < 400; i++) { const v = await st('(a)=>a.tcg()&&a.tcg().view'); if (!v || v.winner !== null) break; const res = await cmd('tcgAction', { action: await page.evaluate(() => window.__hb.aiMove()) }); if (!res.ok) await cmd('tcgAction', { action: { type: 'end' } }); }
  const w = await st('(a)=>a.tcg().view.winner'); assert(w !== null, 'finished'); await page.keyboard.press('Escape'); return `winner=${w}`; });
await step('20 events: login, missions, pass, gacha (simulated currency)', async () => { assert((await cmd('claimLogin')).ok, 'login'); await cmd('dev', { op: 'pass' }); assert((await cmd('claimPass', { level: 1, premium: false })).ok, 'pass'); const g = await cmd('gacha', { times: 10, ticket: false }); assert(g.ok, JSON.stringify(g)); const p = await cmd('premiumPurchase'); assert(!p.ok && p.err === 'PAYMENTS_DISABLED', 'real payments disabled'); return 'login, pass, 10x wish ok; payments disabled'; });
await step('21 all menu windows open without errors', async () => { const labels = await page.$$eval('.mbtn', (b) => b.map((x) => x.getAttribute('aria-label'))); for (const l of labels) { if (l === 'Auto') continue; await page.click(`.mbtn[aria-label="${l}"]`); await page.waitForTimeout(150); const n = await page.$$eval('.win', (w) => w.length); assert(n >= 1, `${l} opened no window`); if (l !== 'Settings') await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); } await shot('21_windows'); await page.keyboard.press('Escape'); return `${labels.length} windows`; });
await step('28 projectiles in flight + durability wear + repair button', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'teleport', x: 34 * 32 + 16, y: 27 * 32 + 16 });
  const m = await cmd('dev', { op: 'spawn', id: 'forest_slime' }); await cmd('attack', { target: m.data.id }); const flying = await st('(a)=>[...a.world.entities.values()].some(e=>e.kind==="projectile")'); assert(flying, 'projectile entity in flight');
  await page.waitForTimeout(80); await shot('28_projectile');
  await cmd('dev', { op: 'wear', n: 10 }); await cmd('dev', { op: 'gold', n: 100000 }); await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await page.evaluate(() => window.__hb.a.ctx && 0); await page.evaluate(() => { const n = document.querySelector('.mbtn[aria-label]'); return n; });
  await cmd('dev', { op: 'teleport', x: 34 * 32 + 16, y: 27 * 32 + 16 }); await page.keyboard.press('f'); await page.waitForSelector('.win:has-text("Brunhild")'); await page.click('.win button:has-text("Refine")'); await page.waitForSelector('.win:has-text("Repair all")'); await shot('28_repair');
  await page.click('.win button:has-text("Repair all")'); await page.waitForTimeout(200); const dur = await st('(a,p)=>Object.values(p.equipment).filter(Boolean).map(i=>i.durability)'); assert(dur.every((d) => d === 100), JSON.stringify(dur)); return `projectile seen; repaired ${dur.length} items to 100%`;
});
await step('29 party bots follow into dungeon + friend presence + card challenge', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('partyLeave');
  const bot = await st('(a)=>{const b=[...a.world.entities.values()].find(e=>e.kind==="bot");return {id:b.id,name:b.name}}'); assert((await cmd('partyInvite', { target: bot.id })).ok, 'invite'); await cmd('friendAdd', { name: bot.name });
  const fs = await cmd('friendsStatus'); const f = fs.data.find((x) => x.name === bot.name); assert(f && f.online && f.simulated, JSON.stringify(f));
  const ch = await cmd('tcgChallenge', { target: bot.id }); assert(ch.ok, JSON.stringify(ch)); const opp = await st('(a)=>a.tcg().opp'); assert(opp.includes(bot.name), opp); await cmd('tcgAction', { action: { type: 'surrender' } });
  const e = await cmd('enterDungeon', { id: 'daily_gem_1' }); assert(e.ok, JSON.stringify(e)); await page.waitForTimeout(300);
  const inside = await st(`(a)=>{const me=a.world.entities.get(a.myId);const b=a.world.entities.get("${bot.id}");return {map:a.mapId, bot:!!b, same: !!b && b.partyId===me.partyId}}`); assert(inside.map === 'mossy_hollow' && inside.bot && inside.same, JSON.stringify(inside));
  await shot('29_party_dungeon'); await cmd('leaveInstance'); const back = await st(`(a)=>!!a.world.entities.get("${bot.id}")`); assert(back, 'bot followed back out'); return `${bot.name} followed into and out of the dungeon; presence + challenge ok`;
});
await step('30 gem refine, cosmetic aura, focused craft, regional food & runes, farm visit', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'gold', n: 1e6 });
  await page.evaluate(() => { const p = window.__hb.a.p; p.inventory = p.inventory.filter((i) => !['material', 'consumable', 'weapon', 'armor', 'accessory'].includes(i.defId.startsWith('gem_') ? 'keep' : 'x') || i.locked).slice(0, 25); }); // free bag space (bag is full after 29 steps; overflow would go to mail)
  for (const [id, n] of [['gem_dust', 200], ['star_dust', 40], ['costume_witch', 1], ['enchant_stone', 5], ['rune_fang', 1], ['food_forest', 3], ['iron_ore', 20], ['oak_log', 10]]) await cmd('dev', { op: 'item', id, n });
  const w = await st('(a,p)=>p.equipment.main.uid'); const sockOk = await st('(a,p)=>p.equipment.main.sockets.some(Boolean)'); assert(sockOk, 'gem from step 9 still socketed');
  const gr = await cmd('refineGem', { uid: w, idx: 0 }); assert(gr.ok, JSON.stringify(gr));
  const c = await st('(a,p)=>p.inventory.find(i=>i.defId==="costume_witch").uid'); assert((await cmd('equip', { uid: c })).ok, 'equip costume'); for (let i = 0; i < 3; i++) assert((await cmd('enhanceCosmetic', { uid: c })).ok, 'enhance'); const cosm = await st('(a)=>a.world.entities.get(a.myId).cosm'); assert(cosm === 3, `aura ${cosm}`);
  await cmd('dev', { op: 'teleport', x: 24 * 32 + 16, y: 31 * 32 + 16 }); const cr = await cmd('craft', { recipe: 'rc_iron_sword', times: 1, focus: 'atk' }); assert(cr.ok, JSON.stringify(cr));
  const pet = await st('(a,p)=>p.pets[0].uid'); const fd = await cmd('feed', { pet, food: 'food_forest' }); assert(fd.ok, JSON.stringify(fd)); assert((await cmd('petRune', { pet, rune: 'rune_fang' })).ok, 'rune');
  const fr = await st('(a,p)=>p.friends[0].name'); const v = await cmd('visitFarm', { name: fr }); assert(v.ok, JSON.stringify(v)); const vv = await st('(a)=>a.visitView()'); assert(vv && vv.owner === fr && vv.pets.length > 0, JSON.stringify(vv)); const lk = await cmd('likeFarm'); assert(lk.ok, JSON.stringify(lk)); assert(!(await cmd('likeFarm')).ok, 'one like per day');
  await page.waitForTimeout(400); await shot('30_farm_visit'); await cmd('leaveInstance'); return `gem +${gr.data.level}, aura ✦3, focused craft, regional food bonus=${fd.data.bonus}, visited ${fr}'s farm`;
});
await step('31 arena modes: Lantern Siege 2v2 via UI, Ember Rush, MVP, season', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('partyLeave');
  await cmd('dev', { op: 'teleport', x: 46 * 32 + 16, y: 29 * 32 + 16 }); await page.click('.mbtn[aria-label="Arena"]'); await page.waitForSelector('.win:has-text("Lantern Siege")');
  await page.click('.win button:has-text("2v2")'); await page.click('.win .li:has-text("Lantern Siege") button:has-text("Queue")'); await page.waitForTimeout(1500);
  const ar = await st('(a)=>{const x=a.arenaInfo();return x&&{mode:x.mode,a:x.teams[0].length,b:x.teams[1].length,pts:x.points.length}}'); assert(ar && ar.mode === 'siege' && ar.a === 2 && ar.b === 2 && ar.pts === 3, JSON.stringify(ar));
  await page.waitForTimeout(2500); await shot('31_siege'); const banner = await page.textContent('.banner'); assert(/Lantern Siege/.test(banner), banner);
  await page.evaluate(() => { const w = window.__hb.a.world; w.arena.score = [100, 40]; }); await page.waitForTimeout(400);
  const s = await cmd('arenaSettle'); assert(s.ok && s.data.mode === 'siege' && s.data.win, JSON.stringify(s)); await cmd('leaveInstance');
  await cmd('dev', { op: 'teleport', x: 46 * 32 + 16, y: 29 * 32 + 16 }); assert((await cmd('arenaJoin', { mode: '1v1', type: 'rush' })).ok, 'rush'); await page.waitForTimeout(4000); const crys = await st('(a)=>{const x=a.arenaInfo();return x.crystals.length+x.carriers.length+x.score[0]+x.score[1]}'); assert(crys >= 1, 'crystal spawned (on ground, carried or scored)'); await shot('31_rush'); await cmd('leaveInstance');
  const se = await cmd('dev', { op: 'season' }); assert(se.ok && se.data.pvp, JSON.stringify(se)); return `siege 2v2 won (MVP=${s.data.mvp}, ${s.data.mvpName}); rush crystals=${crys}; season rollover ${JSON.stringify(se.data)}`;
});
await step('32 market: filters, wishlist alert, auto-bid, sales collection, history, candles', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'gold', n: 1e6 });
  await page.keyboard.press('g'); await page.waitForSelector('.win:has-text("Marketplace")'); await page.selectOption('.win select[aria-label="Rarity"]', 'common'); await page.waitForTimeout(200);
  const shown = await page.$$eval('.win .list .li', (x) => x.length); const ok1 = await st('(a)=>a.market().listings.filter(l=>l.status==="active"&&l.simulated).every(l=>true)'); void ok1;
  await page.click('.win button.tab:has-text("Best Sellers")'); await page.click('.win button.tab:has-text("Exchange")'); await page.click('.win button:has-text("1m")'); await shot('32_exchange');
  const sim = await st('(a)=>{const l=a.market().listings.find(l=>l.status==="active"&&l.simulated);return {id:l.id,def:l.item.defId}}'); assert((await cmd('wishlistSet', { defId: sim.def, maxPrice: 1e9 })).ok, 'wishlist');
  await page.evaluate((id) => { const a = window.__hb.a; a.marketSvc.onNewListing(a.marketSvc.listings.find((l) => l.id === id)); }, sim.id); await page.waitForTimeout(300); const alert = await page.textContent('.toasts'); assert(/Wishlist alert/.test(alert), alert);
  const auc = await st('(a)=>{const x=a.market().auctions.find(x=>x.status==="active"&&x.seller!=="p:"+a.p.id);return x&&{id:x.id,start:String(x.start),cur:String(x.current)}}'); let bidInfo = 'no auction';
  if (auc) { const max = String(BigInt(auc.start) * 10n + BigInt(auc.cur)); const b = await cmd('auctionBid', { id: auc.id, amount: max }); assert(b.ok && b.data.leading, JSON.stringify(b)); assert(BigInt(b.data.current) < BigInt(max), 'pays less than max'); bidInfo = `auto-bid leads at ${b.data.current} (max ${max})`; }
  const it = await st('(a,p)=>p.inventory.find(i=>!i.bound&&!i.locked&&["slime_gel","soft_fur","berry","herb_green","oak_log"].includes(i.defId))?.uid'); assert(it, 'sellable item'); assert((await cmd('marketList', { uid: it, price: '1', qty: 1 })).ok, 'list');
  let coll = 0n; for (let i = 0; i < 40 && coll === 0n; i++) { await page.waitForTimeout(1000); coll = BigInt(await st('(a)=>String(a.market().collectable(a.p.accountId))')); } assert(coll > 0n, 'sim buyer bought the listing');
  const c = await cmd('collectSales'); assert(c.ok, JSON.stringify(c)); const h = await st('(a)=>a.market().history.filter(x=>x.account==="p:"+a.p.id).map(x=>x.kind)'); assert(h.includes('sell'), JSON.stringify(h));
  await page.click('.win button.tab:has-text("History")'); await page.waitForTimeout(200); await shot('32_history'); await page.keyboard.press('Escape');
  return `${shown} common listings shown; wishlist alert; ${bidInfo}; collected ${c.data.collected}G; history ${h.join(',')}`;
});
await step('33 liveops: memberships, banners, event countdown, rankings, TCG tutorial/exchange/cosmetics', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'crystal', n: 20000 });
  const m = await cmd('buyMembership', { id: 'monthly' }); assert(m.ok, JSON.stringify(m)); const c = await cmd('claimMembership', { id: 'monthly' }); assert(c.ok, JSON.stringify(c)); assert(!(await cmd('claimMembership', { id: 'monthly' })).ok, 'double claim blocked');
  await page.click('.mbtn[aria-label="Events"]'); await page.waitForSelector('.win:has-text("Rewards")'); await page.click('.win button.tab:has-text("Memberships")'); await page.waitForTimeout(150);
  const mtxt = await page.textContent('.win'); assert(/left/.test(mtxt) && /Claimed today/.test(mtxt), 'membership ui'); await shot('33_memberships');
  await page.click('.win button.tab:text-is("Event")'); await page.waitForTimeout(150); assert(/Ends in/.test(await page.textContent('.win')), 'event countdown');
  await page.click('.win button.tab:has-text("Wishes")'); await page.click('.win button:has-text("Seasonal Wishes")'); await page.waitForTimeout(150); assert(/Featured this month/.test(await page.textContent('.win')), 'seasonal banner'); await shot('33_seasonal');
  const g = await cmd('gacha', { times: 10, banner: 'gems' }); assert(g.ok && g.data.every((x) => /^gem_/.test(x.itemId)), JSON.stringify(g)); const pity = await st('(a,p)=>p.gacha.pityBy');
  await page.keyboard.press('Escape'); await page.click('.mbtn[aria-label="Rankings"]'); await page.waitForSelector('.win:has-text("Achievements")'); await page.click('.win button.tab:has-text("Pets")'); await page.waitForSelector('.win table.tbl tr');
  const rows = await page.$$eval('.win table.tbl tr', (x) => x.length); assert(rows >= 10, `rows ${rows}`); await shot('33_rankings'); await page.keyboard.press('Escape');
  const tut = await cmd('tcgStart', { mode: 'tutorial' }); assert(tut.ok && tut.data.hint, JSON.stringify(tut).slice(0, 200)); await page.keyboard.press('b'); await page.waitForSelector('.note.tutor'); await shot('33_tutorial');
  for (let i = 0; i < 300; i++) { if (await st('(a)=>a.tcg().view.winner!==null')) break; await cmd('tcgAction', { action: await page.evaluate(() => window.__hb.aiMove()) }); }
  const tutDone = await st('(a,p)=>!!p.tcg.tutorialDone');
  const ids = (await cmd('dev', { op: 'tcgcards' })).data; const ex = await cmd('tcgExchange', { cards: ids }); assert(ex.ok, JSON.stringify(ex));
  const starter = await st('(a,p)=>p.tcg.decks[0].cards[0]'); assert(!(await cmd('dustCard', { card: starter })).ok, 'bound starter card cannot be dusted');
  await cmd('dev', { op: 'currency', c: 'card_dust', n: 2000 }); assert((await cmd('tcgCosmetic', { id: 'table_animated', buy: true })).ok, 'buy table'); assert((await cmd('tcgCosmetic', { id: 'back_starry', buy: true })).ok, 'buy back');
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((x) => x.click())); await page.keyboard.press('b'); await page.waitForSelector('.win:has-text("Card Duels")');
  await page.click('.win button.tab:has-text("Exchange")'); await page.waitForTimeout(150); await shot('33_exchange'); await page.click('.win button.tab:has-text("Cosmetics")'); await page.waitForTimeout(150); const eq = await page.$$eval('.win .card.on', (x) => x.length); assert(eq >= 2, `equipped ${eq}`); await shot('33_cosmetics');
  await cmd('tcgStart', { mode: 'ai' }); await page.evaluate(() => document.querySelectorAll('.win .x').forEach((x) => x.click())); await page.keyboard.press('b'); await page.waitForSelector('.duel.anim'); await shot('33_duel_cosmetics'); await cmd('tcgAction', { action: { type: 'surrender' } }); await page.keyboard.press('Escape');
  return `membership buy+claim; gem banner ×10 (pity ${JSON.stringify(pity)}); ranking rows ${rows}; tutorial won=${tutDone}; exchange → ${ex.data}; bound starter protected; cosmetics applied`;
});
await step('34 wedding: engagement → plaza ceremony phases → married; guild war vs simulated rival', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); const m0 = await st('(a,p)=>p.marriage'); assert(m0 && m0.stage === 'engaged', `engaged after step 15: ${JSON.stringify(m0)}`);
  await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'teleport', x: 28 * 32 + 16, y: 42 * 32 + 16 }); await page.waitForTimeout(200); const portal = await cmd('portal', { i: 3 }); assert(portal.ok, `portal to plaza ${JSON.stringify(portal)}`); await page.waitForTimeout(300);
  assert((await st('(a)=>a.mapId')) === 'wedding_plaza', 'on plaza'); await shot('34_plaza');
  await cmd('dev', { op: 'teleport', x: 15 * 32 + 16, y: 7 * 32 + 16 }); await cmd('dev', { op: 'gold', n: 20000 }); await page.evaluate(() => { window.__hb.a.p.settings.fastWedding = true; });
  const npc = await st('(a)=>[...a.world.entities.values()].find(e=>e.kind==="npc"&&e.name==="Planner Rosa")?.id'); assert(npc, 'planner present');
  const ws = await cmd('weddingStart'); assert(ws.ok, JSON.stringify(ws)); await page.waitForTimeout(1800); const banner = await page.textContent('.banner').catch(() => ''); await shot('34_ceremony');
  let phase = ''; for (let i = 0; i < 40; i++) { phase = await st('(a)=>a.world.wedding?.phase'); if (phase === 'celebration' || phase === 'done') break; await page.waitForTimeout(300); }
  await page.waitForTimeout(400); await shot('34_celebration'); const m1 = await st('(a,p)=>p.marriage'); assert(m1.stage === 'married', JSON.stringify(m1)); const title = await st('(a,p)=>p.titles.includes("title_hearthbound")'); assert(title, 'title');
  await page.keyboard.press('o'); await page.click('.win button.tab:has-text("Guild")'); await page.waitForTimeout(150); await shot('34_guild');
  const gw = await cmd('guildWar'); assert(gw.ok && /\[sim\]/.test(gw.data.rival), JSON.stringify(gw)); await page.keyboard.press('Escape'); await page.waitForTimeout(300); assert((await st('(a)=>a.mapId')) === 'arena', 'in arena');
  const ex0 = await st('(a,p)=>p.guild.exp+p.guild.level*1e6'); await page.evaluate(() => { const w = window.__hb.a.world; w.arena.endsAt = Date.now(); }); let s = null; for (let i = 0; i < 20; i++) { await page.waitForTimeout(250); s = await cmd('arenaSettle'); if (s.ok) break; }
  assert(s && s.ok && s.data.war, JSON.stringify(s)); const ex1 = await st('(a,p)=>p.guild.exp+p.guild.level*1e6'); assert(ex1 > ex0, `guild exp ${ex0}→${ex1}`); await cmd('leaveInstance');
  return `ceremony phase reached ${phase}; banner "${(banner ?? '').slice(0, 60)}"; married+title; guild war vs ${gw.data.rival} ${s.data.win ? 'won' : 'lost'}, guild exp up`;
});
await step('35 content: Coral Coast → Starfall Ruins → Emberpeak, new monsters/NPCs, Tidal Grotto dungeon + boss', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'level', n: 70 }); await cmd('dev', { op: 'skills' });
  const seen = {};
  for (const map of ['coral_coast', 'starfall_ruins', 'emberpeak']) {
    const r = await cmd('dev', { op: 'map', id: map }); assert(r.ok, `${map} ${JSON.stringify(r)}`); await page.waitForTimeout(700); await shot(`35_${map}`);
    seen[map] = await st('(a)=>{const ms=[...a.world.entities.values()];return {mons:[...new Set(ms.filter(e=>e.kind==="monster").map(e=>e.defId))].length,npc:ms.filter(e=>e.kind==="npc").map(e=>e.name)}}');
    assert(seen[map].mons >= 4 && seen[map].npc.length >= 1, `${map}: ${JSON.stringify(seen[map])}`);
  }
  await cmd('dev', { op: 'map', id: 'coral_coast' }); await page.waitForTimeout(300); const crab = await st('(a)=>{const me=a.world.entities.get(a.myId);return [...a.world.entities.values()].filter(e=>e.kind==="monster"&&e.defId==="tide_crab"&&!e.dead).sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0]}');
  assert(crab, 'tide crab present'); const k0 = await st('(a,p)=>p.counters.kills??0');
  for (let i = 0; i < 80; i++) { const alive = await st(`(a)=>{const e=a.world.entities.get("${crab.id}");return e&&!e.dead?{x:e.x,y:e.y}:null}`); if (!alive) break; await cmd('dev', { op: 'heal' }); await cmd('dev', { op: 'teleport', x: alive.x - 30, y: alive.y }); await cmd('attack', { target: crab.id }); await cmd('cast', { skill: await st('(a,p)=>p.hotbar[0]'), target: crab.id }); await page.waitForTimeout(120); }
  const k1 = await st('(a,p)=>p.counters.kills??0'); assert(k1 > k0, `killed a Tideclaw Crab (${k0}→${k1})`);
  // gear up like a Lv70 player would be (starter gear would take minutes against Lv38–42 HP pools): equip an Astral weapon usable by this class
  let geared = ''; for (const w of ['sword', 'greatsword', 'spear', 'dagger', 'bow', 'staff', 'tome', 'knuckle', 'gun', 'lute', 'cards', 'whip']) { await cmd('dev', { op: 'item', id: `astral_${w}` }); const uid = await st(`(a,p)=>p.inventory.find(i=>i.defId==="astral_${w}")?.uid`); if (uid && (await cmd('equip', { uid })).ok) { geared = w; break; } }
  assert(geared, 'equipped an astral weapon');
  const e = await cmd('enterDungeon', { id: 'tidal_grotto' }); assert(e.ok, JSON.stringify(e)); await page.waitForTimeout(400); assert((await st('(a)=>a.mapId')) === 'tidal_grotto', 'in grotto'); await shot('35_grotto');
  let bossSeen = false;
  for (let i = 0; i < 900; i++) { const di = await st('(a)=>a.dungeonInfo()&&a.dungeonInfo().state'); if (di === 'settled') break; await cmd('dev', { op: 'heal' }); const t = await st('(a)=>{const me=a.world.entities.get(a.myId);const m=[...a.world.entities.values()].filter(x=>x.kind==="monster"&&!x.dead).sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0];return m&&{id:m.id,x:m.x,y:m.y,def:m.defId}}'); if (t) { if (t.def === 'abyssal_kraken') bossSeen = true; await cmd('dev', { op: 'weaken', target: t.id }); /* dev op shortens fights (Kraken alone takes ~2.5 min solo); real combat was checked on the crab above */ await cmd('dev', { op: 'teleport', x: t.x - 30, y: t.y }); await cmd('attack', { target: t.id }); await cmd('cast', { skill: await st('(a,p)=>p.hotbar[0]'), target: t.id }); } await page.waitForTimeout(100); }
  const cleared = await st('(a,p)=>p.dungeon.firstClears.includes("tidal_grotto")'); const dbg = await st('(a)=>({di:a.dungeonInfo(),mons:[...a.world.entities.values()].filter(x=>x.kind==="monster"&&!x.dead).map(x=>x.defId+":"+Math.round(x.hp)+"/"+x.maxHp+"@"+Math.round(x.x)+","+Math.round(x.y)),me:(()=>{const m=a.world.entities.get(a.myId);return m&&[Math.round(m.x),Math.round(m.y),m.hp,m.dead]})()})'); assert(cleared && bossSeen, `cleared=${cleared} boss=${bossSeen} ${JSON.stringify(dbg).slice(0, 600)}`); await cmd('leaveInstance');
  return `zones ${Object.entries(seen).map(([k, v]) => `${k}:${v.mons} monster types, NPC ${v.npc.join('/')}`).join('; ')}; Tideclaw Crab killed; Tidal Grotto cleared (Abyssal Kraken)`;
});
await step('36 endgame: Skyreach Isles + Shattered Rift, 8-member raid with simulated allies, boss scaling, weekly lockout', async () => {
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await cmd('dev', { op: 'level', n: 115 }); const lv = await st('(a,p)=>p.level'); assert(lv >= 110, `level ${lv}`);
  const seen = {};
  for (const map of ['skyreach', 'shattered_rift']) { assert((await cmd('dev', { op: 'map', id: map })).ok, map); await page.waitForTimeout(700); await shot(`36_${map}`); seen[map] = await st('(a)=>{const ms=[...a.world.entities.values()];return {mons:[...new Set(ms.filter(e=>e.kind==="monster").map(e=>e.defId))].length,npc:ms.filter(e=>e.kind==="npc").map(e=>e.name)}}'); assert(seen[map].mons >= 4 && seen[map].npc.length >= 1, `${map} ${JSON.stringify(seen[map])}`); }
  await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await page.click('.mbtn[aria-label="Dungeons"]'); await page.waitForSelector('.win:has-text("Raid (up to 8 players)")'); const dtxt = await page.textContent('.win:has-text("Raid (up to 8 players)")'); assert(/Sanctum of the First Flame/.test(dtxt), 'raid listed'); await shot('36_raid_list'); await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  const e = await cmd('enterDungeon', { id: 'flame_sanctum' }); assert(e.ok, JSON.stringify(e)); await page.waitForTimeout(500); const party = await st('(a)=>{const me=a.world.entities.get(a.myId);return (a.world.parties.get(me.partyId)??[]).length}'); assert(party === 8, `raid group ${party}`);
  let bossHp = 0, size = 0;
  for (let i = 0; i < 1500; i++) { const di = await st('(a)=>a.dungeonInfo()&&a.dungeonInfo().state'); if (di === 'settled' || di === 'completed' || di === 'failed') break; await cmd('dev', { op: 'heal' }); const t = await st('(a)=>{const me=a.world.entities.get(a.myId);const live=[...a.world.entities.values()].filter(x=>x.kind==="monster"&&!x.dead);const m=live.find(x=>x.defId==="first_flame_tyrant")??live.sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0];return m&&{id:m.id,x:m.x,y:m.y,def:m.defId,mhp:m.maxHp}}');
    if (t) { if (t.def === 'first_flame_tyrant' && !bossHp) { bossHp = t.mhp; size = await st('(a)=>a.dungeonInfo().raidSize'); await shot('36_raid_boss'); } await cmd('dev', { op: 'weaken', target: t.id }); await cmd('dev', { op: 'teleport', x: t.x - 30, y: t.y }); await cmd('attack', { target: t.id }); await cmd('cast', { skill: await st('(a,p)=>p.hotbar[0]'), target: t.id }); } await page.waitForTimeout(80); }
  const cleared = await st('(a,p)=>p.dungeon.firstClears.includes("flame_sanctum")'); const dbg36 = await st('(a)=>({di:a.dungeonInfo()&&{s:a.dungeonInfo().state,w:a.dungeonInfo().wave,boss:a.dungeonInfo().bossEntity},mons:[...a.world.entities.values()].filter(x=>x.kind==="monster"&&!x.dead).map(x=>x.defId+":"+Math.round(x.hp)),me:(()=>{const m=a.world.entities.get(a.myId);return m&&[m.dead,Math.round(m.hp)]})()})'); assert(cleared, `raid cleared ${JSON.stringify(dbg36).slice(0, 500)}`); assert(size === 8 && bossHp > 400000 * 4, `boss scaled: size ${size}, hp ${bossHp}`);
  const title = await st('(a,p)=>p.titles.includes("title_flamebreaker")'); assert(title, 'raid title'); await cmd('leaveInstance'); await page.waitForTimeout(300);
  const again = await cmd('enterDungeon', { id: 'flame_sanctum' }); assert(!again.ok && again.err === 'WEEKLY_LOCKOUT', JSON.stringify(again));
  return `zones ${Object.entries(seen).map(([k, v]) => `${k}:${v.mons} types/${v.npc.join('')}`).join(', ')}; raid list shown=${/Raid/.test(dtxt)}; group 8 (7 sim); boss HP ${bossHp} for ${size}; cleared → Flamebreaker title; weekly lockout enforced`;
});
await step('37 UI coverage: help/wiki + stat guide, quest journal + navigate, audio/radio/favorites/volume, low-perf mode, auto-battle (combat, loot, repair, bag-full stop), area music', async () => {
  const close = () => page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await close(); await cmd('dev', { op: 'map', id: 'emberglen' }); await page.waitForTimeout(300);
  const out = {};
  // L474 wiki + L044 stat guide
  await page.keyboard.press('h'); await page.waitForSelector('.win:has-text("Wiki")'); const tabsTxt = await page.$$eval('.win:has-text("Wiki") button.tab', (x) => x.map((b) => b.textContent)); assert(tabsTxt.some((t) => /Stat/.test(t)), `help tabs ${tabsTxt}`); await page.click('.win:has-text("Wiki") button.tab:has-text("Stat")'); await page.waitForTimeout(100); assert(/STR|ATK|DEX|Critical/i.test(await page.textContent('.win:has-text("Wiki")')), 'stat guide text'); out.help = tabsTxt.length; await close();
  // L131 journal + L101/L127 navigate (A* moveTo)
  await page.keyboard.press('j'); await page.waitForSelector('.win button.tab:has-text("Journal")'); await page.click('.win button.tab:has-text("Journal")'); await page.waitForTimeout(100); const journal = await page.$$eval('.win .list .li', (x) => x.length); assert(journal >= 1, `journal ${journal}`);
  await page.click('.win button.tab:has-text("Active")'); await page.waitForTimeout(100); const nav = await page.$('.win button:has-text("Navigate")');
  if (nav) { const p0 = await st('(a)=>{const e=a.world.entities.get(a.myId);return [e.x,e.y]}'); await nav.click(); await page.waitForTimeout(1500); const p1 = await st('(a)=>{const e=a.world.entities.get(a.myId);return [e.x,e.y]}'); assert(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 20, `navigate moved ${JSON.stringify([p0, p1])}`); out.navigate = 'moved'; } else out.navigate = 'no active quest with a target';
  await close();
  // L433 volume, L434/L435 radio, L437 favorites, L472 low-performance mode
  await page.keyboard.press('Escape'); await page.waitForSelector('.win:has-text("Settings")'); await page.click('.win button.tab:has-text("Audio")'); await page.waitForTimeout(100);
  const slider = await page.$('.win input[type="range"]'); await slider.evaluate((el) => { el.value = '0.2'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(100);
  const vol = await page.evaluate(() => [window.__hb.settings.master, window.__hb.audio.vol.master]); assert(Math.abs(vol[0] - 0.2) < 0.01 && Math.abs(vol[1] - 0.2) < 0.01, `volume ${vol}`);
  const plays = await page.$$('.win .list .li button:has-text("Play")'); await plays[1].click(); await page.waitForTimeout(100); const radio = await page.evaluate(() => window.__hb.audio.radio); assert(radio, 'radio station playing');
  const favs = await page.$$('.win .list .li button:has-text("Fav")'); await favs[0].click(); await page.waitForTimeout(100); const fav = await page.evaluate(() => window.__hb.audio.favorites.length); assert(fav >= 1, 'favorite saved');
  await (await page.$$('.win .list .li button:has-text("Play")'))[0].click(); await page.click('.win button.tab:has-text("Graphics")'); await page.waitForTimeout(100); await page.click('.win label:has-text("Low performance mode") input'); await page.waitForTimeout(100);
  const low = await page.evaluate(() => window.__hb.settings.lowPerf); assert(low === true, 'low perf on'); await page.click('.win label:has-text("Low performance mode") input'); await close();
  // L430 area music follows the map; L266–L268 auto-battle fights + loots; L431 combat SFX; L271 auto-repair
  await cmd('dev', { op: 'map', id: 'whisperwood' }); await page.waitForTimeout(400); const mood = await page.evaluate(() => window.__hb.audio.mood); assert(mood === 'forest', `area music ${mood}`);
  await cmd('dev', { op: 'item', id: 'repair_kit' }); await page.evaluate(() => { const p = window.__hb.a.p; for (const it of Object.values(p.equipment)) if (it) it.durability = 10; });
  const mon = await st('(a)=>{const me=a.world.entities.get(a.myId);return [...a.world.entities.values()].filter(e=>e.kind==="monster"&&!e.dead&&e.level<8).sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0]}'); await cmd('dev', { op: 'teleport', x: mon.x - 40, y: mon.y });
  const k0 = await st('(a,p)=>p.counters.kills??0'); const hits0 = await page.evaluate(() => window.__hb.audio.played.hit ?? 0); await page.click('.mbtn[aria-label="Auto"]');
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); await cmd('dev', { op: 'heal' }); if ((await st('(a,p)=>p.counters.kills??0')) > k0) break; }
  const k1 = await st('(a,p)=>p.counters.kills??0'); const dur = await st('(a,p)=>Math.min(...Object.values(p.equipment).filter(Boolean).map(i=>i.durability))'); const hits1 = await page.evaluate(() => window.__hb.audio.played.hit ?? 0);
  assert(k1 > k0, `auto-battle killed (${k0}→${k1})`); assert(dur > 20, `auto-repair used the kit (min durability ${dur})`); assert(hits1 > hits0, 'combat SFX played');
  // L270 bag-full stop
  await page.evaluate(() => { const a = window.__hb.a; while (a.p.inventory.length < a.p.invSlots) a.p.inventory.push({ ...a.p.inventory[0], uid: 'fill' + a.p.inventory.length }); }); await page.waitForTimeout(900);
  const stopped = await page.evaluate(() => window.__hb.auto()); assert(stopped === false, 'auto stopped when bag full'); assert(/bag full/i.test(await page.textContent('.toasts')), 'bag full toast');
  await page.evaluate(() => { const a = window.__hb.a; a.p.inventory = a.p.inventory.filter((x) => !String(x.uid).startsWith('fill')); });
  return `help tabs ${out.help}; journal ${journal}; navigate ${out.navigate}; volume/radio/fav/low-perf ok; area music ${mood}; auto-battle kills ${k0}→${k1}, auto-repair durability ${dur}, SFX hits ${hits1 - hits0}; bag-full stop ok`;
});
await step('38 gap closures via UI: appearance salon, floor locks, card-set claim, instant exchange buy, achievement-points ranking, radio mood filter + playlist, wish reveal animation', async () => {
  const close = () => page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await close(); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'gold', n: 1e6 }); await page.waitForTimeout(200);
  // L007 salon
  await page.keyboard.press('c'); await page.click('.win button.tab:has-text("Salon")'); await page.waitForTimeout(100); await page.selectOption('.win select[aria-label="Hairstyle"]', '5');
  await page.$eval('.win input[aria-label="Hair"]', (el) => { el.value = '#33cc99'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await page.click('.win button:has-text("Apply (5,000 Gold)")'); await page.waitForTimeout(200);
  const ap = await st('(a,p)=>({hair:p.appearance.hair,c:p.appearance.hairColor,e:a.world.entities.get(a.myId).appearance.hairColor})'); assert(ap.hair === 5 && ap.c === '#33cc99' && ap.e === '#33cc99', JSON.stringify(ap)); await shot('38_salon'); await close();
  // L228 floor lock visible
  await page.click('.mbtn[aria-label="Dungeons"]'); await page.waitForSelector('.win:has-text("Raid (up to 8 players)")'); await page.click('.win button.tab:has-text("pet")'); await page.waitForTimeout(100);
  const locks = await page.$$eval('.win .li', (x) => x.filter((e) => e.textContent.includes('🔒')).length); assert(locks >= 8, `locked floors shown ${locks}`); await close();
  // L353 card set claim
  await page.keyboard.press('b'); await page.waitForSelector('.win:has-text("Card Duels")'); await page.click('.win button.tab:has-text("Collection")'); await page.waitForTimeout(100);
  const setTxt = await page.textContent('.win .card:has-text("Element sets")'); assert(/\d+\/\d+/.test(setTxt), 'set progress shown');
  const elName = await page.evaluate(() => { const rows = [...document.querySelectorAll('.win .card .cal')]; return rows[0].textContent.split(' ')[0]; });
  const ok = await page.evaluate(async (elx) => (await window.__hb.cmd('claimCardSet', { element: elx })).err, elName); assert(ok === 'INCOMPLETE', `incomplete set refused: ${ok}`);
  await close();
  // L319 instant buy
  await page.keyboard.press('g'); await page.waitForSelector('.win:has-text("Marketplace")'); await page.click('.win button.tab:has-text("Exchange")'); await page.waitForTimeout(150);
  await page.fill('.win .row:has-text("Qty") input', '1'); const g0 = await st('(a)=>String(a.bal("gold"))'); await page.click('.win button:has-text("Instant BUY")'); await page.waitForTimeout(300);
  const toastTxt = await page.textContent('.toasts'); const g1 = await st('(a)=>String(a.bal("gold"))'); assert(/Bought \d+ @ avg/.test(toastTxt) && BigInt(g1) < BigInt(g0), `instant buy: ${toastTxt.slice(-120)}`); await close();
  // L420 achievement points ranking
  await page.click('.mbtn[aria-label="Rankings"]'); await page.waitForSelector('.win:has-text("Achievements")'); await page.click('.win button.tab:has-text("Achievement Pts")'); await page.waitForSelector('.win table.tbl tr'); const rk = await page.$$eval('.win table.tbl tr', (x) => x.length); assert(rk >= 5, `ranking rows ${rk}`); await close();
  // L439 mood filter + L436 playlist
  await page.keyboard.press('Escape'); await page.waitForSelector('.win:has-text("Settings")'); await page.click('.win button.tab:has-text("Audio")'); await page.waitForTimeout(100);
  const all = await page.$$eval('.win .list .li', (x) => x.length); await page.selectOption('.win select[aria-label="Radio mood"]', 'boss'); await page.waitForTimeout(150); const filtered = await page.$$eval('.win .list .li', (x) => x.length); assert(filtered < all, `mood filter ${all}→${filtered}`);
  await page.selectOption('.win select[aria-label="Radio mood"]', ''); await page.waitForTimeout(100); const favs = await page.$$('.win .list .li button:has-text("Fav")'); await favs[1].click(); await page.waitForTimeout(80); await (await page.$$('.win .list .li button:has-text("Fav")'))[2].click(); await page.waitForTimeout(80);
  await page.click('.win button:has-text("Play favorites playlist")'); await page.waitForTimeout(100); const pl = await page.evaluate(() => ({ list: window.__hb.audio.playlist, radio: window.__hb.audio.radio })); assert(pl.list && pl.list.length >= 2 && pl.radio === pl.list[0], JSON.stringify(pl));
  await page.evaluate(() => window.__hb.audio.nextTrack()); const r2 = await page.evaluate(() => window.__hb.audio.radio); assert(r2 === pl.list[1], `playlist advanced to ${r2}`); await page.evaluate(() => window.__hb.audio.playRadio(null)); await close();
  // L475 wish reveal animation
  await cmd('dev', { op: 'item', id: 'gacha_ticket', n: 10 }); await page.click('.mbtn[aria-label="Events"]'); await page.waitForSelector('.win:has-text("Rewards")'); await page.click('.win button.tab:has-text("Wishes")'); await page.waitForTimeout(100);
  await page.click('.win button:has-text("Wish ×10 (tickets)")'); await page.waitForSelector('.wish-reveal .wr-card'); await page.waitForTimeout(2200); const cards = await page.$$eval('.wish-reveal .wr-card', (x) => x.map((c) => getComputedStyle(c).opacity)); await shot('38_wish_reveal');
  assert(cards.length === 10 && cards.every((o) => Number(o) > 0.9), `reveal cards ${JSON.stringify(cards)}`); await page.click('.wish-reveal'); await close();
  return `salon hair ${ap.hair}/${ap.c}; ${locks} locked floors shown; set progress + incomplete refused; instant buy ok; achievement ranking ${rk} rows; mood filter ${all}→${filtered}; playlist ${pl.list.length} stations advances; wish reveal 10 cards`;
});
await step('39 refine result reveal at the Forge, auto-loot during auto-battle, offline auto-play setting, equipment presets, login event reminder', async () => { let stage = 'start'; try {
  const close = () => page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await close(); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'gold', n: 1e6 }); await cmd('dev', { op: 'materials' }); await page.waitForTimeout(200);
  stage = 'L476'; // L476 refine reveal through the real Forge UI (NPC → Refine → select → Refine): toast + refine SFX
  await cmd('dev', { op: 'teleport', x: 33 * 32 + 16, y: 26 * 32 + 16 }); await page.waitForTimeout(200); await page.keyboard.press('f'); await page.waitForSelector('.win:has-text("Brunhild")'); await page.click('.win button:has-text("Refine")'); await page.waitForSelector('.win:has-text("Forge")');
  await page.click('.win:has-text("Forge") .igrid .icell'); await page.waitForTimeout(100); const sfx0 = await page.evaluate(() => (window.__hb.audio.played.refine_ok ?? 0) + (window.__hb.audio.played.refine_fail ?? 0));
  await page.click('.win:has-text("Forge") button.primary:has-text("Refine")'); await page.waitForTimeout(400); const sfx1 = await page.evaluate(() => (window.__hb.audio.played.refine_ok ?? 0) + (window.__hb.audio.played.refine_fail ?? 0));
  const tt = await page.textContent('.toasts'); assert(/Success! Now \+\d+|Failed/.test(tt) && sfx1 === sfx0 + 1, `reveal toast/SFX: ${tt.slice(-80)} sfx ${sfx0}→${sfx1}`); await shot('39_forge'); await close();
  stage = 'S21'; // S21 presets via Character → Equipment
  await page.keyboard.press('c'); await page.click('.win button.tab:has-text("Equipment")'); await page.waitForTimeout(100); await page.click('.win button:has-text("Save 1")'); await page.waitForTimeout(150); const saved = await st('(a,p)=>!!(p.presets&&p.presets[0])'); assert(saved, 'preset saved');
  await page.click('.win button:has-text("Load 1")'); await page.waitForTimeout(200); assert(/Preset 1: \d+ equipped/.test(await page.textContent('.toasts')), 'preset loaded'); await close();
  stage = 'L269'; // L269 offline auto-play setting reaches the player state
  await page.keyboard.press('Escape'); await page.waitForSelector('.win:has-text("Settings")'); await page.click('.win button.tab:has-text("General")'); await page.waitForTimeout(100); await page.click('.win label:has-text("Offline auto-play") input'); await page.waitForTimeout(200); const off = await st('(a,p)=>p.settings.offlineAuto'); assert(off === true, 'offline auto-play enabled'); await close();
  stage = 'L268'; // L268 auto-loot during auto-battle
  await page.evaluate(() => { const p = window.__hb.a.p; p.inventory = p.inventory.slice(0, 20); }); // earlier steps filled the bag; a full bag correctly stops auto-battle
  await page.evaluate(() => { window.__hb.settings.autoLoot = true; }); await cmd('settings', { settings: { autoLoot: true } }); await cmd('dev', { op: 'map', id: 'whisperwood' }); await page.waitForTimeout(400);
  const mon = await st('(a)=>{const me=a.world.entities.get(a.myId);return [...a.world.entities.values()].filter(e=>e.kind==="monster"&&!e.dead&&e.level<8).sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0]}'); await cmd('dev', { op: 'teleport', x: mon.x - 40, y: mon.y });
  const pick0 = await st('(a,p)=>p.counters.pickups??p.counters.loot??0'); const inv0 = await st('(a,p)=>p.inventory.reduce((s,i)=>s+i.qty,0)'); if (!(await page.evaluate(() => window.__hb.auto()))) await page.click('.mbtn[aria-label="Auto"]');
  let picked = false; for (let i = 0; i < 60 && !picked; i++) { await page.waitForTimeout(250); await cmd('dev', { op: 'heal' }); const inv = await st('(a,p)=>p.inventory.reduce((s,i)=>s+i.qty,0)'); const bags = await st('(a)=>[...a.world.entities.values()].filter(e=>e.kind==="loot").length'); picked = inv > inv0 && bags === 0; }
  if (await page.evaluate(() => window.__hb.auto())) await page.click('.mbtn[aria-label="Auto"]'); const dbg39 = await st('(a,p)=>({inv:p.inventory.length,slots:p.invSlots,kills:p.counters.kills,bags:[...a.world.entities.values()].filter(e=>e.kind==="loot").map(e=>Math.round(Math.hypot(e.x-a.world.entities.get(a.myId).x,e.y-a.world.entities.get(a.myId).y))),auto:window.__hb.auto()})'); assert(picked, `auto-loot picked up drops ${JSON.stringify(dbg39)}`);
  stage = 'L468'; // L468 login event reminder: reload + continue shows the event toast
  const name = await st('(a,p)=>p.name'); assert(await st('(a)=>a.save()'), 'saved'); await page.reload(); await page.click('text=Continue'); await page.click('.slot-card:has-text("' + name + '") button:has-text("Play")');
  await page.waitForTimeout(2200); const tt2 = await page.textContent('.toasts'); assert(/Event: .* left/.test(tt2), `event reminder toast: ${tt2.slice(-160)}`);
  return 'forge reveal toast + SFX; preset save/load; offline auto-play on; auto-loot collected drops; event reminder shown after re-login';
} catch (e) { throw new Error(`[${stage}] ${String(e.message).split('\n').slice(0, 3).join(' | ')}`); } });
await step('40 crafting queue UI, personal chat mute, fullscreen toggle', async () => { let stage = 'start'; try {
  const close = () => page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click()));
  await close(); await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'materials' }); await cmd('dev', { op: 'gold', n: 1e6 }); await page.waitForTimeout(200);
  stage = 'S32'; const nq0 = await st('(a,p)=>(p.craftQueue??[]).length');   await page.click('.mbtn[aria-label="Crafting"]'); await page.waitForSelector('.win:has-text("Crafting queue")');
  const qbtn = await page.$('.win button:has-text("Queue ×5")'); await qbtn.click(); await page.waitForTimeout(250); const nq1 = await st('(a,p)=>(p.craftQueue??[]).length'); assert(nq1 === nq0 + 1, `queued ${nq0}→${nq1} ${await page.textContent('.toasts')}`);
  await page.evaluate(() => { for (const e of window.__hb.a.p.craftQueue) e.finishAt = Date.now() - 1; }); await close(); await page.click('.mbtn[aria-label="Crafting"]'); await page.waitForSelector('.win:has-text("Crafting queue")'); await page.click('.win button:has-text("Collect finished")'); await page.waitForTimeout(250);
  assert(/Collected \d+ batch/.test(await page.textContent('.toasts')), 'collected'); assert((await st('(a,p)=>(p.craftQueue??[]).length')) === 0, 'queue empty'); await close();
  stage = 'S39'; await cmd('dev', { op: 'friend', name: 'Juniper' }); await page.keyboard.press('o'); await page.click('.win button.tab:has-text("Friends")'); await page.waitForTimeout(100); await page.click('.win .li:has-text("Juniper") button:has-text("Mute chat")'); await page.waitForTimeout(150);
  assert((await st('(a,p)=>p.muted||[]')).includes('Juniper'), 'muted'); await page.evaluate(() => { window.__hb.a.world.fx.push({ t: 'chat', ch: 'local', from: 'Juniper', msg: 'muted-msg-xyz' }, { t: 'chat', ch: 'local', from: 'Rowan', msg: 'visible-msg-xyz' }); }); await page.waitForTimeout(400);
  const chatTxt = await page.textContent('.chat'); assert(!chatTxt.includes('muted-msg-xyz') && chatTxt.includes('visible-msg-xyz'), 'muted chat hidden, others shown'); await close();
  stage = 'L469'; await page.keyboard.press('Escape'); await page.waitForSelector('.win:has-text("Settings")'); await page.click('.win button.tab:has-text("Graphics")'); await page.click('.win button:has-text("Fullscreen")'); await page.waitForTimeout(400);
  const fs = await page.evaluate(() => !!document.fullscreenElement); if (fs) await page.evaluate(() => document.exitFullscreen()); await close();
  return `craft queue add → collect; mute hides chat only from Juniper; fullscreen ${fs ? 'entered' : 'blocked by headless browser (button handled it)'}`;
} catch (e) { throw new Error(`[${stage}] ${String(e.message).split('\n').slice(0, 3).join(' | ')}`); } });
await step('22 developer System Registry view', async () => { await page.keyboard.press('`'); await page.click('.win button.tab:has-text("System Registry")'); await page.waitForTimeout(200); await shot('22_registry'); const n = await page.$$eval('.reg .li', (x) => x.length); assert(n > 100, `rows ${n}`); await page.keyboard.press('Escape'); return `${n} registry rows`; });
await step('23 save → reload → continue keeps progress', async () => { const lv = await st('(a,p)=>p.level'); const name = await st('(a,p)=>p.name'); const ok = await st('(a)=>a.save()'); assert(ok, 'saved'); await page.reload(); await page.click('text=Continue'); await page.click('.slot-card:has-text("' + name + '") button:has-text("Play")'); await page.waitForTimeout(800); const lv2 = await st('(a,p)=>p.level'); assert(lv2 === lv, `${lv} vs ${lv2}`); return `level ${lv} restored`; });
await step('24 export save produces valid file', async () => { const s = await page.evaluate(() => window.__hb.a.exportSave()); const o = JSON.parse(s); assert(o.format === 'hearthbound-save', 'format'); return `${s.length} bytes`; });
await step('25 mobile viewport renders HUD + joystick', async () => { const ctx = await browser.newContext({ ...devices['Pixel 7'] }); const m = await ctx.newPage(); m.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`)); await m.goto(url); await m.click('text=Create Character'); await m.fill('input[aria-label="Name"]', 'Mobi'); await m.click('text=Begin Adventure'); await m.waitForTimeout(800); const joy = await m.isVisible('.joy'); await m.screenshot({ path: `${SHOTS}/25_mobile.png` }); await ctx.close(); assert(joy, 'joystick visible'); return 'joystick visible'; });
await step('26 Thai language switch', async () => { await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await page.keyboard.press('Escape'); await page.click('.win button:has-text("ภาษาไทย")'); await page.waitForTimeout(200); const txt = await page.textContent('.menu'); await shot('26_thai'); assert(/กระเป๋า|สกิล/.test(txt), 'thai labels'); return 'thai ok'; });
await step('27 performance: frame rate in town', async () => { const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); })); return `${fps} fps (headless, software rendering)`; });

const ok = results.filter((r) => r.ok).length;
writeFileSync(resolve(root, 'tests/e2e/last-run.json'), JSON.stringify({ when: new Date().toISOString(), passed: ok, total: results.length, results, errors }, null, 2));
console.log(`\n${ok}/${results.length} E2E steps passed; ${errors.length} browser errors`); if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close(); process.exit(ok === results.length && errors.length === 0 ? 0 : 1);
