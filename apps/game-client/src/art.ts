/**
 * Original procedural pixel art (§53). Every sprite is generated in code from ASCII pixel maps or
 * drawing routines at 16px logical resolution and rendered at 2× with nearest-neighbour scaling.
 * No external or third-party art assets are used.
 */
export const S = 2; // pixel scale
type Ctx = CanvasRenderingContext2D;
const cache = new Map<string, HTMLCanvasElement>();
export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; return [c, x]; }
function cached(key: string, w: number, h: number, draw: (x: Ctx) => void): HTMLCanvasElement { const c = cache.get(key); if (c) return c; const [cv, x] = canvas(w, h); draw(x); cache.set(key, cv); return cv; }

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}
function hash(x: number, y: number, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const p = (x: Ctx, px: number, py: number, w: number, h: number, c: string) => { x.fillStyle = c; x.fillRect(px, py, w, h); };

/** Draw ASCII pixel map. Palette keys map chars → colors; '.' transparent. */
function ascii(x: Ctx, rows: string[], pal: Record<string, string>, ox = 0, oy = 0, flip = false) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]!; if (ch === '.' || ch === ' ') continue; const c = pal[ch]; if (!c) continue; x.fillStyle = c; x.fillRect(ox + (flip ? row.length - 1 - i : i), oy + j, 1, 1); } });
}

// ---------------- Tiles ----------------
const TILE_COL: Record<number, [string, string, string]> = {
  0: ['#6cb04a', '#5a9c3e', '#82c45a'], 1: ['#4f8a3a', '#447a32', '#5e9c44'], 2: ['#c8a46a', '#b48e58', '#d8b880'], 3: ['#3f8fd0', '#3480c0', '#5aa8e0'], 4: ['#e8d49a', '#d8c080', '#f4e4b4'],
  5: ['#eef4fa', '#dce6f0', '#ffffff'], 6: ['#6a6470', '#5a5460', '#7a7480'], 7: ['#3a3440', '#2a2430', '#4a4450'], 8: ['#a87850', '#946640', '#b88a60'], 9: ['#b8a890', '#a49478', '#c8bca8'],
  10: ['#7a5232', '#684428', '#8a6040'], 11: ['#bfe6f6', '#a8d8ee', '#dcf4ff'], 12: ['#8a7a6a', '#6e6052', '#a09080'], 13: ['#2c6aa8', '#245c94', '#3a7cbc'], 14: ['#9a6a3a', '#7a5028', '#b08050'],
};
export function tileCanvas(t: number, x: number, y: number, frame = 0): HTMLCanvasElement {
  const v = Math.floor(hash(x, y) * 4); const animated = t === 3 || t === 13;
  return cached(`t${t}_${v}_${animated ? frame : 0}`, 16, 16, (c) => {
    const [a, b, hi] = TILE_COL[t] ?? TILE_COL[0]!;
    p(c, 0, 0, 16, 16, a);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const r = hash(i + v * 17, j + v * 31, t); if (r < 0.12) p(c, i, j, 1, 1, b); else if (r > 0.95) p(c, i, j, 1, 1, hi); }
    if (t === 0 || t === 1) { for (let k = 0; k < 3; k++) { const gx = Math.floor(hash(k, v, 9) * 14) + 1, gy = Math.floor(hash(v, k, 7) * 13) + 2; p(c, gx, gy, 1, 2, b); p(c, gx + 1, gy - 1, 1, 2, hi); } if (v === 3) { p(c, 4, 9, 1, 1, '#ffe070'); p(c, 11, 4, 1, 1, '#ff90c0'); } }
    if (t === 2 || t === 9) { for (let k = 0; k < 4; k++) { const gx = Math.floor(hash(k, v, 3) * 13) + 1, gy = Math.floor(hash(v, k, 5) * 13) + 1; p(c, gx, gy, 2, 1, b); p(c, gx, gy - 1, 2, 1, hi); } }
    if (t === 9) { for (let i = 0; i < 16; i += 8) for (let j = 0; j < 16; j += 4) { p(c, ((j / 4) % 2) * 4 + i, j, 1, 4, b); p(c, 0, j, 16, 1, shade(a, -0.08)); } }
    if (t === 3 || t === 13) { const f = frame % 3; for (let k = 0; k < 5; k++) { const wx = (Math.floor(hash(k, v, 2) * 14) + f * 3) % 14, wy = Math.floor(hash(v, k, 4) * 14) + 1; p(c, wx, wy, 3, 1, hi); } }
    if (t === 7) { for (let j = 0; j < 16; j += 4) { p(c, 0, j, 16, 1, b); for (let i = (j / 4) % 2 ? 0 : 4; i < 16; i += 8) p(c, i, j, 1, 4, b); } p(c, 0, 0, 16, 1, hi); }
    if (t === 8 || t === 14) { for (let j = 0; j < 16; j += 4) { p(c, 0, j + 3, 16, 1, b); p(c, (j * 3) % 16, j, 1, 3, b); } }
    if (t === 10) { for (let j = 1; j < 16; j += 4) p(c, 0, j, 16, 2, b); }
    if (t === 12) { p(c, 0, 0, 16, 3, hi); for (let k = 0; k < 6; k++) p(c, Math.floor(hash(k, v) * 14), 4 + Math.floor(hash(v, k) * 11), 2, 1, b); p(c, 0, 13, 16, 3, shade(a, -0.25)); }
    if (t === 5) { for (let k = 0; k < 3; k++) p(c, Math.floor(hash(k, v, 8) * 15), Math.floor(hash(v, k, 6) * 15), 1, 1, '#c8d8e8'); }
    if (t === 11) { p(c, 2, 3, 5, 1, '#ffffff'); p(c, 9, 10, 4, 1, '#ffffff'); }
  });
}
export function isWater(t: number) { return t === 3 || t === 13; }

