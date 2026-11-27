/** Hearthcards — original trading card game (§42–44), separate from monster cards. Deterministic engine with seeded RNG. */
import { CONFIG, ELEMENTS, type Element } from './config.js';
import type { L10n } from './classes.js';
import type { Rarity } from './items.js';
import { Rng } from './rng.js';

export type CardType = 'creature' | 'spell' | 'trap' | 'equipment' | 'field' | 'hero';
export type Keyword = 'guard' | 'swift' | 'lifelink' | 'shield' | 'venom' | 'flying';
export interface CardEffect { kind: 'damage' | 'heal' | 'draw' | 'buff' | 'destroy' | 'summon' | 'aoe' | 'mana' | 'armor'; target: 'enemy_hero' | 'any_enemy' | 'all_enemies' | 'own_hero' | 'ally' | 'all_allies' | 'random_enemy' | 'self'; value: number; value2?: number; token?: string }
export interface TcgCardDef { id: string; name: L10n; type: CardType; element: Element; rarity: Rarity; cost: number; atk: number; hp: number; keywords: Keyword[]; onPlay?: CardEffect[]; trap?: CardEffect; field?: { atk: number; hp: number }; text: L10n; craft: number }

const C: TcgCardDef[] = [];
const EL_NAMES: Record<Element, [string, string]> = { neutral: ['Hearth', 'เตาผิง'], fire: ['Ember', 'ถ่านไฟ'], water: ['Tide', 'กระแส'], earth: ['Grove', 'พงไพร'], wind: ['Gale', 'วายุ'], ice: ['Frost', 'เยือกแข็ง'], light: ['Dawn', 'อรุณ'], dark: ['Dusk', 'สนธยา'], spirit: ['Wisp', 'วิญญาณ'] };
type Tpl = [suffixEn: string, suffixTh: string, type: CardType, rarity: Rarity, cost: number, atk: number, hp: number, kw: Keyword[], onPlay?: CardEffect[], trap?: CardEffect, field?: { atk: number; hp: number }];
const TPL: Tpl[] = [
  ['Sprout', 'ต้นกล้า', 'creature', 'common', 1, 1, 2, []],
  ['Scout', 'หน่วยสอดแนม', 'creature', 'common', 2, 2, 2, ['swift']],
  ['Warden', 'ผู้คุ้มครอง', 'creature', 'common', 3, 2, 5, ['guard']],
  ['Striker', 'นักจู่โจม', 'creature', 'uncommon', 4, 4, 4, [], [{ kind: 'damage', target: 'random_enemy', value: 2 }]],
  ['Colossus', 'ยักษ์ใหญ่', 'creature', 'rare', 6, 6, 7, ['guard']],
  ['Bolt', 'ลูกศร', 'spell', 'common', 2, 0, 0, [], [{ kind: 'damage', target: 'any_enemy', value: 3 }]],
  ['Storm', 'พายุ', 'spell', 'rare', 5, 0, 0, [], [{ kind: 'aoe', target: 'all_enemies', value: 2 }]],
  ['Snare', 'กับดัก', 'trap', 'uncommon', 2, 0, 0, [], undefined, { kind: 'damage', target: 'self', value: 4 }],
  ['Blade', 'ดาบ', 'equipment', 'uncommon', 2, 2, 1, []],
  ['Sanctum', 'วิหาร', 'field', 'rare', 3, 0, 0, [], undefined, undefined, { atk: 1, hp: 1 }],
];
const SPECIAL: Partial<Record<Element, Tpl[]>> = {
  fire: [['Phoenix', 'ฟีนิกซ์', 'creature', 'legendary', 7, 6, 5, ['flying', 'swift'], [{ kind: 'aoe', target: 'all_enemies', value: 1 }]]],
  water: [['Healer', 'ผู้รักษา', 'creature', 'uncommon', 3, 2, 3, [], [{ kind: 'heal', target: 'own_hero', value: 4 }]]],
  earth: [['Treant', 'ภูตไม้', 'creature', 'epic', 5, 3, 8, ['guard'], [{ kind: 'armor', target: 'own_hero', value: 3 }]]],
  wind: [['Roc', 'นกยักษ์', 'creature', 'epic', 5, 5, 3, ['flying', 'swift']]],
  ice: [['Glacier', 'ธารน้ำแข็ง', 'spell', 'epic', 4, 0, 0, [], [{ kind: 'destroy', target: 'any_enemy', value: 0 }]]],
  light: [['Seraph', 'เทวทูต', 'creature', 'legendary', 8, 7, 7, ['shield', 'lifelink'], [{ kind: 'heal', target: 'own_hero', value: 5 }]]],
  dark: [['Viper', 'งูพิษ', 'creature', 'rare', 3, 1, 3, ['venom']]],
  spirit: [['Echo', 'เสียงสะท้อน', 'spell', 'rare', 3, 0, 0, [], [{ kind: 'draw', target: 'self', value: 2 }]]],
  neutral: [['Lantern', 'โคมไฟ', 'spell', 'common', 0, 0, 0, [], [{ kind: 'mana', target: 'self', value: 1 }]], ['Hero of the Hearth', 'วีรชนเตาผิง', 'hero', 'legendary', 5, 0, 0, [], [{ kind: 'armor', target: 'own_hero', value: 5 }, { kind: 'summon', target: 'self', value: 2, value2: 2, token: 'tok_squire' }]]],
};
for (const el of ELEMENTS) {
  const [en, th] = EL_NAMES[el];
  for (const t of [...TPL, ...(SPECIAL[el] ?? [])]) {
    const [se, sth, type, rarity, cost, atk, hp, kw, onPlay, trap, field] = t;
    // element flavor
    const kws = [...kw]; let a = atk, h = hp;
    if (type === 'creature') { if (el === 'fire') { a += 1; h = Math.max(1, h - 1); } if (el === 'earth') h += 1; if (el === 'wind' && !kws.includes('swift') && cost <= 3) kws.push('swift'); if (el === 'light' && cost >= 3 && !kws.includes('shield')) kws.push('shield'); if (el === 'dark' && cost === 4) kws.push('lifelink'); if (el === 'ice' && cost === 3) h += 1; }
    const id = `tc_${el}_${se.toLowerCase().replace(/\s+/g, '_')}`;
    const text = cardText(type, kws, onPlay, trap, field, a, h);
    C.push({ id, name: { en: type === 'hero' ? se : `${en} ${se}`, th: type === 'hero' ? sth : `${sth}${th}` }, type, element: el, rarity, cost, atk: a, hp: h, keywords: kws, onPlay, trap, field, text, craft: { common: 20, uncommon: 50, rare: 100, epic: 400, legendary: 1600, mythic: 3200 }[rarity] });
  }
}
C.push({ id: 'tok_squire', name: { en: 'Squire', th: 'อัศวินฝึกหัด' }, type: 'creature', element: 'neutral', rarity: 'common', cost: 1, atk: 2, hp: 2, keywords: [], text: { en: 'Token.', th: 'โทเคน' }, craft: 0 });
function cardText(type: CardType, kw: Keyword[], on?: CardEffect[], trap?: CardEffect, field?: { atk: number; hp: number }, a?: number, h?: number): L10n {
  const parts: string[] = []; const th: string[] = [];
  if (kw.length) { parts.push(kw.join(', ')); th.push(kw.join(', ')); }
  for (const e of on ?? []) { parts.push(`${e.kind} ${e.value} (${e.target})`); th.push(`${e.kind} ${e.value}`); }
  if (trap) { parts.push(`Trap: when attacked, deal ${trap.value} to attacker`); th.push(`กับดัก: เมื่อถูกโจมตี สร้างความเสียหาย ${trap.value} แก่ผู้โจมตี`); }
  if (field) { parts.push(`Field: your creatures +${field.atk}/+${field.hp}`); th.push(`สนาม: มอนสเตอร์ฝ่ายเรา +${field.atk}/+${field.hp}`); }
  if (type === 'equipment') { parts.push(`Equip: +${a}/+${h} to an ally`); th.push(`สวมใส่: +${a}/+${h} ให้พันธมิตร`); }
  return { en: parts.join('. ') || 'Vanilla.', th: th.join(' ') || 'ธรรมดา' };
}
export const TCG_CARDS: Record<string, TcgCardDef> = Object.fromEntries(C.map((c) => [c.id, c]));
export const TCG_COLLECTIBLE = C.filter((c) => !c.id.startsWith('tok_'));

