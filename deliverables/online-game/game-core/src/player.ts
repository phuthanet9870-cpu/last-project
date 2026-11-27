/**
 * Player domain service (character, progression, items, enhancement, pets, crafting, quests, economy hooks).
 * Server-authoritative in online mode (game-server owns the instance); in artifact mode the LocalAdapter owns it.
 * Every mutation validates first, then mutates (no partial writes) and emits domain events.
 */
import { CONFIG, requiredExp, requiredJobExp, requiredMasteryExp, type Element } from './config.js';
import { ALL_SKILLS, CLASSES, type SkillDef } from './classes.js';
import { MEMBERSHIPS, TCG_COSMETICS, seasonalFeatured, activeEventAt, WEEK_MS, ACHIEVEMENTS, CARD_SET_BONUS, EGG_POOL, LOGIN_CALENDAR, MISSIONS_DAILY, ACTIVITY_CHESTS, MONSTER_CARDS, MOUNTS, PASS, PETS, QUESTS, RECIPES, SHOPS, TITLES, NPCS, EVENTS, GACHA_BANNERS, DUNGEONS, type Objective, type Profession } from './content.js';
import { EconomyError, Ledger, feeOf, type Currency } from './economy.js';
import { EQUIP_SLOTS, ITEMS, OPTION_POOL, RARITIES, SET_BONUS, type ItemInstance, type Rarity, type Slot } from './items.js';
import { Rng, uid } from './rng.js';
import { combatPower, computeStats, zeroPrimary, type Modifier, type Primary, type StatResult } from './stats.js';
import { STARTER_DECKS, TCG_CARDS, openPack, validateDeck } from './tcg.js';

export interface PetInstance { runes?: string[]; uid: string; species: string; name: string; level: number; exp: number; stars: number; happiness: number; hunger: number; onFarm: boolean; skillLevel: number }
export interface Mail { id: string; from: string; subject: string; body: string; items: { itemId: string; qty: number }[]; gold: string; read: boolean; claimed: boolean; ts: number; expiresAt: number }
export interface QuestProgress { id: string; progress: number[]; acceptedAt: number }
export interface Appearance { body: 0 | 1; hair: number; hairColor: string; skin: string; eyes: string }

