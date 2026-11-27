/**
 * Authoritative world simulation (§11–13, §17, §28–31). One World per map instance.
 * Used by the game-server (real players over WebSocket) and by the artifact LocalAdapter (local simulation).
 * Clients only send intents (move vector, target, skill id); this class decides outcomes.
 */
import { CONFIG, type Element } from './config.js';
import { ALL_SKILLS, CLASSES, type SkillDef } from './classes.js';
import { computeHit, computeHeal } from './combat.js';
import { DUNGEONS, MAPS, MONSTERS, NPCS, PETS, WORLD_BOSS_ROTATION } from './content.js';
import { ITEMS } from './items.js';
import { absorbShield, applyStatus, cleanse, hasCC, slowPct, statusModifiers, tickStatuses, STATUSES, type ActiveEffect } from './effects.js';
import { findPath, getMap, isSolidPx, TILE, type GenMap } from './mapgen.js';
import { playerStats, weaponElement, type PlayerService } from './player.js';
import { Rng } from './rng.js';
import type { CombatStats } from './stats.js';
import { zeroDerived } from './stats.js';

export type EntityKind = 'player' | 'monster' | 'npc' | 'pet' | 'loot' | 'bot' | 'summon' | 'projectile';
export interface Entity {
  id: string; kind: EntityKind; x: number; y: number; dir: number; moving: boolean; name: string; level: number;
  hp: number; maxHp: number; mp: number; maxMp: number; effects: ActiveEffect[]; dead: boolean; deadAt: number;
  defId?: string; ownerId?: string; targetId?: string | null; classId?: string; appearance?: any; guild?: string; title?: string | null;
  // AI
  ai?: { state: 'idle' | 'patrol' | 'chase' | 'attack' | 'return' | 'dead'; homeX: number; homeY: number; nextAct: number; threat: Record<string, number>; patrolX?: number; patrolY?: number; skillCd: Record<string, number>; phase: number; telegraph?: { id: string; x: number; y: number; r: number; at: number; power: number; status?: string; element?: Element } };
  // movement
  input?: { dx: number; dy: number }; path?: [number, number][]; speedMult?: number;
  cds: Record<string, number>; gcdUntil: number; castUntil: number; attackAt: number; gauge: number;
  loot?: { itemId: string; qty: number; owner: string; until: number }[]; expiresAt?: number; riding?: boolean; mount?: string | null;
  pvp?: boolean; team?: number; botProfile?: { classId: string; chatAt: number; wanderAt: number; aggressive: boolean }; summonAtk?: number; partyId?: string | null; contrib?: Record<string, number>;
  hidden?: boolean; fixed?: boolean; cosm?: number;
  proj?: { src: string; targetId: string | null; tx: number; ty: number; speed: number; homing: boolean; hitR: number; onHit: (v: Entity) => void };
}
export type Fx =
  | { t: 'dmg'; x: number; y: number; v: number; crit: boolean; miss?: boolean; heal?: boolean; tgt: string; src?: string; el?: Element | null }
  | { t: 'skill'; vfx: string; src: string; x: number; y: number; tx: number; ty: number; r: number; el: Element | null; color: string }
  | { t: 'death'; id: string; x: number; y: number }
  | { t: 'level'; id: string; level: number }
  | { t: 'telegraph'; id: string; x: number; y: number; r: number; ms: number }
  | { t: 'chat'; ch: string; from: string; msg: string; x?: number; y?: number }
  | { t: 'notice'; msg: string; to?: string }
  | { t: 'status'; id: string; s: string };

export type ArenaMode = 'deathmatch' | 'siege' | 'rush';
export interface ArenaState {
  mode: ArenaMode; teams: [string[], string[]]; endsAt: number; done: boolean; winner?: number; score: [number, number]; target: number;
  points: { x: number; y: number; owner: -1 | 0 | 1; progress: number }[]; crystals: { id: number; x: number; y: number }[]; carriers: string[];
  stats: Record<string, { k: number; d: number; h: number; o: number }>; mvp?: string; nextCrystal: number;
}
export interface DungeonRun { runId: string; bossEntity?: string; dungeonId: string; state: 'created' | 'waiting' | 'active' | 'encounter' | 'completed' | 'failed' | 'settled' | 'closed'; wave: number; startedAt: number; endsAt: number; participants: string[] }
export interface BossSession { id: string; bossId: string; entityId: string; startedAt: number; contributions: Record<string, { dmg: number; heal: number; tank: number }>; settled: boolean }

const ELEMENT_COLOR: Record<Element, string> = { neutral: '#ffffff', fire: '#ff7a30', water: '#4aa8ff', earth: '#c0a060', wind: '#a0ffb0', ice: '#a0f0ff', light: '#fff0a0', dark: '#b070ff', spirit: '#70ffe0' };
export interface WorldOptions { mapId: string; instanceId?: string; rng?: Rng; now?: () => number; bots?: number; worldBossIntervalMs?: number; eventMult?: { exp: number; drop: number; gold?: number } }

let ENT = 0;
const eid = (p: string) => `${p}${(++ENT).toString(36)}`;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const BOT_NAMES = ['Lumi', 'Brakken', 'Sorrel', 'Tamsin', 'Quillon', 'Mira', 'Oaken', 'Faye', 'Rook', 'Juniper', 'Pell', 'Vesper', 'Kiko', 'Bramble', 'Nyx', 'Odessa'];
const BOT_LINES = ['Anyone up for Mossy Hollow?', 'LF party for slimes~', 'Selling Slime Gel, cheap!', 'The world boss spawns soon!', 'Just hit +7 on my sword :D', 'Has anyone seen a Gilded Slime?', 'Hearthcards duel anyone?', 'This forest is so cozy', 'Need 2 more Wolf Fangs…', 'gg'];

export class World {
  map: GenMap; mapId: string; instanceId: string; entities = new Map<string, Entity>(); services = new Map<string, PlayerService>();
  fx: Fx[] = []; rng: Rng; now: () => number; nodesDepleted = new Map<string, number>(); dungeon: DungeonRun | null = null; boss: BossSession | null = null;
  nextBossAt = 0; parties = new Map<string, string[]>(); eventMult: { exp: number; drop: number; gold?: number }; arena: ArenaState | null = null;
  private lastTick = 0; private opts: WorldOptions;

