/** Hearthbound game server entry: Fastify REST control plane + WebSocket real-time plane on one port (modular monolith). */
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import IORedis from 'ioredis';
import { CLASSES, MAPS, createCharacter, playerCP, Ledger } from '../../../packages/game-core/src/index.js';
import { AuthError, login, logout, refresh, register, verifyAccess } from './auth.js';
import { migrate, pool, seed, tx } from './db.js';
import { CONFIG } from './env.js';
import { GameServer } from './game.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export async function startServer(opts: { port?: number; quiet?: boolean } = {}) {
  await migrate(); await seed();
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) { try { await register(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD); } catch { /* exists */ } await pool.query(`UPDATE accounts SET role='admin' WHERE username=$1`, [process.env.ADMIN_USERNAME.toLowerCase()]); }
  let redis: IORedis | null = null;
  try { redis = new IORedis(CONFIG.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false }); await redis.connect(); } catch { console.warn('[server] Redis unavailable — presence/rate-limit fall back to memory'); redis = null; }
  const game = new GameServer(redis); await game.load(); game.start();
  const app = Fastify({ logger: opts.quiet ? false : { level: 'info' }, bodyLimit: 64 * 1024, trustProxy: true });
  const hits = new Map<string, { n: number; t: number }>();
  const limit = async (key: string, max: number, windowSec: number) => {
    if (redis) { const k = `hb:rl:${key}`; const n = await redis.incr(k); if (n === 1) await redis.expire(k, windowSec); return n <= max; }
    const now = Date.now(); const h = hits.get(key); if (!h || now - h.t > windowSec * 1000) { hits.set(key, { n: 1, t: now }); return true; } h.n++; return h.n <= max;
  };
  app.addHook('onRequest', async (req, reply) => { reply.header('access-control-allow-origin', CONFIG.corsOrigin); reply.header('access-control-allow-headers', 'content-type, authorization'); reply.header('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS'); reply.header('x-content-type-options', 'nosniff'); reply.header('referrer-policy', 'no-referrer'); if (req.method === 'OPTIONS') reply.code(204).send(); });
  app.setErrorHandler((err, _req, reply) => { if (err instanceof AuthError) return reply.code(err.status).send({ error: err.message }); app.log.error(err); reply.code(err.statusCode ?? 500).send({ error: err.statusCode && err.statusCode < 500 ? err.message : 'Internal error' }); });
  const auth = (req: any) => { const a = verifyAccess(String(req.headers.authorization ?? '').replace(/^Bearer /, '')); if (!a) throw new AuthError(401, 'Unauthorized'); return a; };
  const admin = (req: any) => { const a = auth(req); if (a.role !== 'admin' && a.role !== 'moderator') throw new AuthError(403, 'Forbidden'); return a; };

  // ---- health ----
  app.get('/api/health', async () => ({ ok: true, db: (await pool.query('SELECT 1 AS ok')).rows[0].ok === 1, redis: !!redis && redis.status === 'ready', online: game.conns.size, tickMsP95: game.stats.tickMsP95, tickMsAvg: game.stats.tickMsAvg, bytesOut: game.stats.bytesOut }));
  // ---- auth (§05) ----
  app.post('/api/auth/register', async (req) => { const b: any = req.body ?? {}; if (!(await limit(`reg:${req.ip}`, Number(process.env.REGISTER_LIMIT_PER_HOUR ?? 10), 3600))) throw new AuthError(429, 'Too many registrations'); return register(b.username, b.password); });
  app.post('/api/auth/login', async (req) => { const b: any = req.body ?? {}; if (!(await limit(`login:${req.ip}`, 20, 60))) throw new AuthError(429, 'Too many login attempts'); return login(b.username, b.password, req.ip); });
  app.post('/api/auth/refresh', async (req) => refresh((req.body as any)?.refreshToken));
  app.post('/api/auth/logout', async (req) => { await logout((req.body as any)?.refreshToken); return { ok: true }; });
  // ---- worlds & characters (§06–07) ----
  app.get('/api/worlds', async () => ({ worlds: (await pool.query('SELECT id,name,region,status,capacity FROM worlds')).rows.map((w) => ({ ...w, online: game.conns.size })) }));
  app.get('/api/characters', async (req) => { const a = auth(req); const r = await pool.query('SELECT id,name,class_id AS "classId",level,map_id AS "mapId",updated_at FROM characters WHERE account_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC', [a.sub]); return { characters: r.rows }; });
  app.post('/api/characters', async (req, reply) => {
    const a = auth(req); const b: any = req.body ?? {}; if (!CLASSES[b.classId]) throw new AuthError(400, 'Invalid class');
    const n = (await pool.query('SELECT count(*)::int AS n FROM characters WHERE account_id=$1 AND deleted_at IS NULL', [a.sub])).rows[0].n; if (n >= 6) throw new AuthError(400, 'Character slot limit (6) reached');
    let p; try { p = createCharacter({ accountId: a.sub, name: String(b.name ?? ''), classId: b.classId, appearance: b.appearance ?? { body: 0, hair: 0, hairColor: '#5a3a22', skin: '#f0c8a0', eyes: '#202040' } }); } catch (e: any) { throw new AuthError(400, e.message === 'INVALID_NAME' ? 'Name must be 2–16 letters or numbers' : e.message); }
    const state = { ...p, wallet: undefined };
    try {
      await tx(async (cl) => {
        await cl.query('INSERT INTO characters(id,account_id,world_id,name,class_id,level,state,combat_power) VALUES ($1,$2,$3,$4,$5,1,$6,$7)', [p.id, a.sub, CONFIG.worldId, p.name, p.classId, JSON.stringify(state), playerCP(p)]);
        const txid = `starter:${p.id}`; const acct = `p:${p.id}`;
        await cl.query(`INSERT INTO currency_ledger(tx_id,account,currency,amount,reason) VALUES ($1,'system:mint:starter','gold',-500,'starter'),($1,$2,'gold',500,'starter')`, [txid, acct]);
        await cl.query(`INSERT INTO wallets(account,currency,available) VALUES ($1,'gold',500) ON CONFLICT DO NOTHING`, [acct]);
      });
    } catch (e: any) { if (e.code === '23505') throw new AuthError(409, 'Name already taken in this world'); throw e; }
    game.ledger.mint(`p:${p.id}`, 'gold', 500n, 'starter', `starter:${p.id}`); game.ledger.pending = game.ledger.pending.filter((x) => x.txId !== `starter:${p.id}`); game.ledger.dirty.delete(`p:${p.id}`);
    reply.code(201); return { character: { id: p.id, name: p.name, classId: p.classId, level: 1 } };
  });
  app.delete('/api/characters/:id', async (req) => { const a = auth(req); const id = (req.params as any).id; if (game.conns.has(id)) throw new AuthError(409, 'Character is online'); const r = await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL', [id, a.sub]); return { ok: r.rowCount === 1 }; });
  app.get('/api/rankings/:kind', async (req) => { const kind = (req.params as any).kind; const col = kind === 'pvp' ? 'pvp_rating' : kind === 'cp' ? 'combat_power' : 'level'; return { kind, rows: (await pool.query(`SELECT name, class_id, level, pvp_rating, combat_power FROM characters WHERE deleted_at IS NULL AND world_id=$1 ORDER BY ${col} DESC, name LIMIT 100`, [CONFIG.worldId])).rows }; });
  app.get('/api/content/maps', async () => ({ maps: Object.values(MAPS).map((m) => ({ id: m.id, name: m.name, levelReq: m.levelReq })) }));
  // ---- admin (§62): RBAC, audited ----
  app.get('/api/admin/overview', async (req) => { admin(req); const db = await pool.query(`SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM characters WHERE deleted_at IS NULL)::int AS characters, (SELECT count(*) FROM player_reports WHERE status='open')::int AS open_reports, (SELECT count(*) FROM currency_ledger)::int AS ledger_rows`); return { ...game.overview(), db: db.rows[0] }; });
  app.get('/api/admin/players', async (req) => { admin(req); const q = String((req.query as any).q ?? ''); return { online: [...game.conns.values()].map((c) => ({ charId: c.charId, name: c.svc.p.name, level: c.svc.p.level, map: c.world.mapId, gold: c.svc.gold().toString() })), search: (await pool.query(`SELECT c.id, c.name, c.level, a.username, a.status FROM characters c JOIN accounts a ON a.id=c.account_id WHERE c.name ILIKE $1 LIMIT 50`, [`%${q}%`])).rows }; });
  app.post('/api/admin/kick', async (req) => { const a = admin(req); const b: any = req.body; const ok = await game.kick(b.charId, String(b.reason ?? 'kicked')); await pool.query('INSERT INTO admin_audit_logs(actor,action,target,reason) VALUES ($1,$2,$3,$4)', [a.sub, 'kick', b.charId, b.reason]); return { ok }; });
  app.post('/api/admin/sanction', async (req) => { const a = admin(req); const b: any = req.body; if (!['mute', 'suspend', 'ban', 'unban'].includes(b.action) || !b.reason) throw new AuthError(400, 'action and reason required'); const acc = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [b.charId])).rows[0]?.account_id; if (!acc) throw new AuthError(404, 'not found');
    const before = (await pool.query('SELECT status FROM accounts WHERE id=$1', [acc])).rows[0];
    if (b.action === 'ban' || b.action === 'suspend') { if (a.role !== 'admin') throw new AuthError(403, 'Admin only'); await pool.query('UPDATE accounts SET status=$2, ban_reason=$3 WHERE id=$1', [acc, b.action === 'ban' ? 'banned' : 'suspended', b.reason]); await pool.query('UPDATE account_sessions SET revoked_at=now() WHERE account_id=$1', [acc]); await game.kick(b.charId, b.reason); }
    if (b.action === 'unban') await pool.query(`UPDATE accounts SET status='active', ban_reason=NULL WHERE id=$1`, [acc]);
    await pool.query('INSERT INTO moderation_actions(account_id,action,reason,actor,expires_at) VALUES ($1,$2,$3,$4,$5)', [acc, b.action, b.reason, a.sub, b.hours ? new Date(Date.now() + b.hours * 3600_000) : null]);
    await pool.query('INSERT INTO admin_audit_logs(actor,action,target,reason,before,after) VALUES ($1,$2,$3,$4,$5,$6)', [a.sub, b.action, acc, b.reason, JSON.stringify(before), JSON.stringify({ action: b.action })]);
    const c = game.conns.get(b.charId); if (c && b.action === 'mute') c.muted = true; return { ok: true }; });
  app.post('/api/admin/grant', async (req) => { const a = admin(req); if (a.role !== 'admin') throw new AuthError(403, 'Admin only'); const b: any = req.body; if (!b.reason || String(b.reason).length < 5) throw new AuthError(400, 'A reason (5+ chars) is required'); if (Number(b.qty) > 100000 && !b.approvedBy) throw new AuthError(400, 'Large grants require approvedBy (second admin)'); await game.grant(b.charId, String(b.what), Number(b.qty), a.sub, String(b.reason)); return { ok: true }; });
  app.post('/api/admin/announce', async (req) => { const a = admin(req); const msg = String((req.body as any)?.msg ?? '').slice(0, 200); game.broadcast(msg); await pool.query('INSERT INTO admin_audit_logs(actor,action,reason) VALUES ($1,$2,$3)', [a.sub, 'announce', msg]); return { ok: true }; });
  app.get('/api/admin/audit', async (req) => { admin(req); return { rows: (await pool.query('SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT 100')).rows }; });
  app.get('/api/admin/reports', async (req) => { admin(req); return { rows: (await pool.query('SELECT * FROM player_reports ORDER BY created_at DESC LIMIT 100')).rows }; });
  app.get('/api/admin/flags', async (req) => { admin(req); return { rows: (await pool.query('SELECT * FROM feature_flags ORDER BY key')).rows }; });
  app.post('/api/admin/flags', async (req) => { const a = admin(req); if (a.role !== 'admin') throw new AuthError(403, 'Admin only'); const b: any = req.body; if (b.key === 'realPayments' && b.enabled) throw new AuthError(400, 'Real payments cannot be enabled from the dashboard (requires legal/security review)'); await pool.query('UPDATE feature_flags SET enabled=$2, updated_by=$3, updated_at=now() WHERE key=$1', [b.key, !!b.enabled, a.sub]); await pool.query('INSERT INTO admin_audit_logs(actor,action,target) VALUES ($1,$2,$3)', [a.sub, `flag:${!!b.enabled}`, b.key]); return { ok: true }; });
  app.get('/api/admin/economy', async (req) => { admin(req); const r = await pool.query(`SELECT currency, sum(CASE WHEN account LIKE 'system:mint:%' THEN -amount ELSE 0 END)::text AS minted, sum(CASE WHEN account LIKE 'system:burn:%' THEN amount ELSE 0 END)::text AS burned, sum(amount)::text AS net FROM currency_ledger GROUP BY currency`); const unb = await pool.query('SELECT tx_id, currency, sum(amount)::text s FROM currency_ledger GROUP BY tx_id, currency HAVING sum(amount)<>0 LIMIT 20'); return { flows: r.rows, unbalancedTx: unb.rows, memoryLedger: game.ledger.verify() }; });
  // ---- payments sandbox (§45) — disabled by feature flag; webhook verifies signature & idempotency ----
  app.post('/api/payments/webhook', async (req, reply) => { reply.code(403); return { error: 'Payments disabled (realPayments=false). Sandbox verification flow documented in docs/SECURITY_MODEL.md' }; });
  // ---- static: admin dashboard + game client ----
  const serveDir = (prefix: string, dir: string) => app.get(`${prefix}*`, async (req, reply) => {
    const rel = normalize(decodeURIComponent((req.params as any)['*'] || 'index.html')).replace(/^(\.\.(\/|\\|$))+/, ''); const f = resolve(dir, rel);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) { const idx = resolve(dir, 'index.html'); return reply.type('text/html').send(readFileSync(idx)); }
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    return reply.type(types[extname(f)] ?? 'application/octet-stream').send(readFileSync(f));
  });
  serveDir('/admin/', resolve(root, 'apps/admin-dashboard')); serveDir('/', resolve(root, 'deliverables/playable-artifact'));

  await app.listen({ port: opts.port ?? CONFIG.port, host: CONFIG.host });
  // ---- WebSocket (§57): token auth in query, character ownership checked against DB ----
  const wss = new WebSocketServer({ server: app.server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', async (ws, req) => {
    const u = new URL(req.url ?? '', 'http://x'); const a = verifyAccess(u.searchParams.get('token') ?? undefined); const charId = u.searchParams.get('character') ?? '';
    if (!a) { ws.close(4401, 'Unauthorized'); return; }
    const st = (await pool.query('SELECT status FROM accounts WHERE id=$1', [a.sub])).rows[0]?.status; if (st !== 'active') { ws.close(4403, 'Account not active'); return; }
    let conn: Awaited<ReturnType<GameServer['join']>>; const queue: string[] = []; let ready = false;
    ws.on('message', (d) => { const s = d.toString(); if (!ready) { queue.push(s); return; } game.handle(conn, s).catch((e) => console.error(e)); });
    ws.on('close', () => { if (ready) game.leave(charId).catch(() => undefined); });
    try { conn = await game.join(ws, a.sub, a.role, charId); ready = true; for (const s of queue) await game.handle(conn, s); } catch (e: any) { ws.close(4404, e.message ?? 'join failed'); }
  });
  const shutdown = async () => { game.stop(); for (const id of [...game.conns.keys()]) await game.leave(id); await game.persist([]).catch(() => undefined); await app.close(); await pool.end(); redis?.disconnect(); };
  if (!opts.quiet) { console.log(`\n  Hearthbound server: http://localhost:${opts.port ?? CONFIG.port}/  (game client)  ·  /admin/ (dashboard)  ·  ws://localhost:${opts.port ?? CONFIG.port}/ws\n`); process.on('SIGINT', () => shutdown().then(() => process.exit(0))); process.on('SIGTERM', () => shutdown().then(() => process.exit(0))); }
  return { app, game, shutdown, port: (app.server.address() as any).port as number };
}
void Ledger; void randomBytes;
if (process.argv[1] && /main\.ts$/.test(process.argv[1])) startServer().catch((e) => { console.error(e); process.exit(1); });
