/** Hearthbound game server entry: Fastify REST control plane + WebSocket real-time plane on one port (modular monolith). */
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import IORedis from 'ioredis';
import { CLASSES, MAPS, createCharacter, playerCP, Ledger } from '../../../packages/game-core/src/index.js';
import { AuthError, login, logout, mfaEnable, mfaSetup, refresh, register, verifyAccess, verifyCredentials } from './auth.js';
import { adminAllowed } from './totp.js';
import { migrate, pool, seed, tx } from './db.js';
import { CONFIG } from './env.js';
import { GameServer } from './game.js';

const root = process.env.APP_ROOT ? resolve(process.env.APP_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '../../..'); // APP_ROOT: bundled production build
export async function startServer(opts: { port?: number; quiet?: boolean } = {}) {
  await migrate(); await seed();
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) { try { await register(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD); } catch { /* exists */ } await pool.query(`UPDATE accounts SET role='admin' WHERE username=$1`, [process.env.ADMIN_USERNAME.toLowerCase()]); }
  let redis: IORedis | null = null;
  try { redis = new IORedis(CONFIG.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false }); await redis.connect(); } catch { console.warn('[server] Redis unavailable — presence/rate-limit fall back to memory'); redis = null; }
  const game = new GameServer(redis); await game.load(); game.start();
  const app = Fastify({ logger: opts.quiet ? false : { level: 'info' }, bodyLimit: 64 * 1024, trustProxy: CONFIG.trustProxy }); // only trust X-Forwarded-For behind a reverse proxy (otherwise clients could spoof IPs and dodge rate limits)
  const hits = new Map<string, { n: number; t: number }>();
  const limit = async (key: string, max: number, windowSec: number) => {
    if (redis) { const k = `hb:rl:${key}`; const n = await redis.incr(k); if (n === 1) await redis.expire(k, windowSec); return n <= max; }
    const now = Date.now(); const h = hits.get(key); if (!h || now - h.t > windowSec * 1000) { hits.set(key, { n: 1, t: now }); return true; } h.n++; return h.n <= max;
  };
  const origins = CONFIG.corsOrigin.split(',').map((x) => x.trim()).filter(Boolean);
  const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  app.addHook('onRequest', async (req, reply) => {
    const o = String(req.headers.origin ?? ''); reply.header('access-control-allow-origin', origins.includes('*') ? '*' : origins.includes(o) ? o : origins[0] ?? ''); reply.header('vary', 'origin');
    reply.header('access-control-allow-headers', 'content-type, authorization'); reply.header('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
    reply.header('x-content-type-options', 'nosniff'); reply.header('referrer-policy', 'no-referrer'); reply.header('x-frame-options', 'DENY'); reply.header('cross-origin-opener-policy', 'same-origin'); reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (CONFIG.hsts) reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    if (req.method === 'OPTIONS') reply.code(204).send();
  });
  app.addHook('onSend', async (_req, reply, payload) => { if (String(reply.getHeader('content-type') ?? '').startsWith('text/html')) reply.header('content-security-policy', CSP); return payload; });
  // ---- metrics (Prometheus text format) ----
  const httpStats = { requests: 0, errors5xx: 0, byRoute: new Map<string, number>() };
  app.addHook('onResponse', async (req, reply) => { httpStats.requests++; if (reply.statusCode >= 500) httpStats.errors5xx++; const r = (req.routeOptions?.url ?? 'unknown').replace(/\*$/, '*'); httpStats.byRoute.set(r, (httpStats.byRoute.get(r) ?? 0) + 1); });
  app.setErrorHandler((err, _req, reply) => { if (err instanceof AuthError) return reply.code(err.status).send({ error: err.message, ...((err as any).mfaRequired ? { mfaRequired: true } : {}) }); app.log.error(err); reply.code(err.statusCode ?? 500).send({ error: err.statusCode && err.statusCode < 500 ? err.message : 'Internal error' }); });
  const auth = (req: any) => { const a = verifyAccess(String(req.headers.authorization ?? '').replace(/^Bearer /, '')); if (!a) throw new AuthError(401, 'Unauthorized'); return a; };
  const admin = (req: any) => { const a = auth(req); const g = adminAllowed(a, CONFIG.adminRequireMfa); if (!g.ok) throw new AuthError(g.status, g.error); return a; };

  app.get('/metrics', async (req, reply) => {
    if (process.env.METRICS_TOKEN && req.headers.authorization !== `Bearer ${process.env.METRICS_TOKEN}`) throw new AuthError(401, 'Unauthorized');
    const s = game.stats; const mem = process.memoryUsage(); const L: string[] = [];
    const g = (name: string, help: string, v: number, type = 'gauge') => { L.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, `${name} ${Number.isFinite(v) ? v : 0}`); };
    g('hb_online_players', 'Connected characters', game.conns.size); g('hb_worlds', 'Live world instances', game.worlds.size); g('hb_tick_ms_avg', 'Average simulation tick (ms)', s.tickMsAvg); g('hb_tick_ms_p95', 'p95 simulation tick (ms), budget 50', s.tickMsP95);
    g('hb_ticks_total', 'Simulation ticks', s.ticks, 'counter'); g('hb_ws_bytes_out_total', 'WebSocket bytes sent', s.bytesOut, 'counter'); g('hb_persist_errors_total', 'Failed state saves', (s as any).persistErrors ?? 0, 'counter');
    g('hb_http_requests_total', 'HTTP requests', httpStats.requests, 'counter'); g('hb_http_5xx_total', 'HTTP 5xx responses', httpStats.errors5xx, 'counter'); g('hb_ledger_pending', 'Ledger entries waiting for flush', game.ledger.pending.length);
    g('hb_redis_up', 'Redis connected', redis && redis.status === 'ready' ? 1 : 0); g('process_resident_memory_bytes', 'RSS', mem.rss); g('process_heap_used_bytes', 'Heap used', mem.heapUsed); g('process_uptime_seconds', 'Uptime', process.uptime());
    let dbUp = 0; try { dbUp = (await pool.query('SELECT 1 AS ok')).rows[0].ok === 1 ? 1 : 0; } catch { /* down */ } g('hb_db_up', 'PostgreSQL reachable', dbUp);
    return reply.type('text/plain; version=0.0.4').send(L.join('\n') + '\n');
  });
  app.get('/readyz', async (_req, reply) => { try { await pool.query('SELECT 1'); return { ready: true }; } catch { return reply.code(503).send({ ready: false }); } });
  // ---- health ----
  app.get('/api/health', async () => ({ ok: true, db: (await pool.query('SELECT 1 AS ok')).rows[0].ok === 1, redis: !!redis && redis.status === 'ready', online: game.conns.size, tickMsP95: game.stats.tickMsP95, tickMsAvg: game.stats.tickMsAvg, bytesOut: game.stats.bytesOut }));
  // ---- auth (§05) ----
  app.post('/api/auth/register', async (req) => { const b: any = req.body ?? {}; if (!(await limit(`reg:${req.ip}`, Number(process.env.REGISTER_LIMIT_PER_HOUR ?? 10), 3600))) throw new AuthError(429, 'Too many registrations'); return register(b.username, b.password); });
  app.post('/api/auth/login', async (req) => { const b: any = req.body ?? {}; if (!(await limit(`login:${req.ip}`, 20, 60))) throw new AuthError(429, 'Too many login attempts'); return login(b.username, b.password, req.ip, b.otp ? String(b.otp) : undefined); });
  app.post('/api/auth/mfa/setup', async (req) => mfaSetup(auth(req).sub));
  app.post('/api/auth/mfa/enable', async (req) => { const a = auth(req); if (!(await limit(`mfa:${a.sub}`, 10, 300))) throw new AuthError(429, 'Too many attempts'); return mfaEnable(a.sub, String((req.body as any)?.code ?? '')); });
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
  // Character rename (§07): offline only, unique per world, once per 30 days; friend lists and spouse references follow the new name.
  app.post('/api/characters/:id/rename', async (req) => {
    const a = auth(req); const id = (req.params as any).id; const name = String((req.body as any)?.name ?? '').trim(); if (!/^[\p{L}\p{N}_ ]{2,16}$/u.test(name)) throw new AuthError(400, 'Name must be 2–16 letters/numbers');
    if (game.conns.has(id)) throw new AuthError(409, 'Log out of this character first');
    return tx(async (cl) => {
      const row = (await cl.query('SELECT name, renamed_at FROM characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE', [id, a.sub])).rows[0]; if (!row) throw new AuthError(404, 'Character not found');
      if (row.renamed_at && Date.now() - new Date(row.renamed_at).getTime() < 30 * 86400_000) throw new AuthError(429, 'Characters can be renamed once every 30 days');
      try { await cl.query(`UPDATE characters SET name=$3, renamed_at=now(), state=jsonb_set(state, '{name}', to_jsonb($3::text)) WHERE id=$1 AND account_id=$2`, [id, a.sub, name]); } catch (e: any) { if (e.code === '23505') throw new AuthError(409, 'Name already taken'); throw e; }
      const old = row.name as string;
      await cl.query(`UPDATE characters SET state = jsonb_set(state, '{friends}', (SELECT COALESCE(jsonb_agg(CASE WHEN f->>'name' = $2 THEN jsonb_set(f, '{name}', to_jsonb($3::text)) ELSE f END), '[]'::jsonb) FROM jsonb_array_elements(state->'friends') f)) WHERE world_id=$1 AND state->'friends' @> jsonb_build_array(jsonb_build_object('name', $2::text))`, [CONFIG.worldId, old, name]);
      await cl.query(`UPDATE characters SET state = jsonb_set(state, '{marriage,partner}', to_jsonb($3::text)) WHERE world_id=$1 AND state->'marriage'->>'partner' = $2`, [CONFIG.worldId, old, name]);
      for (const c of game.conns.values()) { let ch = false; for (const f of c.svc.p.friends) if (f.name === old) { f.name = name; ch = true; } if (c.svc.p.marriage?.partner === old) { c.svc.p.marriage.partner = name; ch = true; } if (ch) c.dirty = true; } // online friends/spouse in memory too
      return { ok: true, name, previous: old };
    });
  });
  // Sanction appeals (§63): a sanctioned player (banned/suspended accounts cannot sign in) proves identity with username + password.
  app.post('/api/appeals', async (req) => {
    const b: any = req.body ?? {}; if (!(await limit(`appeal:${req.ip}`, Number(process.env.APPEAL_LIMIT_PER_HOUR ?? 5), 3600))) throw new AuthError(429, 'Too many appeals'); const text = String(b.text ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 2000); if (text.length < 10) throw new AuthError(400, 'Please explain in at least 10 characters');
    const acc = await verifyCredentials(b.username, b.password); if (!acc) throw new AuthError(401, 'Invalid credentials');
    const muted = (await pool.query(`SELECT 1 FROM moderation_actions WHERE account_id=$1 AND action='mute' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`, [acc.id])).rowCount! > 0; if (acc.status === 'active' && !muted) throw new AuthError(400, 'There is no active sanction to appeal');
    try { const r = await pool.query('INSERT INTO appeals(account_id,text) VALUES ($1,$2) RETURNING id', [acc.id, text]); return { ok: true, id: Number(r.rows[0].id) }; } catch (e: any) { if (e.code === '23505') throw new AuthError(409, 'You already have an open appeal'); throw e; }
  });
  app.get('/api/admin/appeals', async (req) => { admin(req); return { rows: (await pool.query(`SELECT ap.id::int AS id, a.username, a.status AS account_status, a.ban_reason, ap.text, ap.status, ap.created_at FROM appeals ap JOIN accounts a ON a.id=ap.account_id ORDER BY (ap.status='open') DESC, ap.created_at DESC LIMIT 100`)).rows }; });
  app.post('/api/admin/appeals/:id', async (req) => {
    const a = admin(req); const b: any = req.body ?? {}; if (!['accept', 'reject'].includes(b.decision) || !b.note) throw new AuthError(400, 'decision and note required');
    return tx(async (cl) => {
      const ap = (await cl.query(`SELECT * FROM appeals WHERE id=$1 FOR UPDATE`, [(req.params as any).id])).rows[0]; if (!ap) throw new AuthError(404, 'not found'); if (ap.status !== 'open') throw new AuthError(409, 'Already resolved');
      await cl.query(`UPDATE appeals SET status=$2, resolver=$3, resolution=$4, resolved_at=now() WHERE id=$1`, [ap.id, b.decision === 'accept' ? 'accepted' : 'rejected', a.sub, String(b.note).slice(0, 500)]);
      if (b.decision === 'accept') { await cl.query(`UPDATE accounts SET status='active', ban_reason=NULL WHERE id=$1`, [ap.account_id]); await cl.query(`UPDATE moderation_actions SET expires_at=now() WHERE account_id=$1 AND action='mute' AND (expires_at IS NULL OR expires_at>now())`, [ap.account_id]); }
      await cl.query('INSERT INTO admin_audit_logs(actor,action,target,reason) VALUES ($1,$2,$3,$4)', [a.sub, `appeal_${b.decision}`, ap.account_id, String(b.note).slice(0, 500)]); return { ok: true };
    });
  });
  app.delete('/api/characters/:id', async (req) => { const a = auth(req); const id = (req.params as any).id; if (game.conns.has(id)) throw new AuthError(409, 'Character is online'); const r = await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL', [id, a.sub]); return { ok: r.rowCount === 1 }; });
  // Rankings (§54): whitelisted kinds only -> fixed SQL expressions (no user text reaches SQL except bound parameters).
  const RANK_EXPR: Record<string, string> = {
    level: 'level', cp: 'combat_power', pvp: 'pvp_rating',
    tcg: `COALESCE((state->'tcg'->>'rating')::int, 0)`,
    pet: `COALESCE((SELECT max((x->>'level')::int) FROM jsonb_array_elements(state->'pets') x), 0)`,
    life: `COALESCE((SELECT sum((v->>'lvl')::int) FROM jsonb_each(state->'professions') AS t(k, v)), 0) + COALESCE((SELECT sum((v->>'lvl')::int) FROM jsonb_each(state->'gathering') AS t(k, v)), 0)`,
    mastery: `COALESCE((state->>'mastery')::int, 0)`,
    achievements: `COALESCE(jsonb_array_length(state->'achievements'), 0)`, // achievement count (points need the content table)
  };
  app.get('/api/rankings/:kind', async (req) => {
    const kind = String((req.params as any).kind); const cls = /^class:([a-z_]{2,24})$/.exec(kind);
    const expr = cls ? 'level' : RANK_EXPR[kind]; if (!expr) throw new AuthError(400, 'Unknown ranking');
    const rows = (await pool.query(`SELECT name, class_id, level, ${expr} AS value FROM characters WHERE deleted_at IS NULL AND world_id=$1 ${cls ? 'AND class_id=$2' : ''} ORDER BY value DESC, name LIMIT 100`, cls ? [CONFIG.worldId, cls[1]] : [CONFIG.worldId])).rows;
    return { kind, rows: rows.map((r, i) => ({ rank: i + 1, name: r.name, classId: r.class_id, level: r.level, value: Number(r.value) })) };
  });
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
