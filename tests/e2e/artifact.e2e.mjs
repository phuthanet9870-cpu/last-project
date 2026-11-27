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
const cmd = (c, a = {}) => page.evaluate(([c, a]) => window.__hb.cmd(c, a), [c, a]);
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
  const uid = await st('(a,p)=>p.equipment.main.uid'); const gem = await st('(a,p)=>p.inventory.find(i=>/^gem_[a-z]+_\d$/.test(i.defId)).uid'); const r = await cmd('socket', { item: uid, gem }); assert(r.ok, JSON.stringify(r));
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
  await cmd('dev', { op: 'materials' }); const nodes = await st('(a)=>a.world.map.nodes.filter(n=>n.type==="herb").map(n=>({id:n.id,x:n.x,y:n.y}))'); const n = nodes[0];
  await cmd('dev', { op: 'teleport', x: n.x * 32 + 16, y: n.y * 32 + 48 }); const g = await cmd('gather', { node: n.id }); assert(g.ok, JSON.stringify(g));
  await cmd('dev', { op: 'map', id: 'emberglen' }); await cmd('dev', { op: 'teleport', x: 24 * 32 + 16, y: 31 * 32 + 16 }); const c = await cmd('craft', { recipe: 'rc_potion', times: 1 }); assert(c.ok, JSON.stringify(c)); return 'gathered herb, crafted potion';
});
await step('13 marketplace list + buy + buy order + auction bid + exchange', async () => {
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
  for (let i = 0; i < 300; i++) { const ar = await st('(a)=>a.arenaInfo()'); if (ar?.done) break; const foe = await st('(a)=>{const ar=a.world.arena;const id=ar.teams[1].find(x=>!a.world.entities.get(x)?.dead);const e=a.world.entities.get(id);return e&&{id,x:e.x,y:e.y}}'); if (foe) { await cmd('dev', { op: 'teleport', x: foe.x - 40, y: foe.y }); await cmd('attack', { target: foe.id }); } await page.waitForTimeout(80); }
  const s = await cmd('arenaSettle'); assert(s.ok, JSON.stringify(s)); const r = await st('(a,p)=>p.pvp.rating'); await cmd('leaveInstance'); return `win=${s.data.win} rating=${r}`;
});
await step('19 Hearthcards duel vs AI to completion', async () => { await page.keyboard.press('b'); await page.waitForSelector('.win:has-text("Hearthcards")'); await page.click('.win button:has-text("Duel AI")'); await page.waitForTimeout(300); await shot('19_tcg');
  for (let i = 0; i < 400; i++) { const v = await st('(a)=>a.tcg()&&a.tcg().view'); if (!v || v.winner !== null) break; const res = await cmd('tcgAction', { action: await page.evaluate(() => window.__hb.aiMove()) }); if (!res.ok) await cmd('tcgAction', { action: { type: 'end' } }); }
  const w = await st('(a)=>a.tcg().view.winner'); assert(w !== null, 'finished'); await page.keyboard.press('Escape'); return `winner=${w}`; });
await step('20 events: login, missions, pass, gacha (simulated currency)', async () => { assert((await cmd('claimLogin')).ok, 'login'); await cmd('dev', { op: 'pass' }); assert((await cmd('claimPass', { level: 1, premium: false })).ok, 'pass'); const g = await cmd('gacha', { times: 10, ticket: false }); assert(g.ok, JSON.stringify(g)); const p = await cmd('premiumPurchase'); assert(!p.ok && p.err === 'PAYMENTS_DISABLED', 'real payments disabled'); return 'login, pass, 10x wish ok; payments disabled'; });
await step('21 all menu windows open without errors', async () => { const labels = await page.$$eval('.mbtn', (b) => b.map((x) => x.getAttribute('aria-label'))); for (const l of labels) { if (l === 'Auto') continue; await page.click(`.mbtn[aria-label="${l}"]`); await page.waitForTimeout(150); const n = await page.$$eval('.win', (w) => w.length); assert(n >= 1, `${l} opened no window`); if (l !== 'Settings') await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); } await shot('21_windows'); await page.keyboard.press('Escape'); return `${labels.length} windows`; });
await step('22 developer System Registry view', async () => { await page.keyboard.press('`'); await page.click('.win button.tab:has-text("System Registry")'); await page.waitForTimeout(200); await shot('22_registry'); const n = await page.$$eval('.reg .li', (x) => x.length); assert(n > 100, `rows ${n}`); await page.keyboard.press('Escape'); return `${n} registry rows`; });
await step('23 save → reload → continue keeps progress', async () => { const lv = await st('(a,p)=>p.level'); const name = await st('(a,p)=>p.name'); const ok = await st('(a)=>a.save()'); assert(ok, 'saved'); await page.reload(); await page.click('text=Continue'); await page.click('.slot-card:has-text("' + name + '") button:has-text("Play")'); await page.waitForTimeout(800); const lv2 = await st('(a,p)=>p.level'); assert(lv2 === lv, `${lv} vs ${lv2}`); return `level ${lv} restored`; });
await step('24 export save produces valid file', async () => { const s = await page.evaluate(() => window.__hb.a.exportSave()); const o = JSON.parse(s); assert(o.format === 'hearthbound-save', 'format'); return `${s.length} bytes`; });
await step('25 mobile viewport renders HUD + joystick', async () => { const ctx = await browser.newContext({ ...devices['Pixel 7'] }); const m = await ctx.newPage(); m.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`)); await m.goto(url); await m.click('text=Create Character'); await m.fill('input[aria-label="Name"]', 'Mobi'); await m.click('text=Begin Adventure'); await m.waitForTimeout(800); const joy = await m.isVisible('.joy'); await m.screenshot({ path: `${SHOTS}/25_mobile.png` }); await ctx.close(); assert(joy, 'joystick visible'); return 'joystick visible'; });
await step('26 Thai language switch', async () => { await page.evaluate(() => document.querySelectorAll('.win .x').forEach((b) => b.click())); await page.click('.mbtn[aria-label="Settings"]'); await page.click('.win button:has-text("ภาษาไทย")'); await page.waitForTimeout(200); const txt = await page.textContent('.menu'); await shot('26_thai'); assert(/กระเป๋า|สกิล/.test(txt), 'thai labels'); return 'thai ok'; });
await step('27 performance: frame rate in town', async () => { const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); })); return `${fps} fps (headless, software rendering)`; });

const ok = results.filter((r) => r.ok).length;
writeFileSync(resolve(root, 'tests/e2e/last-run.json'), JSON.stringify({ when: new Date().toISOString(), passed: ok, total: results.length, results, errors }, null, 2));
console.log(`\n${ok}/${results.length} E2E steps passed; ${errors.length} browser errors`); if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close(); process.exit(ok === results.length && errors.length === 0 ? 0 : 1);
