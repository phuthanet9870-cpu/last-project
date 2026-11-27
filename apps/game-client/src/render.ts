/** Canvas 2D renderer: camera follow, tile layers, y-sorted objects/entities, lighting, day/night, weather, VFX, minimap (§16, §51, §53). */
import { CLASSES, CONFIG, MAPS, MONSTERS, NPCS, PETS, MOUNTS, ITEMS, QUESTS, TITLES, getMap, TILE, type Fx, type GenMap } from '@hb/game-core';
import { S, canvas, characterSprite, itemIcon, monsterSprite, mountSprite, objectSprite, shade, tileCanvas, isWater, type CharLook } from './art.js';
import type { Adapter, PubEntity } from './adapter.js';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dot' | 'text' | 'ring' | 'line' | 'proj' | 'glow'; text?: string; r?: number; x2?: number; y2?: number; grav?: number; big?: boolean }
const DIR4 = [3, 2, 2, 2, 0, 1, 1, 1];
export function lookOf(classId: string | undefined, app: any): CharLook {
  const c = CLASSES[classId ?? 'blade_sentinel'] ?? CLASSES.blade_sentinel!;
  return { body: c.palette.body, trim: c.palette.trim, hair: app?.hairColor ?? c.palette.hair, skin: app?.skin ?? '#f0c8a0', hairStyle: app?.hair ?? 0, bodyType: app?.body ?? 0, weapon: c.weapons[0]!, eyes: app?.eyes };
}
export function npcLook(id: string): CharLook { const n = NPCS[id]!; return { body: n.palette[1], trim: n.palette[2], hair: n.palette[0], skin: '#f0c8a0', hairStyle: id.length % 4, bodyType: id.length % 2, weapon: n.roles.includes('blacksmith') ? 'greatsword' : n.roles.includes('enchanter') || n.roles.includes('healer') ? 'staff' : n.roles.includes('card') ? 'cards' : 'none' }; }