/** 7 starter decks (elements), 20 cards each, legal under deck rules. */
export const STARTER_DECKS: Record<string, { name: L10n; cards: string[] }> = Object.fromEntries((['fire', 'water', 'earth', 'wind', 'ice', 'light', 'dark'] as Element[]).map((el) => {
  const own = C.filter((c) => c.element === el && c.type !== 'hero');
  const neutral = C.filter((c) => c.element === 'neutral' && (c.type === 'creature' || c.id === 'tc_neutral_lantern'));
  const list: string[] = [];
  for (const c of own) list.push(c.id, c.id);
  for (const c of neutral) if (list.length < CONFIG.tcgDeckSize) list.push(c.id);
  return [`starter_${el}`, { name: { en: `${EL_NAMES[el][0]} Starter`, th: `เด็คเริ่มต้น${EL_NAMES[el][1]}` }, cards: list.slice(0, CONFIG.tcgDeckSize) }];
}));

export function validateDeck(cards: string[], owned?: Record<string, number>): string | null {
  if (cards.length !== CONFIG.tcgDeckSize) return `DECK_SIZE_${cards.length}`;
  const counts: Record<string, number> = {};
  for (const id of cards) { const d = TCG_CARDS[id]; if (!d || id.startsWith('tok_')) return `UNKNOWN_CARD_${id}`; counts[id] = (counts[id] ?? 0) + 1; const max = d.rarity === 'legendary' ? 1 : CONFIG.tcgMaxCopies; if (counts[id]! > max) return `TOO_MANY_${id}`; if (owned && (owned[id] ?? 0) < counts[id]!) return `NOT_OWNED_${id}`; }
  return null;
}