// ---------------- Characters ----------------
export interface CharLook { body: string; trim: string; hair: string; skin: string; hairStyle: number; bodyType: number; weapon: string; eyes?: string }
/** dir: 0 down, 1 left, 2 right, 3 up. action: walk frame 0-3, 'attack' 0/1, 'cast'. */
export function characterSprite(look: CharLook, dir: number, frame: number, action: 'idle' | 'walk' | 'attack' | 'cast' | 'dead'): HTMLCanvasElement {
  const key = `ch_${look.body}${look.trim}${look.hair}${look.skin}${look.hairStyle}${look.bodyType}${look.weapon}_${dir}_${frame}_${action}`;
  return cached(key, 20, 26, (x) => {
    const flip = dir === 2; const d = dir === 2 ? 1 : dir;
    x.save(); if (flip) { x.translate(20, 0); x.scale(-1, 1); }
    const ox = 2, oy = 1; const sk = look.skin, skD = shade(sk, -0.2), bd = look.body, bdD = shade(bd, -0.3), bdL = shade(bd, 0.2), tr = look.trim, hr = look.hair, hrD = shade(hr, -0.3), hrL = shade(hr, 0.25), out = '#2a1e1a';
    if (action === 'dead') { p(x, ox + 1, oy + 18, 14, 5, out); p(x, ox + 2, oy + 19, 7, 3, bd); p(x, ox + 9, oy + 19, 5, 3, sk); p(x, ox + 12, oy + 19, 3, 3, hr); x.restore(); return; }
    const walk = action === 'walk' ? frame % 4 : 0; const bob = walk === 1 || walk === 3 ? 1 : 0;
    const legL = walk === 1 ? -1 : walk === 3 ? 1 : 0;
    // legs & boots
    if (d === 1) { p(x, ox + 6 + legL, oy + 19, 3, 4, bdD); p(x, ox + 8 - legL, oy + 19, 3, 4, shade(bdD, -0.1)); p(x, ox + 5 + legL, oy + 22, 4, 2, '#4a3020'); p(x, ox + 8 - legL, oy + 22, 4, 2, '#3a2418'); }
    else { p(x, ox + 4, oy + 19 + (legL < 0 ? -1 : 0), 3, 4, bdD); p(x, ox + 9, oy + 19 + (legL > 0 ? -1 : 0), 3, 4, bdD); p(x, ox + 4, oy + 22 + (legL < 0 ? -1 : 0), 3, 2, '#4a3020'); p(x, ox + 9, oy + 22 + (legL > 0 ? -1 : 0), 3, 2, '#4a3020'); }
    const by = oy + bob;
    // body / tunic
    const wide = look.bodyType === 1 ? 0 : 1;
    p(x, ox + 3 + wide, by + 11, 10 - wide * 2, 9, out);
    p(x, ox + 4 + wide, by + 12, 8 - wide * 2, 7, bd); p(x, ox + 4 + wide, by + 12, 8 - wide * 2, 1, bdL); p(x, ox + 4 + wide, by + 17, 8 - wide * 2, 1, tr); p(x, ox + 4 + wide, by + 18, 8 - wide * 2, 1, bdD);
    if (look.bodyType === 1) { p(x, ox + 3, by + 18, 10, 2, bd); p(x, ox + 3, by + 19, 10, 1, bdD); }
    if (d === 0) { p(x, ox + 7, by + 12, 2, 5, tr); }
    // arms
    const atk = action === 'attack' && frame === 1; const cast = action === 'cast';
    if (d !== 1) { p(x, ox + 2 + wide, by + 12, 2, 6, bdD); p(x, ox + 2 + wide, by + 17, 2, 2, sk); p(x, ox + 12 - wide, by + 12 + (atk ? -2 : 0), 2, 6, bdD); p(x, ox + 12 - wide, by + 17 + (atk ? -3 : 0), 2, 2, sk); }
    else { p(x, ox + 7 + (atk ? -3 : 0), by + 13, 3, 5, bdD); p(x, ox + 7 + (atk ? -4 : 0), by + 17, 2, 2, sk); }
    if (cast) { p(x, ox + 1, by + 10, 2, 2, '#fff8c0'); p(x, ox + 14, by + 10, 2, 2, '#fff8c0'); }
    // head
    p(x, ox + 3, by + 2, 10, 10, out); p(x, ox + 4, by + 3, 8, 8, sk); p(x, ox + 4, by + 10, 8, 1, skD);
    if (d === 0) { p(x, ox + 5, by + 7, 2, 2, look.eyes ?? '#202040'); p(x, ox + 9, by + 7, 2, 2, look.eyes ?? '#202040'); p(x, ox + 5, by + 7, 1, 1, '#ffffff'); p(x, ox + 9, by + 7, 1, 1, '#ffffff'); p(x, ox + 4, by + 9, 1, 1, '#f0a0a0'); p(x, ox + 11, by + 9, 1, 1, '#f0a0a0'); }
    if (d === 1) { p(x, ox + 4, by + 7, 2, 2, look.eyes ?? '#202040'); p(x, ox + 4, by + 7, 1, 1, '#fff'); p(x, ox + 3, by + 8, 1, 2, sk); }
    // hair styles
    const hs = look.hairStyle % 4;
    p(x, ox + 3, by + 1, 10, 4, hr); p(x, ox + 4, by + 1, 6, 1, hrL);
    if (d === 3) { p(x, ox + 3, by + 1, 10, 10, hr); p(x, ox + 4, by + 2, 3, 1, hrL); if (hs === 1) p(x, ox + 4, by + 11, 8, 4, hr); if (hs === 3) { p(x, ox + 6, by + 10, 4, 6, hr); } }
    else if (d === 1) { p(x, ox + 8, by + 2, 5, 7, hr); p(x, ox + 3, by + 3, 2, 2, hr); if (hs === 1) p(x, ox + 9, by + 8, 4, 7, hr); if (hs === 2) { p(x, ox + 10, by, 3, 2, hrD); } if (hs === 3) p(x, ox + 12, by + 5, 3, 6, hr); }
    else { p(x, ox + 3, by + 3, 2, 4, hr); p(x, ox + 11, by + 3, 2, 4, hr); if (hs === 0) p(x, ox + 6, by + 4, 3, 1, hr); if (hs === 1) { p(x, ox + 2, by + 4, 2, 10, hr); p(x, ox + 12, by + 4, 2, 10, hr); } if (hs === 2) { p(x, ox + 4, by, 2, 2, hrD); p(x, ox + 8, by - 1, 2, 2, hrD); p(x, ox + 11, by, 2, 2, hrD); } if (hs === 3) { p(x, ox + 12, by + 3, 3, 3, hr); p(x, ox + 13, by + 6, 2, 6, hr); } }
    p(x, ox + 3, by + 4, 10, 1, hrD);
    // weapon
    drawWeapon(x, look.weapon, ox, by, d, atk || cast);
    x.restore();
  });
}
function drawWeapon(x: Ctx, w: string, ox: number, by: number, d: number, swing: boolean) {
  const metal = '#d8dce8', metalD = '#8890a0', wood = '#8a5a30', gold = '#e0b040';
  const hx = d === 1 ? ox + 3 : ox + 13, hy = by + 15;
  if (d === 3) return; // behind body when facing up
  switch (w) {
    case 'sword': case 'greatsword': { const len = w === 'greatsword' ? 11 : 8; if (swing) { for (let i = 0; i < len; i++) p(x, hx + (d === 1 ? -i : i) - (d === 1 ? 2 : 0), hy - 3 - Math.floor(i / 3), 2, 1, metal); } else { p(x, hx, hy - len, 1, len, metal); p(x, hx + 1, hy - len, 1, len, metalD); p(x, hx - 1, hy, 4, 1, gold); p(x, hx, hy + 1, 2, 2, wood); } break; }
    case 'spear': p(x, hx, hy - 13, 1, 17, wood); p(x, hx - 1, hy - 15, 3, 3, metal); break;
    case 'dagger': p(x, hx, hy - 4, 1, 4, metal); p(x, hx - 1, hy, 3, 1, gold); break;
    case 'bow': p(x, hx + 1, hy - 8, 1, 2, wood); p(x, hx + 2, hy - 6, 1, 8, wood); p(x, hx + 1, hy + 2, 1, 2, wood); p(x, hx, hy - 7, 1, 10, '#f0f0e0'); break;
    case 'staff': p(x, hx, hy - 12, 1, 16, wood); p(x, hx - 1, hy - 14, 3, 3, '#80e0ff'); p(x, hx, hy - 13, 1, 1, '#ffffff'); break;
    case 'tome': p(x, hx - 1, hy - 2, 4, 5, '#6a3aa0'); p(x, hx, hy - 1, 2, 3, '#f0e0c0'); break;
    case 'knuckle': p(x, hx - 1, hy + 1, 3, 2, gold); break;
    case 'gun': p(x, hx - 1, hy - 1, 6, 2, '#505860'); p(x, hx - 1, hy + 1, 2, 2, wood); p(x, hx + 4, hy - 2, 1, 1, '#ff8030'); break;
    case 'lute': p(x, hx - 2, hy - 1, 4, 5, '#c08040'); p(x, hx, hy - 7, 1, 6, wood); p(x, hx - 1, hy, 2, 2, '#402010'); break;
    case 'cards': p(x, hx, hy - 2, 3, 4, '#f0f0f0'); p(x, hx + 1, hy - 1, 1, 2, '#d02020'); break;
    case 'whip': p(x, hx, hy - 1, 1, 3, wood); p(x, hx + 1, hy - 3, 1, 1, '#603010'); p(x, hx + 2, hy - 5, 1, 2, '#603010'); p(x, hx + 3, hy - 7, 1, 2, '#603010'); break;
  }
}

