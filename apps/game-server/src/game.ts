/**
 * Authoritative game server (§57–59). Runs the shared game-core World/command dispatcher; clients send intents only.
 * One process = one world shard (modular monolith, ADR-004). Durable state: PostgreSQL. Presence: Redis.
 */
import type { WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import {
  CONFIG as GAME, DYNAMIC_KEYS, STARTER_DECKS, absoluteAction, applyAction, newMatch, perspective, validateDeck, type TcgAction, type TcgState, publicEntity, ITEMS, Ledger, MAPS, MarketService, PlayerService, Rng, TILE, World, executeCommand, serializePlayer, viewFor, walletId,
  type Currency, type PlayerState, type Result, type Session,
} from '../../../packages/game-core/src/index.js';
import { pool, tx } from './db.js';
import { CONFIG } from './env.js';
import type { Redis } from 'ioredis';

interface Conn { tcgPvp?: { id: string; side: 0 | 1 } | null; phase: number; aoi?: { ids: string[]; at: number; inst: string }; known: Map<string, string>; mapSent: string; ws: WebSocket; accountId: string; role: string; charId: string; svc: PlayerService; world: World; session: Session; lastSnap: number; dirty: boolean; muted: boolean; lastPersist: number }
interface Invite { kind: 'party' | 'trade' | 'duel' | 'guild' | 'marriage' | 'tcg'; from: string; at: number; data?: any }
interface Trade { id: string; a: string; b: string; offer: Record<string, { items: string[]; gold: bigint }>; lock: Record<string, boolean>; confirm: Record<string, boolean>; done: boolean }
const ok = (data?: unknown, msg?: string): Result => ({ ok: true, data, msg });
const fail = (err: string, msg?: string): Result => ({ ok: false, err, msg: msg ?? err });
const ECON_CMDS = new Set(['marketList', 'marketBuy', 'marketCancel', 'buyOrder', 'cancelBuyOrder', 'auctionCreate', 'auctionBid', 'auctionBuyNow', 'exchangePlace', 'exchangeCancel', 'buy', 'sell', 'bulkSell', 'refine', 'craft', 'gacha', 'mailClaim', 'mailClaimAll', 'guildDonate', 'teleport', 'completeQuest']);
const SERVER_ONLY = new Set(['dev']);

export class GameServer {
  ledger = new Ledger(); market: MarketService; worlds = new Map<string, World>(); conns = new Map<string, Conn>(); invites = new Map<string, Invite>(); trades = new Map<string, Trade>();
  tcgMatches = new Map<string, { id: string; state: TcgState; a: string; b: string; settled: boolean }>();
  arenaQueues = new Map<string, string[]>(); get arenaQueue(): string[] { return [...this.arenaQueues.values()].flat(); } matches = new Map<string, { world: World; a: string[]; b: string[]; mode: string; rated: boolean; settled: boolean }>(); stats = { tickMsAvg: 0, bytesOut: 0, ticks: 0, tickMsP95: 0, tickSamples: [] as number[], cmds: 0, persistErrors: 0 };
  private timer?: NodeJS.Timeout; private rng = new Rng(Date.now() & 0xffffff); private chatOut: [string, string, string | null, string | null, string][] = [];
  constructor(public redis: Redis | null) { this.ledger.trackPending = true; this.market = new MarketService(this.ledger, new Rng(7)); }

  async load() {
    for (const r of (await pool.query('SELECT account, currency, available, reserved FROM wallets')).rows) { const b = this.ledger.bal(r.account, r.currency); b.available = BigInt(r.available); b.reserved = BigInt(r.reserved); }
    const m = (await pool.query('SELECT data FROM market_state WHERE world_id=$1', [CONFIG.worldId])).rows[0]; if (m) this.market.load(m.data);
    this.ledger.dirty.clear(); this.ledger.pending = [];
  }
  world(mapId: string, instanceKey?: string): World {
    const key = instanceKey ?? mapId; let w = this.worlds.get(key);
    if (!w) { w = new World({ mapId, instanceId: key, rng: new Rng(MAPS[mapId]!.seed * 131 + key.length), bots: 0, worldBossIntervalMs: Number(process.env.WORLD_BOSS_INTERVAL_MS ?? 10 * 60_000) }); this.worlds.set(key, w); }
    return w;
  }
  start() { const dt = 1000 / CONFIG.tickHz; let last = performance.now(); this.timer = setInterval(() => { const t0 = performance.now(); this.tick(t0 - last); last = t0; const took = performance.now() - t0; const s = this.stats.tickSamples; s.push(took); if (s.length > 200) s.shift(); this.stats.ticks++; if (this.stats.ticks % 20 === 0) this.stats.tickMsAvg = s.reduce((a, b) => a + b, 0) / s.length; if (this.stats.ticks % 20 === 0) this.stats.tickMsP95 = [...s].sort((a, b) => a - b)[Math.floor(s.length * 0.95)] ?? 0; }, dt); }
  stop() { if (this.timer) clearInterval(this.timer); }

  // ---------------- connections ----------------
  async join(ws: WebSocket, accountId: string, role: string, charId: string) {
    const r = await pool.query('SELECT * FROM characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL', [charId, accountId]); const row = r.rows[0];
    if (!row) throw new Error('CHARACTER_NOT_FOUND');
    const prev = this.conns.get(charId); if (prev) { prev.ws.close(4001, 'Logged in elsewhere'); await this.leave(charId); } // single active session per character
    const p = row.state as PlayerState; p.wallet = this.ledger; // shared world ledger (balances loaded from wallets table)
    const svc = new PlayerService(p, new Rng(this.rng.int(1, 2 ** 30)));
    const off = svc.settleFarm(); svc.resetDailyIfNeeded();
    const map = MAPS[p.map] && !MAPS[p.map]!.instanced ? p.map : p.savedMap ?? 'emberglen';
    const world = this.world(map); const e = world.addPlayer(svc, MAPS[p.map]?.instanced ? undefined : { x: p.x, y: p.y });
    const muted = (await pool.query(`SELECT 1 FROM moderation_actions WHERE account_id=$1 AND action='mute' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`, [accountId])).rowCount! > 0;
    const c: Conn = { phase: this.conns.size % 2, known: new Map(), mapSent: '', ws, accountId, role, charId, svc, world, session: {}, lastSnap: 0, dirty: true, muted, lastPersist: Date.now() };
    this.conns.set(charId, c);
    svc.onEvent = () => { c.dirty = true; }; // any domain event (loot, gold, level, quest…) re-syncs the owner's state, even when it happens inside the tick
    await this.redis?.sadd('hb:online', charId).catch(() => undefined); await this.redis?.set(`hb:presence:${charId}`, map, 'EX', 120).catch(() => undefined);
    this.send(c, { type: 'welcome', myId: e.id, mapId: map, player: this.playerJson(c), serverTime: Date.now(), protocolVersion: 1 });
    if (off.minutes) svc.note(`Farm settled ${off.minutes} min while offline.`);
    world.fx.push({ t: 'notice', msg: `${p.name} entered ${MAPS[map]!.name.en}` });
    return c;
  }
  async leave(charId: string) {
    const c = this.conns.get(charId); if (!c) return;
    this.cancelTradesOf(charId); for (const q of this.arenaQueues.values()) { const i = q.indexOf(charId); if (i >= 0) q.splice(i, 1); }
    if (c.tcgPvp) { const m = this.tcgMatches.get(c.tcgPvp.id); if (m && m.state.winner === null) { applyAction(m.state, c.tcgPvp.side, { type: 'surrender' }); this.tcgPush(m); } }
    const e = c.world.entities.get(`pl_${charId}`); if (e?.partyId) { const m = c.world.parties.get(e.partyId); if (m) { m.splice(m.indexOf(e.id), 1); if (m.length <= 1) { for (const id of m) { const x = c.world.entities.get(id); if (x) x.partyId = null; } c.world.parties.delete(e.partyId); } } }
    c.world.removePlayer(`pl_${charId}`); this.conns.delete(charId);
    await this.persist([c]).catch((err) => { this.stats.persistErrors++; console.error('persist on leave failed', err); });
    await this.redis?.srem('hb:online', charId).catch(() => undefined);
  }
  playerJson(c: Conn): string { return serializePlayer({ ...c.svc.p, wallet: this.walletView(c) as any }); }
  /** Client only receives its own wallet rows (no other accounts' balances leak). */
  walletView(c: Conn): Ledger { const v = new Ledger(); const a = walletId(c.svc.p); for (const cur of ['gold', 'crystal', 'arena_token', 'boss_coin', 'card_dust', 'star_dust', 'guild_token', 'event_token'] as Currency[]) { const b = this.ledger.bal(a, cur); const vb = v.bal(a, cur); vb.available = b.available; vb.reserved = b.reserved; } return v; }
  send(c: Conn, m: unknown, plain = false) { if (c.ws.readyState !== 1) return; const s = plain ? JSON.stringify(m) : JSON.stringify(m, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)); this.stats.bytesOut += s.length; c.ws.send(s); }
  sendFx(c: Conn, fx: unknown[]) { if (fx.length) this.send(c, { type: 'fx', fx }, true); }

  // ---------------- command handling ----------------
  async handle(c: Conn, raw: string) {
    let m: any; try { m = JSON.parse(raw); } catch { return; }
    if (!m || m.type !== 'cmd' || typeof m.cmd !== 'string' || raw.length > 16_000) return this.send(c, { type: 'res', id: m?.id, result: fail('INVALID_PACKET') });
    this.stats.cmds++;
    let r: Result;
    if (m.cmd === 'ping') r = ok({ t: Date.now() });
    else if (SERVER_ONLY.has(m.cmd) && !(CONFIG.devCommands && c.role === 'admin')) r = fail('FORBIDDEN', 'Developer commands disabled on this server');
    else r = await this.dispatch(c, m.cmd, m.args ?? {});
    if (r.ok && (ECON_CMDS.has(m.cmd) || this.ledger.pending.length > 0)) { try { await this.persist([...this.conns.values()].filter((x) => x.dirty || x === c)); } catch (e) { this.stats.persistErrors++; console.error('persist failed', e); r = fail('PERSIST_FAILED', 'Server could not save; please retry'); } }
    this.send(c, { type: 'res', id: m.id, result: r }); if (!['move', 'moveTo', 'target', 'ping', 'chat', 'whisper', 'marketView', 'tcgView'].includes(m.cmd)) c.dirty = true; // movement/chat don't change durable state → no full state resend
    if (['marketList', 'marketBuy', 'marketCancel', 'buyOrder', 'cancelBuyOrder', 'auctionCreate', 'auctionBid', 'auctionBuyNow', 'exchangePlace', 'exchangeCancel', 'marketView'].includes(m.cmd)) this.send(c, { type: 'market', market: this.market.serialize() });
    if (m.cmd.startsWith('tcg') && !c.tcgPvp && c.session.tcg && !['tcgChallenge', 'tcgAccept'].includes(m.cmd)) this.send(c, { type: 'tcg', tcg: c.session.tcg ? { view: viewFor(c.session.tcg.state, 0), mode: c.session.tcg.mode, opp: c.session.tcg.oppName } : null });
  }
  private ctx(c: Conn) {
    return { svc: c.svc, world: c.world, market: this.market, entityId: `pl_${c.charId}`, session: c.session, mode: 'server' as const, dev: CONFIG.devCommands && c.role === 'admin',
      changeMap: (mapId: string, x?: number, y?: number, o?: { dungeon?: string; arena?: string }): Result => this.changeMap(c, mapId, x, y, o),
      findPlayerByName: (name: string) => { const t = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === name.toLowerCase()); return t ? { svc: t.svc, entityId: `pl_${t.charId}` } : null; } };
  }
  changeMap(c: Conn, mapId: string, x?: number, y?: number, o: { dungeon?: string; arena?: string } = {}): Result {
    const def = MAPS[mapId]; if (!def) return fail('INVALID_MAP'); if (mapId !== 'pet_farm') c.session.visit = null;
    const id = `pl_${c.charId}`; const old = c.world.entities.get(id); if (old && !MAPS[c.world.mapId]!.instanced) c.session.prevMap = { map: c.world.mapId, x: old.x, y: old.y };
    const prevWorld = c.world; const keepParty = old?.partyId ?? null; // party membership belongs to the player, not the map: carry it across worlds
    if (keepParty) { const lst = c.world.parties.get(keepParty); if (lst) { const i = lst.indexOf(id); if (i >= 0) lst.splice(i, 1); if (!lst.length) c.world.parties.delete(keepParty); } }
    this.cancelTradesOf(c.charId); c.world.removePlayer(id);
    const key = def.instanced ? `${mapId}:${o.arena ?? c.charId}:${Date.now().toString(36)}` : mapId; const w = this.world(mapId, key);
    c.svc.p.riding = c.svc.p.riding && !def.instanced; w.addPlayer(c.svc, x !== undefined && y !== undefined ? { x, y } : { x: def.spawn[0] * TILE + 16, y: def.spawn[1] * TILE + 16 }); c.world = w;
    if (!def.instanced) c.svc.p.savedMap = mapId;
    if (keepParty && !o.dungeon) { const ne = w.entities.get(id); if (ne) { ne.partyId = keepParty; const lst = w.parties.get(keepParty) ?? []; if (!lst.includes(id)) lst.push(id); w.parties.set(keepParty, lst); } }
    const participants = [id];
    if (o.dungeon) { // party dungeon (§28): online party members on the same map enter the same instance (each pays their own daily entry)
      const oldPartyId = keepParty; const members = oldPartyId ? [...this.conns.values()].filter((m) => m !== c && m.world.entities.get(`pl_${m.charId}`)?.partyId === oldPartyId && m.world === prevWorld) : [];
      for (const m of members) { const ok2 = m.svc.startDungeon(o.dungeon); if (!ok2.ok) { this.notice(m, `Could not join party dungeon: ${ok2.msg}`); continue; } const mid = `pl_${m.charId}`; this.cancelTradesOf(m.charId); m.world.removePlayer(mid); w.addPlayer(m.svc, { x: def.spawn[0] * TILE + 16 + 24 * participants.length, y: def.spawn[1] * TILE + 16 }); m.world = w; participants.push(mid); this.send(m, { type: 'state', player: this.playerJson(m), mapId, myId: mid }); }
      if (participants.length > 1 || keepParty) { const pidN = keepParty ?? `party_${randomBytes(4).toString('hex')}`; w.parties.set(pidN, participants); for (const pidE of participants) { const e2 = w.entities.get(pidE); if (e2) e2.partyId = pidN; } }
      w.startDungeon(o.dungeon, `run_${randomBytes(6).toString('hex')}`, participants);
    }
    if (o.arena === 'queue') { /* handled by matchmaker */ }
    this.send(c, { type: 'state', player: this.playerJson(c), mapId, myId: id }); this.redis?.set(`hb:presence:${c.charId}`, mapId, 'EX', 120).catch(() => undefined);
    return ok();
  }
  private target(c: Conn, entityId: string): Conn | undefined { const charId = String(entityId ?? '').replace(/^pl_/, ''); const t = this.conns.get(charId); return t && t.world === c.world ? t : undefined; }
  async dispatch(c: Conn, cmd: string, a: Record<string, any>): Promise<Result> {
    const me = `pl_${c.charId}`;
    switch (cmd) {
      // ---- chat (world/whisper are cross-map) ----
      case 'chat': { if (c.muted) return fail('MUTED', 'You are muted by a moderator'); const ch = String(a.ch ?? 'local'); const msg = String(a.msg ?? '').replace(/[<>]/g, '').slice(0, 160).trim(); if (!msg) return fail('EMPTY');
        if (ch === 'world' || ch === 'trade' || ch === 'help') for (const x of this.conns.values()) { if (!x.svc.p.blocked.includes(c.svc.p.name) && x.world !== c.world) this.sendFx(x, [{ t: 'chat', ch, from: c.svc.p.name, msg }]); }
        if (ch === 'party') { const e = c.world.entities.get(me); const m = e?.partyId ? c.world.parties.get(e.partyId) ?? [] : []; for (const id of m) { const t = this.conns.get(id.replace('pl_', '')); if (t) this.sendFx(t, [{ t: 'chat', ch, from: c.svc.p.name, msg }]); } this.chatOut.push([ch, msg, c.charId, null, c.svc.p.name]); return ok(); }
        c.world.chat(me, ch, msg); this.chatOut.push([ch, msg, c.charId, null, c.svc.p.name]); return ok(); }
      case 'whisper': { const t = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === String(a.to ?? '').toLowerCase()); if (!t) return fail('PLAYER_OFFLINE'); if (t.svc.p.blocked.includes(c.svc.p.name)) return fail('BLOCKED'); const msg = String(a.msg ?? '').replace(/[<>]/g, '').slice(0, 160); this.sendFx(t, [{ t: 'chat', ch: 'whisper', from: c.svc.p.name, msg }]); this.chatOut.push(['whisper', msg, c.charId, t.charId, c.svc.p.name]); return ok(); }
      // ---- party with consent ----
      case 'partyInvite': { const t = this.target(c, a.target); if (!t) return executeCommand(this.ctx(c), cmd, a); if (t.svc.p.blocked.includes(c.svc.p.name)) return fail('BLOCKED'); this.invites.set(t.charId, { kind: 'party', from: c.charId, at: Date.now() }); this.notice(t, `${c.svc.p.name} invites you to a party. Type /accept party or click Accept.`); return ok({ pending: true }); }
      case 'partyAccept': { const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'party' || Date.now() - inv.at > 60_000) return fail('NO_INVITE'); this.invites.delete(c.charId); const from = this.conns.get(inv.from); if (!from || from.world !== c.world) return fail('INVITER_GONE'); const r = executeCommand({ ...this.ctx(from), mode: 'server' }, 'partyInvite', { target: me }); if (r.ok) { this.notice(from, `${c.svc.p.name} joined your party`); } return r; }
      // ---- real two-player trade (§38) ----
      case 'tradeOpen': { const t = this.target(c, a.target); if (!t) return fail('PLAYER_NOT_NEARBY'); const d = Math.hypot(c.world.entities.get(me)!.x - c.world.entities.get(`pl_${t.charId}`)!.x, c.world.entities.get(me)!.y - c.world.entities.get(`pl_${t.charId}`)!.y); if (d > 200) return fail('TOO_FAR'); this.invites.set(t.charId, { kind: 'trade', from: c.charId, at: Date.now() }); this.notice(t, `${c.svc.p.name} wants to trade (tradeAccept).`); return ok({ pending: true }); }
      case 'tradeAccept': { const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'trade') return fail('NO_INVITE'); this.invites.delete(c.charId); const tr: Trade = { id: `tr_${randomBytes(6).toString('hex')}`, a: inv.from, b: c.charId, offer: { [inv.from]: { items: [], gold: 0n }, [c.charId]: { items: [], gold: 0n } }, lock: {}, confirm: {}, done: false }; this.trades.set(tr.id, tr); for (const id of [tr.a, tr.b]) { const x = this.conns.get(id); if (x) this.notice(x, 'Trade window opened'); } return ok({ id: tr.id }); }
      case 'tradeOffer': { const tr = this.tradeOf(c.charId); if (!tr) return fail('NO_TRADE'); const items: string[] = (a.items ?? []).map(String).slice(0, 12); const gold = BigInt(String(a.gold ?? '0').replace(/\D/g, '') || '0'); for (const u of items) { const it = c.svc.findInv(u); if (!it || it.locked || it.bound) return fail('ITEM_NOT_TRADEABLE'); } if (c.svc.gold() < gold) return fail('NOT_ENOUGH_GOLD'); tr.offer[c.charId] = { items, gold }; tr.lock = {}; tr.confirm = {}; this.tradeUpdate(tr); return ok(); }
      case 'tradeLock': { const tr = this.tradeOf(c.charId); if (!tr) return fail('NO_TRADE'); tr.lock[c.charId] = true; this.tradeUpdate(tr); return ok(); }
      case 'tradeConfirm': { const tr = this.tradeOf(c.charId); if (!tr) return fail('NO_TRADE'); if (!tr.lock[tr.a] || !tr.lock[tr.b]) return fail('NOT_LOCKED'); tr.confirm[c.charId] = true; if (tr.confirm[tr.a] && tr.confirm[tr.b]) return this.settleTrade(tr); this.tradeUpdate(tr); return ok({ waiting: true }); }
      case 'tradeCancel': { this.cancelTradesOf(c.charId); return ok(); }
      // ---- PvP: duel request & ranked arena matchmaking (§30) ----
      case 'duelRequest': { const t = this.target(c, a.target); if (!t) return fail('PLAYER_NOT_NEARBY'); this.invites.set(t.charId, { kind: 'duel', from: c.charId, at: Date.now() }); this.notice(t, `${c.svc.p.name} challenges you to a duel (duelAccept).`); return ok({ pending: true }); }
      case 'duelAccept': { const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'duel') return fail('NO_INVITE'); this.invites.delete(c.charId); const from = this.conns.get(inv.from); if (!from) return fail('GONE'); this.startMatch([from], [c], 'duel', false); return ok(); }
      case 'arenaJoin': { // queues per size × mode; teams balanced by rating (snake draft) when enough players are queued
        const size = ['1v1', '2v2', '3v3'].includes(a.mode) ? a.mode : '1v1'; const type = ['deathmatch', 'siege', 'rush'].includes(a.type) ? a.type : 'deathmatch'; const key = `${size}:${type}`;
        if (this.arenaQueue.includes(c.charId)) return fail('ALREADY_QUEUED'); const q = this.arenaQueues.get(key) ?? []; q.push(c.charId); this.arenaQueues.set(key, q);
        this.notice(c, `Queued for ranked ${size} ${type} (${q.length}/${Number(size[0]) * 2})`); this.matchmake(); return ok({ queued: true, key, inQueue: q.length });
      }
      case 'arenaLeaveQueue': { for (const q of this.arenaQueues.values()) { const i = q.indexOf(c.charId); if (i >= 0) q.splice(i, 1); } return ok(); }
      case 'arenaSettle': { return ok({ auto: true, msg: 'Server settles arena results automatically' }); }
      // ---- guild (DB-backed, multi-member) ----
      case 'guildCreate': return this.guildCreate(c, String(a.name ?? ''));
      case 'guildInvite': { const t = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === String(a.name ?? '').toLowerCase()); if (!t) return fail('PLAYER_OFFLINE'); if (!c.svc.p.guild || c.svc.p.guild.role === 'member') return fail('NO_PERMISSION'); this.invites.set(t.charId, { kind: 'guild', from: c.charId, at: Date.now(), data: c.svc.p.guild.id }); this.notice(t, `${c.svc.p.name} invites you to guild ${c.svc.p.guild.name} (guildAccept).`); return ok(); }
      case 'guildAccept': return this.guildAccept(c);
      case 'guildDonate': { const r = executeCommand(this.ctx(c), cmd, a); if (r.ok && c.svc.p.guild) { await pool.query('UPDATE guilds SET exp=exp+$2 WHERE id=$1', [c.svc.p.guild.id, Math.floor(Math.max(100, Number(a.gold) || 0) / 10)]); await pool.query('UPDATE guild_members SET contribution=contribution+$3 WHERE guild_id=$1 AND character_id=$2', [c.svc.p.guild.id, c.charId, Math.floor(Math.max(100, Number(a.gold) || 0) / 10)]); } return r; }
      case 'guildInfo': { if (!c.svc.p.guild) return fail('NO_GUILD'); const g = (await pool.query('SELECT * FROM guilds WHERE id=$1', [c.svc.p.guild.id])).rows[0]; const m = (await pool.query('SELECT c.name, gm.role, gm.contribution FROM guild_members gm JOIN characters c ON c.id=gm.character_id WHERE gm.guild_id=$1 ORDER BY gm.role, c.name', [c.svc.p.guild.id])).rows; return ok({ guild: g, members: m }); }
      case 'guildLeave': { if (c.svc.p.guild) await pool.query('DELETE FROM guild_members WHERE character_id=$1', [c.charId]); return executeCommand(this.ctx(c), cmd, a); }
      case 'report': { await pool.query('INSERT INTO player_reports(id,reporter,target_name,reason) VALUES ($1,$2,$3,$4)', [`rpt_${randomBytes(6).toString('hex')}`, c.charId, String(a.name).slice(0, 20), String(a.reason).slice(0, 60)]); return ok(); }
      case 'marketView': return ok();
      // ---- friend farm visit (§26): only if the owner lists you as a friend; likes persist to the owner (online or offline) ----
      case 'visitFarm': {
        const name = String(a.name ?? ''); if (!c.svc.p.friends.some((f) => f.name.toLowerCase() === name.toLowerCase())) return fail('NOT_FRIENDS');
        const online = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === name.toLowerCase()); const ownerState: any = online ? online.svc.p : (await pool.query('SELECT state FROM characters WHERE lower(name)=lower($1) AND world_id=$2 AND deleted_at IS NULL', [name, CONFIG.worldId])).rows[0]?.state;
        if (!ownerState) return fail('NOT_FOUND'); if (!(ownerState.friends ?? []).some((f: any) => f.name.toLowerCase() === c.svc.p.name.toLowerCase())) return fail('NO_PERMISSION', `${name} has not added you as a friend`);
        c.session.visit = { owner: ownerState.name, simulated: false, likes: ownerState.farm?.likes ?? 0, pets: (ownerState.pets ?? []).filter((p: any) => p.onFarm).map((p: any) => ({ species: p.species, level: p.level })), decorations: ownerState.farm?.decorations ?? [] };
        return this.changeMap(c, 'pet_farm');
      }
      case 'likeFarm': {
        const r = executeCommand(this.ctx(c), 'likeFarm', {}); if (!r.ok) return r; const owner = c.session.visit!.owner; const online = [...this.conns.values()].find((x) => x.svc.p.name === owner);
        if (online) { online.svc.p.farm.likes++; online.dirty = true; this.notice(online, `${c.svc.p.name} liked your farm!`); } else await pool.query(`UPDATE characters SET state = jsonb_set(state, '{farm,likes}', to_jsonb(COALESCE((state->'farm'->>'likes')::int, 0) + 1)) WHERE name=$1 AND world_id=$2`, [owner, CONFIG.worldId]);
        return r;
      }
      // ---- friend presence (§39): online for any friend; map only when the friendship is mutual (privacy) ----
      case 'friendsStatus': return ok(c.svc.p.friends.map((f) => { const t = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === f.name.toLowerCase()); const mutual = !!t && t.svc.p.friends.some((g) => g.name.toLowerCase() === c.svc.p.name.toLowerCase()) && !t.svc.p.blocked.includes(c.svc.p.name); return { name: f.name, online: !!t && !t.svc.p.blocked.includes(c.svc.p.name), map: mutual ? t!.world.mapId : null, mutual, simulated: false }; }));
      // ---- marriage with consent (§41) ----
      case 'propose': {
        if (c.svc.p.marriage) return fail('ALREADY_MARRIED'); const t = [...this.conns.values()].find((x) => x.svc.p.name.toLowerCase() === String(a.name ?? '').toLowerCase()); if (!t || t === c) return fail('PARTNER_OFFLINE', 'Your partner must be online');
        if (t.svc.p.marriage) return fail('PARTNER_MARRIED'); const fa = c.svc.p.friends.find((f) => f.name === t.svc.p.name), fb = t.svc.p.friends.find((f) => f.name === c.svc.p.name); if (!fa || !fb) return fail('MUST_BE_MUTUAL_FRIENDS', 'You must both have each other as friends');
        const minMs = Number(process.env.MARRIAGE_MIN_FRIEND_MS ?? 180000); if (Date.now() - Math.max(fa.since, fb.since) < minMs) return fail('FRIENDSHIP_TOO_NEW');
        const nearOfficiant = c.world.mapId === 'emberglen' && Math.hypot(c.world.entities.get(me)!.x - (16 * TILE + 16), c.world.entities.get(me)!.y - (16 * TILE + 16)) < 200; if (!nearOfficiant) return fail('NEED_OFFICIANT', 'Stand near Officiant Sol in Emberglen');
        if (c.svc.countItem('wedding_ring') < 1 && c.svc.gold() < 10000n) return fail('NEED_RING', 'Need a Hearthbound Ring or 10,000 Gold');
        this.invites.set(t.charId, { kind: 'marriage', from: c.charId, at: Date.now() }); this.notice(t, `${c.svc.p.name} proposes marriage to you! (marriageAccept)`); return ok({ pending: true });
      }
      case 'marriageAccept': {
        const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'marriage') return fail('NO_PROPOSAL'); this.invites.delete(c.charId); const p = this.conns.get(inv.from); if (!p) return fail('PROPOSER_OFFLINE'); if (p.svc.p.marriage || c.svc.p.marriage) return fail('ALREADY_MARRIED');
        if (!p.svc.removeItem('wedding_ring', 1) && !p.svc.spend('gold', 10000, 'wedding')) return fail('PROPOSER_CANNOT_PAY');
        const now = Date.now(); for (const [x, y] of [[p, c], [c, p]] as const) { x.svc.p.marriage = { partner: y.svc.p.name, since: now, anniversary: 0 }; if (!x.svc.p.titles.includes('title_hearthbound')) x.svc.p.titles.push('title_hearthbound'); x.dirty = true; x.world.refreshPlayer(`pl_${x.charId}`); }
        await this.persist([p, c]); for (const x of [p, c]) x.world.fx.push({ t: 'notice', msg: `${p.svc.p.name} and ${c.svc.p.name} are now wed!` }); return ok();
      }
      case 'divorce': {
        const m = c.svc.p.marriage; if (!m) return fail('NOT_MARRIED'); const r = executeCommand(this.ctx(c), 'divorce', {});
        const t = [...this.conns.values()].find((x) => x.svc.p.name === m.partner);
        if (t) { t.svc.p.marriage = null; t.svc.p.titles = t.svc.p.titles.filter((x) => x !== 'title_hearthbound'); if (t.svc.p.title === 'title_hearthbound') t.svc.p.title = null; t.dirty = true; this.notice(t, `${c.svc.p.name} ended your marriage.`); await this.persist([c, t]); }
        else await pool.query(`UPDATE characters SET state = jsonb_set(jsonb_set(state, '{marriage}', 'null'), '{titles}', COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(state->'titles') x WHERE x <> '"title_hearthbound"'), '[]'::jsonb)) WHERE lower(name)=lower($1) AND world_id=$2`, [m.partner, CONFIG.worldId]);
        return r;
      }
      // ---- Hearthcards PvP (§43): friendly duel between two real players, server-authoritative, hidden info per side ----
      case 'tcgChallenge': { const t = this.target(c, a.target); if (!t) return fail('PLAYER_NOT_NEARBY'); if (c.tcgPvp || t.tcgPvp) return fail('ALREADY_DUELING'); this.invites.set(t.charId, { kind: 'tcg', from: c.charId, at: Date.now() }); this.notice(t, `${c.svc.p.name} challenges you to Hearthcards (tcgAccept).`); return ok({ pending: true }); }
      case 'tcgAccept': {
        const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'tcg') return fail('NO_CHALLENGE'); this.invites.delete(c.charId); const ch = this.conns.get(inv.from); if (!ch) return fail('CHALLENGER_OFFLINE');
        const deckOf = (x: Conn) => x.svc.p.tcg.decks.find((d) => d.id === x.svc.p.tcg.activeDeck)?.cards ?? Object.values(STARTER_DECKS)[0]!.cards; const da = deckOf(ch), db = deckOf(c);
        if (validateDeck(da, ch.svc.p.tcg.collection) || validateDeck(db, c.svc.p.tcg.collection)) return fail('ILLEGAL_DECK');
        const m = { id: `tcg_${randomBytes(5).toString('hex')}`, state: newMatch(da, db, this.rng.int(1, 2 ** 30)), a: ch.charId, b: c.charId, settled: false }; this.tcgMatches.set(m.id, m);
        ch.tcgPvp = { id: m.id, side: 0 }; c.tcgPvp = { id: m.id, side: 1 }; this.tcgPush(m); return ok({ id: m.id });
      }
      case 'tcgAction': case 'tcgView': {
        if (!c.tcgPvp) return executeCommand(this.ctx(c), cmd, a); const m = this.tcgMatches.get(c.tcgPvp.id); if (!m) { c.tcgPvp = null; return fail('NO_MATCH'); }
        if (cmd === 'tcgAction') { const err = applyAction(m.state, c.tcgPvp.side, absoluteAction(a.action as TcgAction, c.tcgPvp.side)); if (err) return fail(err); }
        this.tcgPush(m); return ok(perspective(m.state, c.tcgPvp.side));
      }
      case 'tcgStart': if (c.tcgPvp) return fail('MATCH_IN_PROGRESS'); return executeCommand(this.ctx(c), cmd, a);
      case 'propose': return fail('NOT_AVAILABLE_ONLINE', 'Online marriage requires partner acceptance flow (not yet implemented server-side)');
      default: return executeCommand(this.ctx(c), cmd, a);
    }
  }
  tcgPush(m: { id: string; state: TcgState; a: string; b: string; settled: boolean }) {
    const A = this.conns.get(m.a), B = this.conns.get(m.b);
    for (const [cn, side, opp] of [[A, 0, B], [B, 1, A]] as const) if (cn) this.send(cn, { type: 'tcg', tcg: { view: perspective(m.state, side), mode: 'pvp', opp: opp?.svc.p.name ?? 'Opponent' } }, true);
    if (m.state.winner !== null && !m.settled) {
      m.settled = true; const w = m.state.winner; if (A) A.svc.recordTcg(w === 0, 'casual', B?.svc.p.tcg.rating ?? 1000); if (B) B.svc.recordTcg(w === 1, 'casual', A?.svc.p.tcg.rating ?? 1000);
      for (const x of [A, B]) if (x) { x.tcgPvp = null; x.dirty = true; } this.persist([A, B].filter(Boolean) as Conn[]).catch(() => undefined); this.tcgMatches.delete(m.id);
    }
  }
  notice(c: Conn, msg: string) { this.sendFx(c, [{ t: 'notice', msg }]); }
  private tradeOf(charId: string) { return [...this.trades.values()].find((t) => !t.done && (t.a === charId || t.b === charId)); }
  private tradeUpdate(tr: Trade) { for (const id of [tr.a, tr.b]) { const x = this.conns.get(id); if (x) this.send(x, { type: 'trade', trade: { id: tr.id, a: tr.a, b: tr.b, offer: tr.offer, lock: tr.lock, confirm: tr.confirm } }); } }
  private cancelTradesOf(charId: string) { for (const t of this.trades.values()) if (!t.done && (t.a === charId || t.b === charId)) { t.done = true; for (const id of [t.a, t.b]) { const x = this.conns.get(id); if (x && id !== charId) this.notice(x, 'Trade cancelled'); } } }
  /** Validate both sides, then move items + gold in one server-side step and persist both players + trade_history in one DB transaction. */
  private async settleTrade(tr: Trade): Promise<Result> {
    const A = this.conns.get(tr.a), B = this.conns.get(tr.b); if (!A || !B || A.world !== B.world) { tr.done = true; return fail('PARTNER_GONE'); }
    const oa = tr.offer[tr.a]!, ob = tr.offer[tr.b]!;
    const ia = oa.items.map((u) => A.svc.findInv(u)), ib = ob.items.map((u) => B.svc.findInv(u));
    if (ia.some((i) => !i || i.locked || i.bound) || ib.some((i) => !i || i.locked || i.bound)) { tr.done = true; return fail('ITEM_CHANGED'); }
    if (A.svc.freeSlots() + ia.length < ib.length || B.svc.freeSlots() + ib.length < ia.length) { tr.done = true; return fail('INVENTORY_FULL'); }
    if (A.svc.gold() < oa.gold || B.svc.gold() < ob.gold) { tr.done = true; return fail('NOT_ENOUGH_GOLD'); }
    const legs: { account: string; currency: Currency; amount: bigint }[] = [];
    if (oa.gold > 0n) legs.push({ account: walletId(A.svc.p), currency: 'gold', amount: -oa.gold }, { account: walletId(B.svc.p), currency: 'gold', amount: oa.gold });
    if (ob.gold > 0n) legs.push({ account: walletId(B.svc.p), currency: 'gold', amount: -ob.gold }, { account: walletId(A.svc.p), currency: 'gold', amount: ob.gold });
    if (legs.length) this.ledger.post(legs, 'direct_trade', `trade:${tr.id}`);
    for (const i of ia) A.svc.p.inventory.splice(A.svc.p.inventory.indexOf(i!), 1); for (const i of ib) B.svc.p.inventory.splice(B.svc.p.inventory.indexOf(i!), 1);
    A.svc.p.inventory.push(...(ib as any)); B.svc.p.inventory.push(...(ia as any)); tr.done = true;
    await this.persist([A, B], async (cl) => { await cl.query('INSERT INTO trade_history(id,a_char,b_char,a_items,b_items,a_gold,b_gold) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tr.id, tr.a, tr.b, JSON.stringify(ia.map((i) => i!.defId)), JSON.stringify(ib.map((i) => i!.defId)), oa.gold.toString(), ob.gold.toString()]); });
    for (const x of [A, B]) { this.notice(x, 'Trade completed'); x.dirty = true; }
    return ok({ done: true });
  }
  private matchmake() {
    for (const [key, q] of this.arenaQueues) {
      const n = Number(key[0]); for (let i = q.length - 1; i >= 0; i--) if (!this.conns.has(q[i]!)) q.splice(i, 1);
      while (q.length >= n * 2) { const picked = q.splice(0, n * 2).map((id) => this.conns.get(id)!).sort((x, y) => y.svc.p.pvp.rating - x.svc.p.pvp.rating);
        const A: Conn[] = [], B: Conn[] = []; picked.forEach((c, i) => ((i % 4 === 0 || i % 4 === 3) ? A : B).push(c)); this.startMatch(A, B, `ranked${key}`, true, key.split(':')[1] as any); }
    }
  }
  private startMatch(A: Conn[], B: Conn[], mode: string, rated: boolean, type: 'deathmatch' | 'siege' | 'rush' = 'deathmatch') {
    const id = `m_${randomBytes(6).toString('hex')}`; for (const c of [...A, ...B]) this.changeMap(c, 'arena', undefined, undefined, { arena: id });
    const w = this.worlds.get([...this.worlds.keys()].find((k) => k.startsWith(`arena:${id}`))!)!; for (const c of [...A, ...B]) { if (c.world !== w) { c.world.removePlayer(`pl_${c.charId}`); w.addPlayer(c.svc); c.world = w; } }
    w.startArena(A.map((c) => `pl_${c.charId}`), B.map((c) => `pl_${c.charId}`), 120_000, type); this.matches.set(id, { world: w, a: A.map((c) => c.charId), b: B.map((c) => c.charId), mode, rated, settled: false });
    pool.query('INSERT INTO pvp_matches(id,world_id,mode,team_a,team_b) VALUES ($1,$2,$3,$4,$5)', [id, CONFIG.worldId, mode, JSON.stringify(A.map((c) => c.charId)), JSON.stringify(B.map((c) => c.charId))]).catch(() => undefined);
  }
  private settleMatches() {
    for (const [id, m] of this.matches) {
      if (m.settled || !m.world.arena?.done) continue; m.settled = true; const win = m.world.arena.winner!;
      const conns = (ids: string[]) => ids.map((x) => this.conns.get(x)).filter(Boolean) as Conn[]; const avg = (cs: Conn[]) => cs.reduce((s, c) => s + c.svc.p.pvp.rating, 0) / Math.max(1, cs.length);
      const A = conns(m.a), B = conns(m.b); const ra = avg(A), rb = avg(B); const deltas: Record<string, number> = {};
      if (m.rated) { for (const c of A) deltas[c.charId] = c.svc.recordPvp(win === 0, B.map((x) => x.svc.p.name).join(','), rb); for (const c of B) deltas[c.charId] = c.svc.recordPvp(win === 1, A.map((x) => x.svc.p.name).join(','), ra); }
      const mvp = m.world.arena.mvp?.replace(/^pl_/, ''); if (mvp && this.conns.get(mvp)) this.conns.get(mvp)!.svc.awardMvp();
      for (const c of [...A, ...B]) { this.notice(c, `Match finished: ${((win === 0) === A.includes(c)) ? 'VICTORY' : 'DEFEAT'}${deltas[c.charId] !== undefined ? ` (${deltas[c.charId]! >= 0 ? '+' : ''}${deltas[c.charId]} rating)` : ''}. Use "Leave arena".`); c.dirty = true; }
      pool.query('UPDATE pvp_matches SET winner=$2, rating_delta=$3, finished_at=now() WHERE id=$1', [id, win, JSON.stringify(deltas)]).catch(() => undefined);
      this.persist([...A, ...B]).catch(() => undefined);
    }
  }
  private async guildCreate(c: Conn, name: string): Promise<Result> {
    if (c.svc.p.guild) return fail('ALREADY_IN_GUILD'); if (!/^[\p{L}\p{N} ]{3,16}$/u.test(name.trim())) return fail('INVALID_NAME'); if (c.svc.gold() < 10000n) return fail('NOT_ENOUGH_GOLD');
    const id = `g_${randomBytes(6).toString('hex')}`;
    try { await tx(async (cl) => { await cl.query('INSERT INTO guilds(id,world_id,name) VALUES ($1,$2,$3)', [id, CONFIG.worldId, name.trim()]); await cl.query(`INSERT INTO guild_members(guild_id,character_id,role) VALUES ($1,$2,'leader')`, [id, c.charId]); await cl.query('INSERT INTO guild_logs(guild_id,msg) VALUES ($1,$2)', [id, `${c.svc.p.name} founded the guild`]); }); }
    catch (e: any) { if (e.code === '23505') return fail('NAME_TAKEN'); throw e; }
    c.svc.spend('gold', 10000, 'guild_create'); c.svc.p.guild = { id, name: name.trim(), role: 'leader', contribution: 0, level: 1, exp: 0, storage: [], log: [] }; c.world.refreshPlayer(`pl_${c.charId}`); return ok({ id });
  }
  private async guildAccept(c: Conn): Promise<Result> {
    const inv = this.invites.get(c.charId); if (!inv || inv.kind !== 'guild') return fail('NO_INVITE'); this.invites.delete(c.charId); if (c.svc.p.guild) return fail('ALREADY_IN_GUILD');
    const g = (await pool.query('SELECT * FROM guilds WHERE id=$1', [inv.data])).rows[0]; if (!g) return fail('GUILD_GONE');
    await pool.query(`INSERT INTO guild_members(guild_id,character_id,role) VALUES ($1,$2,'member')`, [g.id, c.charId]); await pool.query('INSERT INTO guild_logs(guild_id,msg) VALUES ($1,$2)', [g.id, `${c.svc.p.name} joined`]);
    c.svc.p.guild = { id: g.id, name: g.name, role: 'member', contribution: 0, level: g.level, exp: Number(g.exp), storage: [], log: [] }; c.world.refreshPlayer(`pl_${c.charId}`); return ok();
  }

  // ---------------- persistence (§59): ledger entries + wallets + characters + market in ONE transaction ----------------
  async persist(conns: Conn[], extra?: (c: import('pg').PoolClient) => Promise<void>) {
    const entries = this.ledger.pending.splice(0); const dirty = [...this.ledger.dirty]; this.ledger.dirty.clear();
    try {
      await tx(async (cl) => {
        for (const e of entries) await cl.query('INSERT INTO currency_ledger(tx_id,account,currency,amount,reason,world_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [e.txId, e.account, e.currency, e.amount.toString(), e.reason, CONFIG.worldId]);
        for (const acct of dirty) { const m = this.ledger.balances.get(acct); if (!m) continue; for (const [cur, b] of m) await cl.query('INSERT INTO wallets(account,currency,available,reserved,updated_at) VALUES ($1,$2,$3,$4,now()) ON CONFLICT (account,currency) DO UPDATE SET available=EXCLUDED.available, reserved=EXCLUDED.reserved, updated_at=now()', [acct, cur, b.available.toString(), b.reserved.toString()]); }
        for (const c of conns) { const e = c.world.entities.get(`pl_${c.charId}`); if (e) c.world.persistVitals(e, c.svc); const p = c.svc.p; const st = { ...p, wallet: undefined }; await cl.query('UPDATE characters SET state=$2, level=$3, map_id=$4, pvp_rating=$5, updated_at=now() WHERE id=$1', [c.charId, JSON.stringify(st), p.level, p.map, p.pvp.rating]); c.lastPersist = Date.now(); }
        if (entries.some((e) => /market|auction|exchange|buy_order/.test(e.reason)) || conns.length === 0) await cl.query('INSERT INTO market_state(world_id,data,version) VALUES ($1,$2,1) ON CONFLICT (world_id) DO UPDATE SET data=EXCLUDED.data, version=market_state.version+1, updated_at=now()', [CONFIG.worldId, JSON.stringify(this.market.serialize())]);
        if (extra) await extra(cl);
      });
    } catch (e) { this.ledger.pending.unshift(...entries); for (const d of dirty) this.ledger.dirty.add(d); throw e; }
  }

  // ---------------- tick & sync ----------------
  private tick(dt: number) {
    for (const [key, w] of this.worlds) { const hasPlayers = [...w.entities.values()].some((e) => e.kind === 'player'); if (!hasPlayers && MAPS[w.mapId]!.instanced) { this.worlds.delete(key); continue; } if (hasPlayers || w.boss) w.tick(dt); }
    this.settleMatches();
    const now = Date.now();
    const fxByWorld = new Map<World, ReturnType<World['drainFx']>>(); for (const w of this.worlds.values()) fxByWorld.set(w, w.drainFx());
    // per-world public entity cache: built once per tick, shared by all connections (O(n) serialization instead of O(n²))
    const cache = new Map<World, Map<string, { full: any; dyn: string }>>();
    const pub = (w: World) => { let m = cache.get(w); if (!m) { m = new Map(); for (const e of w.entities.values()) { const full = publicEntity(e); const dyn = JSON.stringify(DYNAMIC_KEYS.map((k) => (full as any)[k])); m.set(e.id, { full, dyn }); } cache.set(w, m); } return m; };
    for (const c of this.conns.values()) {
      const meE = c.world.entities.get(`pl_${c.charId}`); // spatial fx filter: positional effects and local chat only reach players within 1300px
      const fx = (fxByWorld.get(c.world) ?? []).filter((f) => f.t !== 'notice' || !f.to || f.to === `pl_${c.charId}`).filter((f) => f.t !== 'chat' || !c.svc.p.blocked.includes(f.from)).filter((f: any) => !meE || f.x === undefined || f.t === 'notice' || Math.abs(f.x - meE.x) + Math.abs(f.y - meE.y) < 1300);
      this.sendFx(c, fx);
      if ((this.stats.ticks + c.phase) % Math.round(CONFIG.tickHz / CONFIG.snapshotHz) === 0) { // staggered: half the clients on even ticks, half on odd → no burst every other tick
        c.lastSnap = now; const myId = `pl_${c.charId}`; const e = c.world.entities.get(myId); const m = pub(c.world);
        const full = c.mapSent !== c.world.instanceId; if (full) { c.known.clear(); c.mapSent = c.world.instanceId; }
        const upd: any[] = []; const seen = new Set<string>();
        if (!c.aoi || now - c.aoi.at > 300 || c.aoi.inst !== c.world.instanceId) c.aoi = { ids: c.world.aoiIds(myId), at: now, inst: c.world.instanceId }; // visibility set refreshed every 300ms; positions still sent at 10 Hz
        for (const id of c.aoi.ids) { const p = m.get(id); if (!p) continue; seen.add(id); const prev = c.known.get(id); if (prev === undefined) { upd.push(p.full); c.known.set(id, p.dyn); } else if (prev !== p.dyn) { const d: any = { id }; DYNAMIC_KEYS.forEach((k) => { d[k] = (p.full as any)[k]; }); upd.push(d); c.known.set(id, p.dyn); } }
        const rm: string[] = []; for (const id of c.known.keys()) if (!seen.has(id)) { rm.push(id); c.known.delete(id); }
        const extra = { cds: e?.cds, party: e?.partyId ? c.world.parties.get(e.partyId) : [], dungeon: c.world.dungeon, boss: { boss: c.world.boss && !c.world.boss.settled ? c.world.boss : null, nextAt: c.world.nextBossAt, last: c.world.boss }, arena: c.world.arena, visit: c.session.visit ?? null };
        if (upd.length || rm.length || full || this.stats.ticks % 10 === 0) this.send(c, { type: 'snap', mapId: c.world.mapId, full, upd, rm, extra }, true);
      }
      if (c.dirty && now - c.lastSnap < 60) { c.dirty = false; this.send(c, { type: 'state', player: this.playerJson(c), mapId: c.world.mapId, myId: `pl_${c.charId}` }); }
      if (now - c.lastPersist > CONFIG.saveIntervalMs) { c.lastPersist = now; this.persist([c]).catch(() => { this.stats.persistErrors++; }); }
    }
    if (this.stats.ticks % 100 === 0) { this.market.settleAuctions((acct, item) => { const c = [...this.conns.values()].find((x) => walletId(x.svc.p) === acct); if (c) { c.svc.p.inventory.push(item); c.dirty = true; } }); }
    if (this.chatOut.length) { const rows = this.chatOut.splice(0); for (const [ch, body, from, to] of rows) pool.query('INSERT INTO chat_messages(world_id,channel,from_char,to_char,body) VALUES ($1,$2,$3,$4,$5)', [CONFIG.worldId, ch, from, to, body]).catch(() => undefined); }
    for (const [k, inv] of this.invites) if (now - inv.at > 60_000) this.invites.delete(k);
  }
  overview() {
    return { online: this.conns.size, worlds: [...this.worlds.entries()].map(([k, w]) => ({ key: k, map: w.mapId, players: [...w.entities.values()].filter((e) => e.kind === 'player').length, monsters: [...w.entities.values()].filter((e) => e.kind === 'monster').length })), tickMsP95: this.stats.tickMsP95, cmds: this.stats.cmds, persistErrors: this.stats.persistErrors, memoryMB: Math.round(process.memoryUsage().rss / 1e6), ledger: this.ledger.verify(), flows: this.ledger.flows().map((f) => ({ currency: f.currency, minted: f.minted.toString(), burned: f.burned.toString() })), arenaQueue: this.arenaQueue.length, matches: this.matches.size, listings: this.market.listings.filter((l) => l.status === 'active').length, version: GAME.version };
  }
  async grant(charId: string, what: string, qty: number, actor: string, reason: string) {
    const c = this.conns.get(charId); if (!c) throw new Error('Player must be online for grants in this version'); if (qty <= 0 || qty > 1_000_000) throw new Error('qty out of range');
    const before = { gold: c.svc.gold().toString(), items: c.svc.countItem(what) };
    if (ITEMS[what]) c.svc.addItem(what, Math.min(qty, 999), { source: 'gm_grant' }); else c.svc.earn(what as Currency, qty, 'gm_compensation', `gm:${Date.now()}:${charId}`);
    await this.persist([c], async (cl) => { await cl.query('INSERT INTO admin_audit_logs(actor,action,target,reason,before,after) VALUES ($1,$2,$3,$4,$5,$6)', [actor, `grant:${what}:${qty}`, charId, reason, JSON.stringify(before), JSON.stringify({ gold: c.svc.gold().toString(), items: c.svc.countItem(what) })]); });
    c.dirty = true; this.notice(c, `A Game Master granted you ${qty}× ${what}`);
  }
  broadcast(msg: string) { for (const c of this.conns.values()) this.notice(c, `[Announcement] ${msg}`); }
  async kick(charId: string, reason: string) { const c = this.conns.get(charId); if (!c) return false; this.notice(c, `Disconnected by GM: ${reason}`); c.ws.close(4003, reason); await this.leave(charId); return true; }
}
export { TILE };