// ---------------- Battle engine (§43) ----------------
export interface Unit { uid: number; card: string; atk: number; hp: number; maxHp: number; keywords: Keyword[]; canAttack: boolean; shield: boolean }
export interface Side { hero: number; armor: number; mana: number; maxMana: number; deck: string[]; hand: string[]; board: Unit[]; trap: string | null; field: string | null; grave: string[]; fatigue: number }
export interface TcgState { seed: number; rng: number[]; turn: number; active: 0 | 1; sides: [Side, Side]; winner: 0 | 1 | 'draw' | null; log: { t: number; p: 0 | 1; a: string }[]; nextUid: number; ruleVersion: string }
export type TcgAction = { type: 'play'; handIndex: number; target?: TcgTarget } | { type: 'attack'; attacker: number; target: TcgTarget } | { type: 'end' } | { type: 'surrender' };
export type TcgTarget = { side: 0 | 1; unit: number | 'hero' };

export function newMatch(deckA: string[], deckB: string[], seed: number): TcgState {
  const rng = new Rng(seed);
  const mk = (d: string[]): Side => ({ hero: CONFIG.tcgHeroHp, armor: 0, mana: 0, maxMana: 0, deck: rng.shuffle([...d]), hand: [], board: [], trap: null, field: null, grave: [], fatigue: 0 });
  const s: TcgState = { seed, rng: [], turn: 0, active: 0, sides: [mk(deckA), mk(deckB)], winner: null, log: [], nextUid: 1, ruleVersion: CONFIG.version };
  for (let i = 0; i < CONFIG.tcgStartHand; i++) { draw(s, 0); draw(s, 1); }
  draw(s, 1); // second player compensation
  s.rng = rng.getState();
  startTurn(s);
  return s;
}
function R(s: TcgState): Rng { return Rng.fromState(s.rng.length ? s.rng : new Rng(s.seed).getState()); }
function draw(s: TcgState, p: 0 | 1) {
  const side = s.sides[p];
  const c = side.deck.shift();
  if (!c) { side.fatigue++; damageHero(s, p, side.fatigue); return; }
  if (side.hand.length >= 8) { side.grave.push(c); return; }
  side.hand.push(c);
}
function startTurn(s: TcgState) {
  s.turn++; const side = s.sides[s.active];
  side.maxMana = Math.min(CONFIG.tcgMaxMana, side.maxMana + 1); side.mana = side.maxMana;
  for (const u of side.board) u.canAttack = true;
  draw(s, s.active);
  log(s, s.active, `turn ${s.turn}`);
}
function log(s: TcgState, p: 0 | 1, a: string) { s.log.push({ t: s.turn, p, a }); if (s.log.length > 300) s.log.shift(); }
function fieldBonus(side: Side) { const f = side.field ? TCG_CARDS[side.field]?.field : undefined; return f ?? { atk: 0, hp: 0 }; }
function damageHero(s: TcgState, p: 0 | 1, n: number) {
  const side = s.sides[p]; const absorbed = Math.min(side.armor, n); side.armor -= absorbed; side.hero -= n - absorbed;
  if (side.hero <= 0 && s.winner === null) { s.winner = s.sides[1 - p as 0 | 1].hero <= 0 ? 'draw' : (1 - p) as 0 | 1; }
}
function damageUnit(s: TcgState, p: 0 | 1, u: Unit, n: number, venom = false) {
  if (n <= 0) return;
  if (u.shield) { u.shield = false; return; }
  u.hp -= n; if (venom) u.hp = 0;
  if (u.hp <= 0) { const side = s.sides[p]; side.board = side.board.filter((x) => x.uid !== u.uid); side.grave.push(u.card); log(s, p, `${u.card} destroyed`); }
}
function summon(s: TcgState, p: 0 | 1, cardId: string, atk?: number, hp?: number) {
  const side = s.sides[p]; if (side.board.length >= 5) return;
  const d = TCG_CARDS[cardId]!; const fb = fieldBonus(side);
  const u: Unit = { uid: s.nextUid++, card: cardId, atk: (atk ?? d.atk) + fb.atk, hp: (hp ?? d.hp) + fb.hp, maxHp: (hp ?? d.hp) + fb.hp, keywords: [...d.keywords], canAttack: d.keywords.includes('swift'), shield: d.keywords.includes('shield') };
  side.board.push(u);
}
function resolveEffect(s: TcgState, p: 0 | 1, e: CardEffect, target?: TcgTarget) {
  const rng = R(s); const opp = (1 - p) as 0 | 1; const me = s.sides[p]; const them = s.sides[opp];
  const hitTarget = (t: TcgTarget | undefined, n: number) => {
    if (!t || t.unit === 'hero') { damageHero(s, t?.side ?? opp, n); return; }
    const u = s.sides[t.side].board.find((x) => x.uid === t.unit); if (u) damageUnit(s, t.side, u, n);
  };
  switch (e.kind) {
    case 'damage':
      if (e.target === 'enemy_hero') damageHero(s, opp, e.value);
      else if (e.target === 'random_enemy') { const opts = [...them.board.map((u) => ({ side: opp, unit: u.uid as number | 'hero' })), { side: opp, unit: 'hero' as const }]; hitTarget(rng.pick(opts), e.value); }
      else hitTarget(target ?? { side: opp, unit: 'hero' }, e.value);
      break;
    case 'aoe': for (const u of [...them.board]) damageUnit(s, opp, u, e.value); break;
    case 'heal': me.hero = Math.min(CONFIG.tcgHeroHp, me.hero + e.value); break;
    case 'armor': me.armor += e.value; break;
    case 'draw': for (let i = 0; i < e.value; i++) draw(s, p); break;
    case 'mana': me.mana = Math.min(CONFIG.tcgMaxMana, me.mana + e.value); break;
    case 'destroy': { const t = target && target.unit !== 'hero' ? them.board.find((x) => x.uid === target.unit) : them.board.slice().sort((a, b) => b.atk - a.atk)[0]; if (t) damageUnit(s, opp, t, 999); break; }
    case 'summon': summon(s, p, e.token!, e.value, e.value2); break;
    case 'buff': { const t = target && target.unit !== 'hero' ? me.board.find((x) => x.uid === target.unit) : me.board[0]; if (t) { t.atk += e.value; t.hp += e.value2 ?? 0; t.maxHp += e.value2 ?? 0; } break; }
  }
  s.rng = rng.getState();
}

