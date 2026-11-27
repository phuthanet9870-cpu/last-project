/**
 * Data-source adapters (§7 of delivery prompt). Both expose the same surface to the UI/renderer.
 *  - LocalAdapter: runs the shared game-core World + command dispatcher in the browser (artifact mode, SIMULATED other players/economy).
 *  - RemoteAdapter: sends intents to the authoritative game-server over WebSocket (online mode).
 */
import {
  DUNGEONS, Ledger, MAPS, MarketService, PlayerService, Rng, TILE, World, createCharacter, deserializePlayer, executeCommand, publicEntity, serializePlayer, viewFor, EVENTS, CONFIG, activeEventAt,
  type Appearance, type Fx, type PlayerState, type Result, type Session, type Currency,
} from '@hb/game-core';

export type PubEntity = ReturnType<typeof publicEntity>;
export interface Adapter {
  mode: 'local' | 'online'; p: PlayerState; mapId: string; myId: string; dev: boolean;
  send(cmd: string, args?: Record<string, any>): Promise<Result>; rankings(kind: string): Promise<{ rank: number; name: string; value: number; simulated?: boolean }[]>;
  tick(dtMs: number): void; entities(): PubEntity[]; drainFx(): Fx[]; bal(c: Currency): bigint;
  market(): any; tcg(): any; dungeonInfo(): any; bossInfo(): any; arenaInfo(): any; partyMembers(): PubEntity[];
  save(): boolean; onMapChange?: (mapId: string) => void; serverTime(): number; ping: number; activeEvent(): (typeof EVENTS)[number] | null;
}

const SAVE_KEY = 'hearthbound_save_v1';
export function safeStorage(): Storage | null { try { const s = window.localStorage; const k = '__hb_t'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; } }
export interface SaveSlot { id: string; name: string; classId: string; level: number; savedAt: number }
export function listSlots(): SaveSlot[] { try { return JSON.parse(safeStorage()?.getItem(`${SAVE_KEY}_slots`) ?? '[]'); } catch { return []; } }
function writeSlots(s: SaveSlot[]) { try { safeStorage()?.setItem(`${SAVE_KEY}_slots`, JSON.stringify(s)); } catch { /* storage unavailable */ } }
export function loadSlot(id: string): { player: PlayerState; market: any } | null { try { const raw = safeStorage()?.getItem(`${SAVE_KEY}_${id}`); if (!raw) return null; const o = JSON.parse(raw); return { player: deserializePlayer(o.player), market: o.market }; } catch { return null; } }
export function deleteSlot(id: string) { try { safeStorage()?.removeItem(`${SAVE_KEY}_${id}`); writeSlots(listSlots().filter((s) => s.id !== id)); } catch { /* */ } }
export function exportSaveString(p: PlayerState, market: any): string { return JSON.stringify({ format: 'hearthbound-save', version: 1, exportedAt: Date.now(), player: serializePlayer(p), market }); }
export function importSaveString(s: string): { player: PlayerState; market: any } { const o = JSON.parse(s); if (o.format !== 'hearthbound-save' || o.version !== 1) throw new Error('Not a Hearthbound save file'); return { player: deserializePlayer(o.player), market: o.market }; }

