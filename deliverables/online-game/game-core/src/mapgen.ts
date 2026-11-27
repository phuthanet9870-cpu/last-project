/** Deterministic map generation from MapDef (shared by client renderer and server collision). Data-driven: new maps need only a MapDef. */
import { MAPS, NPCS, type MapDef } from './content.js';
import { Rng } from './rng.js';

export const TILE = 32;
export enum T { Grass, DarkGrass, Path, Water, Sand, Snow, Stone, Wall, Wood, Plaza, Soil, Ice, Cliff, DeepWater, Bridge, Lava, Ruin, Ash, Coral }
export const BLOCKING_TILES = new Set([T.Water, T.Wall, T.Cliff, T.DeepWater, T.Lava]);
export type ObjKind = 'tree' | 'pine' | 'snowpine' | 'rock' | 'bush' | 'flower' | 'house' | 'fence' | 'lamp' | 'well' | 'crystal' | 'pillar' | 'stall' | 'banner' | 'crop' | 'mushroom' | 'stump' | 'torch' | 'bed' | 'table' | 'shelf' | 'rug' | 'carpet' | 'arch' | 'bench';
export interface MapObj { kind: ObjKind; x: number; y: number; w: number; h: number; blocks: boolean; variant: number }
export interface ResourceNode { id: string; type: 'ore' | 'tree' | 'herb' | 'fish'; x: number; y: number; tier: number }
export interface GenMap { def: MapDef; w: number; h: number; tiles: Uint8Array; solid: Uint8Array; objects: MapObj[]; nodes: ResourceNode[]; spawnAreas: [number, number][] }

function noise(seed: number, w: number, h: number, scale: number): Float32Array {
  const rng = new Rng(seed); const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
  const g = new Float32Array(gw * gh).map(() => rng.next());
  const out = new Float32Array(w * h);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix]!, b = g[iy * gw + ix + 1]!, c = g[(iy + 1) * gw + ix]!, d = g[(iy + 1) * gw + ix + 1]!;
    out[y * w + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  return out;
}

const cache = new Map<string, GenMap>();
export function getMap(id: string): GenMap {
  const c = cache.get(id); if (c) return c;
  const def = MAPS[id]; if (!def) throw new Error(`unknown map ${id}`);
  const g = generate(def); cache.set(id, g); return g;
}