  constructor(opts: WorldOptions) {
    this.opts = opts; this.mapId = opts.mapId; this.instanceId = opts.instanceId ?? opts.mapId; this.map = getMap(opts.mapId);
    this.rng = opts.rng ?? new Rng(); this.now = opts.now ?? Date.now; this.eventMult = opts.eventMult ?? { exp: 1, drop: 1 };
    const def = MAPS[opts.mapId]!;
    for (const m of def.monsters) for (let i = 0; i < m.count; i++) { if (m.at) { const [fx, fy] = this.freeNear(m.at[0], m.at[1]); this.spawnMonster(m.id, fx * TILE + 16, fy * TILE + 16, { fixed: true }); } else this.spawnMonster(m.id); }
    for (const n of Object.values(NPCS)) if (n.map === opts.mapId) this.entities.set(`npc_${n.id}`, this.baseEntity(`npc_${n.id}`, 'npc', n.x * TILE + 16, n.y * TILE + 16, n.name.en, 1, { defId: n.id }));
    for (let i = 0; i < (opts.bots ?? 0); i++) this.spawnBot();
    if (def.biome === 'crater') this.nextBossAt = this.now() + 15_000;
  }
  private baseEntity(id: string, kind: EntityKind, x: number, y: number, name: string, level: number, extra: Partial<Entity> = {}): Entity {
    return { id, kind, x, y, dir: 2, moving: false, name, level, hp: 1, maxHp: 1, mp: 0, maxMp: 0, effects: [], dead: false, deadAt: 0, cds: {}, gcdUntil: 0, castUntil: 0, attackAt: 0, gauge: 0, ...extra };
  }
  freeNear(tx: number, ty: number): [number, number] { for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = tx + dx, y = ty + dy; if (x > 0 && y > 0 && x < this.map.w - 1 && y < this.map.h - 1 && !this.map.solid[y * this.map.w + x]) return [x, y]; } return this.map.def.spawn; }
  randomFreePoint(): [number, number] { const p = this.rng.pick(this.map.spawnAreas.length ? this.map.spawnAreas : [this.map.def.spawn]); return [p[0] * TILE + 16 + this.rng.int(-8, 8), p[1] * TILE + 16 + this.rng.int(-8, 8)]; }
  spawnMonster(defId: string, x?: number, y?: number, extra: Partial<Entity> = {}): Entity {
    const d = MONSTERS[defId]!; const [px, py] = x !== undefined && y !== undefined ? [x, y] : this.randomFreePoint();
    const e = this.baseEntity(eid('m'), 'monster', px, py, d.name.en, d.level, { defId, hp: d.maxHp, maxHp: d.maxHp, ai: { state: 'idle', homeX: px, homeY: py, nextAct: this.now() + this.rng.int(500, 3000), threat: {}, skillCd: {}, phase: 0 }, contrib: {}, ...extra });
    this.entities.set(e.id, e); return e;
  }
  spawnBot(classId?: string): Entity {
    const cls = classId ?? this.rng.pick(Object.keys(CLASSES)); const [x, y] = this.randomFreePoint(); const lvl = this.rng.int(Math.max(1, MAPS[this.mapId]!.levelReq), MAPS[this.mapId]!.levelReq + 12);
    const hp = 100 + lvl * 25 + 8 * 18 + lvl * 12;
    const e = this.baseEntity(eid('b'), 'bot', x, y, `${this.rng.pick(BOT_NAMES)}${this.rng.int(1, 99)}`, lvl, { classId: cls, hp, maxHp: hp, mp: 100, maxMp: 100, appearance: { body: this.rng.int(0, 1), hair: this.rng.int(0, 3), hairColor: this.rng.pick(['#2a1a0a', '#e0c060', '#a03020', '#f0f0f0', '#4060c0']), skin: this.rng.pick(['#f0c8a0', '#d8a070', '#a06840', '#ffe0c0']), eyes: '#202040' }, botProfile: { classId: cls, chatAt: this.now() + this.rng.int(8000, 40000), wanderAt: 0, aggressive: this.rng.chance(0.7) }, ai: { state: 'idle', homeX: x, homeY: y, nextAct: 0, threat: {}, skillCd: {}, phase: 0 } });
    this.entities.set(e.id, e); return e;
  }

  // ---------------- players ----------------
  addPlayer(svc: PlayerService, at?: { x: number; y: number }): Entity {
    const p = svc.p; const st = playerStats(p).derived;
    let x = at?.x ?? p.x, y = at?.y ?? p.y;
    if (isSolidPx(this.map, x, y)) { x = this.map.def.spawn[0] * TILE + 16; y = this.map.def.spawn[1] * TILE + 16; }
    const e = this.baseEntity(`pl_${p.id}`, 'player', x, y, p.name, p.level, { classId: p.classId, appearance: p.appearance, hp: Math.max(1, Math.min(p.hp, st.maxHp)), maxHp: st.maxHp, mp: Math.min(p.mp, st.maxMp), maxMp: st.maxMp, input: { dx: 0, dy: 0 }, title: p.title, riding: p.riding, mount: p.activeMount, gauge: p.gauge, guild: p.guild?.name });
    this.entities.set(e.id, e); this.services.set(e.id, svc); p.map = this.mapId; svc.visitMap(this.mapId);
    this.syncPet(e.id); return e;
  }
  removePlayer(entityId: string) { const svc = this.services.get(entityId); const e = this.entities.get(entityId); if (svc && e) this.persistVitals(e, svc); this.services.delete(entityId); this.entities.delete(entityId); for (const x of [...this.entities.values()]) if ((x.kind === 'pet' || x.kind === 'summon') && x.ownerId === entityId) this.entities.delete(x.id); }
  persistVitals(e: Entity, svc: PlayerService) { svc.p.hp = Math.max(1, Math.floor(e.hp)); svc.p.mp = Math.floor(e.mp); svc.p.x = Math.floor(e.x); svc.p.y = Math.floor(e.y); svc.p.gauge = e.gauge; }
  syncPet(entityId: string) {
    const e = this.entities.get(entityId); const svc = this.services.get(entityId); if (!e || !svc) return;
    for (const x of [...this.entities.values()]) if (x.kind === 'pet' && x.ownerId === entityId) this.entities.delete(x.id);
    const pet = svc.p.pets.find((p) => p.uid === svc.p.activePet); if (!pet) return;
    const s = svc.petStats(pet); const sp = PETS[pet.species]!;
    this.entities.set(`pet_${entityId}`, this.baseEntity(`pet_${entityId}`, 'pet', e.x - 20, e.y + 10, pet.name, pet.level, { ownerId: entityId, defId: pet.species, hp: s.hp, maxHp: s.hp, summonAtk: s.atk, speedMult: s.cdMult, appearance: { color: sp.color, sprite: sp.sprite } }));
  }
  /** Cached derived stats for movement/regen (not used for damage); refreshed on refreshPlayer or after 500ms. */
  private stCache = new Map<string, { at: number; d: ReturnType<typeof playerStats>['derived'] }>();
  cachedDerived(e: Entity) { const now = this.now(); const c = this.stCache.get(e.id); if (c && now - c.at < 500) return c.d; const d = playerStats(this.services.get(e.id)!.p, statusModifiers(e.effects)).derived; this.stCache.set(e.id, { at: now, d }); return d; }
  refreshPlayer(entityId: string) {
    this.stCache.delete(entityId);
    const e = this.entities.get(entityId); const svc = this.services.get(entityId); if (!e || !svc) return;
    e.cosm = Math.max(svc.p.equipment.costume?.cosmetic ?? 0, svc.p.equipment.wings?.cosmetic ?? 0);
    const st = playerStats(svc.p, statusModifiers(e.effects)).derived; e.maxHp = st.maxHp; e.maxMp = st.maxMp; e.hp = Math.min(e.hp, e.maxHp); e.mp = Math.min(e.mp, e.maxMp); e.level = svc.p.level; e.title = svc.p.title; e.riding = svc.p.riding; e.mount = svc.p.activeMount; e.classId = svc.p.classId; e.guild = svc.p.guild?.name;
  }
  setInput(entityId: string, dx: number, dy: number) { const e = this.entities.get(entityId); if (!e || !e.input) return; const l = Math.hypot(dx, dy); e.input.dx = l > 0 ? dx / l : 0; e.input.dy = l > 0 ? dy / l : 0; if (l > 0) e.path = undefined; }
  moveTo(entityId: string, px: number, py: number): boolean { const e = this.entities.get(entityId); if (!e) return false; const p = findPath(this.map, Math.floor(e.x / TILE), Math.floor(e.y / TILE), Math.floor(px / TILE), Math.floor(py / TILE)); if (!p) return false; e.path = p; return true; }

  combatStats(e: Entity): CombatStats {
    if (e.kind === 'player') { const svc = this.services.get(e.id)!; const d = playerStats(svc.p, statusModifiers(e.effects)).derived; return { ...d, level: svc.p.level, element: weaponElement(svc.p), armorElement: 'neutral' }; }
    const d = zeroDerived(); const mods = statusModifiers(e.effects);
    const apply = (k: keyof typeof d, base: number) => { let v = base; for (const m of mods) if (m.stat === k) v = m.kind === 'flat' ? v + m.value : m.kind === 'pct' ? v * (1 + m.value / 100) : v * m.value; d[k] = v; };
    if (e.kind === 'monster') {
      const m = MONSTERS[e.defId!]!; const enr = m.phases?.slice(0, e.ai!.phase).reduce((s, p) => s * p.enrage, 1) ?? 1;
      apply('atk', m.atk * enr); apply('matk', m.atk * enr); apply('def', m.def); apply('mdef', m.mdef); apply('acc', 100 + m.level * 3); apply('eva', m.level * 1.5); apply('crit', 3); apply('maxHp', m.maxHp); apply('moveSpeed', m.moveSpeed);
      return { ...d, level: m.level, element: m.element, armorElement: m.element };
    }
    const L = e.level; const atk = e.kind === 'bot' ? 20 + L * 6 : (e.summonAtk ?? 10);
    apply('atk', atk); apply('matk', atk); apply('def', 5 + L * 2); apply('mdef', 5 + L * 1.5); apply('acc', 100 + L * 3); apply('eva', L * 2); apply('crit', 8); apply('maxHp', e.maxHp); apply('healPower', L * 2); apply('moveSpeed', 120);
    const el = e.kind === 'pet' ? PETS[e.defId!]?.element ?? 'neutral' : e.classId ? CLASSES[e.classId]!.element : 'neutral';
    return { ...d, level: L, element: el, armorElement: 'neutral' };
  }
  hostile(a: Entity, b: Entity): boolean {
    if (a.id === b.id || b.dead || b.kind === 'npc' || b.kind === 'loot' || b.kind === 'projectile') return false;
    const aSide = a.kind === 'monster' ? 'm' : 'p', bSide = b.kind === 'monster' ? 'm' : 'p';
    if (aSide !== bSide) return !b.effects.some((x) => STATUSES[x.id]?.stealth) || a.kind !== 'monster';
    // player-vs-player: arena teams, or both flagged in a PvP map
    if (this.arena) { const ta = this.teamOf(a), tb = this.teamOf(b); return ta !== -1 && tb !== -1 && ta !== tb; }
    const owner = (x: Entity) => (x.ownerId ? this.entities.get(x.ownerId) ?? x : x);
    const oa = owner(a), ob = owner(b); if (oa.id === ob.id) return false;
    if (oa.partyId && oa.partyId === ob.partyId) return false;
    return !!(MAPS[this.mapId]!.pvp && oa.pvp && ob.pvp);
  }
  teamOf(e: Entity): number { const id = e.ownerId ?? e.id; if (!this.arena) return -1; return this.arena.teams[0].includes(id) ? 0 : this.arena.teams[1].includes(id) ? 1 : -1; }

  // ---------------- actions ----------------
  basicAttack(attackerId: string, targetId: string): string | null {
    const a = this.entities.get(attackerId); const t = this.entities.get(targetId);
    if (!a || !t || a.dead) return 'INVALID'; if (!this.hostile(a, t)) return 'NOT_HOSTILE';
    if (hasCC(a.effects, 'stun', 'freeze', 'sleep', 'disarm')) return 'CROWD_CONTROLLED';
    const now = this.now(); const st = this.combatStats(a);
    const ranged = a.kind === 'player' || a.kind === 'bot' ? ['bow', 'staff', 'tome', 'gun', 'lute', 'cards'].includes(this.weaponOf(a)) : false;
    const range = ranged ? 280 : 64;
    if (dist(a, t) > range + 16) return 'OUT_OF_RANGE';
    if (now < a.attackAt) return 'COOLDOWN';
    a.attackAt = now + Math.floor(1100 / st.aspd); a.targetId = t.id; this.face(a, t);
    const mag = ['staff', 'tome', 'lute'].includes(this.weaponOf(a));
    const resolve = (v: Entity) => {
      const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(v), power: 1, dmgType: mag ? 'mag' : 'phys', element: null, pvp: this.isPvp(a, v) });
      this.dealDamage(a, v, h.damage, h.crit, h.miss, st.element);
      if (!h.miss) { a.gauge = Math.min(100, a.gauge + (a.classId ? CLASSES[a.classId]!.gauge.perHit : 0)); if (st.lifesteal > 0) this.heal(a, a, Math.floor(h.damage * st.lifesteal / 100)); }
    };
    if (ranged && dist(a, t) > 70) { this.spawnProjectile(a, t, { homing: true, speed: mag ? 460 : 560, color: ELEMENT_COLOR[st.element], kind: mag ? 'bolt' : 'arrow', onHit: resolve }); return null; }
    this.fx.push({ t: 'skill', vfx: 'slash', src: a.id, x: a.x, y: a.y, tx: t.x, ty: t.y, r: 0, el: st.element, color: ELEMENT_COLOR[st.element] });
    resolve(t);
    return null;
  }
  weaponOf(e: Entity): string { if (e.kind === 'player') { const svc = this.services.get(e.id)!; const it = svc.p.equipment.main; return it ? (/_([a-z]+)$/.exec(it.defId)?.[1] ?? 'sword') : 'knuckle'; } return e.classId ? CLASSES[e.classId]!.weapons[0]! : 'sword'; }
  isPvp(a: Entity, b: Entity) { const k = (x: Entity) => x.kind === 'player' || x.kind === 'bot' || x.kind === 'pet' || x.kind === 'summon'; return k(a) && k(b); }
  face(a: Entity, t: { x: number; y: number }) { const ang = Math.atan2(t.y - a.y, t.x - a.x); a.dir = (Math.round(ang / (Math.PI / 4)) + 8 + 2) % 8; }

  castSkill(casterId: string, skillId: string, targetId?: string | null, point?: { x: number; y: number }): string | null {
    const a = this.entities.get(casterId); if (!a || a.dead) return 'INVALID';
    const svc = this.services.get(casterId);
    const s: (SkillDef & { rank: number }) | null = svc ? svc.effectiveSkill(skillId) : ALL_SKILLS[skillId] ? { ...ALL_SKILLS[skillId]!, rank: 1 } : null;
    if (!s) return 'SKILL_NOT_LEARNED'; if (s.type === 'passive') return 'PASSIVE';
    if (hasCC(a.effects, 'stun', 'freeze', 'sleep', 'silence', 'fear')) return 'CROWD_CONTROLLED';
    const now = this.now(); if ((a.cds[skillId] ?? 0) > now) return 'COOLDOWN'; if (a.gcdUntil > now) return 'GLOBAL_COOLDOWN';
    if (a.mp < s.mp && a.kind === 'player') return 'NOT_ENOUGH_MP';
    const st = this.combatStats(a);
    let target = targetId ? this.entities.get(targetId) : undefined;
    const needsEnemy = s.target === 'enemy' || s.target === 'line' || s.target === 'cone';
    if (needsEnemy && (!target || !this.hostile(a, target))) { target = this.nearestHostile(a, Math.max(s.range, 80) + 40); if (!target) return 'NO_TARGET'; }
    if (s.target === 'aoe_target' && !point) { const t = target && this.hostile(a, target) ? target : this.nearestHostile(a, s.range + 40); if (!t) return 'NO_TARGET'; point = { x: t.x, y: t.y }; target = t; }
    const aim = point ?? target ?? a;
    if (s.range > 0 && dist(a, aim) > s.range + 24) return 'OUT_OF_RANGE';
    // commit cost and cooldown once
    a.mp -= s.mp; a.cds[skillId] = now + Math.floor(s.cdMs * (1 - Math.min(40, st.cdr) / 100)); a.gcdUntil = now + CONFIG.globalCooldownMs;
    if (aim !== a) this.face(a, aim);
    let mult = 1;
    if (a.gauge >= 100) { a.gauge = 0; mult = 1.5; if (a.classId === 'vanguard') applyStatus(a.effects, 'shield', a.id, 8000, 0, 0, Math.floor(a.maxHp * 0.2)); if (a.classId === 'chrono_adept') { const k = Object.keys(a.cds).find((x) => x !== skillId && a.cds[x]! > now); if (k) a.cds[k] = now; } }
    if (a.classId === 'fortune_dealer') mult *= 0.5 + this.rng.next() * 2;
    if (a.classId === 'void_scholar' && s.dmgType === 'mag') { a.hp = Math.max(1, a.hp - Math.floor(a.maxHp * 0.03)); mult *= 1.2; }
    a.gauge = Math.min(100, a.gauge + 10);
    const color = ELEMENT_COLOR[s.element ?? st.element];
    this.fx.push({ t: 'skill', vfx: s.vfx, src: a.id, x: a.x, y: a.y, tx: aim.x, ty: aim.y, r: s.radius, el: s.element ?? st.element, color });
    if (s.dash && target) { const ang = Math.atan2(target.y - a.y, target.x - a.x); const d0 = Math.max(0, dist(a, target) - 36); for (let i = d0; i > 0; i -= 8) { const nx = a.x + Math.cos(ang) * i, ny = a.y + Math.sin(ang) * i; if (!isSolidPx(this.map, nx, ny)) { a.x = nx; a.y = ny; break; } } }
    // targets
    let victims: Entity[] = []; const allies: Entity[] = [];
    const center = s.target === 'aoe_self' ? a : s.target === 'aoe_target' ? point! : target ?? a;
    if (s.target === 'enemy' && target) victims = [target];
    else if (s.target === 'aoe_self' || s.target === 'aoe_target') victims = this.hostilesIn(a, center, s.radius);
    else if (s.target === 'line' && target) { const ang = Math.atan2(target.y - a.y, target.x - a.x); victims = this.hostilesIn(a, a, s.range).filter((v) => { const dx = v.x - a.x, dy = v.y - a.y; const along = dx * Math.cos(ang) + dy * Math.sin(ang); const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang)); return along > 0 && perp < s.radius + 12; }); }
    else if (s.target === 'cone' && target) { const ang = Math.atan2(target.y - a.y, target.x - a.x); victims = this.hostilesIn(a, a, s.range + 20).filter((v) => { let da = Math.atan2(v.y - a.y, v.x - a.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < Math.PI / 3; }); }
    if (s.target === 'party' || s.target === 'self') { allies.push(a); if (s.target === 'party') for (const x of this.entities.values()) if (x !== a && !x.dead && (x.kind === 'player' || x.kind === 'bot' || x.kind === 'pet') && !this.hostile(a, x) && dist(a, x) <= Math.max(s.radius, 200) && (x.kind !== 'bot' || a.kind === 'bot' || x.partyId === a.partyId)) allies.push(x); }
    if (s.dmgType === 'phys' || s.dmgType === 'mag' || s.dmgType === 'pure') {
      const defenders = victims.slice(0, 12);
      if (s.chain && target) { let last = target; const hit = new Set([target.id]); for (let i = 0; i < s.chain; i++) { const n = this.hostilesIn(a, last, 160).find((v) => !hit.has(v.id)); if (!n) break; hit.add(n.id); defenders.push(n); this.fx.push({ t: 'skill', vfx: 'chain', src: last.id, x: last.x, y: last.y, tx: n.x, ty: n.y, r: 0, el: s.element, color }); last = n; } }
      const applyTo = (v: Entity, idx: number) => {
        if (v.dead) return;
        for (let k = 0; k < s.hits; k++) {
          const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(v), power: s.power * mult * (idx > 0 && s.chain ? 0.7 : 1), dmgType: s.dmgType as any, element: s.element, pvp: this.isPvp(a, v), canMiss: s.dmgType === 'phys' });
          this.dealDamage(a, v, h.damage, h.crit, h.miss, s.element ?? st.element);
          if (!h.miss && s.lifesteal) this.heal(a, a, Math.floor(h.damage * s.lifesteal));
        }
        for (const fx of s.effects) if (!fx.self && !fx.party && !v.dead && this.rng.chance(fx.c ?? 1)) { applyStatus(v.effects, fx.s, a.id, fx.d, Math.floor((st.atk + st.matk) * s.power * 0.5), this.combatStats(v).ccResist); this.fx.push({ t: 'status', id: v.id, s: fx.s }); if (fx.s === 'taunt' && v.ai) { v.ai.threat[a.id] = (v.ai.threat[a.id] ?? 0) + 5000; v.targetId = a.id; } }
        if (s.knockback && !v.dead) { this.knockback(v, a.x, a.y, s.knockback); if (s.knockdown && !this.ccImmune(v)) applyStatus(v.effects, 'knockdown', a.id, 1200, 0, this.combatStats(v).ccResist); }
      };
      const projectile = s.target === 'enemy' && ['arrow', 'bolt', 'drain'].includes(s.vfx) && target && dist(a, target) > 70 && !s.chain;
      if (projectile) this.spawnProjectile(a, target!, { homing: true, speed: 520, color, kind: s.vfx, onHit: (v) => applyTo(v, 0) });
      else defenders.forEach((v, idx) => applyTo(v, idx));
    }
    if (s.dmgType === 'heal') for (const t of allies) { const h = computeHeal(this.rng, st, s.power * mult, t.maxHp - t.hp); this.heal(a, t, h.amount, h.crit); if (s.cleanse) cleanse(t.effects, 'debuff'); }
    for (const fx of s.effects) {
      if (fx.self) applyStatus(a.effects, fx.s, a.id, fx.d, Math.floor(st.matk + st.healPower), 0, s.shieldPct ? Math.floor(a.maxHp * s.shieldPct) : 0);
      if (fx.party) for (const t of allies) applyStatus(t.effects, fx.s, a.id, fx.d, Math.floor(st.matk + st.healPower), 0, s.shieldPct ? Math.floor(t.maxHp * s.shieldPct) : 0);
    }
    if (s.cleanse && s.dmgType !== 'heal') for (const t of allies) cleanse(t.effects, 'debuff');
    if (s.summon) { const id = eid('s'); this.entities.set(id, this.baseEntity(id, 'summon', a.x + 24, a.y, `${s.element ?? 'spirit'} spirit`, a.level, { ownerId: a.id, hp: Math.floor(a.maxHp * 0.4), maxHp: Math.floor(a.maxHp * 0.4), summonAtk: Math.floor((st.atk + st.matk) * 0.35), expiresAt: now + 20000, appearance: { color: color, sprite: 'wisp' } })); }
    if (a.kind === 'player') this.refreshPlayer(a.id);
    return null;
  }
  /** Projectiles (§12): travel at `speed` px/s. Homing ones resolve on the target when they arrive; non-homing ones fly to the aimed point and only hit if the target is still within hitR (dodgeable). */
  spawnProjectile(src: Entity, t: Entity, o: { homing: boolean; speed: number; color: string; kind: string; onHit: (v: Entity) => void }) {
    const id = eid('p'); const e = this.baseEntity(id, 'projectile', src.x, src.y - 6, o.kind, 0, { ownerId: src.id, appearance: { color: o.color, kind: o.kind }, expiresAt: this.now() + 4000, proj: { src: src.id, targetId: t.id, tx: t.x, ty: t.y, speed: o.speed, homing: o.homing, hitR: 26, onHit: o.onHit } });
    this.face(e, t); this.entities.set(id, e); return e;
  }
  private moveProjectile(p: Entity, dt: number) {
    const pr = p.proj!; const tgt = pr.targetId ? this.entities.get(pr.targetId) : undefined;
    if (pr.homing && tgt && !tgt.dead) { pr.tx = tgt.x; pr.ty = tgt.y - 6; }
    const dx = pr.tx - p.x, dy = pr.ty - p.y, d = Math.hypot(dx, dy), stepLen = pr.speed * dt;
    if (d <= stepLen) {
      this.entities.delete(p.id); const src = this.entities.get(pr.src);
      if (!src || src.dead || !tgt || tgt.dead) return;
      if (pr.homing || Math.hypot(tgt.x - pr.tx, tgt.y - 6 - pr.ty) <= pr.hitR) pr.onHit(tgt); else this.fx.push({ t: 'dmg', x: tgt.x, y: tgt.y - 20, v: 0, crit: false, miss: true, tgt: tgt.id, src: src.id });
      return;
    }
    p.x += (dx / d) * stepLen; p.y += (dy / d) * stepLen; p.moving = true; this.face(p, { x: pr.tx, y: pr.ty });
  }
  ccImmune(v: Entity) { const r = v.kind === 'monster' ? MONSTERS[v.defId!]!.rank : ''; return r === 'boss' || r === 'world_boss'; }
  /** Knockback (§12): pushes away from (fx,fy) in small collision-checked steps; bosses are immune, CC resist shortens it. */
  knockback(v: Entity, fx: number, fy: number, distPx: number) {
    if (this.ccImmune(v) || v.dead || distPx <= 0) return;
    const resist = v.kind === 'player' || v.kind === 'bot' ? Math.min(70, this.combatStats(v).ccResist) / 100 : 0;
    let len = distPx * (1 - resist); let ax = v.x - fx, ay = v.y - fy; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; if (l < 1) { ax = 1; ay = 0; }
    const r = 9; const blocked = (x: number, y: number) => isSolidPx(this.map, x - r, y - 4) || isSolidPx(this.map, x + r, y - 4) || isSolidPx(this.map, x - r, y + 8) || isSolidPx(this.map, x + r, y + 8);
    while (len > 0) { const st = Math.min(4, len); const nx = v.x + ax * st, ny = v.y + ay * st; if (blocked(nx, ny)) break; v.x = nx; v.y = ny; len -= st; }
    v.path = undefined; this.fx.push({ t: 'status', id: v.id, s: 'knockback' });
  }
  nearestHostile(a: Entity, range: number): Entity | undefined { let best: Entity | undefined; let bd = range; for (const e of this.entities.values()) { if (!this.hostile(a, e)) continue; const d = dist(a, e); if (d < bd) { bd = d; best = e; } } return best; }
  hostilesIn(a: Entity, c: { x: number; y: number }, r: number): Entity[] { const out: Entity[] = []; for (const e of this.entities.values()) if (this.hostile(a, e) && dist(c, e) <= r + 12) out.push(e); return out; }

  heal(src: Entity, t: Entity, amount: number, crit = false) { if (amount <= 0 || t.dead) return; const real = Math.min(amount, t.maxHp - t.hp); t.hp += real; this.fx.push({ t: 'dmg', x: t.x, y: t.y - 20, v: real, crit, heal: true, tgt: t.id, src: src.id }); if (this.arena?.stats[src.ownerId ?? src.id]) this.arena.stats[src.ownerId ?? src.id]!.h += real; if (this.boss) { const c = (this.boss.contributions[src.ownerId ?? src.id] ??= { dmg: 0, heal: 0, tank: 0 }); c.heal += real; } }
  dealDamage(src: Entity, t: Entity, dmg: number, crit: boolean, miss: boolean, el: Element | null) {
    if (t.dead) return;
    this.fx.push({ t: 'dmg', x: t.x, y: t.y - 20, v: dmg, crit, miss, tgt: t.id, src: src.id, el });
    if (miss) return;
    if (t.effects.some((e) => STATUSES[e.id]?.invuln)) return;
    const after = absorbShield(t.effects, dmg); t.hp -= after;
    for (const e of t.effects) if (STATUSES[e.id]?.cc === 'sleep') e.remainingMs = 0;
    const owner = src.ownerId ?? src.id;
    if (t.ai) { t.ai.threat[owner] = (t.ai.threat[owner] ?? 0) + dmg; if (!t.targetId || t.ai.state === 'idle' || t.ai.state === 'patrol') { t.targetId = src.id; t.ai.state = 'chase'; } }
    if (t.contrib) t.contrib[owner] = (t.contrib[owner] ?? 0) + Math.min(dmg, t.hp + after);
    if (this.boss && t.id === this.boss.entityId) (this.boss.contributions[owner] ??= { dmg: 0, heal: 0, tank: 0 }).dmg += dmg;
    if (this.arena?.stats[owner]) this.arena.stats[owner]!.d += after;
    if (this.boss && src.id === this.boss.entityId) (this.boss.contributions[t.ownerId ?? t.id] ??= { dmg: 0, heal: 0, tank: 0 }).tank += dmg;
    if (t.kind === 'player') { const svc = this.services.get(t.id); if (svc) t.gauge = Math.min(100, t.gauge + (t.classId === 'vanguard' ? 6 : 1)); }
    if (t.kind === 'monster' && MONSTERS[t.defId!]!.ai === 'guard' && t.hp < t.maxHp * 0.5 && !t.effects.some((x) => x.id === 'def_up')) { applyStatus(t.effects, 'def_up', t.id, 8000, 0); this.fx.push({ t: 'status', id: t.id, s: 'def_up' }); }
    if (dmg > 0) { this.wear(src, 'weapon', 0.08); this.wear(t, 'armor', 0.1); }
    if (t.hp <= 0) this.kill(t, src);
  }
  /** Durability (§21): weapons wear when they land hits, a random armor piece when hit; broken (0%) gear gives no stats until repaired. */
  wear(e: Entity, part: 'weapon' | 'armor', amt: number) {
    if (e.kind !== 'player') return; const svc = this.services.get(e.id); if (!svc) return;
    const slots = part === 'weapon' ? (['main'] as const) : (['head', 'body', 'gloves', 'boots', 'belt', 'off'] as const);
    const eq = slots.map((sl) => svc.p.equipment[sl]).filter((x): x is NonNullable<typeof x> => !!x && x.durability > 0); if (!eq.length) return;
    const it = part === 'weapon' ? eq[0]! : eq[Math.floor(this.rng.next() * eq.length)]!; const before = it.durability; it.durability = Math.max(0, Math.round((it.durability - amt) * 100) / 100);
    if (before > 0 && it.durability === 0) { this.refreshPlayer(e.id); this.fx.push({ t: 'notice', msg: `${ITEMS[it.defId]?.name.en ?? 'Gear'} broke! Repair it at Brunhild or use a Tinker Kit.`, to: e.id }); }
    else if (before >= 20 && it.durability < 20) this.fx.push({ t: 'notice', msg: `${ITEMS[it.defId]?.name.en ?? 'Gear'} durability low (${Math.floor(it.durability)}%)`, to: e.id });
  }
  kill(t: Entity, killer: Entity) {
    if (t.dead) return; // process death exactly once
    t.dead = true; t.hp = 0; t.deadAt = this.now(); t.effects = []; this.fx.push({ t: 'death', id: t.id, x: t.x, y: t.y });
    if (this.arena) this.arenaOnDeath(t, killer);
    if (t.kind === 'monster') this.onMonsterDeath(t, killer);
    else if (t.kind === 'player') { const svc = this.services.get(t.id)!; svc.p.exp = Math.max(0, svc.p.exp - Math.floor(svc.p.exp * 0.01)); for (const it of Object.values(svc.p.equipment)) if (it) it.durability = Math.max(0, it.durability - 5); this.refreshPlayer(t.id); this.fx.push({ t: 'notice', msg: 'You were defeated. Press Respawn.', to: t.id }); this.checkArena(); const kOwner = this.entities.get(killer.ownerId ?? killer.id); if (kOwner?.kind === 'player' && kOwner !== t && !this.arena) this.services.get(kOwner.id)?.bump('pvp_kills'); }
    else if (t.kind === 'bot') { this.checkArena(); }
    else if (t.kind === 'pet' || t.kind === 'summon') { /* returns later */ }
  }
  private onMonsterDeath(t: Entity, killer: Entity) {
    const def = MONSTERS[t.defId!]!;
    // reward attribution: everyone who dealt damage (players) gets EXP share; loot ownership to top contributor (party-aware)
    const contribs = Object.entries(t.contrib ?? {}).filter(([id]) => this.services.has(id));
    const totalDmg = contribs.reduce((s, [, v]) => s + v, 0) || 1;
    const top = contribs.sort((a, b) => b[1] - a[1])[0]?.[0] ?? (this.services.has(killer.ownerId ?? killer.id) ? killer.ownerId ?? killer.id : undefined);
    const recipients = new Set<string>(contribs.map(([id]) => id));
    // party share: members within 600px get exp
    for (const [pid, members] of this.parties) { if (members.some((m) => recipients.has(m))) for (const m of members) { const me = this.entities.get(m); if (me && dist(me, t) < 600 && this.services.has(m)) recipients.add(m); } void pid; }
    const partyBonus = recipients.size > 1 ? 1 + 0.1 * (recipients.size - 1) : 1;
    for (const id of recipients) {
      const svc = this.services.get(id)!; const share = recipients.size > 1 ? Math.max(1 / recipients.size, (t.contrib?.[id] ?? 0) / totalDmg) : 1;
      const isTop = id === top;
      const drops = isTop ? svc.rollLoot(def.drops, this.eventMult.drop) : [];
      const gold = isTop ? this.rng.int(def.goldMin, def.goldMax) : 0;
      const before = svc.p.level;
      svc.onKill(def.id, def.level, Math.floor(def.baseExp * share * partyBonus), 0, [], this.eventMult, `${this.instanceId}:${t.id}:${t.deadAt}`);
      if (isTop) {
        svc.earn('gold', gold, 'monster');
        if (drops.length) { const bag: Entity = this.baseEntity(eid('l'), 'loot', t.x + this.rng.int(-6, 6), t.y + this.rng.int(-6, 6), 'Loot', 0, { loot: drops.map((d) => ({ ...d, owner: id, until: this.now() + 30000 })), expiresAt: this.now() + 90000 }); this.entities.set(bag.id, bag); }
        this.fx.push({ t: 'notice', msg: `+${gold} Gold`, to: id });
      }
      if (svc.p.level > before) { const pe = this.entities.get(id)!; this.refreshPlayer(id); pe.hp = pe.maxHp; pe.mp = pe.maxMp; this.fx.push({ t: 'level', id, level: svc.p.level }); }
    }
    if (this.dungeon && (t.id === this.dungeon.bossEntity || (def.rank === 'boss' && this.dungeon.state === 'encounter'))) this.advanceDungeon(true);
    if (this.boss && t.id === this.boss.entityId) this.settleBoss();
    if (def.respawnMs > 0 && !this.dungeon) t.ai!.state = 'dead'; else t.expiresAt = this.now() + 3000;
  }
  pickup(playerId: string, lootId?: string): number {
    const p = this.entities.get(playerId); const svc = this.services.get(playerId); if (!p || !svc) return 0; let n = 0;
    for (const e of [...this.entities.values()]) {
      if (e.kind !== 'loot' || (lootId && e.id !== lootId) || dist(p, e) > 70) continue;
      const remain: NonNullable<Entity['loot']> = [];
      for (const l of e.loot ?? []) { if (l.owner !== playerId && this.now() < l.until) { remain.push(l); continue; } if (svc.slotsNeeded(l.itemId, l.qty) > svc.freeSlots()) { remain.push(l); this.fx.push({ t: 'notice', msg: 'Inventory full', to: playerId }); continue; } svc.addItem(l.itemId, l.qty, { rollOptions: true, source: 'loot' }); n++; }
      e.loot = remain; if (!remain.length) this.entities.delete(e.id);
    }
    return n;
  }
  gatherNode(playerId: string, nodeId: string): string | null {
    const p = this.entities.get(playerId); const svc = this.services.get(playerId); const node = this.map.nodes.find((n) => n.id === nodeId); if (!p || !svc || !node) return 'INVALID';
    if (dist(p, { x: node.x * TILE + 16, y: node.y * TILE + 16 }) > 80) return 'OUT_OF_RANGE';
    const until = this.nodesDepleted.get(nodeId) ?? 0; if (until > this.now()) return 'DEPLETED';
    if ((p.cds['gather'] ?? 0) > this.now()) return 'COOLDOWN';
    const r = svc.gather(node.type, node.tier); if (!r.ok) return r.err!;
    p.cds['gather'] = this.now() + 1200; this.nodesDepleted.set(nodeId, this.now() + 30000);
    this.fx.push({ t: 'notice', msg: `+${r.data!.qty} item`, to: playerId });
    return null;
  }
  respawn(playerId: string) { const e = this.entities.get(playerId); if (!e || !e.dead) return; e.dead = false; e.hp = Math.floor(e.maxHp * 0.5); e.mp = Math.floor(e.maxMp * 0.5); e.x = this.map.def.spawn[0] * TILE + 16; e.y = this.map.def.spawn[1] * TILE + 16; e.effects = []; applyStatus(e.effects, 'invuln', e.id, 3000, 0); }
  chat(fromId: string, ch: string, msg: string) { const e = this.entities.get(fromId); const clean = msg.replace(/[<>]/g, '').slice(0, 160); if (!e || !clean.trim()) return; this.fx.push(ch === 'local' ? { t: 'chat', ch, from: e.name, msg: clean, x: Math.round(e.x), y: Math.round(e.y) } : { t: 'chat', ch, from: e.name, msg: clean }); }

  // ---------------- dungeon (§28) ----------------
  startDungeon(dungeonId: string, runId: string, participants: string[]) {
    const d = DUNGEONS[dungeonId]!;
    this.dungeon = { runId, dungeonId, state: 'active', wave: 0, startedAt: this.now(), endsAt: this.now() + 10 * 60_000, participants };
    for (const e of [...this.entities.values()]) if (e.kind === 'monster') this.entities.delete(e.id);
    this.spawnWave(d.waves[0]!); this.fx.push({ t: 'notice', msg: `${d.name.en}: Wave 1/${d.waves.length}` });
  }
  private spawnWave(w: { monster: string; count: number }[]) { const level = DUNGEONS[this.dungeon!.dungeonId]!.levelReq; for (const g of w) for (let i = 0; i < g.count; i++) { const m = this.spawnMonster(g.monster); const def = MONSTERS[g.monster]!; if (level > def.level) { const scale = 1 + (level - def.level) * 0.12; m.maxHp = m.hp = Math.floor(def.maxHp * scale); m.level = level; } m.ai!.state = 'chase'; } }
  advanceDungeon(bossDead = false) {
    const run = this.dungeon; if (!run || run.state === 'completed' || run.state === 'failed') return; const d = DUNGEONS[run.dungeonId]!;
    if (bossDead || run.state === 'encounter') { if (bossDead) { run.state = 'completed'; this.fx.push({ t: 'notice', msg: 'Dungeon cleared! Rewards granted.' }); for (const pid of run.participants) { const svc = this.services.get(pid); svc?.completeDungeon(run.dungeonId, run.runId); } run.state = 'settled'; } return; }
    run.wave++;
    if (run.wave < d.waves.length) { this.spawnWave(d.waves[run.wave]!); this.fx.push({ t: 'notice', msg: `Wave ${run.wave + 1}/${d.waves.length}` }); }
    else { run.state = 'encounter'; const [x, y] = [this.map.def.w * TILE / 2, this.map.def.h * TILE / 3]; const b = this.spawnMonster(d.boss, x, y); run.bossEntity = b.id; const bd = MONSTERS[d.boss]!; if (d.levelReq > bd.level) { b.maxHp = b.hp = Math.floor(bd.maxHp * (1 + (d.levelReq - bd.level) * 0.15) * (bd.rank === 'boss' ? 1 : 3)); } if (bd.rank !== 'boss') { b.name = `${bd.name.en} (Champion)`; } b.ai!.state = 'chase'; this.fx.push({ t: 'notice', msg: `Boss: ${b.name}!` }); }
  }
  // ---------------- world boss (§29) ----------------
  spawnWorldBoss(bossId?: string) {
    if (this.boss && !this.boss.settled) return;
    const id = bossId ?? WORLD_BOSS_ROTATION[Math.floor(this.now() / 3600_000) % WORLD_BOSS_ROTATION.length]!;
    const players = [...this.entities.values()].filter((e) => e.kind === 'player' || e.kind === 'bot').length;
    const e = this.spawnMonster(id, this.map.def.w * TILE / 2, this.map.def.h * TILE / 2 - 40);
    const scale = 1 + Math.max(0, players - 1) * 0.35; e.maxHp = e.hp = Math.floor(MONSTERS[id]!.maxHp * scale * 0.25); // fixed at encounter start (artifact scale 25%)
    this.boss = { id: `boss_${this.now()}`, bossId: id, entityId: e.id, startedAt: this.now(), contributions: {}, settled: false };
    this.fx.push({ t: 'notice', msg: `World Boss ${e.name} has appeared!` });
  }
  private settleBoss() {
    const b = this.boss; if (!b || b.settled) return; b.settled = true;
    // weighted contribution: dmg + 1.5×heal + 1.2×tank (fair to support/tank roles)
    const ranked = Object.entries(b.contributions).map(([id, c]) => ({ id, score: c.dmg + c.heal * 1.5 + c.tank * 1.2 })).filter((r) => r.score > 0).sort((x, y) => y.score - x.score);
    ranked.forEach((r, i) => {
      const svc = this.services.get(r.id); if (!svc) return; const key = `${b.id}:${r.id}`;
      if (svc.p.counters[`wb:${key}`]) return; svc.p.counters[`wb:${key}`] = 1;
      const coins = i === 0 ? 30 : i < 3 ? 20 : 10; svc.earn('boss_coin', coins, 'world_boss', `wbcoin:${key}`); svc.gainExp(MONSTERS[b.bossId]!.baseExp * (i === 0 ? 1.5 : 1), 'world_boss');
      for (const dr of svc.rollLoot(MONSTERS[b.bossId]!.drops)) svc.addItem(dr.itemId, dr.qty, { rollOptions: true, source: 'world_boss' });
      svc.bump('world_boss'); svc.progressObjective('boss', b.bossId, 1);
      this.fx.push({ t: 'notice', msg: `World boss rank #${i + 1}${i === 0 ? ' (MVP)' : ''}: +${coins} Boss Coins`, to: r.id });
    });
    this.nextBossAt = this.now() + (this.opts.worldBossIntervalMs ?? 5 * 60_000);
  }
  // ---------------- arena (§30) ----------------
  /** Arena modes (§30): deathmatch = Last Light (elimination); siege = Lantern Siege (3 capture points); rush = Ember Rush (carry crystals to base). */
  startArena(teamA: string[], teamB: string[], durationMs = 120_000, mode: ArenaMode = 'deathmatch') {
    const w = this.map.def.w * TILE, h = this.map.def.h * TILE;
    this.arena = { mode, teams: [teamA, teamB], endsAt: this.now() + (mode === 'deathmatch' ? durationMs : Math.max(durationMs, 180_000)), done: false, score: [0, 0], target: mode === 'siege' ? 100 : mode === 'rush' ? 5 : 0,
      points: mode === 'siege' ? [{ x: w * 0.22, y: h * 0.3, owner: -1, progress: 0 }, { x: w * 0.5, y: h * 0.5, owner: -1, progress: 0 }, { x: w * 0.78, y: h * 0.7, owner: -1, progress: 0 }] : [],
      crystals: [], carriers: [], stats: {}, nextCrystal: this.now() + 3000 };
    teamA.forEach((id, i) => { const e = this.entities.get(id); if (e) { const [x, y] = this.arenaBase(0, i); e.x = x; e.y = y; e.team = 0; } });
    teamB.forEach((id, i) => { const e = this.entities.get(id); if (e) { const [x, y] = this.arenaBase(1, i); e.x = x; e.y = y; e.team = 1; e.targetId = teamA[0]; } });
    for (const id of [...teamA, ...teamB]) this.arena.stats[id] = { k: 0, d: 0, h: 0, o: 0 };
    const goal = mode === 'siege' ? 'Hold the lanterns! First team to 100 points wins.' : mode === 'rush' ? 'Carry Ember Crystals from the centre to your base! First to 5 wins.' : 'Last Light: defeat the whole enemy team.';
    this.fx.push({ t: 'notice', msg: `Arena match started (${mode === 'siege' ? 'Lantern Siege' : mode === 'rush' ? 'Ember Rush' : 'Last Light'}). ${goal}` });
  }
  arenaBase(team: number, i = 0): [number, number] { const w = this.map.def.w * TILE, h = this.map.def.h * TILE; return [team === 0 ? w * 0.1 : w * 0.9, h * 0.3 + (i % 5) * 50]; }
  private arenaTick(dt: number, now: number) {
    const a = this.arena!; if (a.done) return; const sec = dt / 1000; const w = this.map.def.w * TILE;
    const alive = (id: string) => { const e = this.entities.get(id); return e && !e.dead ? e : undefined; };
    // respawn in objective modes
    if (a.mode !== 'deathmatch') a.teams.forEach((team, ti) => team.forEach((id, i) => { const e = this.entities.get(id); if (e?.dead && now - e.deadAt > 5000) { const [x, y] = this.arenaBase(ti, i); e.dead = false; e.hp = e.maxHp; e.mp = e.maxMp; e.x = x; e.y = y; e.effects = []; applyStatus(e.effects, 'invuln', e.id, 2000, 0); } }));
    if (a.mode === 'siege') for (const pt of a.points) {
      const n = [0, 0]; a.teams.forEach((t, ti) => t.forEach((id) => { const e = alive(id); if (e && Math.hypot(e.x - pt.x, e.y - pt.y) < 70) n[ti]!++; }));
      if (n[0]! > 0 && n[1]! === 0) pt.progress = Math.min(100, pt.progress + 35 * n[0]! * sec); else if (n[1]! > 0 && n[0]! === 0) pt.progress = Math.max(-100, pt.progress - 35 * n[1]! * sec);
      const prev = pt.owner; if (pt.progress >= 100) pt.owner = 0; else if (pt.progress <= -100) pt.owner = 1; else if (Math.abs(pt.progress) < 1) pt.owner = -1;
      if (prev !== pt.owner && pt.owner !== -1) { for (const id of a.teams[pt.owner]!) if (alive(id) && Math.hypot(alive(id)!.x - pt.x, alive(id)!.y - pt.y) < 70) a.stats[id]!.o++; this.fx.push({ t: 'notice', msg: `Team ${pt.owner === 0 ? 'Blue' : 'Red'} captured a lantern!` }); }
      if (pt.owner !== -1) a.score[pt.owner] += sec;
    }
    if (a.mode === 'rush') {
      if (now > a.nextCrystal && a.crystals.length < 3) { a.nextCrystal = now + 4000; const h = this.map.def.h * TILE; a.crystals.push({ id: Math.floor(now), x: w * 0.5 + this.rng.int(-60, 60), y: h * 0.5 + this.rng.int(-100, 100) }); }
      a.teams.forEach((t, ti) => t.forEach((id) => {
        const e = alive(id); if (!e) return; const carrying = a.carriers.includes(id);
        if (!carrying) { const c = a.crystals.findIndex((cr) => Math.hypot(cr.x - e.x, cr.y - e.y) < 26); if (c >= 0) { a.crystals.splice(c, 1); a.carriers.push(id); this.fx.push({ t: 'notice', msg: `${e.name} picked up an Ember Crystal!` }); } }
        else if ((ti === 0 && e.x < w * 0.16) || (ti === 1 && e.x > w * 0.84)) { a.carriers.splice(a.carriers.indexOf(id), 1); a.score[ti]! += 1; a.stats[id]!.o++; this.fx.push({ t: 'notice', msg: `${e.name} scored for Team ${ti === 0 ? 'Blue' : 'Red'}! (${a.score[0]}–${a.score[1]})` }); }
      }));
    }
    this.checkArena();
  }
  /** Carrier death drops the crystal where they fell. */
  private arenaOnDeath(t: Entity, killer: Entity) {
    const a = this.arena; if (!a) return; const kid = killer.ownerId ?? killer.id; if (a.stats[kid] && kid !== t.id) a.stats[kid]!.k++;
    const ci = a.carriers.indexOf(t.id); if (ci >= 0) { a.carriers.splice(ci, 1); a.crystals.push({ id: Math.floor(this.now()), x: t.x, y: t.y }); }
  }
  checkArena() {
    const a = this.arena; if (!a || a.done) return;
    const alive = (t: string[]) => t.filter((id) => { const e = this.entities.get(id); return e && !e.dead; }).length;
    const timeUp = this.now() >= a.endsAt; const aa = alive(a.teams[0]), bb = alive(a.teams[1]);
    let winner: number | undefined;
    if (a.mode === 'deathmatch') { if (aa === 0 || bb === 0 || timeUp) { const hpOf = (t: string[]) => t.reduce((s2, id) => s2 + (this.entities.get(id)?.hp ?? 0), 0); winner = aa === 0 ? 1 : bb === 0 ? 0 : hpOf(a.teams[0]) >= hpOf(a.teams[1]) ? 0 : 1; } }
    else if (a.score[0] >= a.target || a.score[1] >= a.target || timeUp) winner = a.score[0] >= a.score[1] ? 0 : 1;
    if (winner === undefined) return;
    a.done = true; a.winner = winner;
    // MVP: kills, damage, healing and objectives all count (supports are eligible)
    const score = (id: string) => { const s2 = a.stats[id] ?? { k: 0, d: 0, h: 0, o: 0 }; return s2.k * 100 + s2.d * 0.1 + s2.h * 0.15 + s2.o * 150; };
    a.mvp = [...a.teams[0], ...a.teams[1]].sort((x, y) => score(y) - score(x))[0];
    const mvpName = a.mvp ? this.entities.get(a.mvp)?.name ?? '' : '';
    this.fx.push({ t: 'notice', msg: `Arena finished — Team ${winner === 0 ? 'Blue' : 'Red'} wins!${mvpName ? ` MVP: ${mvpName}` : ''}` });
  }

  // ---------------- tick ----------------
  tick(dtMs: number) {
    this.gridAt = -1;
    const now = this.now(); dtMs = Math.min(dtMs, 250); const dt = dtMs / 1000; this.lastTick = now;
    for (const e of [...this.entities.values()]) {
      if (e.expiresAt && now > e.expiresAt) { this.entities.delete(e.id); continue; }
      if (e.kind === 'projectile') { this.moveProjectile(e, dt); continue; }
      if (e.kind === 'npc' || e.kind === 'loot') continue;
      if (e.dead) { if (e.kind === 'monster' && e.ai?.state === 'dead' && now - e.deadAt > MONSTERS[e.defId!]!.respawnMs) this.respawnMonster(e); if ((e.kind === 'bot' && !this.arena) && now - e.deadAt > 8000) { e.dead = false; e.hp = e.maxHp; const [x, y] = this.randomFreePoint(); e.x = x; e.y = y; } if (e.kind === 'pet' && now - e.deadAt > 10000) { e.dead = false; e.hp = e.maxHp; } continue; }
      // status effects
      const r = tickStatuses(e.effects, dtMs);
      if (r.damage) { e.hp -= r.damage; this.fx.push({ t: 'dmg', x: e.x, y: e.y - 20, v: r.damage, crit: false, tgt: e.id }); if (e.hp <= 0) { this.kill(e, e); continue; } }
      if (r.heal) e.hp = Math.min(e.maxHp, e.hp + r.heal);
      if (r.expired.length && e.kind === 'player') this.refreshPlayer(e.id);
      // regen
      if (e.kind === 'player') { const d = this.cachedDerived(e); e.hp = Math.min(e.maxHp, e.hp + d.hpRegen * dt * 0.5); e.mp = Math.min(e.maxMp, e.mp + d.mpRegen * dt * 0.8); }
      else if (e.kind === 'bot') { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * dt); e.mp = Math.min(e.maxMp, e.mp + 5 * dt); }
      if (e.kind === 'player') this.movePlayer(e, dt);
      else if (e.kind === 'monster') this.monsterAI(e, dt, now);
      else if (e.kind === 'pet' || e.kind === 'summon') this.petAI(e, dt, now);
      else if (e.kind === 'bot') this.botAI(e, dt, now);
    }
    if (this.dungeon && (this.dungeon.state === 'active') && ![...this.entities.values()].some((e) => e.kind === 'monster' && !e.dead)) this.advanceDungeon();
    if (this.dungeon && this.dungeon.state === 'encounter' && this.dungeon.bossEntity && !this.entities.get(this.dungeon.bossEntity)) this.advanceDungeon(true);
    if (this.dungeon && this.dungeon.state === 'active' && now > this.dungeon.endsAt) { this.dungeon.state = 'failed'; this.fx.push({ t: 'notice', msg: 'Dungeon failed: time expired.' }); }
    if (this.map.def.biome === 'crater' && (!this.boss || this.boss.settled) && this.nextBossAt && now >= this.nextBossAt) this.spawnWorldBoss();
    if (this.arena && !this.arena.done) this.arenaTick(dtMs, now);
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
  }
  private respawnMonster(e: Entity) { const d = MONSTERS[e.defId!]!; const [x, y] = e.fixed ? [e.ai!.homeX, e.ai!.homeY] : this.randomFreePoint(); Object.assign(e, { dead: false, hp: d.maxHp, maxHp: d.maxHp, x, y, effects: [], targetId: null, contrib: {} }); e.ai = { state: 'idle', homeX: x, homeY: y, nextAct: this.now() + 1000, threat: {}, skillCd: {}, phase: 0 }; }
  speedOf(e: Entity): number {
    let base = 120; if (e.kind === 'player') base = this.cachedDerived(e).moveSpeed; else if (e.kind === 'monster') base = MONSTERS[e.defId!]!.moveSpeed; else if (e.kind === 'pet' || e.kind === 'summon') base = 150;
    if (hasCC(e.effects, 'stun', 'freeze', 'sleep', 'root')) return 0;
    return base * (1 - slowPct(e.effects) / 100);
  }
  /** Collision-checked movement (server-validated: speed derived from server stats, never from client). */
  step(e: Entity, dx: number, dy: number, dt: number) {
    const sp = this.speedOf(e) * dt; if (sp <= 0 || (!dx && !dy)) { e.moving = false; return; }
    const nx = e.x + dx * sp, ny = e.y + dy * sp; const r = 9;
    const blocked = (x: number, y: number) => isSolidPx(this.map, x - r, y - 4) || isSolidPx(this.map, x + r, y - 4) || isSolidPx(this.map, x - r, y + 8) || isSolidPx(this.map, x + r, y + 8);
    let moved = false;
    if (!blocked(nx, e.y)) { e.x = nx; moved = true; }
    if (!blocked(e.x, ny)) { e.y = ny; moved = true; }
    e.moving = moved; if (moved) { const ang = Math.atan2(dy, dx); e.dir = (Math.round(ang / (Math.PI / 4)) + 8 + 2) % 8; }
  }
  private movePlayer(e: Entity, dt: number) {
    let dx = e.input?.dx ?? 0, dy = e.input?.dy ?? 0;
    if (hasCC(e.effects, 'confusion')) { dx = -dx; dy = -dy; }
    if (!dx && !dy && e.path?.length) { const [tx, ty] = e.path[0]!; const px = tx * TILE + 16, py = ty * TILE + 16; const d = Math.hypot(px - e.x, py - e.y); if (d < 6) { e.path.shift(); } else { dx = (px - e.x) / d; dy = (py - e.y) / d; } }
    this.step(e, dx, dy, dt);
    const svc = this.services.get(e.id)!; svc.p.x = e.x; svc.p.y = e.y; svc.p.hp = e.hp; svc.p.mp = e.mp; svc.p.gauge = e.gauge;
    if (svc.p.settings.autoLoot !== false) for (const l of this.entities.values()) if (l.kind === 'loot' && dist(l, e) < 40) { this.pickup(e.id, l.id); break; }
  }
  private chooseTarget(e: Entity): Entity | undefined {
    const threat = e.ai!.threat; let best: Entity | undefined; let bt = -1;
    for (const [id, t] of Object.entries(threat)) { const x = this.entities.get(id) ?? this.entities.get(`pet_${id}`); if (!x || x.dead || dist(x, e) > MONSTERS[e.defId!]!.leashRange * 1.5) { delete threat[id]; continue; } if (t > bt) { bt = t; best = x; } }
    const taunt = e.effects.find((x) => x.id === 'taunt'); if (taunt) { const t = this.entities.get(taunt.sourceId); if (t && !t.dead) return t; }
    if (e.targetId) { const t = this.entities.get(e.targetId); if (t && !t.dead && (!best || bt <= 0)) return t; }
    return best;
  }
  private monsterAI(e: Entity, dt: number, now: number) {
    const d = MONSTERS[e.defId!]!; const ai = e.ai!;
    if (hasCC(e.effects, 'stun', 'freeze', 'sleep')) { e.moving = false; return; }
    if (hasCC(e.effects, 'fear')) { const t = this.chooseTarget(e); if (t) { const a = Math.atan2(e.y - t.y, e.x - t.x); this.step(e, Math.cos(a), Math.sin(a), dt); } return; }
    // boss phases
    if (d.phases) { const pct = (e.hp / e.maxHp) * 100; while (ai.phase < d.phases.length && pct <= d.phases[ai.phase]!.hpPct) { const ph = d.phases[ai.phase]!; ai.phase++; this.fx.push({ t: 'notice', msg: `${e.name} enrages! (phase ${ai.phase + 1})` }); if (ph.summon) for (let i = 0; i < 3; i++) { const m = this.spawnMonster(ph.summon, e.x + this.rng.int(-60, 60), e.y + this.rng.int(-60, 60)); m.ai!.state = 'chase'; } } }
    if (ai.telegraph && now >= ai.telegraph.at) {
      const tg = ai.telegraph; ai.telegraph = undefined; const st = this.combatStats(e);
      for (const x of this.entities.values()) if ((x.kind === 'player' || x.kind === 'bot' || x.kind === 'pet') && !x.dead && dist(x, tg) <= tg.r) { const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(x), power: tg.power, dmgType: 'mag', element: tg.element ?? d.element }); this.dealDamage(e, x, h.damage, h.crit, false, d.element); if (tg.status && !x.dead) applyStatus(x.effects, tg.status, e.id, 2500, st.atk); if (!x.dead && tg.r <= 130) this.knockback(x, tg.x, tg.y, 60); }
      this.fx.push({ t: 'skill', vfx: 'nova', src: e.id, x: tg.x, y: tg.y, tx: tg.x, ty: tg.y, r: tg.r, el: d.element, color: ELEMENT_COLOR[d.element] });
    }
    if (ai.telegraph) { e.moving = false; return; }
    const target = this.chooseTarget(e);
    if (!target && (d.ai === 'aggressive' || d.ai === 'boss' || d.ai === 'guard' || ai.state === 'chase') && ai.state !== 'return') {
      for (const x of this.entities.values()) if ((x.kind === 'player' || x.kind === 'bot') && !x.dead && dist(x, e) < d.aggroRange && !x.effects.some((s) => STATUSES[s.id]?.stealth) && (d.ai !== 'passive')) { if (d.ai === 'aggressive' || d.ai === 'boss' || d.ai === 'guard') { e.targetId = x.id; ai.threat[x.id] = 1; ai.state = 'chase'; break; } }
    }
    const t = this.chooseTarget(e);
    if (t && dist(e, { x: ai.homeX, y: ai.homeY }) > d.leashRange && !this.dungeon && d.rank !== 'world_boss') { ai.state = 'return'; ai.threat = {}; e.targetId = null; }
    if (ai.state === 'return') { const dd = dist(e, { x: ai.homeX, y: ai.homeY }); if (dd < 10) { ai.state = 'idle'; e.hp = e.maxHp; e.contrib = {}; } else this.step(e, (ai.homeX - e.x) / dd, (ai.homeY - e.y) / dd, dt * 1.5); return; }
    if (t) {
      ai.state = 'chase'; const dd = dist(e, t);
      // boss / skill usage with telegraph
      for (const sk of d.skills ?? []) if ((ai.skillCd[sk.id] ?? 0) < now && dd < sk.radius + 60) { ai.skillCd[sk.id] = now + sk.cdMs; ai.telegraph = { id: sk.id, x: sk.radius > 150 ? e.x : t.x, y: sk.radius > 150 ? e.y : t.y, r: sk.radius, at: now + sk.telegraphMs, power: sk.power, status: sk.status, element: sk.element }; this.fx.push({ t: 'telegraph', id: e.id, x: ai.telegraph.x, y: ai.telegraph.y, r: sk.radius, ms: sk.telegraphMs }); return; }
      const range = d.attackRange * (d.size > 1 ? d.size * 0.8 : 1);
      if (dd > range) { this.step(e, (t.x - e.x) / dd, (t.y - e.y) / dd, dt); }
      else { e.moving = false; this.face(e, t); if (now >= e.attackAt) { e.attackAt = now + d.attackIntervalMs; const st = this.combatStats(e); const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(t), power: 1, dmgType: d.ai === 'ranged' ? 'mag' : 'phys', element: d.element }); if (d.ai === 'ranged') this.spawnProjectile(e, t, { homing: false, speed: 300, color: ELEMENT_COLOR[d.element], kind: 'bolt', onHit: (v) => { const h2 = computeHit(this.rng, { attacker: this.combatStats(e), defender: this.combatStats(v), power: 1, dmgType: 'mag', element: d.element }); this.dealDamage(e, v, h2.damage, h2.crit, h2.miss, d.element); } }); else this.dealDamage(e, t, h.damage, h.crit, h.miss, d.element); } }
      return;
    }
    // idle / patrol
    if (d.ai === 'guard') { const dh = Math.hypot(ai.homeX - e.x, ai.homeY - e.y); if (dh > 6) this.step(e, (ai.homeX - e.x) / dh, (ai.homeY - e.y) / dh, dt); else e.moving = false; return; } // guards hold their post
    if (now > ai.nextAct) { ai.nextAct = now + this.rng.int(2000, 6000); if (this.rng.chance(0.6)) { ai.state = 'patrol'; ai.patrolX = ai.homeX + this.rng.int(-90, 90); ai.patrolY = ai.homeY + this.rng.int(-90, 90); } else ai.state = 'idle'; }
    if (ai.state === 'patrol' && ai.patrolX !== undefined) { const dd = Math.hypot(ai.patrolX - e.x, ai.patrolY! - e.y); if (dd < 6) ai.state = 'idle'; else this.step(e, (ai.patrolX - e.x) / dd, (ai.patrolY! - e.y) / dd, dt * 0.5); } else e.moving = false;
  }
  private petAI(e: Entity, dt: number, now: number) {
    const owner = this.entities.get(e.ownerId!); if (!owner) { this.entities.delete(e.id); return; }
    let target = owner.targetId ? this.entities.get(owner.targetId) : undefined; if (target && (target.dead || !this.hostile(owner, target) || dist(target, owner) > 400)) target = undefined;
    if (!target && e.kind === 'summon') target = this.nearestHostile(owner, 260);
    const dOwner = dist(e, owner);
    if (dOwner > 600) { e.x = owner.x - 20; e.y = owner.y + 10; return; } // stuck recovery / leash
    if (target) {
      const dd = dist(e, target);
      if (dd > 50) this.step(e, (target.x - e.x) / dd, (target.y - e.y) / dd, dt);
      else { e.moving = false; if (now >= e.attackAt) { e.attackAt = now + 1400; const st = this.combatStats(e); const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(target), power: 1, dmgType: 'phys', element: st.element }); this.dealDamage(e, target, h.damage, h.crit, h.miss, st.element); } }
      if (e.kind === 'pet') { const sp = PETS[e.defId!]!; if ((e.cds['pskill'] ?? 0) < now) { e.cds['pskill'] = now + sp.skill.cdMs * (e.speedMult ?? 1); if (sp.skill.heal) this.heal(e, owner, Math.floor(owner.maxHp * 0.08 * sp.skill.power)); else if (sp.skill.buff) applyStatus(owner.effects, sp.skill.buff, e.id, 6000, 0); else if (dd < 80) { const st = this.combatStats(e); const h = computeHit(this.rng, { attacker: st, defender: this.combatStats(target), power: sp.skill.power, dmgType: 'mag', element: sp.element }); this.dealDamage(e, target, h.damage, h.crit, false, sp.element); } } }
      return;
    }
    if (dOwner > 50) this.step(e, (owner.x - e.x) / dOwner, (owner.y - e.y) / dOwner, dt * (dOwner > 150 ? 1.4 : 1)); else e.moving = false;
  }
  /** Simulated players (artifact only, labelled SIMULATED). Same combat rules as players. */
  private botAI(e: Entity, dt: number, now: number) {
    const prof = e.botProfile!;
    if (!this.arena && now > prof.chatAt) { prof.chatAt = now + this.rng.int(25000, 90000); if (this.rng.chance(0.5)) this.fx.push({ t: 'chat', ch: 'world', from: `${e.name} [sim]`, msg: this.rng.pick(BOT_LINES) }); }
    if (hasCC(e.effects, 'stun', 'freeze', 'sleep')) return;
    let t = e.targetId ? this.entities.get(e.targetId) : undefined; if (t && (t.dead || !this.hostile(e, t))) { t = undefined; e.targetId = null; }
    const leader = e.partyId ? (this.parties.get(e.partyId) ?? []).map((id) => this.entities.get(id)).find((x) => x?.kind === 'player') : undefined;
    if (leader && !t && leader.targetId) { const lt = this.entities.get(leader.targetId); if (lt && this.hostile(e, lt)) t = lt; }
    if (leader && !t) { const d = dist(e, leader); if (d > 90) this.step(e, (leader.x - e.x) / d, (leader.y - e.y) / d, dt); else e.moving = false; if (d > 700) { e.x = leader.x + 30; e.y = leader.y; } return; }
    if (this.arena && this.arena.mode !== 'deathmatch' && !this.arena.done) { // objective play for simulated players
      const ar = this.arena; const team = this.teamOf(e); const near = this.nearestHostile(e, 170);
      if (!near) { let goal: { x: number; y: number } | undefined;
        if (ar.mode === 'siege') goal = ar.points.filter((pt) => pt.owner !== team).sort((p1, p2) => Math.hypot(p1.x - e.x, p1.y - e.y) - Math.hypot(p2.x - e.x, p2.y - e.y))[0] ?? ar.points[1];
        else if (ar.carriers.includes(e.id)) { const [bx, by] = this.arenaBase(team); goal = { x: bx, y: by }; } else goal = ar.crystals.sort((c1, c2) => Math.hypot(c1.x - e.x, c1.y - e.y) - Math.hypot(c2.x - e.x, c2.y - e.y))[0];
        if (goal) { const d = Math.hypot(goal.x - e.x, goal.y - e.y); if (d > 20) { this.step(e, (goal.x - e.x) / d, (goal.y - e.y) / d, dt); return; } }
      } else t = near;
    }
    if (!t && (prof.aggressive || this.arena)) t = this.nearestHostile(e, this.arena ? 2000 : 220); if (t) e.targetId = t.id;
    if (t) {
      const ranged = ['bow', 'staff', 'tome', 'gun', 'lute', 'cards'].includes(this.weaponOf(e)); const range = ranged ? 240 : 55; const dd = dist(e, t);
      if (dd > range) this.step(e, (t.x - e.x) / dd, (t.y - e.y) / dd, dt);
      else { e.moving = false; const skills = CLASSES[e.classId!]!.skills.filter((s) => s.type === 'active' && s.reqLevel <= e.level && (s.dmgType !== 'heal' || e.hp < e.maxHp * 0.5)); const s = skills.length && this.rng.chance(0.03) ? this.rng.pick(skills) : null; if (s && e.mp >= s.mp) this.castSkill(e.id, s.id, t.id); else this.basicAttack(e.id, t.id); }
      return;
    }
    if (now > prof.wanderAt) { prof.wanderAt = now + this.rng.int(3000, 9000); const [x, y] = this.randomFreePoint(); e.path = findPath(this.map, Math.floor(e.x / TILE), Math.floor(e.y / TILE), Math.floor(x / TILE), Math.floor(y / TILE), 1500) ?? undefined; }
    if (e.path?.length) { const [tx, ty] = e.path[0]!; const px = tx * TILE + 16, py = ty * TILE + 16; const d = Math.hypot(px - e.x, py - e.y); if (d < 6) e.path.shift(); else this.step(e, (px - e.x) / d, (py - e.y) / d, dt * 0.8); } else e.moving = false;
  }

  /** Spatial hash (§59): rebuilt once per call-site tick; cell 256px. */
  private grid = new Map<number, Entity[]>(); private gridAt = -1; static CELL = 256;
  buildGrid() { const now = this.now(); if (this.gridAt === now) return; this.gridAt = now; this.grid.clear(); for (const e of this.entities.values()) { const k = Math.floor(e.x / World.CELL) * 65536 + Math.floor(e.y / World.CELL); let b = this.grid.get(k); if (!b) { b = []; this.grid.set(k, b); } b.push(e); } }
  nearby(x: number, y: number, r: number): Entity[] { this.buildGrid(); const out: Entity[] = []; const c0 = Math.floor((x - r) / World.CELL), c1 = Math.floor((x + r) / World.CELL), r0 = Math.floor((y - r) / World.CELL), r1 = Math.floor((y + r) / World.CELL); for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) for (const e of this.grid.get(cx * 65536 + cy) ?? []) if (Math.abs(e.x - x) <= r && Math.abs(e.y - y) <= r) out.push(e); return out; }
  /** Area-of-interest snapshot for network sync (§57/§59): grid query, monsters visible a bit further. */
  snapshotFor(entityId: string, radius = 900) {
    const me = this.entities.get(entityId); if (!me) return [...this.entities.values()].map(publicEntity);
    return this.nearby(me.x, me.y, radius * 1.5).filter((e) => e.kind === 'monster' || dist(me, e) <= radius).map(publicEntity);
  }
  /** Visibility cap: at most `maxPlayers` nearest other players (bounds per-client cost to O(k) in crowded towns); always includes self and party members. */
  aoiIds(entityId: string, radius = 900, maxPlayers = 40): string[] {
    const me = this.entities.get(entityId); if (!me) return [];
    const r2 = radius * radius; const party = new Set(me.partyId ? this.parties.get(me.partyId) ?? [] : []); const out: string[] = []; const players: { id: string; d: number }[] = [];
    for (const e of this.nearby(me.x, me.y, radius * 1.5)) {
      const dx = e.x - me.x, dy = e.y - me.y, d = dx * dx + dy * dy;
      if (e.kind === 'player' && e.id !== me.id) { if (d <= r2) players.push({ id: e.id, d: party.has(e.id) ? -1 : d }); } else if (e.kind === 'monster' || d <= r2) out.push(e.id);
    }
    if (players.length > maxPlayers) players.sort((p, q) => p.d - q.d);
    for (let i = 0; i < Math.min(maxPlayers, players.length); i++) out.push(players[i]!.id);
    return out;
  }

  drainFx(): Fx[] { const f = this.fx; this.fx = []; return f; }
}
/** Fields that change often; static fields (name, appearance, class…) are sent once per entity per client. */
export const DYNAMIC_KEYS = ['x', 'y', 'd', 'm', 'l', 'hp', 'mhp', 'mp', 'mmp', 'dead', 'fx', 't', 'r', 'mt', 'tg', 'g', 'team', 'gu', 'tele', 'loot', 'cosm'] as const;
export function publicEntity(e: Entity) {
  return { id: e.id, k: e.kind, x: Math.round(e.x), y: Math.round(e.y), d: e.dir, m: e.moving, n: e.name, l: e.level, hp: Math.ceil(e.hp), mhp: e.maxHp, mp: Math.floor(e.mp), mmp: e.maxMp, dead: e.dead, def: e.defId, own: e.ownerId, cls: e.classId, app: e.appearance, fx: e.effects.map((x) => x.id), t: e.title, r: e.riding, mt: e.mount, tg: e.targetId, g: e.gauge, team: e.team, gu: e.guild, cosm: e.cosm, tele: e.ai?.telegraph ? { x: e.ai.telegraph.x, y: e.ai.telegraph.y, r: e.ai.telegraph.r, at: e.ai.telegraph.at } : undefined, loot: e.loot?.length };
}