export class LocalAdapter implements Adapter {
  mode = 'local' as const; svc: PlayerService; marketSvc: MarketService; world!: World; worlds = new Map<string, World>(); session: Session = {}; dev: boolean; ping = 0;
  onMapChange?: (mapId: string) => void; private saveAcc = 0; private ledger: Ledger;
  constructor(player: PlayerState, marketSave: any, opts: { dev: boolean }) {
    this.dev = opts.dev; this.ledger = player.wallet; this.svc = new PlayerService(player, new Rng(Date.now() & 0xffffff));
    this.marketSvc = new MarketService(this.ledger, new Rng(Date.now() ^ 0x5bd1e995)); this.marketSvc.load(marketSave);
    this.marketSvc.onNewListing = (l) => { const w = this.svc.p.wishlist?.find((x) => x.defId === l.item.defId); if (w && Number(l.price) <= w.maxPrice && l.seller !== `p:${this.svc.p.id}`) this.world?.fx.push({ t: 'notice', msg: `Wishlist alert: ${l.item.defId.replace(/_/g, ' ')} listed at ${l.price}G (your limit ${w.maxPrice}G)`, to: this.myId }); };
    const map = MAPS[player.map] && !MAPS[player.map]!.instanced ? player.map : player.savedMap ?? 'emberglen';
    this.enter(map, MAPS[player.map]?.instanced ? undefined : { x: player.x, y: player.y });
    const off = this.svc.settleFarm(); if (off.minutes > 0) this.svc.note(`While you were away (${off.minutes} min) your farm pets gained ${off.exp} EXP each.`);
    this.svc.resetDailyIfNeeded(); const offA = this.svc.settleOfflineAuto(); if (offA.ok && offA.data!.minutes) this.svc.note(`Offline auto-play: ${offA.data!.minutes} min → +${offA.data!.exp} EXP, +${offA.data!.gold} Gold`);
  }
  get p() { return this.svc.p; } get mapId() { return this.world.mapId; } get myId() { return `pl_${this.svc.p.id}`; }
  visitView() { return this.world.mapId === 'pet_farm' ? this.session.visit ?? null : null; }
  activeEvent() { return activeEventAt(Date.now()); }
  async rankings(kind: string) { const r = await this.send('rankings', { kind }); return r.ok ? (r.data as any[]) : []; }
  private getWorld(mapId: string, fresh: boolean): World {
    const ev = this.activeEvent(); const em = { exp: ev?.expMult ?? 1, drop: ev?.dropMult ?? 1, gold: ev?.goldMult ?? 1 };
    if (fresh) return new World({ mapId, rng: new Rng(Date.now() & 0xffff), eventMult: em, worldBossIntervalMs: 4 * 60_000 });
    let w = this.worlds.get(mapId); if (!w) { const def = MAPS[mapId]!; w = new World({ mapId, rng: new Rng(def.seed * 97), bots: def.biome === 'town' ? 7 : def.safe || def.instanced ? 0 : def.biome === 'crater' ? 5 : 3, eventMult: em, worldBossIntervalMs: 4 * 60_000 }); this.worlds.set(mapId, w); }
    return w;
  }
  private enter(mapId: string, at?: { x: number; y: number }, opts: { dungeon?: string; arena?: string } = {}) {
    const def = MAPS[mapId]!; const prev = this.world; if (mapId !== 'pet_farm') this.session.visit = null;
    // party bots (simulated) follow the player across maps, including into dungeon instances; not into arenas
    let carried: any[] = []; let pid: string | null = null;
    if (prev && !opts.arena) { const me0 = prev.entities.get(this.myId); pid = me0?.partyId ?? null; if (pid) { carried = (prev.parties.get(pid) ?? []).map((id) => prev.entities.get(id)).filter((e): e is NonNullable<typeof e> => !!e && e.kind === 'bot'); for (const b of carried) prev.entities.delete(b.id); prev.parties.delete(pid); } }
    if (prev) { const e = prev.entities.get(this.myId); if (e && !MAPS[prev.mapId]!.instanced) this.session.prevMap = { map: prev.mapId, x: e.x, y: e.y }; prev.removePlayer(this.myId); }
    this.world = this.getWorld(mapId, def.instanced);
    const pos = at ?? { x: def.spawn[0] * TILE + 16, y: def.spawn[1] * TILE + 16 };
    this.svc.p.riding = this.svc.p.riding && (!def.instanced || def.biome === 'farm');
    const me = this.world.addPlayer(this.svc, pos);
    if (!def.instanced) this.svc.p.savedMap = mapId;
    if (pid && carried.length) { me.partyId = pid; carried.forEach((b, i) => { b.x = pos.x + 30 * (i + 1); b.y = pos.y + 10; b.path = undefined; b.targetId = null; b.dead = false; b.hp = b.maxHp; b.partyId = pid; this.world.entities.set(b.id, b); }); this.world.parties.set(pid, [me.id, ...carried.map((b) => b.id)]); }
    if (opts.dungeon && DUNGEONS[opts.dungeon]?.raid) { // artifact raid: fill the group to raidMax with SIMULATED allies (labelled ·sim); online raids are real players
      const p2 = me.partyId ?? `party_raid_${Date.now()}`; const list = this.world.parties.get(p2) ?? [me.id]; me.partyId = p2; this.world.raidParties.add(p2);
      while (list.length < CONFIG.raidMax) { const b = this.world.spawnBot(); b.level = this.svc.p.level; b.maxHp = b.hp = Math.floor(me.maxHp * (0.7 + Math.random() * 0.3)); b.x = pos.x + 24 * ((list.length % 4) - 2); b.y = pos.y - 20 * Math.floor(list.length / 4); b.partyId = p2; list.push(b.id); }
      this.world.parties.set(p2, list);
    }
    if (opts.dungeon) this.world.startDungeon(opts.dungeon, `run_${Date.now()}`, [me.id]);
    if (opts.arena) {
      const [size, type] = opts.arena.split(':'); const n = Number(size?.[0]) || 1; const lvl = this.svc.p.level; const mk = () => { const b = this.world.spawnBot(); b.level = lvl; b.maxHp = b.hp = Math.floor(me.maxHp * (0.8 + Math.random() * 0.3)); b.botProfile!.aggressive = true; return b.id; };
      const allies = Array.from({ length: n - 1 }, mk); const foes = Array.from({ length: n }, mk);
      this.world.startArena([me.id, ...allies], foes, 120_000, (type as any) ?? 'deathmatch'); this.session.arena = { mode: opts.arena, settled: false, prevMap: '', prevX: 0, prevY: 0 };
    }
    this.onMapChange?.(mapId);
  }
  ctx() {
    return { svc: this.svc, world: this.world, market: this.marketSvc, entityId: this.myId, session: this.session, mode: 'local' as const, dev: this.dev,
      changeMap: (m: string, x?: number, y?: number, o?: { dungeon?: string; arena?: string }): Result => { if (!MAPS[m]) return { ok: false, err: 'INVALID_MAP' }; this.enter(m, x !== undefined && y !== undefined ? { x, y } : undefined, o); return { ok: true }; },
      findPlayerByName: () => null };
  }
  async send(cmd: string, args: Record<string, any> = {}): Promise<Result> { const r = executeCommand(this.ctx(), cmd, args); return r; }
  sendSync(cmd: string, args: Record<string, any> = {}): Result { return executeCommand(this.ctx(), cmd, args); }
  tick(dt: number) {
    this.world.tick(dt); this.marketSvc.simulate(this.svc); this.svc.p.playtimeMs += dt;
    this.marketSvc.settleAuctions((acct, item) => { if (acct === `p:${this.svc.p.id}`) { if (this.svc.freeSlots() > 0) this.svc.p.inventory.push(item); else this.svc.sendMail('Auction House', 'Auction item', 'Delivered by mail.', [{ itemId: item.defId, qty: item.qty }]); } });
    this.saveAcc += dt; if (this.saveAcc > 15000) { this.saveAcc = 0; this.save(); }
  }
  entities() { return [...this.world.entities.values()].map(publicEntity); }
  drainFx() { return this.world.drainFx(); }
  bal(c: Currency) { return this.svc.bal(c); }
  market() { return this.marketSvc; }
  tcg() { return this.session.tcg ? { view: viewFor(this.session.tcg.state, 0), mode: this.session.tcg.mode, opp: this.session.tcg.oppName } : null; }
  dungeonInfo() { const d = this.world.dungeon; return d ? { ...d, name: DUNGEONS[d.dungeonId]!.name, waves: DUNGEONS[d.dungeonId]!.waves.length } : null; }
  bossInfo() { const b = this.world.boss; return { boss: b && !b.settled ? b : null, nextAt: this.world.nextBossAt, last: b }; }
  arenaInfo() { return this.world.arena ? { ...this.world.arena, settled: this.session.arena?.settled } : null; }
  partyMembers() { const me = this.world.entities.get(this.myId); if (!me?.partyId) return []; return (this.world.parties.get(me.partyId) ?? []).map((id) => this.world.entities.get(id)).filter(Boolean).map((e) => publicEntity(e!)); }
  serverTime() { return Date.now(); }
  save(): boolean {
    const st = safeStorage(); if (!st) return false; const e = this.world.entities.get(this.myId); if (e) this.world.persistVitals(e, this.svc); this.svc.touchActive();
    try { st.setItem(`${SAVE_KEY}_${this.svc.p.id}`, JSON.stringify({ player: serializePlayer(this.svc.p), market: this.marketSvc.serialize(), savedAt: Date.now() })); const slots = listSlots().filter((s) => s.id !== this.svc.p.id); slots.unshift({ id: this.svc.p.id, name: this.svc.p.name, classId: this.svc.p.classId, level: this.svc.p.level, savedAt: Date.now() }); writeSlots(slots); return true; } catch { return false; }
  }
  exportSave() { const e = this.world.entities.get(this.myId); if (e) this.world.persistVitals(e, this.svc); return exportSaveString(this.svc.p, this.marketSvc.serialize()); }
}
export function newLocalCharacter(name: string, classId: string, appearance: Appearance): PlayerState { return createCharacter({ accountId: 'local_guest', name, classId, appearance }); }