function generate(def: MapDef): GenMap {
  const { w, h } = def; const rng = new Rng(def.seed);
  const tiles = new Uint8Array(w * h); const objects: MapObj[] = []; const nodes: ResourceNode[] = [];
  const set = (x: number, y: number, t: T) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; };
  const get = (x: number, y: number) => tiles[y * w + x] as T;
  const n1 = noise(def.seed * 7 + 1, w, h, 7), n2 = noise(def.seed * 13 + 5, w, h, 4);
  const base: Record<string, T> = { town: T.Grass, forest: T.DarkGrass, hills: T.Grass, snow: T.Snow, cave: T.Stone, arena: T.Sand, farm: T.Grass, house: T.Wood, crater: T.Sand, plaza: T.Grass, coast: T.Sand, ruins: T.Ruin, volcano: T.Ash };
  tiles.fill(base[def.biome]!);
  // biome terrain
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = n1[y * w + x]!, v2 = n2[y * w + x]!;
    if (def.biome === 'forest') { if (v > 0.62) set(x, y, T.Grass); if (v2 < 0.12) set(x, y, T.Path); }
    if (def.biome === 'hills') { if (v > 0.72) set(x, y, T.Cliff); else if (v > 0.6) set(x, y, T.Sand); else if (v2 < 0.2) set(x, y, T.DarkGrass); }
    if (def.biome === 'snow') { if (v < 0.22) set(x, y, T.Ice); if (v > 0.78) set(x, y, T.Cliff); }
    if (def.biome === 'crater') { const dx = x - w / 2, dy = y - h / 2; const r = Math.sqrt(dx * dx + dy * dy); if (r > Math.min(w, h) / 2 - 1) set(x, y, T.Cliff); else if (r < 6) set(x, y, T.Stone); }
    if (def.biome === 'coast') { if (x > w * 0.72 + Math.sin(y / 4) * 2) set(x, y, x > w * 0.8 + Math.sin(y / 4) * 2 ? T.DeepWater : T.Water); else if (v > 0.74) set(x, y, T.Coral); }
    if (def.biome === 'ruins') { if (v > 0.7) set(x, y, T.Grass); else if (v2 < 0.14) set(x, y, T.Stone); else if (v > 0.66 && v2 > 0.8) set(x, y, T.Cliff); }
    if (def.biome === 'volcano') { if (v > 0.76 && x > 3 && y > 3 && x < w - 4 && y < h - 4) set(x, y, T.Lava); else if (v2 < 0.18) set(x, y, T.Stone); }
    if (def.biome === 'cave') { if (v > 0.7 && x > 2 && y > 2 && x < w - 3 && y < h - 3) set(x, y, T.Wall); }
  }
  // river (forest/town/farm/snow)
  if (['forest', 'town', 'farm', 'snow'].includes(def.biome)) {
    const vertical = def.biome !== 'town';
    let p = vertical ? Math.floor(w * 0.45) : Math.floor(h * 0.78);
    for (let i = 0; i < (vertical ? h : w); i++) {
      p += rng.int(-1, 1); p = Math.max(6, Math.min((vertical ? w : h) - 7, p));
      for (let k = -1; k <= 1; k++) { const t = def.biome === 'snow' ? T.Ice : k === 0 ? T.DeepWater : T.Water; vertical ? set(p + k, i, t) : set(i, p + k, t); }
      if (vertical) { set(p - 2, i, T.Sand); set(p + 2, i, T.Sand); } else { set(i, p - 2, T.Sand); set(i, p + 2, T.Sand); }
    }
  }
  // borders
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) set(x, y, def.biome === 'cave' || def.biome === 'house' ? T.Wall : T.Cliff);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) set(x, y, def.biome === 'cave' || def.biome === 'house' ? T.Wall : T.Cliff);
  if (def.biome === 'house') for (let x = 0; x < w; x++) set(x, 1, T.Wall);

  // town layout
  const reserved = new Uint8Array(w * h);
  const reserve = (x: number, y: number, rw: number, rh: number) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i >= 0 && j >= 0 && i < w && j < h) reserved[j * w + i] = 1; };
  if (def.biome === 'town') {
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    for (let y = cy - 6; y <= cy + 9; y++) for (let x = cx - 10; x <= cx + 10; x++) set(x, y, T.Plaza);
    for (let x = 1; x < w - 1; x++) { set(x, 22, T.Path); set(x, 23, T.Path); }
    for (let y = 1; y < h - 1; y++) { set(28, y, get(28, y) === T.DeepWater || get(28, y) === T.Water ? T.Bridge : T.Path); set(29, y, get(29, y) === T.DeepWater || get(29, y) === T.Water ? T.Bridge : T.Path); }
    const houses: [number, number][] = [[6, 8], [14, 6], [38, 6], [46, 9], [6, 28], [44, 31], [14, 34], [38, 36], [20, 3], [34, 2]];
    houses.forEach(([x, y], i) => { objects.push({ kind: 'house', x, y, w: 5, h: 4, blocks: true, variant: i % 4 }); reserve(x - 1, y - 1, 7, 6); });
    for (const [x, y] of [[cx - 10, cy - 6], [cx + 10, cy - 6], [cx - 10, cy + 9], [cx + 10, cy + 9], [cx - 3, cy - 6], [cx + 3, cy + 9]]) objects.push({ kind: 'lamp', x: x!, y: y!, w: 1, h: 1, blocks: true, variant: 0 });
    objects.push({ kind: 'well', x: cx + 4, y: cy + 2, w: 2, h: 2, blocks: true, variant: 0 }); reserve(cx + 4, cy + 2, 2, 2);
    for (const [x, y, v] of [[20, 27, 0], [34, 27, 1], [24, 31, 2], [36, 33, 3]]) objects.push({ kind: 'stall', x: x!, y: y!, w: 2, h: 1, blocks: true, variant: v! });
    objects.push({ kind: 'banner', x: cx - 1, y: cy - 7, w: 1, h: 1, blocks: false, variant: 0 });
  }
  if (def.biome === 'farm') {
    for (let y = 6; y < 12; y++) for (let x = 4; x < 14; x++) if (y % 2 === 0) set(x, y, T.Soil);
    for (let x = 4; x < 14; x++) for (let y = 6; y < 12; y += 2) objects.push({ kind: 'crop', x, y, w: 1, h: 1, blocks: false, variant: (x + y) % 3 });
    for (let x = 22; x < 33; x++) { objects.push({ kind: 'fence', x, y: 5, w: 1, h: 1, blocks: true, variant: 0 }); objects.push({ kind: 'fence', x, y: 13, w: 1, h: 1, blocks: true, variant: 0 }); }
    objects.push({ kind: 'house', x: 16, y: 1, w: 5, h: 4, blocks: true, variant: 2 });
  }
  if (def.biome === 'house') {
    objects.push({ kind: 'bed', x: 2, y: 3, w: 2, h: 2, blocks: true, variant: 0 }, { kind: 'table', x: 9, y: 6, w: 2, h: 1, blocks: true, variant: 0 }, { kind: 'shelf', x: 15, y: 2, w: 3, h: 1, blocks: true, variant: 0 }, { kind: 'rug', x: 8, y: 9, w: 4, h: 3, blocks: false, variant: 0 });
  }
  if (def.biome === 'plaza') { // wedding plaza: stone square, central aisle, benches, flower beds, arch over the altar
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) set(x, y, T.Plaza);
    for (let y = 6; y < h - 1; y++) for (let x = 14; x <= 16; x++) objects.push({ kind: 'carpet', x, y, w: 1, h: 1, blocks: false, variant: x - 14 });
    objects.push({ kind: 'arch', x: 13, y: 2, w: 5, h: 3, blocks: false, variant: 0 });
    for (let y = 9; y <= 17; y += 2) for (const x of [9, 19]) { objects.push({ kind: 'bench', x, y, w: 2, h: 1, blocks: true, variant: 0 }); reserve(x, y, 2, 1); }
    for (const [x, y] of [[3, 3], [26, 3], [3, 20], [26, 20], [11, 4], [19, 4]]) objects.push({ kind: 'lamp', x: x!, y: y!, w: 1, h: 1, blocks: true, variant: 0 });
    for (let i = 0; i < 26; i++) { const x = i < 13 ? 2 + (i % 6) : 22 + (i % 6), y = 6 + Math.floor((i % 13) / 6) * 6 + (i % 3); objects.push({ kind: 'flower', x, y, w: 1, h: 1, blocks: false, variant: i % 4 }); }
  }
  if (def.biome === 'cave') for (let i = 0; i < 10; i++) objects.push({ kind: 'torch', x: rng.int(3, w - 4), y: rng.int(3, h - 4), w: 1, h: 1, blocks: false, variant: 0 });

  // carve paths spawn↔portals & NPC positions so world is reachable
  const carve = (ax: number, ay: number, bx: number, by: number) => {
    let x = ax, y = ay; const pathT = def.biome === 'cave' ? T.Stone : def.biome === 'snow' ? T.Snow : def.biome === 'house' ? T.Wood : T.Path;
    const step = (cx: number, cy: number) => { for (let k = -1; k <= 1; k++) for (let m = -1; m <= 1; m++) { const tx = cx + k, ty = cy + m; if (tx <= 0 || ty <= 0 || tx >= w - 1 || ty >= h - 1) continue; const t = get(tx, ty); if (t === T.Water || t === T.DeepWater) set(tx, ty, T.Bridge); else if (BLOCKING_TILES.has(t)) set(tx, ty, pathT); else if (def.biome !== 'town' && def.biome !== 'house' && k === 0 && m === 0 && t !== T.Bridge) set(tx, ty, pathT); reserve(tx, ty, 1, 1); } };
    while (x !== bx) { step(x, y); x += Math.sign(bx - x); }
    while (y !== by) { step(x, y); y += Math.sign(by - y); }
    step(x, y);
  };
  const [sx, sy] = def.spawn;
  for (const p of def.portals) { const px = Math.min(w - 2, Math.max(1, p.x)), py = Math.min(h - 2, Math.max(1, p.y)); carve(sx, sy, px, py); set(p.x, p.y, def.biome === 'cave' || def.biome === 'house' ? T.Stone : T.Path); }
  for (const n of Object.values(NPCS).filter((n) => n.map === def.id)) { carve(sx, sy, n.x, n.y + 1); reserve(n.x - 1, n.y - 1, 3, 3); }
  reserve(sx - 2, sy - 2, 5, 5);

  // decorations
  const free = (x: number, y: number) => x > 1 && y > 1 && x < w - 2 && y < h - 2 && !reserved[y * w + x] && !BLOCKING_TILES.has(get(x, y)) && get(x, y) !== T.Path && get(x, y) !== T.Plaza && get(x, y) !== T.Bridge && get(x, y) !== T.Soil;
  const occupied = new Set<number>();
  const place = (kind: ObjKind, x: number, y: number, blocks: boolean, variant = 0) => { if (!free(x, y) || occupied.has(y * w + x)) return false; occupied.add(y * w + x); objects.push({ kind, x, y, w: 1, h: 1, blocks, variant }); return true; };
  const dens: Record<string, [ObjKind, number, boolean][]> = {
    town: [['tree', 0.05, true], ['flower', 0.06, false], ['bush', 0.02, true]],
    forest: [['tree', 0.16, true], ['bush', 0.04, true], ['flower', 0.05, false], ['mushroom', 0.02, false], ['stump', 0.01, true]],
    hills: [['rock', 0.05, true], ['tree', 0.04, true], ['flower', 0.03, false], ['bush', 0.03, true]],
    snow: [['snowpine', 0.1, true], ['rock', 0.03, true], ['crystal', 0.01, true]],
    cave: [['pillar', 0.03, true], ['crystal', 0.02, true], ['mushroom', 0.02, false]],
    crater: [['rock', 0.03, true], ['crystal', 0.015, true]],
    farm: [['tree', 0.03, true], ['flower', 0.08, false]], arena: [['pillar', 0.01, true]], house: [], plaza: [],
    coast: [['rock', 0.02, true], ['bush', 0.015, true], ['flower', 0.02, false]], ruins: [['pillar', 0.035, true], ['rock', 0.02, true], ['bush', 0.02, true], ['flower', 0.02, false]], volcano: [['rock', 0.04, true], ['crystal', 0.012, true], ['stump', 0.01, true]],
  };
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    for (const [kind, p, b] of dens[def.biome]!) {
      const local = def.biome === 'forest' && kind === 'tree' ? p * (n1[y * w + x]! < 0.5 ? 1.6 : 0.4) : p;
      if (rng.chance(local)) { place(kind, x, y, b, rng.int(0, 3)); break; }
    }
  }
  // resource nodes
  for (const res of def.resources) for (let i = 0; i < res.count; i++) {
    for (let tries = 0; tries < 200; tries++) {
      const x = rng.int(2, w - 3), y = rng.int(2, h - 3);
      if (res.type === 'fish') { const t = get(x, y); const near = [get(x + 1, y), get(x - 1, y), get(x, y + 1), get(x, y - 1)]; if (BLOCKING_TILES.has(t) || !near.some((n) => n === T.Water || n === T.DeepWater) || occupied.has(y * w + x)) continue; }
      else if (!free(x, y) || occupied.has(y * w + x)) continue;
      occupied.add(y * w + x);
      nodes.push({ id: `${def.id}_${res.type}_${i}`, type: res.type, x, y, tier: def.levelReq >= 25 ? 3 : def.levelReq >= 10 ? 2 : 1 });
      break;
    }
  }
  // solidity
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = BLOCKING_TILES.has(tiles[i] as T) ? 1 : 0;
  for (const o of objects) if (o.blocks) {
    if (o.kind === 'house') { for (let j = o.y + 1; j < o.y + o.h; j++) for (let i = o.x; i < o.x + o.w; i++) solid[j * w + i] = 1; }
    else for (let j = o.y; j < o.y + o.h; j++) for (let i = o.x; i < o.x + o.w; i++) solid[j * w + i] = 1;
  }
  for (const n of nodes) if (n.type !== 'fish') solid[n.y * w + n.x] = 1;
  for (const n of Object.values(NPCS)) if (n.map === def.id) solid[n.y * w + n.x] = 1;
  const spawnAreas: [number, number][] = [];
  for (let tries = 0; tries < 4000 && spawnAreas.length < 80; tries++) { const x = rng.int(3, w - 4), y = rng.int(3, h - 4); if (!solid[y * w + x] && Math.hypot(x - sx, y - sy) > 8) spawnAreas.push([x, y]); }
  return { def, w, h, tiles, solid, objects, nodes, spawnAreas };
}

