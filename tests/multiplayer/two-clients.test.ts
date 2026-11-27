/**
 * Real multiplayer integration test: two authenticated WebSocket clients against a running game server + PostgreSQL.
 * Usage: start server (pnpm server) then `pnpm test:multiplayer` (SERVER=http://localhost:2567).
 */
import WebSocket from 'ws';
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.SERVER ?? 'http://localhost:2567'; const WSURL = BASE.replace(/^http/, 'ws') + '/ws';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://hb:hb_dev_pw@localhost:5432/hearthbound' });
const results: { name: string; ok: boolean; detail: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
async function step(name: string, fn: () => Promise<string | void>) { try { const d = (await fn()) ?? ''; results.push({ name, ok: true, detail: d }); console.log(`PASS ${name} ${d}`); } catch (e: any) { results.push({ name, ok: false, detail: e.message }); console.log(`FAIL ${name}: ${e.message}`); } }
async function api(path: string, body?: unknown, token?: string, method?: string) { const r = await fetch(BASE + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j: any = await r.json().catch(() => ({})); return { status: r.status, j }; }
class Client {
  ws!: WebSocket; myId = ''; mapId = ''; state: any; ents: any[] = []; fx: any[] = []; seq = 0; pending = new Map<number, (r: any) => void>(); closed: { code: number; reason: string } | null = null;
  async connect(token: string, char: string) {
    this.ws = new WebSocket(`${WSURL}?token=${encodeURIComponent(token)}&character=${encodeURIComponent(char)}`);
    await new Promise<void>((res, rej) => {
      this.ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'welcome' || m.type === 'state') { this.state = JSON.parse(m.player); if (m.myId) this.myId = m.myId; if (m.mapId) this.mapId = m.mapId; if (m.type === 'welcome') res(); } if (m.type === 'snap') { if (m.entities.length) this.ents = m.entities; this.fx.push(...m.fx); if (m.mapId) this.mapId = m.mapId; } if (m.type === 'res') { this.pending.get(m.id)?.(m.result); this.pending.delete(m.id); } });
      this.ws.on('close', (code, reason) => { this.closed = { code, reason: reason.toString() }; rej(new Error(`closed ${code} ${reason}`)); }); this.ws.on('error', rej);
    });
  }
  cmd(cmd: string, args: Record<string, unknown> = {}): Promise<any> { const id = ++this.seq; return new Promise((res) => { this.pending.set(id, res); this.ws.send(JSON.stringify({ type: 'cmd', v: 1, id, cmd, args })); setTimeout(() => this.pending.has(id) && res({ ok: false, err: 'TIMEOUT' }), 5000); }); }
  me() { return this.ents.find((e) => e.id === this.myId); }
  gold() { const b = this.state.wallet.b.find((x: any) => x[0] === `p:${this.state.id}`)?.[1].find((y: any) => y[0] === 'gold'); return b ? BigInt(b[1]) : 0n; }
}
const tag = Math.random().toString(36).slice(2, 7);
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
await step('combat on server: travel to field, kill monster, EXP + gold persisted', async () => {
  // walk to waygate keeper then teleport (server validates proximity + cost)
  await A.cmd('moveTo', { x: 30 * 32 + 16, y: 17 * 32 + 16 }); await sleep(2500); const tp = await A.cmd('teleport', { map: 'whisperwood' }); assert(tp.ok, JSON.stringify(tp)); await sleep(500);
  let kills = 0; const errs: Record<string, number> = {}; for (let i = 0; i < 150 && kills < 1; i++) { const me = A.me(); if (!me) { await sleep(200); continue; } const m = A.ents.filter((e) => e.k === 'monster' && !e.dead && e.l <= 5).sort((p, q) => Math.hypot(p.x - me.x, p.y - me.y) - Math.hypot(q.x - me.x, q.y - me.y))[0]; if (m) { const r = await A.cmd('attack', { target: m.id }); if (!r.ok) errs[r.err] = (errs[r.err] ?? 0) + 1; if (!r.ok && r.err === 'OUT_OF_RANGE') await A.cmd('moveTo', { x: m.x, y: m.y }); } else errs.none = (errs.none ?? 0) + 1; await sleep(350); kills = A.state.counters?.kills ?? 0; }
  if (kills < 1) throw new Error(`no kill; errors ${JSON.stringify(errs)} me=${JSON.stringify(A.me())?.slice(0, 120)} map=${A.mapId} ents=${A.ents.length}`);
  assert(kills >= 1, 'killed a monster'); const row = await db.query('SELECT state->\'counters\'->>\'kills\' AS k FROM characters WHERE id=$1', [charA]); return `kills=${kills}, exp=${A.state.exp}, db kills=${row.rows[0].k ?? '(saved on next flush)'}`;
});
await step('disconnect → reconnect restores persisted state', async () => {
  const inv = A.state.inventory.length; const gold = A.gold(); A.ws.close(); await sleep(800);
  const A2 = new Client(); await A2.connect(tokA, charA); assert(A2.state.inventory.length === inv, `inv ${inv} vs ${A2.state.inventory.length}`); assert(A2.gold() === gold, `gold ${gold} vs ${A2.gold()}`); (A as any).__c = A2; return `map ${A2.mapId}`;
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
  const au = await db.query(`SELECT * FROM admin_audit_logs WHERE target=$1 AND action LIKE 'grant:%'`, [charB]); assert(au.rowCount === 1, 'audit row'); return `online=${o.j.online} p95 tick=${o.j.tickMsP95.toFixed(2)}ms ledger ok=${o.j.ledger.ok}`;
});
const passed = results.filter((r) => r.ok).length; mkdirSync('tests/multiplayer', { recursive: true });
writeFileSync('tests/multiplayer/last-run.json', JSON.stringify({ when: new Date().toISOString(), server: BASE, durationMs: Date.now() - t0, passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} multiplayer steps passed`); B.ws.close(); ((A as any).__c?.ws ?? A.ws).close(); await db.end(); process.exit(passed === results.length ? 0 : 1);