export function legalActions(s: TcgState, p: 0 | 1): TcgAction[] {
  if (s.winner !== null || s.active !== p) return [];
  const out: TcgAction[] = [{ type: 'end' }];
  const me = s.sides[p]; const opp = (1 - p) as 0 | 1; const them = s.sides[opp];
  me.hand.forEach((id, i) => {
    const d = TCG_CARDS[id]!; if (d.cost > me.mana) return;
    if (d.type === 'creature' && me.board.length >= 5) return;
    if (d.type === 'equipment') { for (const u of me.board) out.push({ type: 'play', handIndex: i, target: { side: p, unit: u.uid } }); return; }
    if (d.onPlay?.some((e) => e.target === 'any_enemy')) { out.push({ type: 'play', handIndex: i, target: { side: opp, unit: 'hero' } }); for (const u of them.board) out.push({ type: 'play', handIndex: i, target: { side: opp, unit: u.uid } }); return; }
    out.push({ type: 'play', handIndex: i });
  });
  const guards = them.board.filter((u) => u.keywords.includes('guard'));
  for (const u of me.board) {
    if (!u.canAttack || u.atk <= 0) continue;
    const flying = u.keywords.includes('flying');
    const targets = guards.length && !flying ? guards : them.board;
    for (const t of targets) out.push({ type: 'attack', attacker: u.uid, target: { side: opp, unit: t.uid } });
    if (!guards.length || flying) out.push({ type: 'attack', attacker: u.uid, target: { side: opp, unit: 'hero' } });
  }
  return out;
}