export function isSolidPx(m: GenMap, px: number, py: number): boolean {
  const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  return m.solid[y * m.w + x] === 1;
}

/** A* pathfinding on 8-connected grid (§11). Returns tile path. */
export function findPath(m: GenMap, sx: number, sy: number, tx: number, ty: number, maxNodes = 4000): [number, number][] | null {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || m.solid[ty * m.w + tx]) return null;
  const key = (x: number, y: number) => y * m.w + x;
  const open: { x: number; y: number; f: number; g: number }[] = [{ x: sx, y: sy, f: 0, g: 0 }];
  const came = new Map<number, number>(); const gs = new Map<number, number>([[key(sx, sy), 0]]);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur.x === tx && cur.y === ty) {
      const path: [number, number][] = []; let k = key(tx, ty);
      while (k !== key(sx, sy)) { path.push([k % m.w, Math.floor(k / m.w)]); k = came.get(k)!; }
      return path.reverse();
    }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue; const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.solid[key(nx, ny)]) continue;
      if (dx && dy && (m.solid[key(cur.x + dx, cur.y)] || m.solid[key(cur.x, cur.y + dy)])) continue;
      const g = cur.g + (dx && dy ? 1.414 : 1); const k = key(nx, ny);
      if (g < (gs.get(k) ?? Infinity)) { gs.set(k, g); came.set(k, key(cur.x, cur.y)); open.push({ x: nx, y: ny, g, f: g + Math.hypot(tx - nx, ty - ny) }); }
    }
  }
  return null;
}