// ---------------- Monsters / pets ----------------
const M_SPRITES: Record<string, string[][]> = {
  slime: [[
    '................', '................', '................', '................', '.......aa.......', '.....aabbaa.....', '....abbccbba....', '...abbcbbbbba...', '..abbbbbbbbbba..', '..abkkbbbbkkba..', '.abbkwbbbbkwbba.', '.abbbbbmmbbbbba.', '.abbbbbbbbbbbba.', '..adddddddddda..', '...aaaaaaaaaa...', '................'],
  [
    '................', '................', '................', '................', '................', '................', '......aaaa......', '....aabbccaa....', '..aabbbcbbbbaa..', '.abbkkbbbbkkbba.', '.abbkwbbbbkwbba.', 'abbbbbbmmbbbbbba', 'abbbbbbbbbbbbbba', '.adddddddddddda.', '..aaaaaaaaaaaa..', '................']],
  bunny: [[
    '....aa....aa....', '...abca..abca...', '...abca..abca...', '...abca..abca...', '....aba..aba....', '...abbbaabbba...', '..abbbbbbbbbba..', '..abkbbbbbbkba..', '..abbbbppbbbba..', '...abbbbbbbba...', '..abbbbbbbbbba..', '..abbbbbbbbbbba.', '..abbbbbbbbbba..', '...abba..abba...', '...aaa....aaa...', '................'],
  [
    '................', '....aa....aa....', '...abca..abca...', '...abca..abca...', '....aba..aba....', '...abbbaabbba...', '..abbbbbbbbbba..', '..abkbbbbbbkba..', '..abbbbppbbbba..', '...abbbbbbbba...', '..abbbbbbbbbba..', '..abbbbbbbbbbba.', '..abbbbbbbbbba..', '..abba....abba..', '..aaa......aaa..', '................']],
  mushroom: [[
    '................', '.....aaaaaa.....', '...aabbbbbbaa...', '..abbwwbbbwwba..', '.abbbwwbbbwwbba.', '.abbbbbbbbbbbba.', 'abwwbbbbbwwbbbba', 'aaaaaaaaaaaaaaaa', '....acccccca....', '....ackcckca....', '....acccccca....', '....accmmcca....', '....acccccca....', '...aacccccca....', '...aa.aaaa.aa...', '................']],
  bat: [[
    '................', '................', 'a..............a', 'aa....a..a....aa', 'aba..abaaba..aba', 'abba.abbbba.abba', 'abbbaabbbbaabbba', 'abbbbbkbbkbbbbba', '.abbbbbbbbbbbba.', '..abba.ww.abba..', '...aa.abba.aa...', '......abba......', '.......aa.......', '................', '................', '................'],
  [
    '................', '................', '................', '......a..a......', '.....abaaba.....', '.....abbbba.....', '..aaaabbbbaaaa..', '.abbbbkbbkbbbba.', 'abbbbbbbbbbbbbba', 'abba..ww..abbbba', 'aba...abba..abba', 'aa.....aa....aba', 'a.............aa', '................', '................', '................']],
  wolf: [[
    '................', '................', '...........aa...', '..........abba..', '.a.......abbbba.', 'aba.....abbkbbaa', 'abaaaaaaabbbbbbw', '.abbbbbbbbbbbaa.', '.abbbbbbbbbbba..', '.abbcbbbbbcbba..', '.abbbbbbbbbbba..', '..abaab..abaab..', '..aba.a..aba.a..', '..aa.....aa.....', '................', '................'],
  [
    '................', '................', '...........aa...', '..........abba..', '.a.......abbbba.', 'aba.....abbkbbaa', 'abaaaaaaabbbbbbw', '.abbbbbbbbbbbaa.', '.abbbbbbbbbbba..', '.abbcbbbbbcbba..', '.abbbbbbbbbbba..', '...abab..abab...', '...aaba..aaba...', '....aa....aa....', '................', '................']],
  wisp: [[
    '................', '.......a........', '......aca.......', '.....acca.a.....', '....acccaaca....', '...accwwcccca...', '..acccwwwcccca..', '..accckccckcca..', '..acccccccccca..', '..accccmmcccca..', '...acccccccca...', '....acccccca....', '.....aacccaa....', '.......aa.......', '................', '................'],
  [
    '................', '................', '.......a..a.....', '......aca.ca....', '.....accaacca...', '...aaccwwcccca..', '..acccwwwcccca..', '..accckccckcca..', '..acccccccccca..', '..accccmmcccca..', '...acccccccca...', '....accccccca...', '.....aaccccaa...', '.......aaa......', '................', '................']],
  beetle: [[
    '................', '................', '.....aa..aa.....', '......a..a......', '....aaaaaaaa....', '...abbbbbbbbba..', '..abbcbbbbcbbba.', '.abbccbbbbccbbba', '.abbbbbbbbbbbbba', 'aabbbbbaabbbbbaa', '.abbbbbabbbbbba.', '..abbbbabbbbba..', '.a.aaaaaaaaaa.a.', 'a..a..a..a..a..a', '................', '................']],
  golem: [[
    '................', '.....aaaaaa.....', '....abbbbbba....', '....abkbbkba....', '....abbbbbba....', '..aaaaaaaaaaaa..', '.abbbbcccbbbbba.', 'abbbbbcccbbbbbba', 'abba.abbbba.abba', 'abba.abbbba.abba', 'aaa..abbbba..aaa', '.....abaaba.....', '....abba.abba...', '....abba.abba...', '....aaaa.aaaa...', '................']],
  boar: [[
    '................', '................', '................', '.........aaaa...', '..aaaaaaabbbba..', '.abbbbbbbbbkbba.', 'abbbbbbbbbbbbbwa', 'abbcbbbbbbbbbpp.', 'abbbbbbbbbbbbaa.', '.abbbbbbbbbbba..', '..abaab..abaab..', '..aba.a..aba.a..', '..aa.....aa.....', '................', '................', '................']],
  bird: [[
    '................', '................', '................', '.........aaa....', '........abbka...', '........abbbaww.', '..aaaaaaabbba...', '.abcccccbbbba...', 'abcccccbbbbba...', '.aaaaabbbbbba...', '......abbbba....', '.......a..a.....', '......aa..aa....', '................', '................', '................'],
  [
    '................', '..a.............', '..aba............', '..abca...aaa....', '...abca.abbka...', '....abcaabbbaww.', '.....abcbbbba...', '......abbbbba...', '.....abbbbbba...', '......abbbbba...', '......abbbba....', '.......a..a.....', '......aa..aa....', '................', '................', '................']],
  spider: [[
    '................', '................', '.a....aaaa....a.', '..a..abbbba..a..', '...aabbbbbbaa...', 'aa.abkbbbbkba.aa', '..aabbbbbbbbaa..', '.a.abbbccbbba.a.', 'a..abbbbbbbba..a', '..a.abbbbbba.a..', '.a...aaaaaa...a.', 'a..............a', '................', '................', '................', '................']],
  ghost: [[
    '................', '.....aaaaaa.....', '....abbbbbba....', '...abbbbbbbba...', '..abbkkbbkkbba..', '..abbkkbbkkbba..', '..abbbbbbbbbba..', '..abbbbmmbbbba..', '..abbbbbbbbbba..', '..abbbbbbbbbba..', '..abbbbbbbbbba..', '..abbabbabbabba.', '..aba.aba.aba.a.', '................', '................', '................']],
  crab: [[
    '................', '................', '.aa..........aa.', 'abba........abba', 'abba..k..k..abba', '.aba..a..a..aba.', '..aaaaaaaaaaaa..', '..abbbbbbbbbbba.', '.abbbcbbbbcbbbba', '.abbbbbbbbbbbbba', '..aaaaaaaaaaaa..', '..a.a.a..a.a.a..', '.a..a.a..a.a..a.', '................', '................', '................']],
};
export function monsterSprite(kind: string, color: string, frame: number): HTMLCanvasElement {
  const frames = M_SPRITES[kind] ?? M_SPRITES.slime!; const rows = frames[frame % frames.length]!;
  return cached(`m_${kind}_${color}_${frame % frames.length}`, 16, 16, (x) => ascii(x, rows, { a: shade(color, -0.55), b: color, c: shade(color, 0.35), d: shade(color, -0.25), k: '#1a1020', w: '#ffffff', m: shade(color, -0.6), p: '#ff9fb0' }));
}
export function mountSprite(kind: string, color: string, frame: number): HTMLCanvasElement {
  return cached(`mt_${kind}_${color}_${frame % 2}`, 24, 16, (x) => {
    const c = color, d = shade(c, -0.4), l = shade(c, 0.3), o = '#2a1e1a'; const f = frame % 2;
    if (kind === 'owl') { p(x, 4, 4, 16, 9, o); p(x, 5, 5, 14, 7, c); p(x, 5, 5, 14, 2, l); p(x, f ? 0 : 1, 6 - f, 5, 4, d); p(x, f ? 19 : 18, 6 - f, 5, 4, d); p(x, 17, 2, 6, 5, o); p(x, 18, 3, 4, 3, c); p(x, 19, 4, 1, 1, '#ffd040'); p(x, 22, 5, 2, 1, '#e0a020'); return; }
    p(x, 3, 5, 15, 7, o); p(x, 4, 6, 13, 5, c); p(x, 4, 6, 13, 1, l);
    if (kind === 'lizard') { p(x, 0, 7, 4, 2, d); p(x, 17, 4, 6, 5, o); p(x, 18, 5, 5, 3, c); p(x, 21, 5, 1, 1, '#ffff60'); }
    else { p(x, 16, 1, 5, 7, o); p(x, 17, 2, 4, 5, c); p(x, 20, 3, 1, 1, '#101010'); p(x, 1, 5, 3, 5, d); if (kind === 'ram') { p(x, 15, 0, 3, 3, '#c0b090'); p(x, 18, 0, 3, 2, '#c0b090'); } else p(x, 15, 1, 2, 5, d); }
    const lg = f ? 1 : 0; p(x, 5 + lg, 11, 2, 4, d); p(x, 9 - lg, 11, 2, 4, d); p(x, 12 + lg, 11, 2, 4, d); p(x, 15 - lg, 11, 2, 4, d);
  });
}