export interface PlayerState {
  v: 1; id: string; accountId: string; name: string; classId: string; appearance: Appearance; createdAt: number; playtimeMs: number;
  level: number; exp: number; jobLevel: number; jobExp: number; ascension: number; mastery: number; masteryExp: number;
  statPoints: number; skillPoints: number; allocated: Primary; skillRanks: Record<string, number>; hotbar: (string | null)[];
  hp: number; mp: number; gauge: number; map: string; x: number; y: number; savedMap: string;
  inventory: ItemInstance[]; invSlots: number; storage: ItemInstance[]; equipment: Partial<Record<Slot, ItemInstance>>;
  quests: { active: QuestProgress[]; done: string[]; lastDaily: string; lastWeekly: string };
  counters: Record<string, number>; achievements: string[]; titles: string[]; title: string | null;
  pets: PetInstance[]; activePet: string | null; eggs: { uid: string; hatchAt: number }[];
  farm: { capacity: number; feederSlots: number; feederLevel: number; food: number; lastSettle: number; decorations: { itemId: string; x: number; y: number; rot: number }[]; likes: number };
  mounts: string[]; activeMount: string | null; riding: boolean; mountLevels: Record<string, number>;
  monsterCards: Record<string, number>; discovered: string[];
  professions: Partial<Record<Profession, { lvl: number; exp: number }>>; gathering: Record<'ore' | 'tree' | 'herb' | 'fish', { lvl: number; exp: number }>;
  tcg: { tutorialDone?: boolean; bound?: Record<string, number>; cosmetics?: { owned: string[]; back: string; mat: string; table: string }; season?: number; seasons?: { season: number; rank: number; stars: number }[]; collection: Record<string, number>; decks: { id: string; name: string; cards: string[] }[]; activeDeck: string; rating: number; stars: number; rank: number; wins: number; losses: number; pity: number; tower: number };
  pvp: { seasons?: { season: number; rating: number; tier: string }[]; rating: number; wins: number; losses: number; season: number; history: { ts: number; opp: string; win: boolean; delta: number }[] };
  dungeon: { runs: Record<string, number>; firstClears: string[]; day: string };
  gacha: { pityBy?: Record<string, number>; pity: number; history: { ts: number; item: string; rarity: string }[] };
  pass: { level: number; exp: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  login: { lastDay: string; streak: number; claimed: number };
  missions: { day: string; progress: Record<string, number>; claimed: string[]; points: number; chests: number[] };
  events: { progress: Record<string, number>; claimed: string[]; week?: number }; // week = event occurrence (progress + claims reset when a new weekly event starts)
  mail: Mail[]; friends: { name: string; note: string; since: number }[]; blocked: string[];
  guild: { id: string; name: string; role: 'leader' | 'officer' | 'member'; contribution: number; level: number; exp: number; storage: ItemInstance[]; log: string[] } | null;
  marriage: { partner: string; since: number; anniversary: number; stage?: 'engaged' | 'married'; engagedAt?: number } | null; // stage missing = married (pre-0.9 saves)
  house: { furniture: { itemId: string; x: number; y: number; rot: number }[]; theme: number };
  refinePity: Record<string, number>; settings: Record<string, any>; storageSlots?: number; memberships?: Record<string, { until: number | null; lastClaim: string }>; wishlist?: { defId: string; maxPrice: number }[]; wallet: Ledger;
  log: { ts: number; msg: string }[];
}

export type GameEvent = { type: string; [k: string]: any };
/** Seasons (§30, §43): fixed-length seasons from an epoch; rollover is lazy and idempotent per character (season number recorded). */
export function currentSeason(now: number): number { return Math.floor((now - CONFIG.seasonEpoch) / (CONFIG.seasonDays * 86400_000)) + 1; }
export function seasonEndsAt(season: number): number { return CONFIG.seasonEpoch + season * CONFIG.seasonDays * 86400_000; }
export const PVP_TIERS = [{ name: 'Bronze', min: 0, tokens: 10 }, { name: 'Silver', min: 1100, tokens: 25 }, { name: 'Gold', min: 1250, tokens: 50 }, { name: 'Platinum', min: 1400, tokens: 90 }, { name: 'Diamond', min: 1550, tokens: 150 }];
export function pvpTier(rating: number) { return [...PVP_TIERS].reverse().find((t) => rating >= t.min)!; }
/** Regional pet foods (§25): double effect for pets of these elements. */
export const REGIONAL_FOOD: Record<string, string[]> = { food_forest: ['earth', 'wind'], food_hills: ['fire', 'neutral'], food_snow: ['ice', 'water'] };
export const PET_RUNES = ['rune_fang', 'rune_shell', 'rune_wind'];
export const GEM_REFINE_RATE = [100, 90, 80, 70, 60, 50, 40, 32, 25, 20]; // % success +0→+1 … +9→+10
export const COSMETIC_MAX = 5;
export interface Result<T = unknown> { ok: boolean; err?: string; msg?: string; data?: T }
const ok = <T>(data?: T, msg?: string): Result<T> => ({ ok: true, data, msg });
const fail = (err: string, msg?: string): Result<any> => ({ ok: false, err, msg: msg ?? err });

export function dayKey(ts: number): string { return new Date(ts + 7 * 3600_000).toISOString().slice(0, 10); } // Asia/Bangkok reset boundary (UTC+7)
export function weekKey(ts: number): string { const d = new Date(ts + 7 * 3600_000); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }

export function newItem(defId: string, qty = 1, rng?: Rng): ItemInstance {
  const def = ITEMS[defId]; if (!def) throw new Error(`unknown item ${defId}`);
  const it: ItemInstance = { uid: uid('it'), defId, qty, refine: 0, options: [], sockets: [], cards: [], locked: false, bound: !def.tradeable, durability: 100 };
  if (def.type === 'weapon' || def.type === 'armor' || def.type === 'accessory') {
    it.cards = [null];
    if (rng) { const n = RARITIES.indexOf(def.rarity) >= 2 ? 2 : rng.chance(0.4) ? 1 : 0; for (let i = 0; i < n; i++) it.options.push(rollOption(rng, def.type)); }
  }
  if (def.type === 'skill_stone') it.stone = { skillId: null, mods: [], refine: 0 };
  return it;
}
function rollOption(rng: Rng, type: string): Omit<Modifier, 'source'> {
  const pool = OPTION_POOL.filter((o) => o.slots.includes(type as any));
  const o = rng.pick(pool); return { stat: o.stat, kind: 'flat', value: rng.int(o.min, o.max) };
}

export function createCharacter(opts: { id?: string; accountId: string; name: string; classId: string; appearance: Appearance; now?: number }): PlayerState {
  const cls = CLASSES[opts.classId]; if (!cls) throw new Error('INVALID_CLASS');
  if (!/^[\p{L}\p{N}_ ]{2,16}$/u.test(opts.name.trim())) throw new Error('INVALID_NAME');
  const now = opts.now ?? Date.now();
  const id = opts.id ?? uid('ch');
  const p: PlayerState = {
    v: 1, id, accountId: opts.accountId, name: opts.name.trim(), classId: cls.id, appearance: opts.appearance, createdAt: now, playtimeMs: 0,
    level: 1, exp: 0, jobLevel: 1, jobExp: 0, ascension: 0, mastery: 0, masteryExp: 0, statPoints: 5, skillPoints: 2, allocated: zeroPrimary(),
    skillRanks: Object.fromEntries(cls.skills.filter((s) => s.reqLevel <= 1).map((s) => [s.id, 1])), hotbar: [cls.skills[0]!.id, cls.skills[1]!.id, null, null, null, null, null, null],
    hp: 1, mp: 1, gauge: 0, map: 'emberglen', x: 28 * 32 + 16, y: 24 * 32 + 16, savedMap: 'emberglen',
    inventory: [], invSlots: CONFIG.inventoryBaseSlots, storage: [], equipment: {},
    quests: { active: [], done: [], lastDaily: dayKey(now), lastWeekly: weekKey(now) }, counters: {}, achievements: [], titles: ['title_newcomer'], title: 'title_newcomer',
    pets: [], activePet: null, eggs: [], farm: { capacity: CONFIG.farmBaseCapacity, feederSlots: CONFIG.feederBaseSlots, feederLevel: 0, food: 0, lastSettle: now, decorations: [], likes: 0 },
    mounts: [], activeMount: null, riding: false, mountLevels: {}, monsterCards: {}, discovered: [],
    professions: {}, gathering: { ore: { lvl: 1, exp: 0 }, tree: { lvl: 1, exp: 0 }, herb: { lvl: 1, exp: 0 }, fish: { lvl: 1, exp: 0 } },
    tcg: { season: currentSeason(now), collection: {}, decks: [], activeDeck: '', rating: 1000, stars: 0, rank: 0, wins: 0, losses: 0, pity: 0, tower: 0 },
    pvp: { rating: 1000, wins: 0, losses: 0, season: currentSeason(now), history: [] }, dungeon: { runs: {}, firstClears: [], day: dayKey(now) },
    gacha: { pity: 0, history: [] }, pass: { level: 0, exp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    login: { lastDay: '', streak: 0, claimed: 0 }, missions: { day: dayKey(now), progress: {}, claimed: [], points: 0, chests: [] }, events: { progress: {}, claimed: [] },
    mail: [], friends: [], blocked: [], guild: null, marriage: null, house: { furniture: [], theme: 0 }, refinePity: {}, settings: {}, wallet: new Ledger(), log: [],
  };
  // starter kit (single logical transaction)
  const weapon = { sword: 'wood_sword', greatsword: 'wood_greatsword', spear: 'wood_spear', dagger: 'wood_dagger', bow: 'wood_bow', staff: 'wood_staff', tome: 'wood_tome', knuckle: 'wood_knuckle', gun: 'wood_gun', lute: 'wood_lute', cards: 'wood_cards', whip: 'wood_whip' }[cls.weapons[0]!];
  p.equipment.main = newItem(weapon);
  p.equipment.body = newItem('wood_body');
  for (const [id, q] of [['potion_hp_s', 10], ['potion_mp_s', 5], ['capture_net', 3], ['pet_food', 10], ['wood_head', 1], ['tool_axe', 1], ['tool_sickle', 1]] as const) p.inventory.push(newItem(id, q));
  const deck = STARTER_DECKS[`starter_${['fire', 'water', 'earth', 'wind', 'ice', 'light', 'dark'].includes(cls.element) ? cls.element : 'fire'}`]!;
  p.tcg.bound = {}; for (const c of deck.cards) { p.tcg.collection[c] = (p.tcg.collection[c] ?? 0) + 1; p.tcg.bound[c] = (p.tcg.bound[c] ?? 0) + 1; } // starter cards are account-bound
  p.tcg.decks.push({ id: 'deck1', name: deck.name.en, cards: [...deck.cards] }); p.tcg.activeDeck = 'deck1';
  p.wallet.mint(walletId(p), 'gold', 500n, 'starter', `starter:${id}`);
  p.wallet.mint(walletId(p), 'crystal_free', 1500n, 'starter_sim', `starter_c:${id}`); // simulated, non-tradeable Free Crystal (no real money)
  const s = playerStats(p); p.hp = s.derived.maxHp; p.mp = s.derived.maxMp;
  return p;
}
export const walletId = (p: PlayerState) => `p:${p.id}`;

/** Collect every modifier source in a fixed order (§10 pipeline). */
export function playerModifiers(p: PlayerState, extra: Modifier[] = []): Modifier[] {
  const mods: Modifier[] = [];
  const setCounts: Record<string, number> = {};
  for (const slot of EQUIP_SLOTS) {
    const it = p.equipment[slot]; if (!it || it.durability <= 0) continue; const def = ITEMS[it.defId]!; // broken gear contributes nothing
    const src = `equip:${slot}`;
    for (const m of def.stats ?? []) {
      const bonus = m.kind === 'flat' && ['atk', 'matk', 'def', 'mdef', 'maxHp'].includes(m.stat) ? Math.floor(m.value * it.refine * 0.06) + it.refine * 2 : 0;
      mods.push({ ...m, value: m.value + bonus, source: src });
    }
    for (const o of it.options) mods.push({ ...o, source: `option:${slot}` });
    it.sockets.forEach((g, i) => { if (g && it.refine >= CONFIG.gemSocketUnlock[i]!) for (const m of ITEMS[g]?.stats ?? []) mods.push({ ...m, value: Math.round(m.value * (1 + (it.gemRefine?.[i] ?? 0) * 0.1) * 10) / 10, source: `gem:${slot}` }); });
    for (const c of it.cards) if (c) for (const m of MONSTER_CARDS[c]?.mods ?? []) mods.push({ ...m, source: `card:${slot}` });
    if (def.setId) setCounts[def.setId] = (setCounts[def.setId] ?? 0) + 1;
  }
  for (const [set, n] of Object.entries(setCounts)) for (const b of SET_BONUS[set] ?? []) if (n >= b.pieces) for (const m of b.mods) mods.push({ ...m, source: `set:${set}${b.pieces}` });
  const collected = Object.keys(p.monsterCards).length;
  for (const b of CARD_SET_BONUS) if (collected >= b.count) for (const m of b.mods) mods.push({ ...m, source: `collection:${b.count}` });
  for (const [sid, rank] of Object.entries(p.skillRanks)) { const s = ALL_SKILLS[sid]; if (s?.type === 'passive' && rank > 0) for (const m of s.passive ?? []) mods.push({ ...m, value: m.value * rank, source: `passive:${sid}` }); }
  const pet = p.pets.find((x) => x.uid === p.activePet);
  if (pet) for (const m of PETS[pet.species]?.ownerBonus ?? []) mods.push({ ...m, value: m.value * (1 + pet.stars * 0.25), source: `pet:${pet.species}` });
  if (pet?.runes?.includes('rune_shell')) mods.push({ stat: 'def', kind: 'pct', value: 3, source: 'pet_rune:shell' });
  if (p.activeMount) { const md = MOUNTS[p.activeMount]; for (const m of md?.bonus ?? []) mods.push({ ...m, value: m.value * (1 + (p.mountLevels[p.activeMount] ?? 0) * 0.1), source: `mount:${p.activeMount}` }); if (p.riding && md) mods.push({ stat: 'moveSpeed', kind: 'flat', value: md.speed, source: 'riding' }); }
  if (p.title) for (const m of TITLES[p.title]?.mods ?? []) mods.push({ ...m, source: `title:${p.title}` });
  if (p.ascension > 0) mods.push({ stat: 'maxHp', kind: 'pct', value: p.ascension * 5, source: 'ascension' }, { stat: 'atk', kind: 'pct', value: p.ascension * 4, source: 'ascension' }, { stat: 'matk', kind: 'pct', value: p.ascension * 4, source: 'ascension' });
  if (p.mastery > 0) mods.push({ stat: 'maxHp', kind: 'flat', value: Math.floor(30 * Math.sqrt(p.mastery)), source: 'mastery' });
  if (p.marriage && p.marriage.stage !== 'engaged') mods.push({ stat: 'expBonus', kind: 'flat', value: 5, source: 'marriage' });
  for (const [id, m] of Object.entries(p.memberships ?? {})) if (m.until === null || m.until > Date.now()) for (const b of MEMBERSHIPS[id]?.bonus ?? []) mods.push({ stat: b.stat as any, kind: 'flat', value: b.value, source: `membership:${id}` });
  return mods.concat(extra);
}
export function playerStats(p: PlayerState, extra: Modifier[] = []): StatResult {
  const cls = CLASSES[p.classId]!;
  return computeStats({ level: p.level, base: cls.base, growth: cls.growth, allocated: p.allocated, modifiers: playerModifiers(p, extra) });
}
export function playerCP(p: PlayerState): number { return combatPower(playerStats(p).derived, p.level); }
export function weaponElement(p: PlayerState): Element { return ITEMS[p.equipment.main?.defId ?? '']?.element ?? CLASSES[p.classId]!.element; }

export class PlayerService {
  events: GameEvent[] = [];
  constructor(public p: PlayerState, public rng: Rng = new Rng(), public now: () => number = Date.now) {}
  emit(e: GameEvent) { this.events.push(e); this.onEvent(e); }
  note(msg: string) { this.p.log.unshift({ ts: this.now(), msg }); if (this.p.log.length > 80) this.p.log.length = 80; }
  // ---- wallet ----
  get acct() { return walletId(this.p); }
  bal(c: Currency): bigint { return this.p.wallet.available(this.acct, c); }
  gold(): bigint { return this.bal('gold'); }
  earn(c: Currency, n: number | bigint, reason: string, key?: string) { const v = BigInt(Math.floor(Number(n))); if (v > 0n) { this.p.wallet.mint(this.acct, c, v, reason, key); this.emit({ type: 'currency', c, delta: Number(v) }); } }
  spend(c: Currency, n: number | bigint, reason: string): boolean { const v = BigInt(Math.floor(Number(n))); if (v <= 0n) return true; if (this.bal(c) < v) return false; this.p.wallet.burn(this.acct, c, v, reason); this.emit({ type: 'currency', c, delta: -Number(v) }); return true; }

  // ---- inventory (§20) ----
  countItem(defId: string): number { return this.p.inventory.filter((i) => i.defId === defId).reduce((s, i) => s + i.qty, 0); }
  slotsNeeded(defId: string, qty: number): number {
    const def = ITEMS[defId]!; if (def.stack <= 1) return qty;
    let room = 0; for (const i of this.p.inventory) if (i.defId === defId) room += def.stack - i.qty;
    return Math.max(0, Math.ceil((qty - room) / def.stack));
  }
  freeSlots(): number { return this.p.invSlots - this.p.inventory.length; }
  /** Adds items; overflow goes to mail (never lost). Returns created instances. */
  addItem(defId: string, qty = 1, opts: { rollOptions?: boolean; source?: string } = {}): ItemInstance[] {
    const def = ITEMS[defId]; if (!def || qty <= 0) return [];
    const created: ItemInstance[] = []; let left = qty;
    if (def.stack > 1) for (const i of this.p.inventory) { if (left <= 0) break; if (i.defId !== defId) continue; const add = Math.min(def.stack - i.qty, left); i.qty += add; left -= add; if (add) created.push(i); }
    while (left > 0) {
      const n = Math.min(def.stack, left); left -= n;
      const it = newItem(defId, n, opts.rollOptions ? this.rng : undefined);
      if (this.freeSlots() > 0) { this.p.inventory.push(it); created.push(it); }
      else this.sendMail('System', 'Inventory full', 'Overflow items delivered by mail.', [{ itemId: defId, qty: n }]);
    }
    this.emit({ type: 'item_gain', itemId: defId, qty, source: opts.source });
    if (def.type === 'material' || def.type === 'quest') this.progressObjective('collect', defId, 0);
    return created;
  }
  removeItem(defId: string, qty: number): boolean {
    if (this.countItem(defId) < qty) return false;
    let left = qty;
    for (let i = this.p.inventory.length - 1; i >= 0 && left > 0; i--) { const it = this.p.inventory[i]!; if (it.defId !== defId || it.locked) continue; const take = Math.min(it.qty, left); it.qty -= take; left -= take; if (it.qty <= 0) this.p.inventory.splice(i, 1); }
    if (left > 0) return false; // locked items prevented removal (shouldn't happen after count check unless locked)
    return true;
  }
  findInv(uidv: string) { return this.p.inventory.find((i) => i.uid === uidv); }
  sortInventory() { const order = ['weapon', 'armor', 'accessory', 'costume', 'consumable', 'gem', 'skill_stone', 'material', 'pet_egg', 'pet_food', 'mount_key', 'ticket', 'card_pack', 'tool', 'decoration', 'enchant', 'protection', 'quest']; this.p.inventory.sort((a, b) => order.indexOf(ITEMS[a.defId]!.type) - order.indexOf(ITEMS[b.defId]!.type) || a.defId.localeCompare(b.defId)); return ok(); }
  splitStack(uidv: string, n: number): Result { const it = this.findInv(uidv); if (!it || n <= 0 || n >= it.qty) return fail('INVALID'); if (this.freeSlots() < 1) return fail('INVENTORY_FULL'); it.qty -= n; this.p.inventory.push({ ...newItem(it.defId, n) }); return ok(); }
  toggleLock(uidv: string): Result { const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); it.locked = !it.locked; return ok(); }
  sellItem(uidv: string, qty?: number): Result {
    const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); if (it.locked) return fail('LOCKED');
    const def = ITEMS[it.defId]!; if (def.type === 'quest') return fail('CANNOT_SELL');
    const n = Math.min(qty ?? it.qty, it.qty); const price = Math.floor(def.price * 0.25) * n + it.refine * 50;
    it.qty -= n; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1);
    this.earn('gold', price, 'npc_sell'); this.note(`Sold ${def.name.en} ×${n} for ${price}G`); return ok({ price });
  }
  bulkSell(rarities: Rarity[]): Result { let total = 0; for (const it of [...this.p.inventory]) { const d = ITEMS[it.defId]!; if ((d.type === 'weapon' || d.type === 'armor' || d.type === 'accessory') && rarities.includes(d.rarity) && !it.locked && it.refine === 0) { const r = this.sellItem(it.uid); total += (r.data as any)?.price ?? 0; } } return ok({ total }); }
  dismantle(uidv: string): Result {
    const it = this.findInv(uidv); if (!it || it.locked) return fail('INVALID'); const d = ITEMS[it.defId]!;
    if (!['weapon', 'armor', 'accessory', 'gem', 'skill_stone'].includes(d.type)) return fail('CANNOT_DISMANTLE');
    this.p.inventory.splice(this.p.inventory.indexOf(it), 1);
    const tier = RARITIES.indexOf(d.rarity) + 1;
    if (d.type === 'gem') this.addItem('gem_dust', 2 * tier); else if (d.type === 'skill_stone') this.addItem('stone_dust', 5 + it.stone!.refine * 2); else { this.addItem('stone_dust', tier * 2); if (tier >= 3) this.addItem('refine_ore', tier - 2); }
    return ok();
  }
  expandStorage(): Result { const cur = this.p.storageSlots ?? 120; if (cur >= 300) return fail('MAX'); const cost = 2000 + (cur - 120) * 150; if (!this.spend('gold', cost, 'storage_expand')) return fail('NOT_ENOUGH_GOLD', `Expansion costs ${cost}G`); this.p.storageSlots = cur + 20; return ok({ slots: this.p.storageSlots }); }
  storageMove(uidv: string, toStorage: boolean): Result {
    const from = toStorage ? this.p.inventory : this.p.storage, to = toStorage ? this.p.storage : this.p.inventory;
    const i = from.findIndex((x) => x.uid === uidv); if (i < 0) return fail('NOT_FOUND');
    if (!toStorage && this.freeSlots() <= 0) return fail('INVENTORY_FULL'); if (toStorage && this.p.storage.length >= (this.p.storageSlots ?? 120)) return fail('STORAGE_FULL');
    to.push(from.splice(i, 1)[0]!); return ok();
  }
  useItem(uidv: string): Result<any> {
    const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); const d = ITEMS[it.defId]!;
    if (d.reqLevel > this.p.level) return fail('LEVEL_TOO_LOW');
    if (d.slot) return this.equip(uidv);
    if (d.type === 'pet_egg') return this.incubateEgg(uidv);
    if (d.type === 'mount_key') return this.unlockMount(uidv);
    if (d.type === 'card_pack') return this.openCardPack(uidv);
    if (!d.use) return fail('NOT_USABLE');
    const st = playerStats(this.p).derived;
    if (d.use.grant === 'capture') return fail('USE_ON_TARGET', 'Select a weakened monster and press the net in hotbar / Capture button.');
    if (d.use.grant === 'repair') { const eq = Object.values(this.p.equipment).filter((i) => i && i.durability < 100) as ItemInstance[]; if (!eq.length) return fail('NOTHING_TO_REPAIR', 'Equipped gear is in perfect condition'); for (const i of eq) i.durability = 100; it.qty--; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1); this.clampVitals(); return ok({ repaired: eq.length }); }
    if (d.use.hp) this.p.hp = Math.min(st.maxHp, this.p.hp + d.use.hp);
    if (d.use.mp) this.p.mp = Math.min(st.maxMp, this.p.mp + d.use.mp);
    if (d.use.exp) this.gainExp(d.use.exp, 'item');
    it.qty--; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1);
    this.emit({ type: 'use_item', itemId: d.id });
    return ok(d.use);
  }

  // ---- equipment (§21) ----
  equip(uidv: string): Result {
    const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); const d = ITEMS[it.defId]!;
    if (!d.slot) return fail('NOT_EQUIPPABLE'); if (d.reqLevel > this.p.level) return fail('LEVEL_TOO_LOW', `Requires level ${d.reqLevel}`);
    if (d.type === 'weapon' && d.weapon && !CLASSES[this.p.classId]!.weapons.includes(d.weapon)) return fail('CLASS_RESTRICTED', `${CLASSES[this.p.classId]!.name.en} cannot use ${d.weapon}`);
    let slot = d.slot; if (slot === 'ring1' && this.p.equipment.ring1 && !this.p.equipment.ring2) slot = 'ring2';
    if (slot === 'off' && ['greatsword', 'bow', 'staff', 'gun'].includes(ITEMS[this.p.equipment.main?.defId ?? '']?.weapon ?? '')) return fail('TWO_HANDED');
    const prev = this.p.equipment[slot];
    this.p.inventory.splice(this.p.inventory.indexOf(it), 1); // atomic swap: free slot guaranteed since we removed one
    if (prev) this.p.inventory.push(prev);
    this.p.equipment[slot] = it; it.bound = it.bound || RARITIES.indexOf(d.rarity) >= 4;
    this.emit({ type: 'equip', slot }); this.progressObjective('equip', '', 1); this.clampVitals();
    return ok();
  }
  unequip(slot: Slot): Result { const it = this.p.equipment[slot]; if (!it) return fail('EMPTY'); if (this.freeSlots() <= 0) return fail('INVENTORY_FULL'); delete this.p.equipment[slot]; this.p.inventory.push(it); this.clampVitals(); return ok(); }
  clampVitals() { const d = playerStats(this.p).derived; this.p.hp = Math.min(this.p.hp, d.maxHp); this.p.mp = Math.min(this.p.mp, d.maxMp); }
  findOwned(uidv: string): ItemInstance | undefined { return this.findInv(uidv) ?? Object.values(this.p.equipment).find((i) => i?.uid === uidv); }

  // ---- durability & repair (§21) ----
  gearList(): ItemInstance[] { return [...Object.values(this.p.equipment).filter(Boolean), ...this.p.inventory.filter((i) => ['weapon', 'armor', 'accessory'].includes(ITEMS[i.defId]!.type))] as ItemInstance[]; }
  repairCost(it: ItemInstance): number { const d = ITEMS[it.defId]!; const missing = Math.max(0, 100 - it.durability); return Math.ceil(missing * (1 + d.price * 0.004) * (1 + it.refine * 0.1)); }
  repairAll(equippedOnly = false): Result<{ cost: number; repaired: number }> {
    const list = (equippedOnly ? Object.values(this.p.equipment).filter(Boolean) : this.gearList()) as ItemInstance[]; const need = list.filter((i) => i.durability < 100);
    if (!need.length) return fail('NOTHING_TO_REPAIR', 'All gear is in perfect condition'); const cost = need.reduce((s, i) => s + this.repairCost(i), 0);
    if (!this.spend('gold', cost, 'repair')) return fail('NOT_ENOUGH_GOLD', `Repair costs ${cost}G`);
    for (const i of need) i.durability = 100; this.clampVitals(); return ok({ cost, repaired: need.length });
  }
  // ---- refinement (§22) ----
  refinePreview(uidv: string) {
    const it = this.findOwned(uidv); if (!it) return null; const lvl = it.refine;
    if (lvl >= 20) return { max: true } as const;
    const base = CONFIG.refineSuccess[lvl]!; const pity = Math.min(CONFIG.refinePityCap, (this.p.refinePity[uidv] ?? 0) * CONFIG.refinePityPerFail);
    const ore = lvl >= 10 ? 'refine_ore_hi' : 'refine_ore';
    return { max: false, from: lvl, to: lvl + 1, chance: Math.min(100, base + (base < 100 ? pity : 0)), gold: CONFIG.refineGoldCost(lvl + 1), ore, oreQty: CONFIG.refineOreCost(lvl + 1),
      onFail: lvl + 1 <= 5 ? 'none' : lvl + 1 <= 10 ? 'materials lost' : lvl + 1 <= 15 ? `materials lost, ${Math.round(CONFIG.refineDowngradeChance11to15 * 100)}% chance −1` : 'materials lost, −1 unless protected', pity };
  }
  refine(uidv: string, useProtection = false, useBlessing = false): Result<{ success: boolean; level: number; downgraded: boolean }> {
    const it = this.findOwned(uidv); const pv = this.refinePreview(uidv); if (!it || !pv) return fail('NOT_FOUND'); if (pv.max) return fail('MAX_LEVEL');
    const d = ITEMS[it.defId]!; if (!['weapon', 'armor', 'accessory'].includes(d.type)) return fail('NOT_REFINABLE');
    if (this.gold() < BigInt(pv.gold)) return fail('NOT_ENOUGH_GOLD'); if (this.countItem(pv.ore) < pv.oreQty) return fail('NOT_ENOUGH_ORE', `Need ${pv.oreQty}× ${ITEMS[pv.ore]!.name.en}`);
    if (useProtection && this.countItem('ward_scroll') < 1) return fail('NO_PROTECTION'); if (useBlessing && this.countItem('blessing_scroll') < 1) return fail('NO_BLESSING');
    this.spend('gold', pv.gold, 'refine'); this.removeItem(pv.ore, pv.oreQty); if (useBlessing) this.removeItem('blessing_scroll', 1);
    const success = this.rng.next() * 100 < Math.min(100, pv.chance + (useBlessing ? 10 : 0)); let downgraded = false;
    if (success) { it.refine++; this.p.refinePity[uidv] = 0; this.bump('refine_success'); this.p.counters.max_refine = Math.max(this.p.counters.max_refine ?? 0, it.refine); if (it.refine >= 10) this.emit({ type: 'announce', msg: `${this.p.name} refined ${d.name.en} to +${it.refine}!` }); }
    else {
      this.p.refinePity[uidv] = (this.p.refinePity[uidv] ?? 0) + 1;
      const target = pv.to;
      if (target >= 16 || (target >= 11 && this.rng.chance(CONFIG.refineDowngradeChance11to15))) {
        if (useProtection) this.removeItem('ward_scroll', 1); else { it.refine = Math.max(10, it.refine - 1); downgraded = true; }
      }
    }
    this.bump('refines'); this.progressObjective('refine', '', 1); this.clampVitals();
    this.note(`Refine ${d.name.en} +${pv.from}→+${pv.to}: ${success ? 'SUCCESS' : 'FAIL'}${downgraded ? ' (downgraded)' : ''}`);
    return ok({ success, level: it.refine, downgraded });
  }
  // ---- gems (§23) ----
  socketGem(itemUid: string, gemUid: string): Result {
    const it = this.findOwned(itemUid); const gem = this.findInv(gemUid); if (!it || !gem) return fail('NOT_FOUND');
    if (ITEMS[gem.defId]!.type !== 'gem') return fail('NOT_GEM');
    const unlocked = CONFIG.gemSocketUnlock.filter((l) => it.refine >= l).length; if (unlocked === 0) return fail('NO_SOCKET', 'Sockets unlock at +5/+10/+15/+20');
    while (it.sockets.length < unlocked) it.sockets.push(null);
    const idx = it.sockets.findIndex((s) => s === null); if (idx < 0) return fail('SOCKETS_FULL');
    it.sockets[idx] = gem.defId; gem.qty--; if (gem.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(gem), 1);
    return ok();
  }
  unsocketGem(itemUid: string, idx: number): Result { const it = this.findOwned(itemUid); if (!it || !it.sockets[idx]) return fail('EMPTY'); if (!this.spend('gold', 500, 'gem_remove')) return fail('NOT_ENOUGH_GOLD'); const g = it.sockets[idx]!; it.sockets[idx] = null; this.addItem(g, 1); return ok(); }
  fuseGems(defId: string): Result { const m = /^gem_(\w+)_(\d)$/.exec(defId); if (!m || m[2] === '3') return fail('CANNOT_FUSE'); if (this.countItem(defId) < 3) return fail('NEED_3'); if (!this.spend('gold', 300 * Number(m[2]), 'gem_fuse')) return fail('NOT_ENOUGH_GOLD'); this.removeItem(defId, 3); this.addItem(`gem_${m[1]}_${Number(m[2]) + 1}`, 1); return ok(); }
  /** Gem refining (§23): socketed gem +0–10, +10% of its stat per level; costs Gem Dust + Gold; failure keeps the level (no destruction). */
  refineGem(itemUid: string, idx: number): Result<{ success: boolean; level: number }> {
    const it = this.findOwned(itemUid); if (!it || !it.sockets[idx]) return fail('NO_GEM', 'No gem in that socket'); it.gemRefine ??= it.sockets.map(() => 0); while (it.gemRefine.length < it.sockets.length) it.gemRefine.push(0);
    const lv = it.gemRefine[idx] ?? 0; if (lv >= 10) return fail('MAX_LEVEL'); const dust = 2 + lv * 2, gold = 300 * (lv + 1);
    if (this.countItem('gem_dust') < dust) return fail('NEED_GEM_DUST', `Need ${dust} Gem Dust`); if (!this.spend('gold', gold, 'gem_refine')) return fail('NOT_ENOUGH_GOLD', `Need ${gold}G`);
    this.removeItem('gem_dust', dust); const success = this.rng.next() * 100 < GEM_REFINE_RATE[lv]!; if (success) it.gemRefine[idx] = lv + 1; this.clampVitals(); return ok({ success, level: it.gemRefine[idx]! });
  }
  /** Cosmetic enhancement (§22): costumes/wings +0–5 using a duplicate costume or Star Dust; purely visual (aura), never adds stats. */
  enhanceCosmetic(itemUid: string, fodderUid?: string): Result<{ level: number }> {
    const it = this.findOwned(itemUid); if (!it || ITEMS[it.defId]!.type !== 'costume') return fail('NOT_COSMETIC'); const lv = it.cosmetic ?? 0; if (lv >= COSMETIC_MAX) return fail('MAX_LEVEL');
    if (fodderUid) { const f = this.findInv(fodderUid); if (!f || f === it || f.defId !== it.defId || f.locked) return fail('NEED_DUPLICATE', 'Use an identical costume'); this.p.inventory.splice(this.p.inventory.indexOf(f), 1); }
    else if (!this.removeItem('star_dust', 3 + lv * 2)) return fail('NEED_STAR_DUST', `Need ${3 + lv * 2} Star Dust (or a duplicate costume)`);
    it.cosmetic = lv + 1; return ok({ level: it.cosmetic });
  }
  // ---- random options / enchant ----
  enchant(itemUid: string, lockIdx: number[] = []): Result {
    const it = this.findOwned(itemUid); if (!it) return fail('NOT_FOUND'); const d = ITEMS[it.defId]!; if (!['weapon', 'armor', 'accessory'].includes(d.type)) return fail('INVALID');
    const need = 1 + lockIdx.length; if (this.countItem('enchant_stone') < need) return fail('NOT_ENOUGH_STONES', `Need ${need} Enchant Stone(s)`);
    this.removeItem('enchant_stone', need);
    const n = Math.max(1, it.options.length, RARITIES.indexOf(d.rarity) >= 3 ? 3 : 2);
    const next: Omit<Modifier, 'source'>[] = [];
    for (let i = 0; i < n; i++) next.push(lockIdx.includes(i) && it.options[i] ? it.options[i]! : rollOption(this.rng, d.type));
    it.options = next; this.clampVitals(); return ok();
  }
  // ---- monster cards (§24) ----
  insertCard(itemUid: string, cardId: string): Result {
    const it = this.findOwned(itemUid); if (!it) return fail('NOT_FOUND'); const c = MONSTER_CARDS[cardId]; if (!c || (this.p.monsterCards[cardId] ?? 0) < 1) return fail('NO_CARD');
    const t = ITEMS[it.defId]!.type; if (t !== c.slot) return fail('WRONG_SLOT', `Card fits ${c.slot}`);
    while (it.cards.length < (it.refine >= 10 ? 2 : 1)) it.cards.push(null); // second card row unlocks at +10
    const idx = it.cards.findIndex((x) => x === null); if (idx < 0) return fail('NO_CARD_SLOT', it.refine < 10 ? 'Second card slot unlocks at +10' : 'All card slots used');
    it.cards[idx] = cardId; this.p.monsterCards[cardId]!--; if (this.p.monsterCards[cardId]! <= 0) this.p.monsterCards[cardId] = 0; return ok();
  }
  // ---- skill stones (§15) ----
  inscribeStone(stoneUid: string, skillId: string): Result {
    const st = this.findInv(stoneUid); if (!st?.stone) return fail('NOT_STONE'); const sk = ALL_SKILLS[skillId]; if (!sk || sk.classId !== this.p.classId || sk.type === 'passive') return fail('INCOMPATIBLE');
    if (!this.spend('gold', 1000, 'stone_inscribe')) return fail('NOT_ENOUGH_GOLD');
    const keys = ['power', 'cd', 'mp', 'radius'] as const;
    st.stone.skillId = skillId; st.stone.mods = this.rng.shuffle([...keys]).slice(0, 2).map((key) => ({ key, value: key === 'power' ? this.rng.int(5, 15) : key === 'cd' ? this.rng.int(5, 12) : key === 'mp' ? this.rng.int(5, 20) : this.rng.int(5, 20) }));
    return ok();
  }
  /** Re-inscription (§15): keep the skill, reroll the two modifiers. */
  reinscribeStone(stoneUid: string): Result { const st = this.findInv(stoneUid); if (!st?.stone?.skillId) return fail('NOT_INSCRIBED'); if (st.locked) return fail('UNSLOT_FIRST', 'Unslot the stone first'); if (!this.removeItem('stone_dust', 5)) return fail('NEED_STONE_DUST', 'Need 5 Stone Dust'); if (!this.spend('gold', 500, 'stone_reinscribe')) { this.addItem('stone_dust', 5); return fail('NOT_ENOUGH_GOLD'); } const keys = ['power', 'cd', 'mp', 'radius'] as const; st.stone.mods = this.rng.shuffle([...keys]).slice(0, 2).map((key) => ({ key, value: key === 'power' ? this.rng.int(5, 15) : key === 'cd' ? this.rng.int(5, 12) : this.rng.int(5, 20) })); return ok({ mods: st.stone.mods }); }
  refineStone(stoneUid: string): Result { const st = this.findInv(stoneUid); if (!st?.stone?.skillId) return fail('NOT_INSCRIBED'); if (st.stone.refine >= 10) return fail('MAX'); if (this.countItem('stone_dust') < 5 + st.stone.refine * 3) return fail('NOT_ENOUGH_DUST'); this.removeItem('stone_dust', 5 + st.stone.refine * 3); if (this.rng.chance(Math.max(0.3, 1 - st.stone.refine * 0.07))) { st.stone.refine++; return ok({ success: true }); } return ok({ success: false }); }
  equippedStones(): ItemInstance[] { return this.p.inventory.filter((i) => i.stone?.skillId && i.locked); }
  /** Skill modified by rank + slotted (locked) skill stones; values clamped so no negative cost/cooldown. */
  effectiveSkill(id: string): SkillDef & { rank: number } | null {
    const s = ALL_SKILLS[id]; const rank = this.p.skillRanks[id] ?? 0; if (!s || rank <= 0) return null;
    const e = { ...s, rank, power: s.power * (1 + s.perRank * (rank - 1)) };
    for (const st of this.equippedStones()) if (st.stone!.skillId === id) for (const m of st.stone!.mods) { const v = m.value * (1 + st.stone!.refine * 0.1) / 100; if (m.key === 'power') e.power *= 1 + v; if (m.key === 'cd') e.cdMs = Math.max(500, Math.floor(e.cdMs * (1 - v))); if (m.key === 'mp') e.mp = Math.max(0, Math.floor(e.mp * (1 - v))); if (m.key === 'radius') e.radius = Math.floor(e.radius * (1 + v)); }
    return e;
  }

  // ---- progression (§9) ----
  gainExp(amount: number, source: string, eventMult = 1): number {
    const d = playerStats(this.p).derived; const gained = Math.floor(amount * (1 + d.expBonus / 100) * eventMult);
    let levels = 0;
    const capLvl = CONFIG.levelCap;
    this.p.jobExp += Math.floor(gained * 0.6);
    while (this.p.jobLevel < 70 && this.p.jobExp >= requiredJobExp(this.p.jobLevel)) { this.p.jobExp -= requiredJobExp(this.p.jobLevel); this.p.jobLevel++; this.p.skillPoints++; }
    if (this.p.level >= capLvl) {
      if (this.p.ascension >= CONFIG.ascensionTiers) { this.p.masteryExp += gained; while (this.p.mastery < CONFIG.extendedMasteryCap && this.p.masteryExp >= requiredMasteryExp(this.p.mastery)) { this.p.masteryExp -= requiredMasteryExp(this.p.mastery); this.p.mastery++; this.emit({ type: 'mastery', level: this.p.mastery }); this.masteryMilestone(this.p.mastery); } }
      return gained;
    }
    this.p.exp += gained;
    while (this.p.level < capLvl && this.p.exp >= requiredExp(this.p.level)) {
      const req = this.p.level >= CONFIG.ascensionLevelReq[this.p.ascension]! && this.p.ascension < CONFIG.ascensionTiers ? null : requiredExp(this.p.level);
      if (req === null) { this.p.exp = Math.min(this.p.exp, requiredExp(this.p.level)); break; } // ascension gate: overflow capped
      this.p.exp -= req; this.p.level++; levels++;
      this.p.statPoints += CONFIG.statPointsPerLevel; this.p.skillPoints += CONFIG.skillPointsPerLevel;
    }
    if (this.p.level >= capLvl) this.p.exp = 0;
    if (levels) {
      const st = playerStats(this.p).derived; this.p.hp = st.maxHp; this.p.mp = st.maxMp;
      this.emit({ type: 'level_up', level: this.p.level }); this.note(`Level up! Now level ${this.p.level}`);
      this.p.counters.level = this.p.level; this.checkAchievements(); this.progressObjective('level', '', 0);
      for (let lv = this.p.level - levels + 1; lv <= this.p.level; lv++) if (lv % 10 === 0) this.sendMail('Elder Rowan', `Milestone: Level ${lv}`, 'A gift for your growth.', [{ itemId: 'refine_ore', qty: 5 }, { itemId: 'gacha_ticket', qty: 1 }], 1000); // every crossed milestone, even on multi-level gains
    }
    this.gainPassExp(Math.max(1, Math.floor(amount / 200)));
    return gained;
  }
  ascend(): Result {
    const tier = this.p.ascension; if (tier >= CONFIG.ascensionTiers) return fail('MAX_ASCENSION');
    if (this.p.level < CONFIG.ascensionLevelReq[tier]!) return fail('LEVEL_TOO_LOW', `Requires level ${CONFIG.ascensionLevelReq[tier]}`);
    const hearts = 3 * (tier + 1); if (this.countItem('boss_heart') < hearts) return fail('NEED_HEARTS', `Requires ${hearts}× Guardian Heart`);
    this.removeItem('boss_heart', hearts); this.p.ascension++; this.p.statPoints += 10; this.p.skillPoints += 5;
    this.emit({ type: 'announce', msg: `${this.p.name} has reached Ascension ${this.p.ascension}!` }); return ok();
  }
  allocate(stat: keyof Primary, n = 1): Result { if (n <= 0 || this.p.statPoints < n) return fail('NO_POINTS'); this.p.allocated[stat] += n; this.p.statPoints -= n; return ok(); }
  resetStats(): Result { const total = Object.values(this.p.allocated).reduce((a, b) => a + b, 0); if (!this.spend('gold', 1000 + this.p.level * 50, 'stat_reset')) return fail('NOT_ENOUGH_GOLD'); this.p.allocated = zeroPrimary(); this.p.statPoints += total; this.clampVitals(); return ok(); }
  learnSkill(id: string): Result {
    const s = ALL_SKILLS[id]; if (!s || s.classId !== this.p.classId) return fail('INVALID_SKILL');
    const rank = this.p.skillRanks[id] ?? 0; if (rank >= s.maxRank) return fail('MAX_RANK'); if (this.p.level < s.reqLevel + rank * 2) return fail('LEVEL_TOO_LOW', `Requires level ${s.reqLevel + rank * 2}`);
    if (this.p.skillPoints < 1) return fail('NO_SKILL_POINTS');
    this.p.skillPoints--; this.p.skillRanks[id] = rank + 1;
    if (rank === 0 && s.type !== 'passive') { const i = this.p.hotbar.indexOf(null); if (i >= 0) this.p.hotbar[i] = id; }
    return ok();
  }
  resetSkills(): Result { if (!this.spend('gold', 2000, 'skill_reset')) return fail('NOT_ENOUGH_GOLD'); const cls = CLASSES[this.p.classId]!; let pts = 0; for (const [id, r] of Object.entries(this.p.skillRanks)) { const s = ALL_SKILLS[id]!; pts += s.reqLevel <= 1 ? r - 1 : r; } this.p.skillRanks = Object.fromEntries(cls.skills.filter((s) => s.reqLevel <= 1).map((s) => [s.id, 1])); this.p.skillPoints += pts; this.p.hotbar = [cls.skills[0]!.id, cls.skills[1]!.id, null, null, null, null, null, null]; return ok(); }
  setHotbar(i: number, skillOrItem: string | null): Result { if (i < 0 || i >= 8) return fail('INVALID'); this.p.hotbar[i] = skillOrItem; return ok(); }
  /** Change class (Developer/Testing only; production gated by class-change quest). */
  changeClass(classId: string): Result { const c = CLASSES[classId]; if (!c) return fail('INVALID'); this.p.classId = classId; this.p.skillRanks = Object.fromEntries(c.skills.filter((s) => s.reqLevel <= 1).map((s) => [s.id, 1])); this.p.skillPoints = this.p.level + 1; this.p.hotbar = [c.skills[0]!.id, c.skills[1]!.id, null, null, null, null, null, null]; this.clampVitals(); return ok(); }

  // ---- kill rewards (called by world/combat engine exactly once per death) ----
  onKill(monsterId: string, level: number, baseExp: number, gold: number, drops: { itemId: string; qty: number }[], eventMult: { exp: number; drop: number; gold?: number } = { exp: 1, drop: 1 }, killKey?: string) {
    if (killKey) { if ((this.p.counters[`k:${killKey}`] ?? 0) > 0) return; this.p.counters[`k:${killKey}`] = 1; }
    const diff = this.p.level - level; const penalty = diff > 10 ? Math.max(0.1, 1 - (diff - 10) * 0.1) : 1;
    this.gainExp(baseExp * penalty, 'kill', eventMult.exp);
    const d = playerStats(this.p).derived;
    this.earn('gold', Math.floor(gold * (1 + d.goldBonus / 100) * (eventMult.gold ?? 1)), 'monster');
    for (const dr of drops) this.addItem(dr.itemId, dr.qty, { rollOptions: true, source: 'drop' });
    const card = MONSTER_CARDS[`mc_${monsterId}`]; if (card && this.rng.chance(card.dropChance * (1 + d.dropBonus / 100) * eventMult.drop)) { this.p.monsterCards[card.id] = (this.p.monsterCards[card.id] ?? 0) + 1; if (!this.p.discovered.includes(card.id)) this.p.discovered.push(card.id); this.note(`Monster card: ${card.name.en}!`); this.emit({ type: 'card_drop', card: card.id }); }
    this.bump('kills'); this.progressObjective('kill', monsterId, 1);
    if (this.p.activePet) { const pet = this.p.pets.find((x) => x.uid === this.p.activePet); if (pet) this.petGainExp(pet, Math.floor(baseExp * 0.3)); }
    // drop kill-key memory housekeeping
    if (killKey) { const keys = Object.keys(this.p.counters).filter((k) => k.startsWith('k:')); if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete this.p.counters[k]; }
  }
  rollLoot(drops: { itemId: string; chance: number; min: number; max: number }[], dropMult = 1): { itemId: string; qty: number }[] {
    const d = playerStats(this.p).derived; const out: { itemId: string; qty: number }[] = [];
    for (const dr of drops) if (ITEMS[dr.itemId] && this.rng.chance(Math.min(1, dr.chance * (1 + d.dropBonus / 100) * dropMult))) out.push({ itemId: dr.itemId, qty: this.rng.int(dr.min, dr.max) });
    return out;
  }

  // ---- counters / achievements / missions / events (§48–49) ----
  bump(counter: string, n = 1) {
    this.p.counters[counter] = (this.p.counters[counter] ?? 0) + n;
    this.resetDailyIfNeeded();
    if (MISSIONS_DAILY.some((m) => m.counter === counter)) this.p.missions.progress[counter] = (this.p.missions.progress[counter] ?? 0) + n;
    this.syncEventWeek(); const active = activeEventAt(this.now()); for (const m of active.missions) if (m.counter === counter) this.p.events.progress[m.id] = (this.p.events.progress[m.id] ?? 0) + n; // only the running event counts
    this.checkAchievements();
  }
  checkAchievements() {
    this.p.counters.pets = this.p.pets.length; this.p.counters.mounts = this.p.mounts.length; this.p.counters.monster_cards = Object.keys(this.p.monsterCards).length; this.p.counters.level = this.p.level;
    for (const a of ACHIEVEMENTS) if (!this.p.achievements.includes(a.id) && (this.p.counters[a.counter] ?? 0) >= a.target) {
      this.p.achievements.push(a.id); if (a.title && !this.p.titles.includes(a.title)) this.p.titles.push(a.title);
      this.note(`Achievement unlocked: ${a.name.en}`); this.emit({ type: 'achievement', id: a.id });
    }
  }
  setTitle(t: string | null): Result { if (t && !this.p.titles.includes(t)) return fail('LOCKED'); this.p.title = t; this.clampVitals(); return ok(); }
  /** Event missions belong to one occurrence of a weekly event: a new week starts fresh, so returning events can be completed again. */
  syncEventWeek() { const wk = Math.floor(this.now() / WEEK_MS); if (this.p.events.week !== wk) this.p.events = { progress: {}, claimed: [], week: wk }; }
  resetDailyIfNeeded() {
    this.checkSeasons(); this.syncEventWeek();
    const day = dayKey(this.now());
    if (this.p.missions.day !== day) this.p.missions = { day, progress: {}, claimed: [], points: 0, chests: [] };
    if (this.p.dungeon.day !== day) this.p.dungeon = { ...this.p.dungeon, runs: {}, day };
    if (this.p.quests.lastDaily !== day) { this.p.quests.done = this.p.quests.done.filter((q) => QUESTS[q]?.type !== 'daily'); this.p.quests.active = this.p.quests.active.filter((q) => QUESTS[q.id]?.type !== 'daily'); this.p.quests.lastDaily = day; }
    const wk = weekKey(this.now()); if (this.p.quests.lastWeekly !== wk) { this.p.quests.done = this.p.quests.done.filter((q) => QUESTS[q]?.type !== 'weekly'); this.p.quests.active = this.p.quests.active.filter((q) => QUESTS[q.id]?.type !== 'weekly'); this.p.quests.lastWeekly = wk; }
  }
  /** Season rollover: rewards by final tier mailed exactly once, then soft reset (rating halfway to 1000; TCG rank −1, stars 0). */
  checkSeasons(): { pvp?: string; tcg?: string } {
    const cur = currentSeason(this.now()); const out: { pvp?: string; tcg?: string } = {};
    if (this.p.pvp.season < cur && this.p.createdAt >= seasonEndsAt(this.p.pvp.season)) { this.p.pvp.season = cur; this.p.tcg.season = cur; } // legacy saves: never played that season
    if (this.p.pvp.season < cur) {
      const tier = pvpTier(this.p.pvp.rating); (this.p.pvp.seasons ??= []).unshift({ season: this.p.pvp.season, rating: this.p.pvp.rating, tier: tier.name });
      this.earn('arena_token', tier.tokens, 'pvp_season_reward', `pvpseason:${this.p.id}:${this.p.pvp.season}`); if (tier.name === 'Diamond' && !this.p.titles.includes('title_gladiator')) this.p.titles.push('title_gladiator');
      this.sendMail('Arena Master Kaz', `Arena Season ${this.p.pvp.season} results`, `Final rating ${this.p.pvp.rating} (${tier.name}). You received ${tier.tokens} Arena Tokens.`);
      this.p.pvp.rating = 1000 + Math.floor((this.p.pvp.rating - 1000) / 2); this.p.pvp.season = cur; out.pvp = tier.name;
    }
    const ts = this.p.tcg.season ?? cur; if (ts < cur) {
      (this.p.tcg.seasons ??= []).unshift({ season: ts, rank: this.p.tcg.rank, stars: this.p.tcg.stars }); const dust = 50 + this.p.tcg.rank * 100;
      this.earn('card_dust', dust, 'tcg_season_reward', `tcgseason:${this.p.id}:${ts}`); this.sendMail('Duelist Kit', `Hearthcards Season ${ts} results`, `Final rank ${['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'][this.p.tcg.rank]}. You received ${dust} Card Dust.`);
      this.p.tcg.rank = Math.max(0, this.p.tcg.rank - 1); this.p.tcg.stars = 0; out.tcg = String(ts);
    }
    this.p.tcg.season = cur; return out;
  }
  /** MVP reward for an arena match (called once per match by the settlement code). */
  awardMvp(): void { this.earn('arena_token', 10, 'arena_mvp'); if (!this.p.titles.includes('title_mvp')) this.p.titles.push('title_mvp'); this.bump('arena_mvp'); this.note('You were the match MVP!'); }
  /** Engagement (§41): consent given; the wedding ceremony at the plaza completes the marriage. */
  engage(partner: string) { this.p.marriage = { partner, since: 0, anniversary: 0, stage: 'engaged', engagedAt: this.now() }; this.emit({ type: 'engaged', partner } as any); }
  completeWedding(partner: string) {
    const m = this.p.marriage; if (!m || m.partner !== partner || m.stage === 'married') return false;
    this.p.marriage = { partner, since: this.now(), anniversary: 0, stage: 'married' }; if (!this.p.titles.includes('title_hearthbound')) this.p.titles.push('title_hearthbound'); this.addItem('costume_festival', 1); this.bump('weddings'); this.emit({ type: 'wedded', partner } as any); return true;
  }
  isMarried() { const m = this.p.marriage; return !!m && m.stage !== 'engaged'; }
  /** Mastery (Lantern Level) milestones: titles + an aura cosmetic at 10/25/50. */
  masteryMilestone(lv: number) { const t = ({ 10: 'title_lantern_10', 25: 'title_lantern_25', 50: 'title_lantern_50' } as Record<number, string>)[lv]; if (!t) return; if (!this.p.titles.includes(t)) this.p.titles.push(t); if (lv === 50) this.addItem('wings_fairy', 1); this.sendMail('Elder Rowan', `Lantern Level ${lv}`, 'Your lantern burns brighter. A new title awaits.', [], 0); }
  /** Equipment presets: save the equipped set; loading re-equips whatever of it is still owned. */
  savePreset(i: number): Result { if (!(i >= 0 && i < 3)) return fail('INVALID'); const ps = ((this.p as any).presets ??= [null, null, null]) as (Record<string, string> | null)[]; ps[i] = Object.fromEntries(Object.entries(this.p.equipment).filter(([, v]) => v).map(([k, v]) => [k, (v as ItemInstance).uid])); return ok(); }
  loadPreset(i: number): Result<{ equipped: number; missing: number }> { const ps = (this.p as any).presets as (Record<string, string> | null)[] | undefined; const pr = ps?.[i]; if (!pr) return fail('EMPTY'); let equipped = 0, missing = 0; for (const uidv of Object.values(pr)) { if (Object.values(this.p.equipment).some((e) => e?.uid === uidv)) { equipped++; continue; } if (!this.findInv(uidv)) { missing++; continue; } if (this.equip(uidv).ok) equipped++; else missing++; } return ok({ equipped, missing }); }
  /** Offline auto-play (§31): with the setting on, time away (≥5 min, capped 8 h) yields EXP and Gold at 30% of on-level grinding; mailed summary. */
  settleOfflineAuto(): Result<{ minutes: number; exp: number; gold: number }> {
    const now = this.now(); const last = (this.p as any).lastActiveAt as number | undefined; (this.p as any).lastActiveAt = now; if (!this.p.settings.offlineAuto || !last) return ok({ minutes: 0, exp: 0, gold: 0 });
    const minutes = Math.min(8 * 60, Math.floor((now - last) / 60000)); if (minutes < 5) return ok({ minutes: 0, exp: 0, gold: 0 });
    const exp = Math.floor(requiredExp(Math.min(this.p.level, CONFIG.levelCap)) / 240 * minutes * 0.3); const gold = Math.floor(this.p.level * 3 * minutes * 0.3);
    this.gainExp(exp, 'offline_auto'); this.earn('gold', gold, 'offline_auto', `offline:${this.p.id}:${now}`); this.sendMail('Auto-play', `Offline adventure (${minutes} min)`, `While you were away: +${exp} EXP, +${gold} Gold (30% rate, max 8 h).`, [], 0); return ok({ minutes, exp, gold });
  }
  touchActive() { (this.p as any).lastActiveAt = this.now(); }
  hasMembership(id: string) { const m = this.p.memberships?.[id]; return !!m && (m.until === null || m.until > this.now()); }
  /** Memberships (§47): simulated Crystal only; time-limited ones extend when bought again; no auto-renewal. */
  buyMembership(id: string): Result<{ until: number | null }> {
    const def = MEMBERSHIPS[id]; if (!def) return fail('INVALID'); const ms = (this.p.memberships ??= {}); const cur = ms[id];
    if (def.days === null && cur) return fail('ALREADY_OWNED'); if (!this.spendCrystal(def.cost, `membership_sim:${id}`)) return fail('NOT_ENOUGH_CRYSTAL', `Costs ${def.cost} Crystal (simulated)`);
    const base = cur?.until && cur.until > this.now() ? cur.until : this.now(); ms[id] = { until: def.days === null ? null : base + def.days * 86400_000, lastClaim: cur?.lastClaim ?? '' }; return ok({ until: ms[id]!.until });
  }
  claimMembership(id: string): Result { const def = MEMBERSHIPS[id]; const m = this.p.memberships?.[id]; if (!def?.daily || !m || !this.hasMembership(id)) return fail('NOT_ACTIVE'); const day = dayKey(this.now()); if (m.lastClaim === day) return fail('ALREADY_CLAIMED'); m.lastClaim = day; this.earn(def.daily.currency as any, def.daily.amount, `membership_daily:${id}`); return ok(); }
  // ---- Hearthcards extras ----
  spareCards(cardId: string): number { const inDecks = Math.max(0, ...this.p.tcg.decks.map((d) => d.cards.filter((x) => x === cardId).length)); const n = this.p.tcg.collection[cardId] ?? 0; return Math.max(0, Math.min(n - inDecks, n - (this.p.tcg.bound?.[cardId] ?? 0))); }
  /** Card exchange: 3 spare unbound cards of one rarity -> 1 random card of the next rarity. */
  exchangeCards(cardIds: string[]): Result<string> {
    if (cardIds.length !== 3) return fail('NEED_3'); const defs = cardIds.map((c) => TCG_CARDS[c]); if (defs.some((d) => !d)) return fail('INVALID'); const rar = defs[0]!.rarity; if (defs.some((d) => d!.rarity !== rar)) return fail('SAME_RARITY', 'All 3 cards must share a rarity');
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary']; const next = order[order.indexOf(rar) + 1]; if (!next) return fail('MAX_RARITY');
    const need: Record<string, number> = {}; for (const c of cardIds) need[c] = (need[c] ?? 0) + 1; for (const [c, n] of Object.entries(need)) if (this.spareCards(c) < n) return fail('CARD_IN_USE_OR_BOUND', `${TCG_CARDS[c]!.name.en}: not enough spare unbound copies`);
    const pool = Object.values(TCG_CARDS).filter((x) => x.rarity === next && !x.id.startsWith('tok_')); if (!pool.length) return fail('MAX_RARITY');
    for (const [c, n] of Object.entries(need)) this.p.tcg.collection[c]! -= n; const got = this.rng.pick(pool).id; this.p.tcg.collection[got] = (this.p.tcg.collection[got] ?? 0) + 1; return ok(got);
  }
  /** Card set completion (§42): own at least one of every collectible card of an element → one-time reward. */
  cardSetStatus() { const els = [...new Set(Object.values(TCG_CARDS).filter((c) => !c.id.startsWith('tok_')).map((c) => c.element))]; return els.map((el) => { const cards = Object.values(TCG_CARDS).filter((c) => c.element === el && !c.id.startsWith('tok_')); const owned = cards.filter((c) => (this.p.tcg.collection[c.id] ?? 0) > 0).length; return { element: el, owned, total: cards.length, claimed: !!this.p.counters[`tcgset:${el}`] }; }); }
  claimCardSet(element: string): Result { const s = this.cardSetStatus().find((x) => x.element === element); if (!s) return fail('INVALID'); if (s.claimed) return fail('ALREADY_CLAIMED'); if (s.owned < s.total) return fail('INCOMPLETE', `${s.owned}/${s.total} cards`); this.p.counters[`tcgset:${element}`] = 1; this.earn('card_dust', 400, 'tcg_set'); this.addItem('card_pack', 2); this.bump('card_sets'); return ok(); }
  /** Appearance salon: change hair/colours after creation (gold sink). Body type is kept. */
  changeAppearance(a: Partial<PlayerState['appearance']>): Result { const allowed = ['hair', 'hairColor', 'skin', 'eyes'] as const; const next = { ...this.p.appearance } as any; for (const k of allowed) if (a[k] !== undefined) { if ((k === 'hair' && !(Number.isInteger(a[k]) && (a[k] as number) >= 0 && (a[k] as number) < 8)) || (k !== 'hair' && !/^#[0-9a-fA-F]{3,6}$/.test(String(a[k])))) return fail('INVALID_APPEARANCE'); next[k] = a[k]; } if (!this.spend('gold', 5000, 'appearance_salon')) return fail('NOT_ENOUGH_GOLD', 'The salon costs 5,000 Gold'); this.p.appearance = next; return ok(); }
  tcgCosmetic(id: string, buy: boolean): Result { const c = TCG_COSMETICS[id]; if (!c) return fail('INVALID'); const cos = (this.p.tcg.cosmetics ??= { owned: ['back_classic', 'mat_wood', 'table_classic'], back: 'back_classic', mat: 'mat_wood', table: 'table_classic' }); if (buy && !cos.owned.includes(id)) { if (!this.spend('card_dust', c.cost, 'tcg_cosmetic')) return fail('NOT_ENOUGH_DUST', `Costs ${c.cost} Card Dust`); cos.owned.push(id); } if (!cos.owned.includes(id)) return fail('NOT_OWNED'); (cos as any)[c.kind] = id; return ok(); }
  claimMission(id: string): Result { this.resetDailyIfNeeded(); const m = MISSIONS_DAILY.find((x) => x.id === id); if (!m) return fail('INVALID'); if (this.p.missions.claimed.includes(id)) return fail('ALREADY_CLAIMED'); if ((this.p.missions.progress[m.counter] ?? 0) < m.target) return fail('INCOMPLETE'); this.p.missions.claimed.push(id); this.p.missions.points += m.points; this.gainPassExp(20); return ok(); }
  claimChest(i: number): Result { const c = ACTIVITY_CHESTS[i]; if (!c) return fail('INVALID'); if (this.p.missions.chests.includes(i)) return fail('ALREADY_CLAIMED'); if (this.p.missions.points < c.points) return fail('INCOMPLETE'); this.p.missions.chests.push(i); this.addItem(c.itemId, c.qty); return ok(); }
  claimLogin(): Result {
    const day = dayKey(this.now()); if (this.p.login.lastDay === day) return fail('ALREADY_CLAIMED');
    const yesterday = dayKey(this.now() - 86400_000); this.p.login.streak = this.p.login.lastDay === yesterday ? this.p.login.streak + 1 : 1; this.p.login.lastDay = day;
    const reward = LOGIN_CALENDAR[this.p.login.claimed % LOGIN_CALENDAR.length]!; this.p.login.claimed++; this.addItem(reward.itemId, reward.qty); this.earn('gold', 200 * Math.min(7, this.p.login.streak), 'login'); this.earn('crystal_free', 20, 'login_free_crystal');
    return ok({ reward, streak: this.p.login.streak });
  }
  claimEventMission(evId: string, mId: string): Result { this.syncEventWeek(); if (activeEventAt(this.now()).id !== evId) return fail('EVENT_NOT_ACTIVE'); const ev = EVENTS.find((e) => e.id === evId); const m = ev?.missions.find((x) => x.id === mId); if (!m) return fail('INVALID'); if (this.p.events.claimed.includes(mId)) return fail('ALREADY_CLAIMED'); if ((this.p.events.progress[mId] ?? 0) < m.target) return fail('INCOMPLETE'); this.p.events.claimed.push(mId); const fest = this.hasMembership('festival') ? 2 : 1; this.addItem(m.reward.itemId, m.reward.qty * fest); this.earn('event_token', 20 * fest, 'event_mission'); return ok({ festival: fest === 2 }); }
  // ---- pass (§47) ----
  gainPassExp(n: number) { this.p.pass.exp += n; while (this.p.pass.level < PASS.levels && this.p.pass.exp >= PASS.expPerLevel) { this.p.pass.exp -= PASS.expPerLevel; this.p.pass.level++; } }
  claimPass(level: number, premium: boolean): Result {
    if (level < 1 || level > this.p.pass.level) return fail('LOCKED'); const list = premium ? this.p.pass.claimedPremium : this.p.pass.claimedFree; if (list.includes(level)) return fail('ALREADY_CLAIMED');
    if (premium && !this.p.pass.premium) return fail('PREMIUM_REQUIRED'); const r = (premium ? PASS.premium : PASS.free)[level - 1]!; list.push(level); this.addItem(r.itemId, r.qty); return ok();
  }
  buyPremiumPass(): Result { if (this.p.pass.premium) return fail('OWNED'); if (!this.spendCrystal(980, 'pass_premium_sim')) return fail('NOT_ENOUGH_CRYSTAL'); this.p.pass.premium = true; return ok(); }

  // ---- quests (§18) ----
  questAvailable(id: string): boolean { const q = QUESTS[id]; if (!q) return false; if (this.p.quests.done.includes(id) || this.p.quests.active.some((a) => a.id === id)) return false; if (q.prereq && !this.p.quests.done.includes(q.prereq)) return false; return this.p.level >= q.reqLevel; }
  acceptQuest(id: string): Result { this.resetDailyIfNeeded(); if (!this.questAvailable(id)) return fail('UNAVAILABLE'); if (this.p.quests.active.length >= 20) return fail('QUEST_LOG_FULL'); const q = QUESTS[id]!; this.p.quests.active.push({ id, progress: q.objectives.map(() => 0), acceptedAt: this.now() }); this.progressObjective('level', '', 0); this.progressObjective('collect', '', 0); this.note(`Quest accepted: ${q.name.en}`); return ok(); }
  abandonQuest(id: string): Result { const i = this.p.quests.active.findIndex((a) => a.id === id); if (i < 0) return fail('NOT_ACTIVE'); this.p.quests.active.splice(i, 1); return ok(); }
  objectiveDone(q: QuestProgress): boolean { const def = QUESTS[q.id]!; return def.objectives.every((o, i) => q.progress[i]! >= objTarget(o)); }
  progressObjective(kind: Objective['kind'], key: string, n: number) {
    for (const qp of this.p.quests.active) {
      const def = QUESTS[qp.id]!;
      def.objectives.forEach((o, i) => {
        if (o.kind !== kind) return;
        if (o.kind === 'kill' && o.target !== 'any' && o.target !== key) return;
        if (o.kind === 'talk' && o.npc !== key) return;
        if (o.kind === 'visit' && o.map !== key) return;
        if (o.kind === 'dungeon' && 'id' in o && o.id && o.id !== key) return;
        if (o.kind === 'gather' && o.node !== key) return;
        if (o.kind === 'collect') { qp.progress[i] = Math.min(o.count, this.countItem(o.item)); return; }
        if (o.kind === 'level') { qp.progress[i] = Math.min(o.level, this.p.level); return; }
        qp.progress[i] = Math.min(objTarget(o), qp.progress[i]! + (n || 1));
      });
    }
  }
  completeQuest(id: string, choice?: string): Result {
    const qp = this.p.quests.active.find((a) => a.id === id); if (!qp) return fail('NOT_ACTIVE'); const def = QUESTS[id]!;
    this.progressObjective('collect', '', 0); this.progressObjective('level', '', 0);
    if (!this.objectiveDone(qp)) return fail('INCOMPLETE');
    if (def.rewards.choice && (!choice || !def.rewards.choice.includes(choice))) return fail('CHOOSE_REWARD');
    // consume collect objectives
    for (const o of def.objectives) if (o.kind === 'collect') this.removeItem(o.item, o.count);
    this.p.quests.active.splice(this.p.quests.active.indexOf(qp), 1); this.p.quests.done.push(id);
    this.gainExp(def.rewards.exp, 'quest'); this.earn('gold', def.rewards.gold, 'quest', `quest:${this.p.id}:${id}:${this.p.quests.lastDaily}`);
    for (const it of def.rewards.items ?? []) this.addItem(it.itemId, it.qty, { rollOptions: true });
    if (choice) this.addItem(choice, 1, { rollOptions: true });
    if (def.type === 'ascension') this.ascend();
    this.bump('quests'); this.note(`Quest complete: ${def.name.en}`); this.emit({ type: 'quest_complete', id });
    return ok();
  }
  talkTo(npcId: string) { this.progressObjective('talk', npcId, 1); }
  visitMap(mapId: string) { this.progressObjective('visit', mapId, 1); }

  // ---- shops (§34) ----
  shopPrice(itemId: string, shopId: string): number { const e = SHOPS[shopId]?.items.find((i) => i.itemId === itemId); return e ? e.price || ITEMS[itemId]!.price : 0; }
  buy(shopId: string, itemId: string, qty = 1): Result {
    const shop = SHOPS[shopId]; const entry = shop?.items.find((i) => i.itemId === itemId); if (!shop || !entry || qty <= 0 || qty > 999) return fail('INVALID');
    if (entry.dailyLimit) { const k = `buy:${shopId}:${itemId}:${dayKey(this.now())}`; if ((this.p.counters[k] ?? 0) + qty > entry.dailyLimit) return fail('DAILY_LIMIT'); }
    const total = this.shopPrice(itemId, shopId) * qty; if (this.slotsNeeded(itemId, qty) > this.freeSlots()) return fail('INVENTORY_FULL');
    if (!this.spend(shop.currency as Currency, total, `shop:${shopId}`)) return fail('NOT_ENOUGH_CURRENCY');
    if (entry.dailyLimit) { const k = `buy:${shopId}:${itemId}:${dayKey(this.now())}`; this.p.counters[k] = (this.p.counters[k] ?? 0) + qty; }
    this.addItem(itemId, qty); return ok({ total });
  }

  // ---- crafting & gathering (§32) ----
  craft(recipeId: string, times = 1, focusStat?: string): Result {
    const r = RECIPES[recipeId]; if (!r || times < 1 || times > 50) return fail('INVALID');
    const prof = this.p.professions[r.profession] ?? { lvl: 1, exp: 0 }; if (prof.lvl < r.level) return fail('PROFESSION_LEVEL', `Requires ${r.profession} ${r.level}`);
    for (const i of r.inputs) if (this.countItem(i.itemId) < i.qty * times) return fail('MISSING_MATERIALS', `Need ${i.qty * times}× ${ITEMS[i.itemId]!.name.en}`);
    if (this.gold() < BigInt(r.gold * times)) return fail('NOT_ENOUGH_GOLD'); if (this.slotsNeeded(r.output.itemId, r.output.qty * times) > this.freeSlots()) return fail('INVENTORY_FULL');
    const outDef = ITEMS[r.output.itemId]!; const focus = focusStat ? OPTION_POOL.find((o) => o.stat === focusStat && o.slots.includes(outDef.type)) : undefined;
    if (focusStat && !focus) return fail('INVALID_OPTION', 'That option cannot appear on this item'); if (focus && this.countItem('enchant_stone') < times) return fail('NEED_ENCHANT_STONE', 'Focused crafting needs 1 Enchant Stone per item');
    let made = 0;
    for (let t = 0; t < times; t++) { for (const i of r.inputs) this.removeItem(i.itemId, i.qty); this.spend('gold', r.gold, 'craft'); if (this.rng.chance(Math.min(1, r.success + prof.lvl * 0.01))) { const got = this.addItem(r.output.itemId, r.output.qty, { rollOptions: true, source: 'craft' }); if (focus) { this.removeItem('enchant_stone', 1); const g = got[got.length - 1]; if (g) { g.options = [{ stat: focus.stat, kind: 'flat' as const, value: this.rng.int(Math.ceil((focus.min + focus.max) / 2), focus.max) }, ...g.options.filter((o) => o.stat !== focus.stat)].slice(0, 3); } } made++; } prof.exp += r.exp; while (prof.exp >= prof.lvl * 100) { prof.exp -= prof.lvl * 100; prof.lvl++; } }
    this.p.professions[r.profession] = prof; this.bump('crafts', made); this.progressObjective('craft', '', made);
    return ok({ made, failed: times - made });
  }
  gather(type: 'ore' | 'tree' | 'herb' | 'fish', tier: number): Result<{ itemId: string; qty: number }> {
    const tool = { ore: 'tool_pickaxe', tree: 'tool_axe', herb: 'tool_sickle', fish: 'tool_rod' }[type];
    if (this.countItem(tool) < 1) return fail('NEED_TOOL', `Need a ${ITEMS[tool]!.name.en}`);
    const ti = this.p.inventory.find((x) => x.defId === tool)!; ti.durability = (ti.durability ?? 100) - 2; if (ti.durability <= 0) { this.removeItem(tool, 1); ti.durability = 100; this.note(`Your ${ITEMS[tool]!.name.en} broke!`); } // next tool in the stack starts fresh // tool durability: 50 uses
    const g = this.p.gathering[type];
    const tables = { ore: [['copper_ore', 'iron_ore', 'refine_ore'], ['iron_ore', 'silver_ore', 'refine_ore'], ['silver_ore', 'star_ore', 'refine_ore_hi']], tree: [['oak_log', 'oak_log', 'pine_log'], ['oak_log', 'pine_log', 'moon_log'], ['pine_log', 'moon_log', 'moon_log']], herb: [['herb_green', 'herb_blue', 'berry'], ['herb_green', 'herb_blue', 'herb_gold'], ['herb_blue', 'herb_gold', 'wheat']], fish: [['fish_carp', 'fish_carp', 'fish_trout'], ['fish_carp', 'fish_trout', 'fish_koi'], ['fish_trout', 'fish_koi', 'fish_koi']] }[type][Math.min(2, tier - 1)]!;
    const roll = this.rng.next() + g.lvl * 0.01; const itemId = roll > 0.92 ? tables[2]! : roll > 0.55 ? tables[1]! : tables[0]!;
    const qty = 1 + (this.rng.chance(g.lvl * 0.02) ? 1 : 0);
    if (this.slotsNeeded(itemId, qty) > this.freeSlots()) return fail('INVENTORY_FULL');
    this.addItem(itemId, qty, { source: 'gather' }); g.exp += 10 * tier; while (g.exp >= g.lvl * 50) { g.exp -= g.lvl * 50; g.lvl++; }
    this.bump('gathers'); this.progressObjective('gather', type, 1);
    return ok({ itemId, qty });
  }

  // ---- pets (§25–26) ----
  addPet(species: string): PetInstance { const s = PETS[species]!; const pet: PetInstance = { uid: uid('pet'), species, name: s.name.en, level: 1, exp: 0, stars: 0, happiness: 80, hunger: 80, onFarm: false, skillLevel: 1 }; this.p.pets.push(pet); this.checkAchievements(); this.note(`New pet: ${s.name.en}!`); return pet; }
  tryCapture(species: string, hpPct: number): Result<{ success: boolean; pet?: PetInstance }> {
    if (!PETS[species]) return fail('NOT_CAPTURABLE'); if (this.countItem('capture_net') < 1) return fail('NO_NET');
    if (this.p.pets.length >= 60) return fail('PET_LIMIT');
    this.removeItem('capture_net', 1);
    const chance = Math.min(0.9, 0.15 + (1 - hpPct) * 0.7);
    if (!this.rng.chance(chance)) return ok({ success: false });
    const pet = this.addPet(species); this.progressObjective('capture', '', 1); this.bump('captures'); return ok({ success: true, pet });
  }
  incubateEgg(uidv: string): Result { const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); if (this.p.eggs.length >= 4) return fail('INCUBATOR_FULL'); it.qty--; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1); this.p.eggs.push({ uid: uid('egg'), hatchAt: this.now() + 60_000 }); this.note('Egg placed in incubator (60s).'); return ok(); }
  hatchEgg(eggUid: string, instant = false): Result<PetInstance> {
    const i = this.p.eggs.findIndex((e) => e.uid === eggUid); if (i < 0) return fail('NOT_FOUND');
    if (!instant && this.p.eggs[i]!.hatchAt > this.now()) return fail('NOT_READY', `Hatches in ${Math.ceil((this.p.eggs[i]!.hatchAt - this.now()) / 1000)}s`);
    this.p.eggs.splice(i, 1); const sp = this.rng.weighted(EGG_POOL).id; const pet = this.addPet(sp); this.progressObjective('hatch', '', 1); this.progressObjective('capture', '', 1); return ok(pet);
  }
  petGainExp(pet: PetInstance, n: number) { pet.exp += n; while (pet.level < 100 && pet.exp >= pet.level * pet.level * 40) { pet.exp -= pet.level * pet.level * 40; pet.level++; } }
  feedPet(petUid: string, foodId = 'pet_food'): Result<{ bonus: boolean }> { const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet) return fail('NOT_FOUND'); if (ITEMS[foodId]?.type !== 'pet_food') return fail('NOT_FOOD'); if (!this.removeItem(foodId, 1)) return fail('NO_FOOD'); const fine = foodId === 'pet_food_fine'; const regional = REGIONAL_FOOD[foodId]; const el = PETS[pet.species]!.element; const bonus = !!regional && regional.includes(el); const k = bonus ? 2 : 1; pet.hunger = Math.min(100, pet.hunger + (fine || regional ? 40 : 20)); pet.happiness = Math.min(100, pet.happiness + (fine ? 15 : regional ? 8 : 5) * k); this.petGainExp(pet, (fine ? 200 : regional ? 100 : 50) * k); this.bump('pet_feeds'); return ok({ bonus }); }
  /** Pet runes (§25): up to 2 per pet; removing returns the rune. */
  petRune(petUid: string, runeId: string, remove = false): Result { const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet) return fail('NOT_FOUND'); if (!PET_RUNES.includes(runeId)) return fail('INVALID_RUNE'); pet.runes ??= []; if (remove) { const i = pet.runes.indexOf(runeId); if (i < 0) return fail('NOT_SOCKETED'); if (this.freeSlots() <= 0) return fail('INVENTORY_FULL'); pet.runes.splice(i, 1); this.addItem(runeId, 1); this.clampVitals(); return ok(); } if (pet.runes.length >= 2) return fail('RUNE_SLOTS_FULL'); if (pet.runes.includes(runeId)) return fail('DUPLICATE_RUNE'); if (!this.removeItem(runeId, 1)) return fail('NO_RUNE'); pet.runes.push(runeId); this.clampVitals(); return ok(); }
  summonPet(petUid: string | null): Result { if (petUid === null) { this.p.activePet = null; return ok(); } const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet) return fail('NOT_FOUND'); if (pet.onFarm) return fail('ON_FARM', 'Remove from farm first'); this.p.activePet = petUid; this.clampVitals(); return ok(); }
  petStats(pet: PetInstance) { const s = PETS[pet.species]!; const m = (1 + pet.level * 0.12 * s.growth) * (1 + pet.stars * 0.2); const r = pet.runes ?? []; return { hp: Math.floor(s.base.hp * m * (r.includes('rune_shell') ? 1.25 : 1)), atk: Math.floor(s.base.atk * m * (r.includes('rune_fang') ? 1.25 : 1)), cdMult: r.includes('rune_wind') ? 0.7 : 1 }; }
  starUpPet(petUid: string, fodderUid: string): Result { const pet = this.p.pets.find((x) => x.uid === petUid); const f = this.p.pets.find((x) => x.uid === fodderUid); if (!pet || !f || pet === f) return fail('INVALID'); if (f.species !== pet.species) return fail('SAME_SPECIES'); if (pet.stars >= 5) return fail('MAX_STARS'); if (this.p.activePet === f.uid) this.p.activePet = null; this.p.pets.splice(this.p.pets.indexOf(f), 1); pet.stars++; return ok(); }
  evolvePet(petUid: string): Result { const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet) return fail('NOT_FOUND'); const next = PETS[pet.species]?.evolvesTo; if (!next) return fail('CANNOT_EVOLVE'); if (pet.level < 20) return fail('LEVEL_TOO_LOW', 'Pet must be level 20'); if (!this.removeItem('star_dust', 5) && !this.spend('gold', 5000, 'pet_evolve')) return fail('NEED_STAR_DUST'); pet.species = next; pet.name = PETS[next]!.name.en; return ok(); }
  releasePet(petUid: string): Result { const i = this.p.pets.findIndex((x) => x.uid === petUid); if (i < 0) return fail('NOT_FOUND'); const pet = this.p.pets[i]!; if (this.p.activePet === pet.uid) this.p.activePet = null; this.p.pets.splice(i, 1); this.addItem('star_dust', 1 + pet.stars); return ok(); }
  renamePet(petUid: string, name: string): Result { const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet || !/^[\p{L}\p{N} ]{1,14}$/u.test(name)) return fail('INVALID'); pet.name = name; return ok(); }
  farmAssign(petUid: string, on: boolean): Result { this.settleFarm(); const pet = this.p.pets.find((x) => x.uid === petUid); if (!pet) return fail('NOT_FOUND'); if (on && this.p.pets.filter((x) => x.onFarm).length >= this.p.farm.capacity) return fail('FARM_FULL'); if (on && this.p.activePet === petUid) this.p.activePet = null; pet.onFarm = on; return ok(); }
  farmAddFood(qty: number): Result { this.settleFarm(); const cap = this.p.farm.feederSlots * 50; if (this.p.farm.food + qty > cap) return fail('FEEDER_FULL', `Feeder holds ${cap}`); if (!this.removeItem('pet_food', qty)) return fail('NO_FOOD'); this.p.farm.food += qty; return ok(); }
  upgradeFeeder(): Result { if (this.p.farm.feederLevel >= 10) return fail('MAX'); const cost = 2000 * (this.p.farm.feederLevel + 1); if (!this.spend('gold', cost, 'feeder_upgrade')) return fail('NOT_ENOUGH_GOLD'); this.p.farm.feederLevel++; this.p.farm.feederSlots = Math.min(CONFIG.feederMaxSlots, CONFIG.feederBaseSlots + this.p.farm.feederLevel * 2); return ok(); }
  expandFarm(): Result { if (this.p.farm.capacity >= CONFIG.farmMaxCapacity) return fail('MAX'); if (!this.spend('gold', 3000 + this.p.farm.capacity * 200, 'farm_expand')) return fail('NOT_ENOUGH_GOLD'); this.p.farm.capacity = Math.min(CONFIG.farmMaxCapacity, this.p.farm.capacity + 4); return ok(); }
  /** Offline farm settlement (§26): server/local timestamps, capped accumulation, food-limited, idempotent (lastSettle advances). */
  settleFarm(): { minutes: number; exp: number; foodUsed: number } {
    const now = this.now(); const elapsed = Math.min(CONFIG.farmMaxAccumulationMs, Math.max(0, now - this.p.farm.lastSettle));
    const pets = this.p.pets.filter((x) => x.onFarm); const minutes = Math.floor(elapsed / 60000);
    if (minutes <= 0 || pets.length === 0) { if (pets.length === 0) this.p.farm.lastSettle = now; return { minutes: 0, exp: 0, foodUsed: 0 }; }
    const foodPerMin = pets.length * 0.2; const maxByFood = foodPerMin > 0 ? Math.floor(this.p.farm.food / foodPerMin) : 0; const fedMin = Math.min(minutes, maxByFood);
    const foodUsed = Math.ceil(fedMin * foodPerMin); this.p.farm.food = Math.max(0, this.p.farm.food - foodUsed);
    const expEach = Math.floor(fedMin * CONFIG.farmExpPerMinute * (1 + this.p.farm.feederLevel * 0.1) + (minutes - fedMin) * 0.5);
    for (const pet of pets) { this.petGainExp(pet, expEach); pet.happiness = Math.min(100, pet.happiness + Math.floor(fedMin / 30)); }
    if (pets.some((x) => PETS[x.species]!.role === 'farming')) { const n = Math.floor(fedMin / 20); if (n > 0) this.addItem('herb_green', n, { source: 'farm' }); }
    this.p.farm.lastSettle += minutes * 60000; if (this.p.farm.lastSettle < now - CONFIG.farmMaxAccumulationMs) this.p.farm.lastSettle = now;
    return { minutes, exp: expEach, foodUsed };
  }
  placeDecoration(itemId: string, x: number, y: number, inHouse: boolean): Result { const list = inHouse ? this.p.house.furniture : this.p.farm.decorations; if (list.length >= 30) return fail('DECOR_LIMIT'); if (ITEMS[itemId]?.type !== 'decoration') return fail('INVALID'); if (list.some((d) => d.x === x && d.y === y)) return fail('OCCUPIED'); if (!this.removeItem(itemId, 1)) return fail('NOT_OWNED'); list.push({ itemId, x, y, rot: 0 }); return ok(); }
  removeDecoration(i: number, inHouse: boolean): Result { const list = inHouse ? this.p.house.furniture : this.p.farm.decorations; const d = list[i]; if (!d) return fail('INVALID'); if (this.freeSlots() <= 0) return fail('INVENTORY_FULL'); list.splice(i, 1); this.addItem(d.itemId, 1); return ok(); }
  rotateDecoration(i: number, inHouse: boolean): Result { const list = inHouse ? this.p.house.furniture : this.p.farm.decorations; const d = list[i]; if (!d) return fail('INVALID'); d.rot = (d.rot + 1) % 4; return ok(); }

  // ---- mounts (§27) ----
  unlockMount(uidv: string): Result { const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); const m = Object.values(MOUNTS).find((x) => x.key === it.defId); if (!m) return fail('INVALID'); it.qty--; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1); if (this.p.mounts.includes(m.id)) { this.earn('stable_seal', 10 + ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(m.rarity) * 10, 'duplicate_mount'); this.note('Duplicate mount converted to Stable Seals'); return ok({ duplicate: true }); } this.p.mounts.push(m.id); this.p.mountLevels[m.id] = 0; if (!this.p.activeMount) this.p.activeMount = m.id; this.checkAchievements(); this.note(`Mount unlocked: ${m.name.en}`); return ok(); }
  setMount(id: string | null): Result { if (id && !this.p.mounts.includes(id)) return fail('LOCKED'); this.p.activeMount = id; if (!id) this.p.riding = false; return ok(); }
  toggleRide(inCombat: boolean, mapAllows: boolean): Result { if (!this.p.activeMount) return fail('NO_MOUNT'); if (!this.p.riding && (inCombat || !mapAllows)) return fail('CANNOT_RIDE_HERE'); this.p.riding = !this.p.riding; return ok({ riding: this.p.riding }); }
  upgradeMount(id: string): Result { if (!this.p.mounts.includes(id)) return fail('LOCKED'); const lv = this.p.mountLevels[id] ?? 0; if (lv >= 10) return fail('MAX'); if (!this.removeItem('star_dust', 2 + lv)) return fail('NEED_STAR_DUST'); this.p.mountLevels[id] = lv + 1; return ok(); }

  // ---- TCG collection & packs (§42, §44) ----
  openCardPack(uidv: string): Result<string[]> { const it = this.findInv(uidv); if (!it) return fail('NOT_FOUND'); it.qty--; if (it.qty <= 0) this.p.inventory.splice(this.p.inventory.indexOf(it), 1); const r = openPack(this.rewardRng ?? this.rng, this.p.tcg.pity); this.p.tcg.pity = r.pity; for (const c of r.cards) this.p.tcg.collection[c] = (this.p.tcg.collection[c] ?? 0) + 1; this.note(`Pack: ${r.cards.map((c) => TCG_CARDS[c]!.name.en).join(', ')}`); return ok(r.cards); }
  saveDeck(id: string, name: string, cards: string[]): Result { const err = validateDeck(cards, this.p.tcg.collection); if (err) return fail(err); const d = this.p.tcg.decks.find((x) => x.id === id); if (d) { d.name = name; d.cards = [...cards]; } else { if (this.p.tcg.decks.length >= 10) return fail('DECK_LIMIT'); this.p.tcg.decks.push({ id, name, cards: [...cards] }); } return ok(); }
  craftCard(cardId: string): Result { const c = TCG_CARDS[cardId]; if (!c || cardId.startsWith('tok_')) return fail('INVALID'); if (!this.spend('card_dust', c.craft, 'card_craft')) return fail('NOT_ENOUGH_DUST'); this.p.tcg.collection[cardId] = (this.p.tcg.collection[cardId] ?? 0) + 1; return ok(); }
  dustCard(cardId: string): Result { const c = TCG_CARDS[cardId]; const n = this.p.tcg.collection[cardId] ?? 0; if (!c || this.spareCards(cardId) <= 0) return fail('IN_USE_OR_NONE', 'Card is in a deck or account-bound'); this.p.tcg.collection[cardId] = n - 1; this.earn('card_dust', Math.floor(c.craft / 4), 'card_dust'); return ok(); }
  recordTcg(win: boolean, mode: 'ai' | 'tower' | 'ranked' | 'casual' | 'tutorial', oppRating = 1000) {
    if (mode === 'tutorial') { if (win && !this.p.tcg.tutorialDone) { this.p.tcg.tutorialDone = true; this.earn('card_dust', 200, 'tcg_tutorial'); this.addItem('card_pack', 2); } return; }
    this.bump('tcg_games'); if (win) { this.p.tcg.wins++; this.bump('tcg_wins'); this.progressObjective('card_win', '', 1); } else this.p.tcg.losses++;
    if (mode === 'ranked') { const d = elo(this.p.tcg.rating, oppRating, win); this.p.tcg.rating += d; this.p.tcg.stars = Math.max(0, this.p.tcg.stars + (win ? 1 : -1)); if (this.p.tcg.stars >= 10 && this.p.tcg.rank < 5) { this.p.tcg.rank++; this.p.tcg.stars = 0; } }
    if (mode === 'tower' && win) { this.p.tcg.tower = Math.min(10, this.p.tcg.tower + 1); this.earn('card_dust', 50 * this.p.tcg.tower, 'tcg_tower'); }
    this.earn('gold', win ? 150 : 40, 'tcg'); if (win) this.earn('card_dust', 20, 'tcg');
  }
  recordPvp(win: boolean, oppName: string, oppRating: number) { const d = elo(this.p.pvp.rating, oppRating, win); this.p.pvp.rating += d; win ? this.p.pvp.wins++ : this.p.pvp.losses++; this.p.pvp.history.unshift({ ts: this.now(), opp: oppName, win, delta: d }); this.p.pvp.history.length = Math.min(20, this.p.pvp.history.length); this.earn('arena_token', win ? 10 : 3, 'arena'); if (win) { this.bump('pvp_wins'); this.progressObjective('pvp_win', '', 1); } return d; }

  // ---- gacha (§46) — simulated Crystal only; real-money random rewards disabled by feature flag ----
  /** Spend Crystal: Free (bound) Crystal first, then tradeable Crystal (§33). */
  spendCrystal(n: number, reason: string): boolean { const free = Number(this.bal('crystal_free')); if (free + Number(this.bal('crystal')) < n) return false; const f = Math.min(free, n); if (f) this.spend('crystal_free', f, reason); if (n - f) this.spend('crystal', n - f, reason); return true; }
  /** Optional unpredictable RNG for random rewards (server sets a crypto-backed one; the artifact uses the seeded RNG). */
  rewardRng: Rng | null = null;
  gachaDraw(times: 1 | 10, useTicket: boolean, bannerId: string = 'standard'): Result<{ itemId: string; rarity: string }[]> {
    const rr = this.rewardRng ?? this.rng;
    const b = (GACHA_BANNERS as Record<string, typeof GACHA_BANNERS.standard>)[bannerId]; if (!b) return fail('INVALID_BANNER'); const pb = (this.p.gacha.pityBy ??= {});
    if (useTicket) { if (!this.removeItem('gacha_ticket', times)) return fail('NOT_ENOUGH_TICKETS'); }
    else if (!this.spendCrystal(b.cost.crystal * times, `gacha_sim:${bannerId}`)) return fail('NOT_ENOUGH_CRYSTAL');
    const out: { itemId: string; rarity: string }[] = [];
    for (let i = 0; i < times; i++) {
      pb[bannerId] = (pb[bannerId] ?? (bannerId === 'standard' ? this.p.gacha.pity : 0)) + 1; // pity tracked per banner
      let rarity = rr.weighted(CONFIG.gachaRates).rarity;
      if (pb[bannerId]! >= CONFIG.gachaPity) rarity = 'legendary';
      if (rarity === 'legendary' || rarity === 'mythic') pb[bannerId] = 0; if (bannerId === 'standard') this.p.gacha.pity = pb[bannerId]!;
      const pool = ((b.pools as any)[rarity] ?? (b.pools as any).uncommon) as string[]; const itemId = bannerId === 'seasonal' && rarity === 'mythic' ? seasonalFeatured(this.now()) : rr.pick(pool);
      if (ITEMS[itemId]) this.addItem(itemId, 1, { rollOptions: true, source: 'gacha' }); else if (PETS[itemId.replace('_egg', '')]) this.addPet(itemId.replace('_egg', ''));
      out.push({ itemId, rarity }); this.p.gacha.history.unshift({ ts: this.now(), item: itemId, rarity });
    }
    this.p.gacha.history.length = Math.min(50, this.p.gacha.history.length);
    return ok(out);
  }

  // ---- dungeons (§28) bookkeeping ----
  canEnterDungeon(id: string): Result { this.resetDailyIfNeeded(); const d = DUNGEONS[id]; if (!d) return fail('INVALID'); if (this.p.level < d.levelReq) return fail('LEVEL_TOO_LOW', `Requires level ${d.levelReq}`); const fl = /^daily_(\w+)_(\d+)$/.exec(id); if (fl && Number(fl[2]) > 1 && !this.p.dungeon.firstClears.includes(`daily_${fl[1]}_${Number(fl[2]) - 1}`)) return fail('FLOOR_LOCKED', `Clear floor ${Number(fl[2]) - 1} first`); if ((this.p.dungeon.runs[id] ?? 0) >= d.dailyLimit) return fail('DAILY_LIMIT'); if (d.type === 'raid' && this.p.counters[`raid:${id}:${weekKey(this.now())}`]) return fail('WEEKLY_LOCKOUT', 'Raid already cleared this week (resets Monday 00:00 Asia/Bangkok)'); return ok(); }
  startDungeon(id: string): Result { const c = this.canEnterDungeon(id); if (!c.ok) return c; this.p.dungeon.runs[id] = (this.p.dungeon.runs[id] ?? 0) + 1; return ok(); }
  completeDungeon(id: string, runId: string): Result {
    const d = DUNGEONS[id]!; const key = `dun:${runId}`; if (this.p.counters[key]) return fail('ALREADY_CLAIMED'); this.p.counters[key] = 1;
    const first = !this.p.dungeon.firstClears.includes(id); if (first) this.p.dungeon.firstClears.push(id);
    if (d.type === 'raid') { this.p.counters[`raid:${id}:${weekKey(this.now())}`] = 1; if (!this.p.titles.includes('title_flamebreaker')) this.p.titles.push('title_flamebreaker'); } // weekly lockout + raid title
    this.gainExp(d.reward.exp * (first ? 2 : 1), 'dungeon'); this.earn('gold', d.reward.gold, 'dungeon', key);
    for (const it of d.reward.items) this.addItem(it.itemId, it.qty, { rollOptions: true });
    this.bump('dungeons'); this.progressObjective('dungeon', id, 1); return ok({ first });
  }

  // ---- mail (§41) ----
  sendMail(from: string, subject: string, body: string, items: { itemId: string; qty: number }[] = [], gold = 0) { this.p.mail.unshift({ id: uid('mail'), from, subject, body, items, gold: String(gold), read: false, claimed: false, ts: this.now(), expiresAt: this.now() + 30 * 86400_000 }); if (this.p.mail.length > 100) this.p.mail.length = 100; }
  claimMail(id: string): Result { const m = this.p.mail.find((x) => x.id === id); if (!m) return fail('NOT_FOUND'); if (m.claimed) return fail('ALREADY_CLAIMED'); const need = m.items.reduce((s, i) => s + this.slotsNeeded(i.itemId, i.qty), 0); if (need > this.freeSlots()) return fail('INVENTORY_FULL'); m.claimed = true; m.read = true; for (const i of m.items) this.addItem(i.itemId, i.qty); this.earn('gold', Number(m.gold), 'mail', `mail:${m.id}`); return ok(); }
  claimAllMail(): Result { let n = 0; for (const m of this.p.mail) if (!m.claimed && (m.items.length || m.gold !== '0')) { if (this.claimMail(m.id).ok) n++; } else m.read = true; return ok({ n }); }
  deleteMail(id: string): Result { const i = this.p.mail.findIndex((x) => x.id === id); if (i < 0) return fail('NOT_FOUND'); const m = this.p.mail[i]!; if (!m.claimed && (m.items.length || m.gold !== '0')) return fail('UNCLAIMED_ATTACHMENTS'); this.p.mail.splice(i, 1); return ok(); }

  // ---- currency exchange helper for NPC rate (§37 order book handled by world economy) ----
  onEvent(_e: GameEvent) { /* hook for adapters */ }
}

function objTarget(o: Objective): number { return 'count' in o ? o.count : o.kind === 'level' ? o.level : 1; }
export function elo(r: number, opp: number, win: boolean): number { const e = 1 / (1 + Math.pow(10, (opp - r) / 400)); return Math.round(CONFIG.eloK * ((win ? 1 : 0) - e)); }
export function npcQuests(npcId: string): string[] { return Object.values(QUESTS).filter((q) => q.giver === npcId).map((q) => q.id); }
export { NPCS, feeOf, EconomyError };

/** Serialize/deserialize save (BigInt-safe). Save format versioned (v). */
export function serializePlayer(p: PlayerState): string { return JSON.stringify({ ...p, wallet: p.wallet.serialize() }); }
export function deserializePlayer(s: string): PlayerState { const o = JSON.parse(s); if (o.v !== 1) throw new Error('UNSUPPORTED_SAVE_VERSION'); o.wallet = Ledger.deserialize(o.wallet); return o as PlayerState; }