/** Online adapter: authoritative server; client only renders snapshots and sends intents. */
export class RemoteAdapter implements Adapter {
  mode = 'online' as const; dev = false; p!: PlayerState; mapId = 'emberglen'; myId = ''; ping = 0; private ws!: WebSocket; private pending = new Map<number, (r: Result) => void>(); private seq = 0;
  private ents: PubEntity[] = []; private entMap = new Map<string, any>(); private fx: Fx[] = []; private marketSnap: any = { listings: [], buyOrders: [], auctions: [], book: { bids: [], asks: [] }, priceHistory: {}, exchangeHistory: [] }; private tcgSnap: any = null; private extra: any = {};
  onMapChange?: (m: string) => void; private timeOffset = 0;
  static async connect(url: string, token: string, characterId: string): Promise<RemoteAdapter> {
    const a = new RemoteAdapter(); a.httpBase = url.replace(/^ws/, 'http').replace(/\/ws\/?$/, ''); await new Promise<void>((res, rej) => {
      a.ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}&character=${encodeURIComponent(characterId)}`);
      a.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); a.onMessage(m); if (m.type === 'welcome') res(); };
      a.ws.onerror = () => rej(new Error('WebSocket connection failed')); a.ws.onclose = () => a.fx.push({ t: 'notice', msg: 'Disconnected from server. Reload to reconnect.' });
    });
    setInterval(() => { const t = performance.now(); a.send('ping').then(() => { a.ping = Math.round(performance.now() - t); }); }, 3000);
    return a;
  }
  private onMessage(m: any) {
    if (m.type === 'welcome' || m.type === 'state') { const p = JSON.parse(m.player); p.wallet = Ledger.deserialize(p.wallet); this.p = p; if (m.myId) this.myId = m.myId; if (m.mapId && m.mapId !== this.mapId) { this.mapId = m.mapId; this.onMapChange?.(m.mapId); } if (m.serverTime) this.timeOffset = m.serverTime - Date.now(); }
    if (m.type === 'fx') this.fx.push(...m.fx);
    if (m.type === 'snap') { // delta snapshot: new entities arrive in full, changed ones carry only dynamic fields, rm lists departures
      if (m.full) this.entMap.clear();
      for (const u of m.upd ?? []) { const cur = this.entMap.get(u.id); if (cur) Object.assign(cur, u); else this.entMap.set(u.id, u); }
      for (const id of m.rm ?? []) this.entMap.delete(id);
      if (m.entities) for (const u of m.entities) this.entMap.set(u.id, u);
      this.ents = [...this.entMap.values()]; if (m.fx) this.fx.push(...m.fx); if (m.extra) this.extra = m.extra; if (m.mapId && m.mapId !== this.mapId) { this.mapId = m.mapId; this.onMapChange?.(m.mapId); } }
    if (m.type === 'market') this.marketSnap = reviveBig(m.market);
    if (m.type === 'tcg') this.tcgSnap = m.tcg;
    if (m.type === 'trade') { const t = m.trade; const mine = t.offer[this.p.id]; const other = Object.entries(t.offer as Record<string, any>).find(([k]) => k !== this.p.id)?.[1]; this.fx.push({ t: 'notice', msg: `Trade: you offer ${mine?.items.length ?? 0} item(s) + ${String(mine?.gold ?? 0).replace('n', '')}G · partner offers ${other?.items.length ?? 0} item(s) + ${String(other?.gold ?? 0).replace('n', '')}G · locked ${Object.keys(t.lock).length}/2 · confirmed ${Object.keys(t.confirm).length}/2` }); }
    if (m.type === 'res') { this.pending.get(m.id)?.(m.result); this.pending.delete(m.id); }
  }
  send(cmd: string, args: Record<string, any> = {}): Promise<Result> {
    const id = ++this.seq; return new Promise((res) => { this.pending.set(id, res); try { this.ws.send(JSON.stringify({ type: 'cmd', v: 1, id, cmd, args })); } catch { res({ ok: false, err: 'DISCONNECTED' }); } setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); res({ ok: false, err: 'TIMEOUT' }); } }, 8000); });
  }
  tick() { /* server simulates */ }
  entities() { return this.ents; } drainFx() { const f = this.fx; this.fx = []; return f; }
  bal(c: Currency) { return this.p.wallet.available(`p:${this.p.id}`, c); }
  market() { return this.marketSnap; } tcg() { return this.tcgSnap; }
  dungeonInfo() { return this.extra.dungeon ?? null; } bossInfo() { return this.extra.boss ?? { boss: null, nextAt: 0 }; } arenaInfo() { return this.extra.arena ?? null; }
  visitView() { return this.mapId === 'pet_farm' ? this.extra.visit ?? null : null; }
  partyMembers() { const ids: string[] = this.extra.party ?? []; return this.ents.filter((e) => ids.includes(e.id)); }
  save() { return true; } serverTime() { return Date.now() + this.timeOffset; } activeEvent() { return activeEventAt(this.serverTime()); }
  private httpBase = '';
  async rankings(kind: string) { try { const r = await fetch(`${this.httpBase}/api/rankings/${encodeURIComponent(kind)}`); if (!r.ok) return []; const j = await r.json(); return (j.rows ?? []).map((x: any) => ({ rank: x.rank, name: x.name, value: x.value })); } catch { return []; } }
}
export function reviveBig(v: any): any { if (typeof v === 'string' && /^-?\d+n$/.test(v)) return BigInt(v.slice(0, -1)); if (Array.isArray(v)) return v.map(reviveBig); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reviveBig(x)])); return v; }
export { CONFIG };