// ---------------- Objects ----------------
export function objectSprite(kind: string, variant: number, w: number, h: number, night = false): HTMLCanvasElement {
  return cached(`o_${kind}_${variant}_${w}_${h}_${night ? 1 : 0}`, w * 16, h * 16 + (['tree', 'pine', 'snowpine', 'lamp', 'house'].includes(kind) ? 16 : 0), (x) => {
    const o = '#2a1e1a';
    switch (kind) {
      case 'tree': { const g = ['#3e8a36', '#4a9a3a', '#5aa040', '#3a7a40'][variant]!; p(x, 6, 18, 4, 14, '#6a4424'); p(x, 7, 18, 1, 14, '#8a5a30'); const blob = (cx: number, cy: number, r: number, col: string) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) p(x, cx + i, cy + j, 1, 1, col); }; blob(8, 11, 8, o); blob(8, 11, 7, shade(g, -0.2)); blob(7, 9, 6, g); blob(5, 7, 3, shade(g, 0.25)); if (variant === 1) { p(x, 4, 12, 1, 1, '#e04040'); p(x, 11, 9, 1, 1, '#e04040'); p(x, 9, 14, 1, 1, '#e04040'); } break; }
      case 'pine': case 'snowpine': { const g = kind === 'snowpine' ? '#3a6a5a' : '#2f6e3a'; p(x, 7, 26, 2, 6, '#5a3a20'); for (let k = 0; k < 4; k++) { const wdt = 4 + k * 3; const yy = 3 + k * 6; p(x, 8 - wdt / 2 - 1, yy, wdt + 2, 8, o); p(x, 8 - wdt / 2, yy + 1, wdt, 6, g); p(x, 8 - wdt / 2, yy + 1, Math.ceil(wdt / 2), 2, shade(g, 0.2)); if (kind === 'snowpine') p(x, 8 - wdt / 2, yy + 1, wdt, 2, '#f4f8ff'); } break; }
      case 'rock': p(x, 2, 6, 12, 9, o); p(x, 3, 7, 10, 7, '#8a8a90'); p(x, 4, 7, 6, 2, '#b0b0b8'); p(x, 3, 12, 10, 2, '#6a6a70'); break;
      case 'bush': p(x, 1, 6, 14, 9, o); p(x, 2, 7, 12, 7, '#3e8a36'); p(x, 3, 7, 6, 3, '#5aaa48'); if (variant % 2) { p(x, 5, 9, 1, 1, '#ff6080'); p(x, 10, 11, 1, 1, '#ff6080'); } break;
      case 'flower': { const cols = ['#ff7090', '#ffe060', '#a080ff', '#ffffff']; for (let k = 0; k < 3; k++) { const fx = 3 + k * 4 + (variant % 2), fy = 8 + ((k * 5 + variant) % 5); p(x, fx, fy + 2, 1, 3, '#3a8a30'); p(x, fx - 1, fy, 3, 3, cols[(variant + k) % 4]!); p(x, fx, fy + 1, 1, 1, '#ffd040'); } break; }
      case 'mushroom': p(x, 6, 10, 2, 4, '#f0e0c0'); p(x, 4, 7, 6, 4, '#d04040'); p(x, 5, 8, 1, 1, '#fff'); p(x, 10, 11, 2, 3, '#f0e0c0'); p(x, 9, 9, 4, 3, '#c08040'); break;
      case 'stump': p(x, 3, 8, 10, 7, o); p(x, 4, 9, 8, 5, '#7a5030'); p(x, 4, 9, 8, 2, '#c09060'); p(x, 7, 9, 2, 1, '#8a6040'); break;
      case 'crystal': p(x, 6, 2, 4, 13, o); p(x, 7, 3, 2, 11, '#80e0ff'); p(x, 7, 3, 1, 8, '#e0ffff'); p(x, 3, 8, 3, 7, o); p(x, 4, 9, 1, 5, '#a080ff'); p(x, 10, 7, 3, 8, o); p(x, 11, 8, 1, 6, '#80ffd0'); break;
      case 'pillar': p(x, 3, 0, 10, 16, o); p(x, 4, 1, 8, 14, '#8a8494'); p(x, 4, 1, 2, 14, '#a8a2b0'); p(x, 3, 0, 10, 2, '#a8a2b0'); break;
      case 'torch': p(x, 7, 6, 2, 8, '#6a4424'); p(x, 6, 3, 4, 4, '#ff9030'); p(x, 7, 2, 2, 2, '#ffe060'); break;
      case 'lamp': p(x, 7, 6, 2, 26, '#3a3030'); p(x, 4, 2, 8, 6, o); p(x, 5, 3, 6, 4, night ? '#fff0a0' : '#e0c080'); p(x, 4, 1, 8, 1, '#3a3030'); break;
      case 'fence': p(x, 0, 7, 16, 2, '#a07040'); p(x, 0, 11, 16, 2, '#8a5a30'); p(x, 2, 4, 2, 11, '#b08050'); p(x, 12, 4, 2, 11, '#b08050'); break;
      case 'well': p(x, 2, 10, 28, 20, o); p(x, 3, 11, 26, 18, '#8a8494'); for (let i = 3; i < 29; i += 6) p(x, i, 11, 1, 18, '#6a6474'); p(x, 7, 14, 18, 8, '#2a5a8a'); p(x, 4, 0, 2, 12, '#6a4424'); p(x, 26, 0, 2, 12, '#6a4424'); p(x, 2, 0, 28, 3, '#a03a2a'); break;
      case 'stall': { const c = ['#e04040', '#4080e0', '#40a060', '#e0a020'][variant]!; p(x, 0, 0, 32, 6, o); for (let i = 0; i < 32; i += 4) p(x, i, 1, 2, 4, i % 8 ? '#ffffff' : c); p(x, 1, 6, 2, 10, '#6a4424'); p(x, 29, 6, 2, 10, '#6a4424'); p(x, 1, 10, 30, 5, '#a87850'); p(x, 4, 8, 3, 2, '#e0e040'); p(x, 10, 8, 3, 2, '#ff8040'); p(x, 18, 8, 3, 2, '#80c040'); break; }
      case 'banner': p(x, 7, 0, 2, 16, '#5a3a20'); p(x, 9, 1, 6, 9, '#c03030'); p(x, 10, 3, 4, 4, '#ffd040'); break;
      case 'crop': { const c = ['#6ac040', '#e0c040', '#e06030'][variant]!; p(x, 5, 8, 2, 6, '#3a8a30'); p(x, 9, 7, 2, 7, '#3a8a30'); p(x, 4, 6, 3, 3, c); p(x, 9, 5, 3, 3, c); break; }
      case 'bed': p(x, 0, 2, 32, 28, o); p(x, 1, 3, 30, 26, '#8a5a30'); p(x, 3, 4, 26, 7, '#ffffff'); p(x, 3, 11, 26, 17, '#4a7ac0'); p(x, 3, 11, 26, 2, '#6a9ae0'); break;
      case 'table': p(x, 0, 2, 32, 12, o); p(x, 1, 3, 30, 8, '#a87850'); p(x, 2, 11, 3, 5, '#6a4424'); p(x, 27, 11, 3, 5, '#6a4424'); p(x, 12, 4, 6, 3, '#ffffff'); break;
      case 'shelf': p(x, 0, 0, 48, 16, o); p(x, 1, 1, 46, 14, '#7a5030'); for (let i = 3; i < 45; i += 4) p(x, i, 3, 3, 5, ['#c03030', '#3060c0', '#30a050', '#e0b030'][i % 4]!); p(x, 1, 8, 46, 1, '#5a3a20'); break;
      case 'rug': p(x, 0, 0, 64, 48, '#a03a3a'); p(x, 4, 4, 56, 40, '#c05050'); p(x, 8, 8, 48, 32, '#e0b040'); p(x, 12, 12, 40, 24, '#c05050'); break;
      case 'house': {
        const roof = ['#b84a3a', '#3a6ab0', '#5a8a3a', '#8a4aa0'][variant]!; const W = w * 16, H = h * 16 + 16;
        p(x, 2, 26, W - 4, H - 26, o); p(x, 3, 27, W - 6, H - 28, '#e8d8b8'); for (let j = 30; j < H - 2; j += 6) p(x, 3, j, W - 6, 1, '#d0c0a0');
        for (let j = 0; j < 28; j++) { const inset = Math.max(0, 18 - j); p(x, inset, j + 2, W - inset * 2, 1, j % 4 === 0 ? shade(roof, -0.3) : roof); p(x, inset, j + 2, 2, 1, o); p(x, W - inset - 2, j + 2, 2, 1, o); }
        p(x, 0, 28, W, 3, shade(roof, -0.4)); p(x, W - 18, 4, 6, 12, '#7a6a6a'); p(x, W - 19, 3, 8, 2, '#5a4a4a');
        const dx = Math.floor(W / 2) - 6; p(x, dx, H - 22, 12, 20, o); p(x, dx + 1, H - 21, 10, 19, '#7a4a28'); p(x, dx + 8, H - 12, 2, 2, '#e0c040');
        const win = night ? '#ffe9a0' : '#8ac8f0'; for (const wx of [10, W - 26]) { p(x, wx, H - 26, 14, 12, o); p(x, wx + 1, H - 25, 12, 10, win); p(x, wx + 7, H - 25, 1, 10, o); p(x, wx + 1, H - 20, 12, 1, o); p(x, wx, H - 14, 14, 2, '#a07040'); }
        break;
      }
    }
  });
}