/** Apply an action after validating it against legalActions (server-authoritative). Returns error code or null. */
export function applyAction(s: TcgState, p: 0 | 1, a: TcgAction): string | null {
  if (s.winner !== null) return 'MATCH_OVER';
  if (a.type === 'surrender') { s.winner = (1 - p) as 0 | 1; log(s, p, 'surrender'); return null; }
  if (s.active !== p) return 'NOT_YOUR_TURN';
  const legal = legalActions(s, p);
  if (!legal.some((l) => JSON.stringify(l) === JSON.stringify(a))) return 'ILLEGAL_ACTION';
  const me = s.sides[p]; const opp = (1 - p) as 0 | 1; const them = s.sides[opp];
  if (a.type === 'end') { s.active = opp; startTurn(s); return null; }
  if (a.type === 'play') {
    const id = me.hand[a.handIndex]!; const d = TCG_CARDS[id]!;
    me.hand.splice(a.handIndex, 1); me.mana -= d.cost; log(s, p, `play ${id}`);
    if (d.type === 'creature') summon(s, p, id);
    else if (d.type === 'trap') { if (me.trap) me.grave.push(me.trap); me.trap = id; }
    else if (d.type === 'field') { if (me.field) me.grave.push(me.field); me.field = id; for (const u of me.board) { u.atk += d.field!.atk; u.hp += d.field!.hp; } }
    else if (d.type === 'equipment') { const u = me.board.find((x) => x.uid === (a.target!.unit as number)); if (u) { u.atk += d.atk; u.hp += d.hp; u.maxHp += d.hp; } me.grave.push(id); }
    else me.grave.push(id);
    for (const e of d.onPlay ?? []) resolveEffect(s, p, e, a.target);
    return null;
  }
  if (a.type === 'attack') {
    const att = me.board.find((u) => u.uid === a.attacker)!; att.canAttack = false;
    if (them.trap) { const tr = TCG_CARDS[them.trap]!.trap!; log(s, opp, `trap ${them.trap}`); them.grave.push(them.trap); them.trap = null; damageUnit(s, p, att, tr.value); if (!me.board.includes(att)) return null; }
    if (a.target.unit === 'hero') { damageHero(s, opp, att.atk); log(s, p, `${att.card} hits hero ${att.atk}`); }
    else {
      const def = them.board.find((u) => u.uid === a.target.unit)!;
      const aAtk = att.atk, dAtk = def.atk;
      damageUnit(s, opp, def, aAtk, att.keywords.includes('venom'));
      damageUnit(s, p, att, dAtk, def.keywords.includes('venom'));
      log(s, p, `${att.card} attacks ${def.card}`);
    }
    if (att.keywords.includes('lifelink')) me.hero = Math.min(CONFIG.tcgHeroHp, me.hero + att.atk);
    return null;
  }
  return 'UNKNOWN';
}