export class Renderer {
  cv: HTMLCanvasElement; x: CanvasRenderingContext2D; camX = 0; camY = 0; zoom = 1; map!: GenMap; staticLayer!: HTMLCanvasElement; mini!: HTMLCanvasElement; particles: Particle[] = []; lastHit = new Map<string, number>();
  smooth = new Map<string, { x: number; y: number }>(); hover: PubEntity | null = null; selected: string | null = null; light: HTMLCanvasElement; lx: CanvasRenderingContext2D; weatherParts: { x: number; y: number; s: number; v: number }[] = [];
  settings = { particles: true, weather: true, lighting: true, reducedMotion: false, lowPerf: false, showNames: true };
  t = 0; animFrame = 0; private nightOverride: number | null = null; telegraphs: { x: number; y: number; r: number; until: number; start: number }[] = [];
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.x = cv.getContext('2d')!; [this.light, this.lx] = canvas(cv.width, cv.height); }
  setMap(mapId: string) {
    this.map = getMap(mapId); const m = this.map; const [c, x] = canvas(m.w * 16, m.h * 16);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) { const t = m.tiles[j * m.w + i]!; x.drawImage(tileCanvas(t, i, j, 0), i * 16, j * 16); }
    // shoreline foam + cliff shadows (simple autotile edges)
    for (let j = 1; j < m.h - 1; j++) for (let i = 1; i < m.w - 1; i++) {
      const t = m.tiles[j * m.w + i]!; if (isWater(t)) continue;
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
      nb.forEach(([dx, dy], k) => { const n = m.tiles[(j + dy) * m.w + i + dx]!; if (isWater(n)) { x.fillStyle = 'rgba(255,255,255,0.35)'; if (k === 0) x.fillRect(i * 16, j * 16, 16, 1); if (k === 1) x.fillRect(i * 16 + 15, j * 16, 1, 16); if (k === 2) x.fillRect(i * 16, j * 16 + 15, 16, 1); if (k === 3) x.fillRect(i * 16, j * 16, 1, 16); } if (n === 12 && t !== 12 && k === 0) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 16, j * 16, 16, 3); } });
    }
    this.staticLayer = c;
    const [mc, mx] = canvas(m.w * 2, m.h * 2); const col: Record<number, string> = { 0: '#6cb04a', 1: '#4f8a3a', 2: '#c8a46a', 3: '#3f8fd0', 4: '#e8d49a', 5: '#eef4fa', 6: '#6a6470', 7: '#2a2430', 8: '#a87850', 9: '#b8a890', 10: '#7a5232', 11: '#bfe6f6', 12: '#5a4e44', 13: '#2c6aa8', 14: '#9a6a3a' };
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) { mx.fillStyle = col[m.tiles[j * m.w + i]!] ?? '#000'; mx.fillRect(i * 2, j * 2, 2, 2); }
    for (const o of m.objects) if (o.blocks) { mx.fillStyle = o.kind === 'house' ? '#b84a3a' : '#2a5a2a'; mx.fillRect(o.x * 2, o.y * 2, o.w * 2, o.h * 2); }
    this.mini = mc; this.particles = []; this.smooth.clear(); this.telegraphs = [];
  }
  resize(w: number, h: number) { this.cv.width = w; this.cv.height = h; this.light.width = w; this.light.height = h; this.x.imageSmoothingEnabled = false; }
  nightFactor(): number { if (this.nightOverride !== null) return this.nightOverride; const ph = (Date.now() % CONFIG.dayLengthMs) / CONFIG.dayLengthMs; const v = Math.cos(ph * Math.PI * 2); return Math.max(0, Math.min(1, (-v + 0.3) / 1.1)); }
  setNight(v: number | null) { this.nightOverride = v; }
  weather(): string { const ws = MAPS[this.map.def.id]!.weather; return ws[Math.floor(Date.now() / 120000) % ws.length] ?? 'clear'; }
  timeLabel(): string { const ph = (Date.now() % CONFIG.dayLengthMs) / CONFIG.dayLengthMs; const h = Math.floor(ph * 24 + 6) % 24; return `${String(h).padStart(2, '0')}:${String(Math.floor((ph * 24 * 60) % 60)).padStart(2, '0')}`; }

  pushFx(list: Fx[], meId: string, ents: Map<string, PubEntity>) {
    if (!this.settings.particles && list.length > 0) list = list.filter((f) => f.t === 'dmg' || f.t === 'level' || f.t === 'telegraph');
    for (const f of list) {
      if (f.t === 'dmg') { this.particles.push({ x: f.x + (Math.random() * 16 - 8), y: f.y - 8, vx: 0, vy: -40, life: 900, max: 900, color: f.miss ? '#c0c0c0' : f.heal ? '#70ff80' : f.crit ? '#ffd040' : ents.get(f.tgt)?.k === 'player' ? '#ff6060' : '#ffffff', size: f.crit ? 14 : 11, kind: 'text', text: f.miss ? 'MISS' : `${f.heal ? '+' : ''}${f.v}${f.crit ? '!' : ''}`, big: f.crit }); if (!f.heal && !f.miss) this.lastHit.set(f.tgt, performance.now()); }
      else if (f.t === 'skill') this.skillFx(f);
      else if (f.t === 'death') for (let i = 0; i < 14; i++) this.particles.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.8) * 120, life: 600, max: 600, color: i % 2 ? '#ffffff' : '#c0c0c0', size: 3, kind: 'dot', grav: 200 });
      else if (f.t === 'level') { const e = ents.get(f.id); if (e) { for (let i = 0; i < 30; i++) this.particles.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y, vx: 0, vy: -60 - Math.random() * 80, life: 1200, max: 1200, color: '#ffe060', size: 3, kind: 'dot' }); this.particles.push({ x: e.x, y: e.y - 50, vx: 0, vy: -20, life: 2000, max: 2000, color: '#ffe060', size: 16, kind: 'text', text: 'LEVEL UP!', big: true }); } }
      else if (f.t === 'telegraph') this.telegraphs.push({ x: f.x, y: f.y, r: f.r, start: performance.now(), until: performance.now() + f.ms });
    }
    void meId;
  }
  private skillFx(f: Extract<Fx, { t: 'skill' }>) {
    const c = f.color; const P = (p: Partial<Particle> & { kind: Particle['kind'] }) => this.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, life: 400, max: 400, color: c, size: 3, ...p });
    switch (f.vfx) {
      case 'arrow': case 'bolt': case 'drain': P({ kind: 'proj', x: f.x, y: f.y - 12, x2: f.tx, y2: f.ty - 12, life: 220, max: 220, size: f.vfx === 'arrow' ? 2 : 5 }); break;
      case 'slash': case 'arc': P({ kind: 'ring', x: f.tx, y: f.ty - 10, r: f.vfx === 'arc' ? f.r || 60 : 22, life: 200, max: 200, size: 3 }); for (let i = 0; i < 6; i++) P({ kind: 'dot', x: f.tx, y: f.ty - 10, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 300, max: 300 }); break;
      case 'whirl': case 'nova': case 'shock': P({ kind: 'ring', x: f.vfx === 'nova' && f.tx ? f.tx : f.x, y: (f.vfx === 'nova' && f.ty ? f.ty : f.y) - 4, r: f.r || 100, life: 450, max: 450, size: 5 }); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; P({ kind: 'dot', x: f.tx || f.x, y: f.ty || f.y, vx: Math.cos(a) * (f.r || 100) * 2, vy: Math.sin(a) * (f.r || 100) * 2, life: 450, max: 450, size: 4 }); } break;
      case 'explosion': case 'rain': case 'trap': for (let i = 0; i < (f.vfx === 'rain' ? 18 : 26); i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * (f.r || 80); if (f.vfx === 'rain') P({ kind: 'line', x: f.tx + Math.cos(a) * d, y: f.ty + Math.sin(a) * d - 120, x2: f.tx + Math.cos(a) * d, y2: f.ty + Math.sin(a) * d, life: 250 + Math.random() * 200, max: 450 }); else P({ kind: 'dot', x: f.tx, y: f.ty, vx: Math.cos(a) * d * 3, vy: Math.sin(a) * d * 3, life: 500, max: 500, size: 4 + Math.random() * 3 }); } P({ kind: 'ring', x: f.tx, y: f.ty, r: f.r || 80, life: 350, max: 350, size: 4 }); P({ kind: 'glow', x: f.tx, y: f.ty, r: f.r || 80, life: 300, max: 300 }); break;
      case 'beam': case 'chain': P({ kind: 'line', x: f.x, y: f.y - 12, x2: f.tx, y2: f.ty - 12, life: 260, max: 260, size: f.vfx === 'beam' ? 8 : 3 }); break;
      case 'heal': for (let i = 0; i < 20; i++) P({ kind: 'dot', x: f.x + (Math.random() - 0.5) * (f.r ? 120 : 30), y: f.y + (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, life: 800, max: 800, color: '#90ff90', size: 3 }); P({ kind: 'ring', x: f.x, y: f.y, r: Math.min(f.r || 40, 160), life: 500, max: 500, color: '#90ff90' }); break;
      case 'buff': case 'shield': case 'mark': P({ kind: 'ring', x: f.vfx === 'mark' ? f.tx : f.x, y: (f.vfx === 'mark' ? f.ty : f.y) - 12, r: 26, life: 600, max: 600, size: 3 }); for (let i = 0; i < 10; i++) P({ kind: 'dot', x: f.x + (Math.random() - 0.5) * 30, y: f.y, vy: -70, life: 700, max: 700, size: 3 }); break;
      case 'dash': for (let i = 0; i < 10; i++) P({ kind: 'dot', x: f.x + (f.tx - f.x) * (i / 10), y: f.y + (f.ty - f.y) * (i / 10) - 10, life: 300, max: 300, color: '#ffffff', size: 4 }); break;
      case 'flash': P({ kind: 'glow', x: f.tx, y: f.ty, r: f.r || 100, life: 300, max: 300, color: '#ffffff' }); break;
      case 'big': P({ kind: 'ring', x: f.tx, y: f.ty - 10, r: 40, life: 300, max: 300, size: 6 }); P({ kind: 'glow', x: f.tx, y: f.ty - 10, r: 50, life: 300, max: 300 }); break;
    }
  }

  draw(a: Adapter, dt: number) {
    const ctx = this.x; const W = this.cv.width, H = this.cv.height; this.t += dt; if (this.t > 300) { this.t = 0; this.animFrame++; }
    const ents = a.entities(); const byId = new Map(ents.map((e) => [e.id, e]));
    for (const e of ents) { const s = this.smooth.get(e.id); if (!s || Math.hypot(s.x - e.x, s.y - e.y) > 200) this.smooth.set(e.id, { x: e.x, y: e.y }); else { const k = Math.min(1, dt / 70); s.x += (e.x - s.x) * k; s.y += (e.y - s.y) * k; } }
    const me = byId.get(a.myId); const sm = me ? this.smooth.get(me.id)! : { x: 0, y: 0 };
    const z = S * this.zoom; const vw = W / z, vh = H / z; const mw = this.map.w * 16, mh = this.map.h * 16;
    // camera follow (logical px = world px / 2)
    let cx = sm.x / 2 - vw / 2, cy = sm.y / 2 - vh / 2; cx = Math.max(0, Math.min(mw - vw, cx)); cy = Math.max(0, Math.min(mh - vh, cy)); if (mw < vw) cx = (mw - vw) / 2; if (mh < vh) cy = (mh - vh) / 2;
    this.camX = cx; this.camY = cy;
    ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.scale(z, z); ctx.translate(-Math.round(cx * 1) , -Math.round(cy * 1));
    ctx.drawImage(this.staticLayer, 0, 0);
    // animated water tiles
    const fr = this.settings.reducedMotion ? 0 : this.animFrame % 3; const x0 = Math.max(0, Math.floor(cx / 16)), y0 = Math.max(0, Math.floor(cy / 16)), x1 = Math.min(this.map.w - 1, Math.ceil((cx + vw) / 16)), y1 = Math.min(this.map.h - 1, Math.ceil((cy + vh) / 16));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const t = this.map.tiles[j * this.map.w + i]!; if (isWater(t)) ctx.drawImage(tileCanvas(t, i, j, fr), i * 16, j * 16); }
    // portals
    MAPS[this.map.def.id]!.portals.forEach((pt) => { const px = pt.x * 16 + 8, py = pt.y * 16 + 8; const r = 7 + Math.sin(performance.now() / 300) * 1.5; ctx.fillStyle = 'rgba(120,200,255,0.25)'; ctx.beginPath(); ctx.ellipse(px, py, r + 4, (r + 4) * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a0e0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.6, performance.now() / 500, 0, Math.PI * 1.6); ctx.stroke(); this.label(ctx, pt.label.en, px, py - 12, '#c0f0ff', 5); });
    // telegraphs
    const nowP = performance.now(); this.telegraphs = this.telegraphs.filter((t) => t.until > nowP);
    for (const t of this.telegraphs) { const k = (nowP - t.start) / (t.until - t.start); ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.beginPath(); ctx.ellipse(t.x / 2, t.y / 2, t.r / 2, t.r / 2 * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.beginPath(); ctx.ellipse(t.x / 2, t.y / 2, (t.r / 2) * k, (t.r / 2) * 0.7 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ff5050'; ctx.beginPath(); ctx.ellipse(t.x / 2, t.y / 2, t.r / 2, t.r / 2 * 0.7, 0, 0, Math.PI * 2); ctx.stroke(); }
    // y-sorted drawables
    const night = this.nightFactor() > 0.4;
    type D = { y: number; f: () => void };
    const list: D[] = [];
    for (const o of this.map.objects) { if (o.x * 16 > cx + vw + 64 || (o.x + o.w) * 16 < cx - 64 || o.y * 16 > cy + vh + 64 || (o.y + o.h) * 16 < cy - 80) continue; const tall = ['tree', 'pine', 'snowpine', 'lamp', 'house'].includes(o.kind); const spr = objectSprite(o.kind, o.variant, o.w, o.h, night); const flat = ['rug', 'flower', 'crop'].includes(o.kind); list.push({ y: flat ? -1e9 + o.y : (o.y + o.h) * 16, f: () => ctx.drawImage(spr, o.x * 16, o.y * 16 - (tall ? 16 : 0)) }); }
    for (const n of this.map.nodes) list.push({ y: n.y * 16 + 14, f: () => this.drawNode(ctx, n) });
    const p = a.p; const visit = this.map.def.biome === 'farm' ? (a as any).visitView?.() ?? null : null; const decor = this.map.def.biome === 'farm' ? (visit ? visit.decorations : p.farm.decorations) : this.map.def.biome === 'house' ? p.house.furniture : [];
    for (const d of decor) list.push({ y: d.y * 16 + 14, f: () => { const def = ITEMS[d.itemId]; if (def) { ctx.save(); ctx.translate(d.x * 16 + 8, d.y * 16 + 8); ctx.rotate((d.rot * Math.PI) / 2); ctx.drawImage(itemIcon(def.icon, def.color), -6, -6); ctx.restore(); } } });
    if (this.map.def.biome === 'farm') (visit ? visit.pets : p.pets.filter((x) => x.onFarm)).forEach((pet: { species: string }, i: number) => { const sp = PETS[pet.species]!; const px = 23 * 16 + ((i * 37 + Math.floor(performance.now() / 60) % 200) % 150), py = 6 * 16 + ((i * 53) % 90); list.push({ y: py + 12, f: () => { ctx.drawImage(monsterSprite(sp.sprite, sp.color, this.animFrame + i), px, py, 12, 12); } }); });
    for (const e of ents) { const s = this.smooth.get(e.id)!; list.push({ y: s.y / 2 + (e.k === 'loot' ? -6 : 0), f: () => this.drawEntity(ctx, e, s.x / 2, s.y / 2, a, byId) }); }
    list.sort((u, v) => u.y - v.y); for (const d of list) d.f();
    // particles
    this.drawParticles(ctx, dt);
    ctx.restore();
    // weather + lighting (screen space)
    if (this.settings.weather) this.drawWeather(ctx, W, H, dt);
    if (this.settings.lighting) this.drawLighting(ctx, W, H, ents, z, a);
  }
  private label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 5) { ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(text, x + 0.5, y + 0.5); ctx.fillStyle = color; ctx.fillText(text, x, y); }
  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, v: number, col: string) { ctx.fillStyle = '#1a1010'; ctx.fillRect(x - w / 2 - 0.5, y - 0.5, w + 1, 3); ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, v)), 2); }
  private drawNode(ctx: CanvasRenderingContext2D, n: GenMap['nodes'][number]) {
    const x = n.x * 16, y = n.y * 16; const tw = Math.sin(performance.now() / 400 + n.x) * 0.5 + 0.5;
    if (n.type === 'ore') { ctx.drawImage(objectSprite('rock', 0, 1, 1), x, y); const col = n.tier === 3 ? '#c080ff' : n.tier === 2 ? '#e0e8f0' : '#d08040'; ctx.fillStyle = col; ctx.fillRect(x + 5, y + 9, 2, 2); ctx.fillRect(x + 9, y + 8, 2, 2); ctx.fillRect(x + 7, y + 11, 1, 1); }
    if (n.type === 'tree') { ctx.drawImage(objectSprite('stump', 0, 1, 1), x, y); ctx.drawImage(itemIcon('log', '#8a5a2a'), x + 2, y - 4); }
    if (n.type === 'herb') { ctx.drawImage(itemIcon('herb', n.tier === 3 ? '#f0d040' : '#50c050'), x + 2, y + 2); }
    if (n.type === 'fish') { ctx.strokeStyle = `rgba(255,255,255,${0.4 + tw * 0.4})`; ctx.beginPath(); ctx.ellipse(x + 8, y + 9, 3 + tw * 3, 2 + tw * 1.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = `rgba(255,255,200,${tw * 0.8})`; ctx.fillRect(x + 12, y + 2, 1, 1);
  }
  private drawEntity(ctx: CanvasRenderingContext2D, e: PubEntity, x: number, y: number, a: Adapter, byId: Map<string, PubEntity>) {
    const hit = (performance.now() - (this.lastHit.get(e.id) ?? 0)) < 120; const isMe = e.id === a.myId; const sel = this.selected === e.id;
    const shadow = (w: number) => { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 6, w, w * 0.4, 0, 0, Math.PI * 2); ctx.fill(); };
    if (sel) { ctx.strokeStyle = e.k === 'monster' ? '#ff5050' : '#60e0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 6, 10, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
    const stealth = e.fx?.includes('stealth');
    if (stealth) ctx.globalAlpha = isMe ? 0.5 : 0.25;
    if (e.k === 'player' || e.k === 'bot' || e.k === 'npc') {
      shadow(7);
      const look = e.k === 'npc' ? npcLook(e.def!) : lookOf(e.cls, e.app);
      const d4 = e.k === 'npc' ? 0 : DIR4[e.d] ?? 0; const action = e.dead ? 'dead' : e.m ? 'walk' : 'idle';
      const fr = Math.floor(performance.now() / 140) % 4;
      let oy = 0;
      if (e.r && e.mt && !e.dead) { const md = MOUNTS[e.mt]; if (md) { const ms = mountSprite(md.sprite, md.color, fr); ctx.save(); if (d4 === 1) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); } ctx.drawImage(ms, x - 12, y - 8 + (e.m && fr % 2 ? -1 : 0)); ctx.restore(); oy = -8; } }
      if (e.cosm && !e.dead) { const t0 = performance.now() / 400; const n = 3 + e.cosm * 2; for (let i = 0; i < n; i++) { const ang = t0 + (i / n) * Math.PI * 2; ctx.fillStyle = `hsla(${(i * 47 + t0 * 40) % 360},90%,75%,0.85)`; ctx.fillRect(Math.round(x + Math.cos(ang) * 11), Math.round(y - 8 + oy + Math.sin(ang) * 6), 1.5, 1.5); } } // cosmetic enhancement aura (visual only)
      const spr = characterSprite(look, d4, fr, action as any); ctx.drawImage(spr, Math.round(x - 10), Math.round(y - 20 + oy));
      if (hit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(spr, Math.round(x - 10), Math.round(y - 20 + oy)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (e.k === 'npc') { const n = NPCS[e.def!]!; const qs = Object.values(QUESTS) as any[]; const hasQ = qs.some((q) => q.giver === n.id && !a.p.quests.done.includes(q.id) && !a.p.quests.active.some((x) => x.id === q.id) && a.p.level >= q.reqLevel && (!q.prereq || a.p.quests.done.includes(q.prereq))); const ready = a.p.quests.active.some((q) => QUESTS[q.id]?.giver === n.id); if (hasQ || ready) { const bob = Math.sin(performance.now() / 250) * 1.5; this.label(ctx, ready ? '?' : '!', x, y - 26 + bob, ready ? '#80ff80' : '#ffe040', 9); } if (this.settings.showNames) { this.label(ctx, n.name.en, x, y + 13, '#ffe9a8', 5); this.label(ctx, `<${n.title.en}>`, x, y + 18, '#c0b090', 4); } }
      else if (this.settings.showNames) { this.label(ctx, `${e.n}${e.k === 'bot' ? ' ·sim' : ''}`, x, y - 24 + oy, isMe ? '#ffffff' : e.k === 'bot' ? '#b0d8ff' : '#80ffb0', 5); if (e.t && e.t !== 'title_newcomer') this.label(ctx, `«${TITLES[e.t]?.name.en ?? ''}»`, x, y - 29 + oy, '#ffd070', 4); if (!isMe) this.bar(ctx, x, y - 22 + oy, 16, e.hp / e.mhp, '#e04040'); if (e.team !== undefined) this.label(ctx, '●', x, y + 12, e.team === 0 ? '#4090ff' : '#ff4040', 5); }
    } else if (e.k === 'monster') {
      const d = MONSTERS[e.def!]!; const size = 16 * d.size; shadow(6 * d.size);
      const fr = Math.floor(performance.now() / (e.m ? 180 : 400)) % 2; const bounce = d.sprite === 'slime' || d.sprite === 'wisp' || d.sprite === 'ghost' ? Math.sin(performance.now() / 200 + e.x) * 1.5 : 0;
      if (e.dead) { ctx.globalAlpha = 0.35; }
      const spr = monsterSprite(d.sprite, d.color, fr); ctx.save(); if (e.d >= 5 && e.d <= 7) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); } ctx.drawImage(spr, Math.round(x - size / 2), Math.round(y - size + 6 + bounce), size, size); if (hit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(spr, Math.round(x - size / 2), Math.round(y - size + 6 + bounce), size, size); ctx.globalCompositeOperation = 'source-over'; } ctx.restore(); ctx.globalAlpha = 1;
      if (!e.dead) { const bossy = d.rank === 'boss' || d.rank === 'world_boss'; this.bar(ctx, x, y - size + 2, bossy ? 30 : 14, e.hp / e.mhp, bossy ? '#ff3060' : '#e04040'); if (this.settings.showNames || sel) this.label(ctx, `${d.rank !== 'normal' ? '★ ' : ''}${e.n} Lv${e.l}`, x, y - size, d.rank === 'normal' ? '#f0f0f0' : d.rank === 'rare' ? '#ffe040' : '#ff8080', 4.5); }
      if (e.fx?.length) e.fx.slice(0, 4).forEach((s, i) => { ctx.fillStyle = s === 'burn' ? '#ff7a2f' : s === 'poison' ? '#7bd45a' : s === 'stun' ? '#ffe066' : s === 'chill' || s === 'freeze' ? '#9fe3ff' : '#c080ff'; ctx.fillRect(x - 6 + i * 4, y - size - 6, 3, 3); });
    } else if (e.k === 'pet' || e.k === 'summon') {
      shadow(4); const sp = e.app?.sprite ?? 'slime'; const col = e.app?.color ?? '#ccc'; if (e.k === 'summon') ctx.globalAlpha = 0.75; if (e.dead) ctx.globalAlpha = 0.3;
      ctx.drawImage(monsterSprite(sp, col, Math.floor(performance.now() / 200)), Math.round(x - 6), Math.round(y - 8 + Math.sin(performance.now() / 180) * 1), 12, 12); ctx.globalAlpha = 1; if (this.settings.showNames) this.label(ctx, e.n, x, y - 10, e.k === 'pet' ? '#ffc0e0' : '#c0ffff', 4);
    } else if (e.k === 'projectile') {
      const col = e.app?.color ?? '#fff'; const ang = ((e.d - 2) * Math.PI) / 4; ctx.save(); ctx.translate(x, y);
      if (e.app?.kind === 'arrow') { ctx.rotate(ang); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-5, -0.5, 9, 1); ctx.fillStyle = col; ctx.fillRect(3, -1, 2, 2); ctx.fillStyle = '#a07040'; ctx.fillRect(-6, -1, 2, 2); }
      else { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 5); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else if (e.k === 'loot') {
      const b = Math.sin(performance.now() / 200) * 1; ctx.drawImage(itemIcon('pack', '#e0b040'), x - 6, y - 8 + b); ctx.fillStyle = `rgba(255,240,160,${0.5 + b * 0.3})`; ctx.fillRect(x + 4, y - 9 + b, 1, 1); ctx.fillRect(x - 5, y - 4, 1, 1);
    }
    ctx.globalAlpha = 1; void byId;
  }
  private drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
    const keep: Particle[] = []; const s = dt / 1000;
    for (const p of this.particles) {
      p.life -= dt; if (p.life <= 0) continue; keep.push(p); const k = p.life / p.max;
      p.x += p.vx * s / 2; p.y += p.vy * s / 2; if (p.grav) p.vy += p.grav * s;
      const X = p.x / 2, Y = p.y / 2; ctx.globalAlpha = Math.min(1, k * 1.5);
      if (p.kind === 'dot') { ctx.fillStyle = p.color; ctx.fillRect(X, Y, p.size / 2, p.size / 2); }
      else if (p.kind === 'text') { ctx.font = `bold ${p.size / 2 + (p.big ? 1 : 0)}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(p.text!, X, Y); ctx.fillStyle = p.color; ctx.fillText(p.text!, X, Y); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = p.size / 2; ctx.beginPath(); ctx.ellipse(X, Y, (p.r! / 2) * (1 - k * 0.6), (p.r! / 2) * 0.7 * (1 - k * 0.6), 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (p.kind === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = p.size / 2 * k + 0.5; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(p.x2! / 2, p.y2! / 2); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5; ctx.stroke(); }
      else if (p.kind === 'proj') { const t = 1 - k; const px = (p.x + (p.x2! - p.x) * t) / 2, py = (p.y + (p.y2! - p.y) * t) / 2; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, p.size / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(px - 0.5, py - 0.5, 1, 1); }
      else if (p.kind === 'glow') { const g = ctx.createRadialGradient(X, Y, 0, X, Y, p.r! / 2); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.globalAlpha = k * 0.6; ctx.beginPath(); ctx.arc(X, Y, p.r! / 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1; this.particles = keep.slice(-(this.settings.lowPerf ? 150 : 600));
  }
  private drawWeather(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number) {
    const w = this.weather(); const biome = this.map.def.biome; if (biome === 'house' || biome === 'cave') return;
    const n = this.settings.lowPerf ? 40 : 120; while (this.weatherParts.length < n) this.weatherParts.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random(), v: 0.5 + Math.random() });
    const s = dt / 1000;
    if (w === 'rain') { ctx.fillStyle = 'rgba(40,60,100,0.15)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(180,200,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (const p of this.weatherParts) { p.y += 700 * p.v * s; p.x -= 120 * s; if (p.y > H) { p.y = -10; p.x = Math.random() * W + 60; } ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y + 10); } ctx.stroke(); }
    if (w === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const p of this.weatherParts) { p.y += 50 * p.v * s; p.x += Math.sin(performance.now() / 800 + p.s * 10) * 20 * s; if (p.y > H) { p.y = -5; p.x = Math.random() * W; } ctx.fillRect(p.x, p.y, 2 + p.s * 2, 2 + p.s * 2); } }
    if (w === 'leaves') { for (const p of this.weatherParts.slice(0, 40)) { p.y += 35 * p.v * s; p.x += (Math.sin(performance.now() / 600 + p.s * 8) * 40 + 20) * s; if (p.y > H || p.x > W) { p.y = -5; p.x = Math.random() * W - 40; } ctx.fillStyle = p.s > 0.5 ? '#e0903a' : '#9ac040'; ctx.fillRect(p.x, p.y, 4, 2); } }
    if (w === 'fog') { const g = ctx.createLinearGradient(0, 0, W, H); const o = Math.sin(performance.now() / 4000) * 0.05; g.addColorStop(0, `rgba(220,230,240,${0.22 + o})`); g.addColorStop(0.5, `rgba(220,230,240,${0.1 - o})`); g.addColorStop(1, `rgba(220,230,240,${0.25 + o})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  private drawLighting(ctx: CanvasRenderingContext2D, W: number, H: number, ents: PubEntity[], z: number, a: Adapter) {
    const biome = this.map.def.biome; let dark = biome === 'cave' ? 0.62 : biome === 'house' ? 0.1 : this.nightFactor() * 0.68; if (biome === 'crater') dark = Math.max(dark, 0.25);
    if (dark < 0.03) return;
    const l = this.lx; l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, W, H); l.fillStyle = biome === 'cave' ? `rgba(8,6,20,${dark})` : `rgba(12,16,48,${dark})`; l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const hole = (wx: number, wy: number, r: number, i = 1) => { const sx = (wx - this.camX) * z, sy = (wy - this.camY) * z; if (sx < -r * z || sy < -r * z || sx > W + r * z || sy > H + r * z) return; const g = l.createRadialGradient(sx, sy, 0, sx, sy, r * z); g.addColorStop(0, `rgba(0,0,0,${i})`); g.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = g; l.beginPath(); l.arc(sx, sy, r * z, 0, Math.PI * 2); l.fill(); };
    const flick = 1 + Math.sin(performance.now() / 120) * 0.04;
    for (const o of this.map.objects) { if (o.kind === 'lamp') hole(o.x * 16 + 8, o.y * 16 - 10, 60 * flick); if (o.kind === 'torch') hole(o.x * 16 + 8, o.y * 16 + 4, 55 * flick); if (o.kind === 'crystal') hole(o.x * 16 + 8, o.y * 16 + 8, 28, 0.7); if (o.kind === 'house') { hole(o.x * 16 + 17, (o.y + o.h) * 16 - 4, 26, 0.8); hole((o.x + o.w) * 16 - 19, (o.y + o.h) * 16 - 4, 26, 0.8); } }
    for (const pt of MAPS[this.map.def.id]!.portals) hole(pt.x * 16 + 8, pt.y * 16 + 8, 40, 0.8);
    for (const e of ents) { const s = this.smooth.get(e.id); if (!s) continue; if (e.id === a.myId) hole(s.x / 2, s.y / 2 - 6, 70, 0.9); else if (e.k === 'player' || e.k === 'bot') hole(s.x / 2, s.y / 2 - 6, 30, 0.5); else if (e.k === 'monster' && ['wisp', 'ghost'].includes(MONSTERS[e.def!]?.sprite ?? '')) hole(s.x / 2, s.y / 2 - 6, 34, 0.7); else if (e.k === 'projectile') hole(s.x / 2, s.y / 2, 14, 0.6); }
    for (const p of this.particles) if (p.kind === 'glow' || p.kind === 'ring') hole(p.x / 2, p.y / 2, (p.r ?? 40) / 2 + 20, 0.6);
    ctx.drawImage(this.light, 0, 0);
    // warm tint near lights at night
    if (biome !== 'cave' && dark > 0.3) { ctx.fillStyle = `rgba(255,170,90,${(dark - 0.3) * 0.08})`; ctx.fillRect(0, 0, W, H); }
  }
  screenToWorld(sx: number, sy: number) { const z = S * this.zoom; return { x: (sx / z + this.camX) * 2, y: (sy / z + this.camY) * 2 }; }
  pick(sx: number, sy: number, ents: PubEntity[]): PubEntity | null {
    const w = this.screenToWorld(sx, sy); let best: PubEntity | null = null; let bd = 40;
    for (const e of ents) { if (e.k === 'projectile') continue; const s = this.smooth.get(e.id) ?? e; const size = e.k === 'monster' ? 16 * (MONSTERS[e.def!]?.size ?? 1) : 18; const d = Math.hypot(s.x - w.x, s.y - size - w.y + size * 0.4); if (d < Math.max(bd, size)) { bd = d; best = e; } }
    return best;
  }
  drawMinimap(mc: HTMLCanvasElement, a: Adapter) {
    const x = mc.getContext('2d')!; x.imageSmoothingEnabled = false; const W = mc.width, H = mc.height; x.fillStyle = '#10141c'; x.fillRect(0, 0, W, H);
    const sc = Math.min(W / this.mini.width, H / this.mini.height); const ox = (W - this.mini.width * sc) / 2, oy = (H - this.mini.height * sc) / 2; x.drawImage(this.mini, ox, oy, this.mini.width * sc, this.mini.height * sc);
    const k = sc * 2 / TILE;
    for (const pt of MAPS[this.map.def.id]!.portals) { x.fillStyle = '#80e0ff'; x.fillRect(ox + pt.x * 2 * sc - 1, oy + pt.y * 2 * sc - 1, 3, 3); }
    for (const e of a.entities()) { if (e.k === 'loot' || e.k === 'projectile') continue; x.fillStyle = e.id === a.myId ? '#ffffff' : e.k === 'monster' ? (MONSTERS[e.def!]?.rank === 'normal' ? '#ff5050' : '#ff00ff') : e.k === 'npc' ? '#ffe040' : e.k === 'bot' || e.k === 'player' ? '#60c0ff' : '#ffa0d0'; const sz = e.id === a.myId ? 3 : 2; x.fillRect(ox + e.x * k - sz / 2, oy + e.y * k - sz / 2, sz, sz); }
    const z = S * this.zoom; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.strokeRect(ox + this.camX * 2 * k, oy + this.camY * 2 * k, (this.cv.width / z) * 2 * k, (this.cv.height / z) * 2 * k);
  }
}
export { shade };