// ---------------- Item & skill icons ----------------
const ICON: Record<string, string[]> = {
  sword: ['..........aa', '.........aba', '........abba', '.......abba.', '......abba..', '.....abba...', '.aa.abba....', '.acabba.....', '..acba......', '..aacca.....', '.ad.aacc....', 'add...aa....'],
  greatsword: ['.........aaa', '........abba', '.......abbba', '......abbba.', '.....abbba..', '....abbba...', '.aaabbba....', '.accbba.....', '..acca......', '..adaacc....', '.add..aa....', 'add.........'],
  spear: ['.........aaa', '........abba', '.........aba', '........ad.a', '.......ad...', '......ad....', '.....ad.....', '....ad......', '...ad.......', '..ad........', '.ad.........', 'ad..........'],
  dagger: ['............', '............', '.......aa...', '......aba...', '.....abba...', '....abba....', '...abba.....', '.acaba......', '..acca......', '.ad.ac......', 'ad..........', '............'],
  bow: ['....aa......', '...add......', '..ad.e......', '.ad..e......', '.ad...e.....', 'ad....e.....', 'ad....e.....', '.ad...e.....', '.ad..e......', '..ad.e......', '...add......', '....aa......'],
  staff: ['........aaa.', '.......acwca', '.......accca', '........aca.', '.......ad...', '......ad....', '.....ad.....', '....ad......', '...ad.......', '..ad........', '.ad.........', 'ad..........'],
  tome: ['............', '.aaaaaaaaa..', '.abbbbbbbwa.', '.abbccbbbwa.', '.abccccbbwa.', '.abbccbbbwa.', '.abbbbbbbwa.', '.abbbbbbbwa.', '.abbbbbbbwa.', '.aaaaaaaaaa.', '..dddddddd..', '............'],
  knuckle: ['............', '............', '..aaaaaaaa..', '.abcbcbcbca.', '.abbbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '...abbbba...', '....aaaa....', '............', '............', '............'],
  gun: ['............', '............', '............', 'aaaaaaaaaaa.', 'abbbbbbbbbca', 'aaaaaabbbaa.', '....addaaa..', '....add.....', '...add......', '...aaa......', '............', '............'],
  lute: ['..........aa', '.........ada', '........ad..', '.......ad...', '...aaaad....', '..abbbbaa...', '.abbaabbba..', '.abaddabba..', '.abbaabbba..', '..abbbbba...', '...aaaaa....', '............'],
  cards: ['............', '..aaaaa.....', '..awwwa.....', '..awcwaaaa..', '..awwwawwa..', '..aaaaawca..', '.....awwwa..', '.....aaaaa..', '............', '............', '............', '............'],
  whip: ['............', '.........aa.', '........a..a', '.......a....', '......a.....', '.....a......', '....a.......', '...ad.......', '..ad........', '.ad.........', 'ad..........', '............'],
  helm: ['............', '...aaaaaa...', '..abbbbbba..', '.abccbbbbba.', '.abcbbbbbba.', '.abbbbbbbba.', '.aaaaaaaaaa.', '.ab.aaaa.ba.', '.ab......ba.', '.aa......aa.', '............', '............'],
  armor: ['............', '.aaa....aaa.', 'abbaaaaaabba', 'abbbbbbbbbba', '.aabbccbbaa.', '..abbccbba..', '..abbbbbba..', '..abbbbbba..', '..abbbbbba..', '..aaaaaaaa..', '............', '............'],
  gloves: ['............', '....a.a.a...', '...ababab...', '...abababa..', '...abbbbba..', '...abbbbba..', 'aa.abbbbba..', 'abaabbbbba..', '.abbbbbbba..', '..accccca...', '..aaaaaaa...', '............'],
  boots: ['............', '...aaaa.....', '...abba.....', '...abba.....', '...abba.....', '...abba.....', '...abbaaaa..', '..abbbbbbba.', '..abbbbbbbba', '..accccccca.', '..aaaaaaaa..', '............'],
  belt: ['............', '............', '............', 'aaaaaaaaaaaa', 'abbbbaaabbba', 'abbbbawabbba', 'abbbbaaabbba', 'aaaaaaaaaaaa', '............', '............', '............', '............'],
  shield: ['............', '.aaaaaaaaaa.', '.abbbbbbbba.', '.abccbbbcba.', '.abcbbbbcba.', '.abbbccbbba.', '.abbbccbbba.', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....aaaa....', '............'],
  ring: ['............', '....aaaa....', '...awcwwa...', '....aaaa....', '...a....a...', '..ad....da..', '..ad....da..', '..ad....da..', '...a....a...', '....aaaa....', '............', '............'],
  amulet: ['..a......a..', '...a....a...', '....a..a....', '.....aa.....', '....abba....', '...abccba...', '...abcwba...', '...abbbba...', '....abba....', '.....aa.....', '............', '............'],
  earring: ['............', '.....aa.....', '.....a......', '.....a......', '....aba.....', '...abcba....', '...abbba....', '....aba.....', '.....a......', '....aba.....', '.....a......', '............'],
  potion: ['....aaaa....', '....adda....', '.....aa.....', '....abba....', '...abbbba...', '..abwbbbba..', '..abwbbbba..', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....aaaa....', '............'],
  food: ['............', '............', '....aaaa....', '..aacbbcaa..', '.abbbbbbbba.', '.abcbbbbcba.', 'aaaaaaaaaaaa', 'awwwwwwwwwwa', '.awwwwwwwwa.', '..aaaaaaaa..', '............', '............'],
  scroll: ['............', '.aaaaaaaaaa.', 'adwwwwwwwwda', '.awcccccwwa.', '.awwwwwwwwa.', '.awccccwwwa.', '.awwwwwwwwa.', '.awcccwwwwa.', 'adwwwwwwwwda', '.aaaaaaaaaa.', '............', '............'],
  book: ['............', '.aaaaaaaaa..', '.abbbbbbbwa.', '.abccccbbwa.', '.abbbbbbbwa.', '.abccccbbwa.', '.abbbbbbbwa.', '.abbbbbbbwa.', '.aaaaaaaaaa.', '..dddddddd..', '............', '............'],
  gel: ['............', '............', '............', '.....aa.....', '....abba....', '...abcbba...', '..abcbbbba..', '..abbbbbba..', '..abbbbbba..', '...aaaaaa...', '............', '............'],
  fur: ['............', '...aaaaaa...', '..abbbbbba..', '.abcbbcbbba.', '.abbbbbbbba.', '.abbcbbcbba.', '.abbbbbbbba.', '..abbbbbba..', '...aaaaaa...', '............', '............', '............'],
  mushroom: ['............', '...aaaaaa...', '..abbbbbba..', '.abwbbbwbba.', '.abbbbbbbba.', '.aaaaaaaaaa.', '....awwa....', '....awwa....', '....awwa....', '....aaaa....', '............', '............'],
  wing: ['............', 'aa..........', 'aba.........', 'abba........', 'abbbaa......', '.abbbbaa....', '.abbbbbbaa..', '..abbbbbbba.', '...abbbbbbba', '....aaaaaaaa', '............', '............'],
  fang: ['............', '..aaaaaaaa..', '..awwwwwwa..', '...awwwwa...', '...awwwwa...', '....awwa....', '....awwa....', '.....aa.....', '............', '............', '............', '............'],
  shell: ['............', '....aaaa....', '...abbbba...', '..abcbbcba..', '.abbbbbbbba.', '.abcbbbbcba.', '.abbbbbbbba.', '..abbbbbba..', '...aaaaaa...', '............', '............', '............'],
  orb: ['............', '....aaaa....', '...abbbba...', '..abwcbbba..', '..abccbbba..', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....aaaa....', '............', '............', '............'],
  crystal: ['.....aa.....', '....abba....', '...abwbba...', '...abwbba...', '..abbwbbba..', '..abbbbbba..', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....', '............', '............'],
  dust: ['............', '............', '..b...c..b..', '....b...b...', '.c..aaaa..c.', '...abbbba...', '..abcbbcba..', '..abbbbbba..', '...aaaaaa...', '............', '............', '............'],
  heart: ['............', '.aaa..aaa...', 'abbba abbba.', 'abwbbabbbba.', 'abbbbbbbbba.', '.abbbbbbba..', '..abbbbba...', '...abbba....', '....aba.....', '.....a......', '............', '............'],
  ore: ['............', '............', '....aaaa....', '...abbcba...', '..abcbbbbaa.', '.abbbbbcbbba', '.abbcbbbbbba', '.abbbbbbcba.', '..aaaaaaaa..', '............', '............', '............'],
  log: ['............', '............', '.aaaaaaaaa..', 'abbbbbbbbaca', 'abdbbbdbbacca', 'abbbbbbbbacca', 'abbdbbbbbaca', '.aaaaaaaaa..', '............', '............', '............', '............'],
  herb: ['............', '.....a......', '....aba.....', '...abba.a...', '..abba.aba..', '..aba.abba..', '...a.abba...', '....aba.....', '.....d......', '.....d......', '.....d......', '............'],
  fish: ['............', '............', '..aaaa....a.', '.abbbba..aba', 'abwbbbbaabba', 'abbbbbbbbba.', 'abbbcbbaabba', '.abbbba..aba', '..aaaa....a.', '............', '............', '............'],
  berry: ['............', '.....dd.....', '....d.......', '...aa.aa....', '..abba.aa...', '..abwbaabba.', '..abbbaabwa.', '...aaa.abba.', '.......aaa..', '............', '............', '............'],
  wheat: ['......a.....', '.....aba....', '....abcba...', '.....aba....', '....abcba...', '.....aba....', '....abcba...', '.....ad.....', '.....d......', '.....d......', '.....d......', '............'],
  cloth: ['............', '.aaaaaaaaaa.', '.abbbbbbbba.', '.abccbbccba.', '.abbbbbbbba.', '.abccbbccba.', '.abbbbbbbba.', '.aaaaaaaaaa.', '............', '............', '............', '............'],
  gem: ['............', '...aaaaaa...', '..abwbbbba..', '.abwbbbbbba.', 'aaaaaaaaaaaa', '.abbbbbbbba.', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....', '............', '............'],
  stone: ['............', '...aaaaaa...', '..abbbbbba..', '.abbcccbbba.', '.abcbbbcbba.', '.abbcccbbba.', '.abbbbbbbba.', '..abbbbbba..', '...aaaaaa...', '............', '............', '............'],
  pickaxe: ['..aaaaaa....', '.abbbbbba...', 'aba....aba..', 'aa..ad..aa..', '....ad......', '....ad......', '....ad......', '....ad......', '....ad......', '....aa......', '............', '............'],
  axe: ['....aaaa....', '...abbbba...', '...abbbbad..', '...abbbad...', '....aaad....', '......ad....', '.....ad.....', '....ad......', '...ad.......', '..aa........', '............', '............'],
  rod: ['..........ad', '.........ad.', '........ad.e', '.......ad..e', '......ad...e', '.....ad....e', '....ad.....e', '...ad......a', '..ad.......b', '.aa.........', '............', '............'],
  sickle: ['....aaaa....', '..aabbbbaa..', '.abaa..aaba.', '.aa......ba.', '.........ba.', '.......aab..', '......ad....', '.....ad.....', '....ad......', '...aa.......', '............', '............'],
  egg: ['............', '....aaaa....', '...abbbba...', '..abcbbbba..', '..abbbcbba..', '.abbbbbbbba.', '.abcbbbbcba.', '.abbbbbbbba.', '..abbbbbba..', '...aaaaaa...', '............', '............'],
  net: ['............', '.aaaaaaaa...', '.awawawaw...', '.aawawawa...', '.awawawaw...', '.aawawawa...', '..aaaaaaa...', '.....ad.....', '......ad....', '.......ad...', '........aa..', '............'],
  whistle: ['............', '............', '..aaaaaaa...', '.abbbbbbba..', 'abwbbbbbbaaa', 'abbbbbbbbbba', '.abbbbbbba..', '..aaaaaaa...', '............', '............', '............', '............'],
  robe: ['............', '...aa..aa...', '..abba.bba..', '.abbbaabbba.', '.abbbccbbba.', '..abbccbba..', '..abbbbbba..', '.abbbbbbbba.', '.abbbbbbbba.', 'abbbbbbbbbba', 'aaaaaaaaaaaa', '............'],
  wings: ['............', 'aa........aa', 'aba......aba', 'abba....abba', 'abbba..abbba', 'abcbbaabbcba', '.abbbbbbbba.', '..abbaabba..', '...aa..aa...', '............', '............', '............'],
  ticket: ['............', '............', 'aaaaaaaaaaaa', 'abbbbbbbbbba', 'a.bccbbccb.a', 'abbbbbbbbbba', 'a.bccbbccb.a', 'abbbbbbbbbba', 'aaaaaaaaaaaa', '............', '............', '............'],
  pack: ['............', '.aaaaaaaaaa.', '.abbbbbbbba.', '.abwbbbbwba.', '.abbbccbbba.', '.abbccccbba.', '.abbbccbbba.', '.abwbbbbwba.', '.abbbbbbbba.', '.aaaaaaaaaa.', '............', '............'],
  deco: ['............', '....aaaa....', '...abbbba...', '...abwbba...', '...abbbba...', '....aaaa....', '.....ad.....', '.....ad.....', '....aaaa....', '...adddda...', '............', '............'],
};
export function itemIcon(icon: string, color: string): HTMLCanvasElement {
  return cached(`i_${icon}_${color}`, 12, 12, (x) => ascii(x, ICON[icon] ?? ICON.orb!, { a: '#1e1418', b: color, c: shade(color, 0.4), d: '#7a5030', e: '#f0f0e0', w: '#ffffff' }));
}
const SKILL_GLYPH: Record<string, string[]> = {
  slash: ['..........a.', '.........aw.', '........awa.', '.......awa..', '......awa...', '.....awa....', '....awa.....', '...awa......', '..awa.......', '.awa........', '.aa.........', '............'],
  whirl: ['....aaaa....', '..aa....aa..', '.a..aaaa..a.', 'a..a....a..a', 'a.a..aa..a.a', 'a.a.awwa.a.a', 'a.a.awwa.a.a', 'a.a..aa..a.a', 'a..a.......a', '.a..aaaa..a.', '..aa....aa..', '....aaaa....'],
  dash: ['............', '.....aa.....', '...aa.awa...', 'aaaa...awa..', '.......awwa.', 'aaaaaaaawwwa', '.......awwa.', 'aaaa...awa..', '...aa.awa...', '.....aa.....', '............', '............'],
  buff: ['.....aa.....', '....awwa....', '...awwwwa...', '..awwwwwwa..', '.aaaawwaaaa.', '....awwa....', '....awwa....', '....awwa....', '....awwa....', '....aaaa....', '............', '............'],
  arc: ['............', '.aaaa.......', '.....aaa....', '........aa..', '..........a.', '...........a', '...........a', '..........a.', '........aa..', '.....aaa....', '.aaaa.......', '............'],
  shock: ['.....a......', '....aa......', '...awa......', '..awwaaaa...', '.awwwwwwa...', '...aawwa....', '....awa.....', '...awa......', '..aa........', '.a..........', '............', '............'],
  beam: ['............', '............', '............', '...........a', 'aaaaaaaaaaaw', 'wwwwwwwwwwww', 'aaaaaaaaaaaw', '...........a', '............', '............', '............', '............'],
  shield: ['............', '.aaaaaaaaaa.', '.awwwwwwwwa.', '.awaaaaaawa.', '.awawwwwawa.', '.awawwwwawa.', '..awawwawa..', '..awaaaawa..', '...awwwwa...', '....aaaa....', '............', '............'],
  big: ['a....a....a.', '.a...a...a..', '..a..a..a...', '...aawaa....', 'aaaawwwwaaaa', '...aawaa....', '..a..a..a...', '.a...a...a..', 'a....a....a.', '............', '............', '............'],
  nova: ['.a...aa...a.', '..a..aa..a..', '...aawwaa...', '.a.awwwwa.a.', 'aaawwwwwwaaa', 'aaawwwwwwaaa', '.a.awwwwa.a.', '...aawwaa...', '..a..aa..a..', '.a...aa...a.', '............', '............'],
  arrow: ['............', '........aaa.', '.........aw.', '........awa.', '.......awa..', '......awa...', '.....awa....', '...aawa.....', '..awaa......', '.aw.........', 'a...........', '............'],
  rain: ['.a...a...a..', 'aw..aw..aw..', '.a...a...a..', '...a...a...a', '..aw..aw..aw', '...a...a...a', '.a...a...a..', 'aw..aw..aw..', '.a...a...a..', '............', 'aaaaaaaaaaaa', '............'],
  trap: ['............', '............', 'a.a.a.a.a.a.', 'awawawawawa.', 'aaaaaaaaaaa.', 'a.........a.', 'a..aaaaa..a.', 'a.........a.', 'aaaaaaaaaaa.', '............', '............', '............'],
  explosion: ['...a....a...', '.a..a..a..a.', '..a.aaaa.a..', '...awwwwa...', 'aaawwaawwaaa', '..awa..awa..', '..awa..awa..', 'aaawwaawwaaa', '...awwwwa...', '..a.aaaa.a..', '.a..a..a..a.', '...a....a...'],
  flash: ['.....a......', '.....a......', '.a...a...a..', '..a.aaa.a...', '...awwwa....', 'aaawwwwwaaa.', '...awwwa....', '..a.aaa.a...', '.a...a...a..', '.....a......', '.....a......', '............'],
  mark: ['....aaaa....', '..aa....aa..', '.a...aa...a.', '.a..a..a..a.', 'a..a.ww.a..a', 'a..a.ww.a..a', '.a..a..a..a.', '.a...aa...a.', '..aa....aa..', '....aaaa....', '............', '............'],
  bolt: ['............', '.......aaa..', '......awwwa.', '.....awwwwa.', '....awwwwa..', '...awwwa....', '..awwa......', '.aww........', '.aw.........', 'aa..........', '............', '............'],
  chain: ['......a.....', '.....aw.....', '....awa.....', '...aaaaaa...', '......awa...', '.....awa....', '....aaaaaaa.', '.......awa..', '......awa...', '.....aa.....', '............', '............'],
  drain: ['aa........aa', '.aw......wa.', '..aw....wa..', '...aw..wa...', '....awwa....', '....awwa....', '...awwwwa...', '..awwwwwwa..', '..awwwwwwa..', '...aaaaaa...', '............', '............'],
  heal: ['............', '....aaaa....', '....awwa....', '....awwa....', '.aaaawwaaaa.', '.awwwwwwwwa.', '.awwwwwwwwa.', '.aaaawwaaaa.', '....awwa....', '....awwa....', '....aaaa....', '............'],
  none: ['.....aa.....', '.....aa.....', '....awwa....', 'aaaawwwwaaaa', '.awwwwwwwwa.', '..awwwwwwa..', '..awwaawwa..', '.awwa..awwa.', '.aa......aa.', '............', '............', '............'],
};
export function skillIcon(vfx: string, color: string, passive = false): HTMLCanvasElement {
  return cached(`s_${vfx}_${color}_${passive}`, 16, 16, (x) => {
    p(x, 0, 0, 16, 16, '#1a1420'); p(x, 1, 1, 14, 14, shade(color, -0.6)); p(x, 1, 1, 14, 1, shade(color, -0.3));
    ascii(x, SKILL_GLYPH[passive ? 'none' : vfx] ?? SKILL_GLYPH.bolt!, { a: color, w: '#ffffff' }, 2, 2);
    if (passive) { p(x, 0, 0, 16, 1, '#e0c060'); p(x, 0, 15, 16, 1, '#e0c060'); }
  });
}
export function portrait(look: CharLook): HTMLCanvasElement { return characterSprite(look, 0, 0, 'idle'); }
export function tcgArt(element: string, type: string, seed: number): HTMLCanvasElement {
  const col: Record<string, string> = { neutral: '#c8b8a0', fire: '#ff6a30', water: '#3a90e0', earth: '#8a9a40', wind: '#70d090', ice: '#a0e0ff', light: '#ffe080', dark: '#7a4ab0', spirit: '#60e0d0' };
  return cached(`tcg_${element}_${type}_${seed}`, 24, 18, (x) => {
    const c = col[element] ?? '#ccc'; for (let j = 0; j < 18; j++) p(x, 0, j, 24, 1, shade(c, -0.5 + j / 40));
    if (type === 'creature' || type === 'hero') { const kinds = Object.keys(M_SPRITES); x.drawImage(monsterSprite(kinds[seed % kinds.length]!, c, 0), 4, 1); }
    else if (type === 'spell') { ascii(x, SKILL_GLYPH[['bolt', 'nova', 'explosion', 'heal', 'flash'][seed % 5]!]!, { a: c, w: '#fff' }, 6, 3); }
    else if (type === 'trap') ascii(x, SKILL_GLYPH.trap!, { a: c, w: '#fff' }, 6, 3);
    else if (type === 'equipment') ascii(x, ICON.sword!, { a: '#1e1418', b: c, c: '#fff', d: '#7a5030' }, 6, 3);
    else ascii(x, SKILL_GLYPH.mark!, { a: c, w: '#fff' }, 6, 3);
  });
}