/** Simple legal-information AI: lethal check → value plays → favorable trades → face. Uses only visible information. */
export function aiChooseAction(s: TcgState, p: 0 | 1): TcgAction {
  const legal = legalActions(s, p); const opp = (1 - p) as 0 | 1;
  const plays = legal.filter((a): a is Extract<TcgAction, { type: 'play' }> => a.type === 'play');
  if (plays.length) {
    const scored = plays.map((a) => { const d = TCG_CARDS[s.sides[p].hand[a.handIndex]!]!; let v = d.cost * 10 + d.atk + d.hp; if (a.target && a.target.unit !== 'hero') { const u = s.sides[opp].board.find((x) => x.uid === a.target!.unit); v += u ? u.atk * 3 : 0; } if (d.type === 'trap' && s.sides[p].trap) v -= 100; return { a, v }; }).sort((x, y) => y.v - x.v);
    if (scored[0]!.v > -50) return scored[0]!.a;
  }
  const attacks = legal.filter((a): a is Extract<TcgAction, { type: 'attack' }> => a.type === 'attack');
  if (attacks.length) {
    const them = s.sides[opp];
    const totalAtk = s.sides[p].board.filter((u) => u.canAttack).reduce((x, u) => x + u.atk, 0);
    const face = attacks.find((a) => a.target.unit === 'hero');
    if (face && totalAtk >= them.hero + them.armor) return face;
    const trades = attacks.filter((a) => a.target.unit !== 'hero').map((a) => { const att = s.sides[p].board.find((u) => u.uid === a.attacker)!; const def = them.board.find((u) => u.uid === a.target.unit)!; const kills = att.atk >= def.hp && !def.shield; const dies = def.atk >= att.hp && !att.shield; return { a, v: (kills ? def.atk + def.hp : 0) - (dies ? att.atk + att.hp : 0) }; }).sort((x, y) => y.v - x.v);
    if (trades.length && (trades[0]!.v > 0 || !face)) return trades[0]!.a;
    if (face) return face;
  }
  return { type: 'end' };
}

/** Hidden-information redaction (§43): opponent hand/deck contents and face-down trap are hidden. */
export function viewFor(s: TcgState, viewer: 0 | 1 | 'spectator') {
  return { ...s, rng: [], seed: 0, sides: s.sides.map((side, i) => ({ ...side, deck: side.deck.length, hand: viewer === i ? side.hand : side.hand.length, trap: side.trap ? (viewer === i ? side.trap : 'hidden') : null })) };
}

export const TCG_RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];
export const PACK_RATES: { rarity: Rarity; weight: number }[] = [{ rarity: 'common', weight: 60 }, { rarity: 'uncommon', weight: 25 }, { rarity: 'rare', weight: 10 }, { rarity: 'epic', weight: 4 }, { rarity: 'legendary', weight: 1 }];
export function openPack(rng: Rng, pity: number): { cards: string[]; pity: number } {
  const cards: string[] = []; let gotEpic = false;
  for (let i = 0; i < 5; i++) {
    let rar = rng.weighted(PACK_RATES).rarity;
    if (i === 4 && !gotEpic && pity + 1 >= 10) rar = 'epic';
    if (rar === 'epic' || rar === 'legendary') gotEpic = true;
    const pool = TCG_COLLECTIBLE.filter((c) => c.rarity === rar);
    cards.push(rng.pick(pool.length ? pool : TCG_COLLECTIBLE).id);
  }
  return { cards, pity: gotEpic ? 0 : pity + 1 };
}

/** PvP perspective: every client sees itself as side 0 (so the same duel UI works for both players). */
export function perspective(s: TcgState, side: 0 | 1) {
  const v: any = viewFor(s, side); if (side === 0) return v;
  const flip = (x: any) => (x === 0 ? 1 : x === 1 ? 0 : x);
  return { ...v, sides: [v.sides[1], v.sides[0]], active: flip(v.active), winner: flip(v.winner), log: v.log.map((l: any) => ({ ...l, p: flip(l.p) })) };
}
/** Translate an action expressed from a side-1 player's perspective back to absolute sides. */
export function absoluteAction(a: TcgAction, side: 0 | 1): TcgAction {
  if (side === 0) return a; const f = (t?: TcgTarget) => (t ? { ...t, side: (1 - t.side) as 0 | 1 } : t);
  if (a.type === 'play') return { ...a, target: f(a.target) }; if (a.type === 'attack') return { ...a, target: f(a.target)! }; return a;
}
