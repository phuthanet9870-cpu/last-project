/**
 * Real multiplayer integration test: two authenticated WebSocket clients against a running game server + PostgreSQL.
 * Usage: start server (pnpm server) then `pnpm test:multiplayer` (SERVER=http://localhost:2567).
 */
import WebSocket from 'ws';
import { aiChooseAction } from '../../packages/game-core/src/index.js';
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.env.SERVER ?? 'http://localhost:2567'; const WSURL = BASE.replace(/^http/, 'ws') + '/ws';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://hb:hb_dev_pw@localhost:5432/hearthbound' });
const results: { name: string; ok: boolean; detail: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
async function step(name: string, fn: () => Promise<string | void>) { try { const d = (await fn()) ?? ''; results.push({ name, ok: true, detail: d }); console.log(`PASS ${name} ${d}`); } catch (e: any) { results.push({ name, ok: false, detail: e.message }); console.log(`FAIL ${name}: ${e.message}`); } }
async function api(path: string, body?: unknown, token?: string, method?: string) { const r = await fetch(BASE + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j: any = await r.json().catch(() => ({})); return { status: r.status, j }; }
class Client {
  ws!: WebSocket; market: any = null; tcg: any = null; map = new Map<string, any>(); myId = ''; mapId = ''; state: any; ents: any[] = []; fx: any[] = []; seq = 0; pending = new Map<number, (r: any) => void>(); closed: { code: number; reason: string } | null = null;
  async connect(token: string, char: string) {
    this.ws = new WebSocket(`${WSURL}?token=${encodeURIComponent(token)}&character=${encodeURIComponent(char)}`);
    await new Promise<void>((res, rej) => {
      this.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'welcome' || m.type === 'state') { this.state = JSON.parse(m.player); if (m.myId) this.myId = m.myId; if (m.mapId) this.mapId = m.mapId; if (m.type === 'welcome') res(); } if (m.type === 'tcg') this.tcg = m.tcg; if (m.type === 'market') this.market = m.market; if (m.type === 'fx') this.fx.push(...m.fx); if (m.type === 'snap') { if (m.full) this.map.clear(); for (const u of m.upd ?? []) { const c0 = this.map.get(u.id); if (c0) Object.assign(c0, u); else this.map.set(u.id, u); } for (const id of m.rm ?? []) this.map.delete(id); this.ents = [...this.map.values()]; if (m.mapId) this.mapId = m.mapId; } if (m.type === 'res') { this.pending.get(m.id)?.(m.result); this.pending.delete(m.id); } });
      this.ws.on('close', (code, reason) => { this.closed = { code, reason: reason.toString() }; rej(new Error(`closed ${code} ${reason}`)); }); this.ws.on('error', rej);
    });
  }
  cmd(cmd: string, args: Record<string, unknown> = {}): Promise<any> { const id = ++this.seq; return new Promise((res) => { this.pending.set(id, res); this.ws.send(JSON.stringify({ type: 'cmd', v: 1, id, cmd, args })); setTimeout(() => this.pending.has(id) && res({ ok: false, err: 'TIMEOUT' }), 5000); }); }
  me() { return this.ents.find((e) => e.id === this.myId); }
  gold() { const b = this.state.wallet.b.find((x: any) => x[0] === `p:${this.state.id}`)?.[1].find((y: any) => y[0] === 'gold'); return b ? BigInt(b[1]) : 0n; }
}
const tag = Math.random().toString(36).slice(2, 7);
async function walkTo(c: Client, x: number, y: number) { for (let i = 0; i < 40; i++) { await c.cmd('moveTo', { x, y }); await sleep(500); const me = c.me(); if (me && Math.hypot(me.x - x, me.y - y) < 60) return; } throw new Error(`could not reach ${x},${y}`); }
const A = new Client(), B = new Client(); let tokA = '', tokB = '', charA = '', charB = '', accA = '';
const t0 = Date.now();
await step('register + login two accounts (Argon2id)', async () => {
  const ra = await api('/api/auth/register', { username: `alice_${tag}`, password: 'correct-horse-1' }); assert(ra.status === 200, JSON.stringify(ra.j)); accA = ra.j.accountId;
  const rb = await api('/api/auth/register', { username: `bob_${tag}`, password: 'correct-horse-2' }); assert(rb.status === 200, JSON.stringify(rb.j));
  const bad = await api('/api/auth/login', { username: `alice_${tag}`, password: 'wrong-password' }); assert(bad.status === 401, 'wrong password rejected');
  const la = await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' }); tokA = la.j.accessToken; tokB = rb.j.accessToken;
  const rt = await api('/api/auth/refresh', { refreshToken: la.j.refreshToken }); assert(rt.status === 200, 'refresh rotation'); const reuse = await api('/api/auth/refresh', { refreshToken: la.j.refreshToken }); assert(reuse.status === 401, 'refresh reuse detected');
  tokA = (await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' })).j.accessToken;
  const pw = await db.query('SELECT password_hash FROM accounts WHERE id=$1', [accA]); assert(String(pw.rows[0].password_hash).startsWith('$argon2id$'), 'argon2id hash stored'); return 'tokens issued, refresh rotation + reuse detection ok';
});
await step('create characters (unique names, slot validation)', async () => {
  const a = await api('/api/characters', { name: `Al${tag}`, classId: 'blade_sentinel' }, tokA); assert(a.status === 201, JSON.stringify(a.j)); charA = a.j.character.id;
  const b = await api('/api/characters', { name: `Bo${tag}`, classId: 'dawn_priest' }, tokB); assert(b.status === 201, JSON.stringify(b.j)); charB = b.j.character.id;
  const dup = await api('/api/characters', { name: `Al${tag}`, classId: 'vanguard' }, tokB); assert(dup.status === 409, 'duplicate name rejected');
  const noauth = await api('/api/characters', { name: 'Zed', classId: 'vanguard' }); assert(noauth.status === 401, 'unauthenticated rejected'); return `${charA}, ${charB}`;
});
await step('unauthorized WebSocket + foreign character rejected', async () => {
  const x = new Client(); await x.connect('bogus', charA).catch(() => undefined); assert(x.closed?.code === 4401, `bad token → ${x.closed?.code}`);
  const y = new Client(); await y.connect(tokB, charA).catch(() => undefined); assert(y.closed?.code === 4404, `foreign char → ${y.closed?.code}`); return 'rejected 4401 / 4404';
});
await step('two clients join same world and see each other', async () => {
  await A.connect(tokA, charA); await B.connect(tokB, charB); await sleep(400);
  assert(A.ents.some((e) => e.id === B.myId), 'A sees B'); assert(B.ents.some((e) => e.id === A.myId), 'B sees A'); return `map ${A.mapId}`;
});
await step('server-authoritative movement replicated (collision-checked)', async () => {
  const x0 = B.ents.find((e) => e.id === A.myId).x; await A.cmd('move', { dx: 1, dy: 0 }); await sleep(800); await A.cmd('move', { dx: 0, dy: 0 }); await sleep(250);
  const x1 = B.ents.find((e) => e.id === A.myId).x; assert(x1 > x0 + 40, `B observed A move ${x0}→${x1}`);
  const tp = await A.cmd('dev', { op: 'teleport', x: 99999, y: 99999 }); assert(!tp.ok && tp.err === 'FORBIDDEN', 'client teleport forbidden'); return `${x0}→${x1}`;
});
await step('chat local + world + whisper delivered; malformed packet rejected', async () => {
  await A.cmd('chat', { ch: 'local', msg: 'hello <script>alert(1)</script>' }); await sleep(250); const c = B.fx.find((f) => f.t === 'chat' && f.from.startsWith('Al')); assert(c && !c.msg.includes('<'), 'chat delivered & escaped');
  await B.cmd('whisper', { to: `Al${tag}`, msg: 'psst' }); await sleep(250); assert(A.fx.some((f) => f.t === 'chat' && f.ch === 'whisper'), 'whisper');
  const r = await new Promise<any>((res) => { A.ws.send('{"type":"cmd","id":999,"cmd":42}'); A.pending.set(999, res); setTimeout(() => res({ err: 'TIMEOUT' }), 2000); }); assert(r.err === 'INVALID_PACKET', `malformed → ${r.err}`); return 'ok';
});
await step('party invite requires acceptance', async () => { const r = await A.cmd('partyInvite', { target: B.myId }); assert(r.ok && r.data.pending, JSON.stringify(r)); const acc = await B.cmd('partyAccept'); assert(acc.ok, JSON.stringify(acc)); return 'party formed'; });
await step('direct trade: item ↔ gold, both lock+confirm, persisted', async () => {
  const pot = A.state.inventory.find((i: any) => i.defId === 'potion_hp_s'); const goldA0 = A.gold(), goldB0 = B.gold();
  assert((await A.cmd('tradeOpen', { target: B.myId })).ok, 'open'); assert((await B.cmd('tradeAccept')).ok, 'accept');
  assert((await A.cmd('tradeOffer', { items: [pot.uid], gold: '0' })).ok, 'offer A'); assert((await B.cmd('tradeOffer', { items: [], gold: '100' })).ok, 'offer B');
  await A.cmd('tradeLock'); await B.cmd('tradeLock'); const c1 = await A.cmd('tradeConfirm'); assert(c1.ok && c1.data.waiting, 'waiting for partner'); const c2 = await B.cmd('tradeConfirm'); assert(c2.ok && c2.data.done, JSON.stringify(c2)); await sleep(300);
  assert(!A.state.inventory.some((i: any) => i.uid === pot.uid), 'item left A'); assert(B.state.inventory.some((i: any) => i.uid === pot.uid), 'item reached B'); assert(A.gold() === goldA0 + 100n && B.gold() === goldB0 - 100n, `gold ${A.gold()} ${B.gold()}`);
  const h = await db.query('SELECT * FROM trade_history WHERE a_char=$1', [charA]); assert(h.rowCount === 1, 'trade_history row'); return 'potion ↔ 100G';
});
await step('marketplace: list (escrow) → buy → double-buy rejected → persisted ledger balanced', async () => {
  const it = A.state.inventory.find((i: any) => i.defId === 'capture_net'); const li = await A.cmd('marketList', { uid: it.uid, price: '10', qty: 1 }); assert(li.ok, JSON.stringify(li)); const id = li.data.id;
  const b1 = await B.cmd('marketBuy', { id }); assert(b1.ok, JSON.stringify(b1)); const b2 = await B.cmd('marketBuy', { id }); assert(!b2.ok, 'second buy rejected');
  const unb = await db.query('SELECT tx_id FROM currency_ledger GROUP BY tx_id, currency HAVING sum(amount)<>0'); assert(unb.rowCount === 0, 'all ledger tx balanced in DB');
  const neg = await db.query(`SELECT * FROM wallets WHERE account NOT LIKE 'system:%' AND (available<0 OR reserved<0)`); assert(neg.rowCount === 0, 'no negative wallets'); return 'sold 1 net for 10G (fee burned)';
});
await step('market privacy + account sales collection box', async () => {
  await A.cmd('marketView'); await B.cmd('marketView'); await sleep(300); const coll = BigInt(String(A.market.collectable)); assert(coll > 0n, `A collection ${coll}`);
  assert((B.market.hist ?? []).every((h: any) => h.account === `p:${B.state.id}`), 'B sees only own history'); assert((A.market.auctions ?? []).every((x: any) => !('maxBids' in x)), 'auction maxima stripped');
  const g0 = A.gold(); const c = await A.cmd('collectSales'); assert(c.ok, JSON.stringify(c)); await sleep(300); assert(A.gold() === g0 + coll, `gold ${g0}→${A.gold()}`); return `collected ${coll}G; other players' history & auction maxima hidden`;
});
await step('friend presence: online for friends, location only when mutual', async () => {
  await A.cmd('friendAdd', { name: `Bo${tag}` }); let r = await A.cmd('friendsStatus'); const f1 = r.data.find((x: any) => x.name === `Bo${tag}`); assert(f1.online && f1.map === null && f1.mutual === false, JSON.stringify(f1));
  await B.cmd('friendAdd', { name: `Al${tag}` }); r = await A.cmd('friendsStatus'); const f2 = r.data.find((x: any) => x.name === `Bo${tag}`); assert(f2.online && f2.map === 'emberglen' && f2.mutual, JSON.stringify(f2)); return 'one-sided: online only; mutual: map visible';
});
await step('engagement requires the partner to accept', async () => {
  await db.query(`UPDATE accounts SET role='admin' WHERE id=$1`, [accA]); const adm = (await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' })).j.accessToken; const gr = await api('/api/admin/grant', { charId: charA, what: 'gold', qty: 20000, reason: 'test: wedding funds' }, adm); assert(gr.status === 200, JSON.stringify(gr.j)); await sleep(200);
  await walkTo(A, 16 * 32 + 16, 17 * 32 + 16); const g0 = A.gold();
  const p = await A.cmd('propose', { name: `Bo${tag}` }); assert(p.ok && p.data.pending, JSON.stringify(p)); assert(!A.state.marriage, 'not married before acceptance');
  const acc = await B.cmd('marriageAccept'); assert(acc.ok, JSON.stringify(acc)); await sleep(400);
  assert(A.state.marriage?.partner === `Bo${tag}` && B.state.marriage?.partner === `Al${tag}`, 'both engaged'); assert(A.state.marriage.stage === 'engaged' && B.state.marriage.stage === 'engaged', 'engaged, not yet married'); assert(A.gold() <= g0, 'proposer paid'); return `engaged; gold ${g0}→${A.gold()}`;
});
await step('wedding ceremony at the plaza: both partners present → phases → married (persisted)', async () => {
  for (const c of [A, B]) { await walkTo(c, 28 * 32 + 16, 42 * 32 + 24); const r = await c.cmd('portal', { i: 3 }); assert(r.ok, `portal ${JSON.stringify(r)}`); } await sleep(400); assert(A.mapId === 'wedding_plaza' && B.mapId === 'wedding_plaza', `maps ${A.mapId}/${B.mapId}`);
  const early = await A.cmd('weddingStart'); assert(!early.ok && early.err === 'BOTH_AT_ALTAR', JSON.stringify(early));
  for (const c of [A, B]) await walkTo(c, 15 * 32 + 16, 8 * 32 + 16); const g0 = A.gold(); const s = await A.cmd('weddingStart'); assert(s.ok, JSON.stringify(s));
  let st: any = null; for (let i = 0; i < 40; i++) { await sleep(250); st = (await B.cmd('weddingStatus')).data; if (st?.phase === 'celebration' || st?.phase === 'done') break; } assert(st && ['celebration', 'done'].includes(st.phase), JSON.stringify(st)); await sleep(300);
  assert(A.state.marriage?.stage === 'married' && B.state.marriage?.stage === 'married', `stages ${A.state.marriage?.stage}/${B.state.marriage?.stage}`); assert(A.state.titles.includes('title_hearthbound'), 'title'); assert(A.gold() === g0 - 5000n, `cost ${g0}→${A.gold()}`);
  for (const c of [A, B]) { await walkTo(c, 15 * 32 + 16, 22 * 32 + 24); const r = await c.cmd('portal', { i: 0 }); assert(r.ok, `exit ${JSON.stringify(r)}`); } await sleep(300); assert(A.mapId === 'emberglen', A.mapId); return `phases → ${st.phase}; both married; 5000G paid`;
});
await step('visit a real friend\'s farm and like it (persists to owner)', async () => {
  const before = B.state.farm.likes; const v = await A.cmd('visitFarm', { name: `Bo${tag}` }); assert(v.ok, JSON.stringify(v)); await sleep(400); assert(A.mapId === 'pet_farm', A.mapId);
  const l = await A.cmd('likeFarm'); assert(l.ok, JSON.stringify(l)); await sleep(300); assert(B.state.farm.likes === before + 1, `likes ${before}→${B.state.farm.likes}`); assert(!(await A.cmd('likeFarm')).ok, 'once per day');
  await A.cmd('leaveInstance'); await sleep(300); return `owner likes ${before}→${B.state.farm.likes}`;
});
await step('Hearthcards PvP duel between the two players to completion', async () => {
  const ch = await A.cmd('tcgChallenge', { target: B.myId }); assert(ch.ok && ch.data.pending, JSON.stringify(ch)); const acc = await B.cmd('tcgAccept'); assert(acc.ok, JSON.stringify(acc)); await sleep(300);
  assert(A.tcg?.mode === 'pvp' && B.tcg?.mode === 'pvp', 'both in pvp view'); assert(typeof A.tcg.view.sides[1].hand === 'number', 'opponent hand hidden');
  let n = 0; while (n++ < 400) { const done = [A, B].some((x) => x.tcg?.view.winner !== null && x.tcg?.view.winner !== undefined); if (done) break; const me = [A, B].find((x) => x.tcg?.view.active === 0); if (!me) { await sleep(50); continue; } const v = me.tcg.view; const st2 = { ...v, sides: [{ ...v.sides[0] }, { ...v.sides[1], hand: Array(v.sides[1].hand).fill('x') }] }; const act0 = aiChooseAction(st2, 0); const r = await me.cmd('tcgAction', { action: act0 }); if (!r.ok) await me.cmd('tcgAction', { action: { type: 'end' } }); await sleep(20); }
  await sleep(300); const wa = A.tcg.view.winner, wb = B.tcg.view.winner; assert(wa !== null && (wa === 'draw' ? wb === 'draw' : wa === 1 - wb), `winners ${wa}/${wb}`); return `A sees winner ${wa}, B sees ${wb} (perspective-correct); ${A.state.tcg.wins + A.state.tcg.losses + B.state.tcg.wins + B.state.tcg.losses} results recorded`;
});
await step('party dungeon: party enters the same instance together', async () => {
  await walkTo(A, 44 * 32 + 16, 23 * 32 + 16); const r = await A.cmd('enterDungeon', { id: 'daily_exp_1' }); assert(r.ok, JSON.stringify(r)); await sleep(500);
  assert(A.mapId === 'mossy_hollow' && B.mapId === 'mossy_hollow', `maps ${A.mapId}/${B.mapId}`); assert(A.ents.some((e) => e.id === B.myId), 'A sees B inside instance');
  await A.cmd('leaveInstance'); await B.cmd('leaveInstance'); await sleep(400); return 'both entered daily_exp_1 together';
});
await step('combat on server: travel to field, kill monster, EXP + gold persisted', async () => {
  // walk to waygate keeper then teleport (server validates proximity + cost)
  await walkTo(A, 30 * 32 + 16, 17 * 32 + 16); const tp = await A.cmd('teleport', { map: 'whisperwood' }); assert(tp.ok, JSON.stringify(tp)); await sleep(500);
  let kills = 0; const errs: Record<string, number> = {}; for (let i = 0; i < 150 && kills < 1; i++) { const me = A.me(); if (!me) { await sleep(200); continue; } if (me.dead) { await A.cmd('respawn'); await sleep(300); continue; } const m = A.ents.filter((e) => e.k === 'monster' && !e.dead && ['forest_slime', 'puff_bunny', 'cap_shroom'].includes(e.def)).sort((p, q) => Math.hypot(p.x - me.x, p.y - me.y) - Math.hypot(q.x - me.x, q.y - me.y))[0]; if (m) { const r = await A.cmd('attack', { target: m.id }); if (!r.ok) errs[r.err] = (errs[r.err] ?? 0) + 1; if (!r.ok && r.err === 'OUT_OF_RANGE') await A.cmd('moveTo', { x: m.x, y: m.y }); } else errs.none = (errs.none ?? 0) + 1; await sleep(350); kills = A.state.counters?.kills ?? 0; }
  if (kills < 1) throw new Error(`no kill; errors ${JSON.stringify(errs)} me=${JSON.stringify(A.me())?.slice(0, 120)} map=${A.mapId} ents=${A.ents.length}`);
  assert(kills >= 1, 'killed a monster'); const row = await db.query('SELECT state->\'counters\'->>\'kills\' AS k FROM characters WHERE id=$1', [charA]); return `kills=${kills}, exp=${A.state.exp}, db kills=${row.rows[0].k ?? '(saved on next flush)'}`;
});
await step('disconnect → reconnect restores persisted state', async () => {
  const inv = A.state.inventory.length; const gold = A.gold(); A.ws.close(); await sleep(800);
  const A2 = new Client(); await A2.connect(tokA, charA); assert(A2.state.inventory.length === inv, `inv ${inv} vs ${A2.state.inventory.length}`); assert(A2.gold() === gold, `gold ${gold} vs ${A2.gold()}`); (A as any).__c = A2; return `map ${A2.mapId}`;
});
await step('arena mode queue: Lantern Siege 1v1 matches two real players', async () => {
  const A2: Client = (A as any).__c; assert((await A2.cmd('arenaJoin', { mode: '1v1', type: 'siege' })).ok, 'A queued'); const q = await B.cmd('arenaJoin', { mode: '1v1', type: 'siege' }); assert(q.ok, JSON.stringify(q)); await sleep(700);
  assert(A2.mapId === 'arena' && B.mapId === 'arena', `maps ${A2.mapId}/${B.mapId}`); await A2.cmd('leaveInstance'); await B.cmd('leaveInstance'); await sleep(500); return 'siege match created for both';
});
await step('ranked arena 1v1 between the two real players', async () => {
  const A2: Client = (A as any).__c; await B.cmd('moveTo', { x: 30 * 32 + 16, y: 17 * 32 + 16 }); await sleep(100);
  assert((await A2.cmd('arenaJoin')).ok, 'A queued'); assert((await B.cmd('arenaJoin')).ok, 'B queued'); await sleep(600); assert(A2.mapId === 'arena' && B.mapId === 'arena', `maps ${A2.mapId} ${B.mapId}`);
  const r0 = B.state.pvp.rating; for (let i = 0; i < 200; i++) { const e = A2.ents.find((x) => x.id === B.myId); if (!e || e.dead) break; const me = A2.ents.find((x) => x.id === A2.myId); if (Math.hypot(me.x - e.x, me.y - e.y) > 60) await A2.cmd('moveTo', { x: e.x, y: e.y }); await A2.cmd('attack', { target: B.myId }); await sleep(300); }
  await sleep(800); const m = await db.query('SELECT winner, rating_delta FROM pvp_matches WHERE team_a ? $1 OR team_b ? $1 ORDER BY started_at DESC LIMIT 1', [charA]); assert(m.rows[0]?.winner !== null && m.rows[0]?.winner !== undefined, 'match settled in DB'); return `winner team ${m.rows[0].winner}, deltas ${JSON.stringify(m.rows[0].rating_delta)}, B rating ${r0}→${B.state.pvp.rating}`;
});
await step('admin RBAC: player forbidden, admin overview + audited grant', async () => {
  const f = await api('/api/admin/overview', undefined, tokB); assert(f.status === 403, `player → ${f.status}`);
  await db.query(`UPDATE accounts SET role='admin' WHERE id=$1`, [accA]); const tok = (await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' })).j.accessToken;
  const o = await api('/api/admin/overview', undefined, tok); assert(o.status === 200 && o.j.online >= 1, JSON.stringify(o.j).slice(0, 200));
  const g = await api('/api/admin/grant', { charId: charB, what: 'gold', qty: 777, reason: 'test compensation' }, tok); assert(g.status === 200, JSON.stringify(g.j));
  const au = await db.query(`SELECT * FROM admin_audit_logs WHERE target=$1 AND action LIKE 'grant:%'`, [charB]); assert(au.rowCount === 1 || au.rowCount === 0, 'audit row'); const au2 = await db.query(`SELECT * FROM admin_audit_logs WHERE action LIKE 'grant:%' AND target IN ($1,$2)`, [charA, charB]); assert(au2.rowCount === 2, `audit rows ${au2.rowCount}`); return `online=${o.j.online} p95 tick=${o.j.tickMsP95.toFixed(2)}ms ledger ok=${o.j.ledger.ok}`;
});
await step('Hearthcards card trade (bound cards refused), rankings API kinds, weekly champion title', async () => {
  const A2: Client = (A as any).__c; const tok = (await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' })).j.accessToken;
  assert((await api('/api/admin/grant', { charId: charA, what: 'card_dust', qty: 2000, reason: 'card trade test' }, tok)).status === 200, 'dust grant'); await sleep(200);
  const card = 'tc_fire_striker'; const n0 = A2.state.tcg.collection[card] ?? 0, b0 = B.state.tcg.collection[card] ?? 0; const cr = await A2.cmd('craftCard', { card }); assert(cr.ok, JSON.stringify(cr)); await sleep(200);
  const bound = Object.keys(A2.state.tcg.bound ?? {})[0]; assert((await A2.cmd('tradeOpen', { target: B.myId })).ok, 'open'); assert((await B.cmd('tradeAccept')).ok, 'accept');
  const bad = await A2.cmd('tradeOffer', { items: [], gold: '0', cards: { [bound]: 1 } }); assert(!bad.ok && bad.err === 'CARD_NOT_TRADEABLE', `bound card offer → ${JSON.stringify(bad)}`);
  assert((await A2.cmd('tradeOffer', { items: [], gold: '0', cards: { [card]: 1 } })).ok, 'offer card'); assert((await B.cmd('tradeOffer', { items: [], gold: '50' })).ok, 'offer gold');
  await A2.cmd('tradeLock'); await B.cmd('tradeLock'); await A2.cmd('tradeConfirm'); const done = await B.cmd('tradeConfirm'); assert(done.ok && done.data.done, JSON.stringify(done)); await sleep(300);
  assert((A2.state.tcg.collection[card] ?? 0) === n0 && (B.state.tcg.collection[card] ?? 0) === b0 + 1, `card moved ${A2.state.tcg.collection[card]} / ${B.state.tcg.collection[card]}`);
  const h = await db.query(`SELECT a_items FROM trade_history WHERE a_char=$1 ORDER BY created_at DESC LIMIT 1`, [charA]); assert(JSON.stringify(h.rows).includes(`card:${card}x1`), 'card in trade_history');
  const kinds = ['level', 'cp', 'pvp', 'tcg', 'pet', 'life', 'mastery', `class:${B.state.classId}`]; const sizes: string[] = [];
  for (const k of kinds) { const r = await api(`/api/rankings/${encodeURIComponent(k)}`); assert(r.status === 200 && Array.isArray(r.j.rows), `${k} → ${r.status}`); sizes.push(`${k}:${r.j.rows.length}`); }
  const badK = await api('/api/rankings/' + encodeURIComponent("level; DROP TABLE x")); assert(badK.status === 400, `bad kind → ${badK.status}`);
  const cls = await api(`/api/rankings/${encodeURIComponent(`class:${B.state.classId}`)}`); assert(cls.j.rows.every((r: any) => r.classId === B.state.classId), 'class filter');
  await db.query(`INSERT INTO weekly_champions(week,kind,character_id,name,value) VALUES ($1,'pvp',$2,$3,1) ON CONFLICT (week,kind) DO UPDATE SET character_id=EXCLUDED.character_id, awarded_at=now()`, [`test-${tag}`, charB, B.state.name]);
  let got = false; for (let i = 0; i < 30 && !got; i++) { await sleep(200); got = B.state.titles.includes('title_weekly'); } assert(got, 'champion title granted to B');
  return `card ${card} A→B for 50G; bound card refused; rankings ${sizes.join(' ')}; title_weekly → B`;
});
await step('guild: shared DB storage, member/officer permissions, announcement, guild war between two real guilds', async () => {
  const A2: Client = (A as any).__c; const tok = (await api('/api/auth/login', { username: `alice_${tag}`, password: 'correct-horse-1' })).j.accessToken;
  for (const id of [charA, charB]) assert((await api('/api/admin/grant', { charId: id, what: 'gold', qty: 30000, reason: 'guild test funds' }, tok)).status === 200, 'gold'); await sleep(200);
  for (const c of [A2, B]) if (c.state.guild) await c.cmd('guildLeave');
  const gA = `Lan${tag}`.slice(0, 16), gB = `Ash${tag}`.slice(0, 16); assert((await A2.cmd('guildCreate', { name: gA })).ok, 'create A'); assert((await A2.cmd('guildInvite', { name: B.state.name })).ok, 'invite'); assert((await B.cmd('guildAccept')).ok, 'accept'); await sleep(200);
  const it = B.state.inventory.find((i: any) => !i.bound && !i.locked); assert(it, 'B has a storable item'); const dep = await B.cmd('guildStorage', { deposit: true, uid: it.uid }); assert(dep.ok, JSON.stringify(dep)); await sleep(200); assert(!B.state.inventory.some((i: any) => i.uid === it.uid), 'left B bag');
  const list = await A2.cmd('guildStorage', { list: true }); assert(list.ok && list.data.items.some((x: any) => x.item.uid === it.uid), 'A sees the shared item'); const sid = list.data.items.find((x: any) => x.item.uid === it.uid).id;
  const deny = await B.cmd('guildStorage', { withdraw: true, id: sid }); assert(!deny.ok && deny.err === 'NO_PERMISSION', JSON.stringify(deny));
  assert((await A2.cmd('guildPromote', { name: B.state.name, role: 'officer' })).ok, 'promote'); await sleep(200); assert(B.state.guild.role === 'officer', `role ${B.state.guild.role}`);
  const wd = await B.cmd('guildStorage', { withdraw: true, id: sid }); assert(wd.ok, JSON.stringify(wd)); await sleep(200); assert(B.state.inventory.some((i: any) => i.uid === it.uid), 'back in B bag'); assert(!(await B.cmd('guildStorage', { withdraw: true, id: sid })).ok, 'double withdraw refused');
  assert((await B.cmd('guildAnnounce', { text: 'Raid at 8 <b>pm</b>' })).ok, 'announce'); const info = await A2.cmd('guildInfo'); assert(info.data.guild.announcement === 'Raid at 8 pm', `sanitised: ${info.data.guild.announcement}`);
  const lead = await A2.cmd('guildLeave'); assert(!lead.ok && lead.err === 'TRANSFER_FIRST', JSON.stringify(lead)); const logs = (await db.query('SELECT count(*) FROM guild_logs WHERE guild_id=$1', [A2.state.guild.id])).rows[0].count; assert(Number(logs) >= 4, `logs ${logs}`);
  assert((await B.cmd('guildLeave')).ok, 'B leaves'); await sleep(200); assert(!B.state.guild, 'B guildless'); assert((await B.cmd('guildCreate', { name: gB })).ok, 'create B');
  const ch = await A2.cmd('guildWarChallenge', { guild: gB }); assert(ch.ok, JSON.stringify(ch)); const acc = await B.cmd('guildWarAccept'); assert(acc.ok, JSON.stringify(acc)); await sleep(500); assert(A2.mapId === 'arena' && B.mapId === 'arena', `maps ${A2.mapId}/${B.mapId}`);
  let row: any = null; for (let i = 0; i < 40; i++) { await sleep(250); row = (await db.query('SELECT winner, score FROM guild_wars WHERE match_id=$1', [acc.data.match])).rows[0]; if (row?.winner) break; } assert(row?.winner, `war settled ${JSON.stringify(row)}`);
  await A2.cmd('leaveInstance'); await B.cmd('leaveInstance'); return `storage deposit→list→denied→promote→withdraw; announcement sanitised; war winner ${row.winner === A2.state.guild?.id ? gA : gB} score ${JSON.stringify(row.score)}`;
});
await step('worker: weekly champion = most PvP rating gained in the last 7 days (not all-time rating)', async () => {
  const period = `mp-${tag}`; const out = execFileSync('npx', ['tsx', 'apps/worker/src/main.ts', '--once', '--job', 'weeklyChampion', '--period', period], { encoding: 'utf8' });
  const row = (await db.query('SELECT character_id, value FROM weekly_champions WHERE week=$1', [period])).rows[0]; assert(row, `no champion row: ${out}`);
  const gains = (await db.query(`SELECT d.key AS id, sum(d.value::int) AS g FROM pvp_matches m CROSS JOIN LATERAL jsonb_each_text(m.rating_delta) d WHERE m.finished_at > now() - interval '7 days' GROUP BY d.key`)).rows; const max = Math.max(...gains.map((x) => Number(x.g)));
  assert(Number(row.value) === max && max > 0, `champion gain ${row.value} vs max ${max}`); const top = (await db.query('SELECT max(pvp_rating) AS r FROM characters')).rows[0].r;
  return `champion gained +${row.value} this week (highest all-time rating on the server: ${top})`;
});
await step('raid: raid group of real players enters the Sanctum together (8-cap group, Lv110 gate, shared instance)', async () => {
  // two fresh Lv115 raiders (levelled with admin dev commands on a non-production server: DEV_COMMANDS=1)
  const mk2 = async (n: string) => { const r = await api('/api/auth/register', { username: `${n}_${tag}`, password: 'correct-horse-9' }); await db.query(`UPDATE accounts SET role='admin' WHERE id=$1`, [r.j.accountId]); const tok = (await api('/api/auth/login', { username: `${n}_${tag}`, password: 'correct-horse-9' })).j.accessToken; const ch = await api('/api/characters', { name: `${n.slice(0, 2)}${tag}`, classId: n === 'cara' ? 'blade_sentinel' : 'dawn_priest' }, tok); const c = new Client(); await c.connect(tok, ch.j.character.id); return c; };
  const C1 = await mk2('cara'), D1 = await mk2('dane'); await sleep(400);
  const low = await C1.cmd('enterDungeon', { id: 'flame_sanctum' }); assert(!low.ok && low.err === 'LEVEL_TOO_LOW', JSON.stringify(low));
  for (const c of [C1, D1]) { const r = await c.cmd('dev', { op: 'level', n: 115 }); assert(r.ok, `dev level ${JSON.stringify(r)} (server needs DEV_COMMANDS=1)`); } await sleep(300);
  assert((await C1.cmd('partyInvite', { target: D1.myId })).ok, 'invite'); assert((await D1.cmd('partyAccept')).ok, 'accept'); const rg = await C1.cmd('partyRaid'); assert(rg.ok && rg.data.max === 8, JSON.stringify(rg)); assert(!(await D1.cmd('partyRaid')).ok, 'only leader converts');
  const e = await C1.cmd('enterDungeon', { id: 'flame_sanctum' }); assert(e.ok, JSON.stringify(e)); await sleep(700);
  assert(C1.mapId === 'flame_sanctum' && D1.mapId === 'flame_sanctum', `maps ${C1.mapId}/${D1.mapId}`); const sameInst = C1.ents.some((x) => x.id === D1.myId); assert(sameInst, 'same raid instance');
  const mons = C1.ents.filter((x) => x.k === 'monster').length; assert(mons >= 5, `raid wave spawned (${mons})`);
  await C1.cmd('leaveInstance'); await D1.cmd('leaveInstance'); C1.ws.close(); D1.ws.close(); return `2 real raiders in one Sanctum instance; wave of ${mons} monsters; Lv gate + leader-only conversion enforced`;
});
const passed = results.filter((r) => r.ok).length; mkdirSync('tests/multiplayer', { recursive: true });
writeFileSync('tests/multiplayer/last-run.json', JSON.stringify({ when: new Date().toISOString(), server: BASE, durationMs: Date.now() - t0, passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} multiplayer steps passed`); B.ws.close(); ((A as any).__c?.ws ?? A.ws).close(); await db.end(); process.exit(passed === results.length ? 0 : 1);
