/**
 * Shared command dispatcher (§57): the single authoritative entry point for every player intent.
 * Game-server executes this for WebSocket commands; the artifact LocalAdapter executes the very same code in-browser.
 * The actor is always ctx.svc (derived from the session), never from the payload.
 */
import { CONFIG } from './config.js';
import { CLASSES } from './classes.js';
import { DUNGEONS, MAPS, MONSTERS, NPCS, PETS, QUESTS, MOUNTS } from './content.js';
export interface FarmVisit { owner: string; simulated: boolean; likes: number; pets: { species: string; level: number }[]; decorations: { itemId: string; x: number; y: number; rot: number }[] }
import { EconomyError } from './economy.js';
import { ITEMS, type Slot } from './items.js';
import { TILE } from './mapgen.js';
import { MarketService, guildCan, guildLevelExp } from './market.js';
import { type PlayerService, type Result, walletId, npcQuests } from './player.js';
import { uid } from './rng.js';
import { STARTER_DECKS, aiChooseAction, applyAction, newMatch, viewFor, type TcgAction, type TcgState } from './tcg.js';
import type { World } from './world.js';
import { applyStatus } from './effects.js';

export interface Session {
  tcg?: { state: TcgState; mode: 'ai' | 'tower' | 'ranked' | 'casual'; oppName: string; oppRating: number; settled: boolean } | null;
  trade?: ReturnType<MarketService['openTrade']> | null; tradePartner?: string;
  duel?: { opp: string; startedAt: number } | null; arena?: { mode: string; settled: boolean; prevMap: string; prevX: number; prevY: number } | null;
  prevMap?: { map: string; x: number; y: number } | null; visit?: FarmVisit | null; lastCmdAt?: number; cmdCount?: number;
}
export interface CommandContext {
  svc: PlayerService; world: World; market: MarketService; entityId: string; session: Session; mode: 'local' | 'server'; dev: boolean;
  changeMap: (mapId: string, x?: number, y?: number, opts?: { dungeon?: string; arena?: string }) => Result;
  findPlayerByName?: (name: string) => { svc: PlayerService; entityId: string } | null;
}
type Args = Record<string, any>;
const ok = (data?: unknown, msg?: string): Result => ({ ok: true, data, msg });
const fail = (err: string, msg?: string): Result => ({ ok: false, err, msg: msg ?? err });
const big = (v: unknown): bigint => { const s = String(v ?? '0').replace(/[^0-9]/g, ''); return BigInt(s || '0'); };
const near = (ctx: CommandContext, role: string): boolean => {
  if (ctx.dev) return true; const me = ctx.world.entities.get(ctx.entityId); if (!me) return false;
  return Object.values(NPCS).some((n) => n.map === ctx.world.mapId && n.roles.includes(role as any) && Math.hypot(n.x * TILE + 16 - me.x, n.y * TILE + 16 - me.y) < 160);
};
const RATE_LIMIT_PER_SEC = 30;

export const COMMANDS: Record<string, (ctx: CommandContext, a: Args) => Result> = {
  // --- movement & combat ---
  move: (c, a) => { c.world.setInput(c.entityId, Number(a.dx) || 0, Number(a.dy) || 0); return ok(); },
  moveTo: (c, a) => (c.world.moveTo(c.entityId, Number(a.x), Number(a.y)) ? ok() : fail('NO_PATH')),
  target: (c, a) => { const e = c.world.entities.get(c.entityId); if (e) e.targetId = a.id ?? null; return ok(); },
  attack: (c, a) => { const r = c.world.basicAttack(c.entityId, String(a.target)); return r ? fail(r) : ok(); },
  cast: (c, a) => { const r = c.world.castSkill(c.entityId, String(a.skill), a.target ?? null, a.x !== undefined ? { x: Number(a.x), y: Number(a.y) } : undefined); return r ? fail(r) : ok(); },
  pickup: (c) => ok({ n: c.world.pickup(c.entityId) }),
  gather: (c, a) => { const r = c.world.gatherNode(c.entityId, String(a.node)); return r ? fail(r) : ok(); },
  respawn: (c) => { c.world.respawn(c.entityId); return ok(); },
  pvpToggle: (c) => { const e = c.world.entities.get(c.entityId)!; if (!MAPS[c.world.mapId]!.pvp) return fail('PVP_DISABLED_HERE'); e.pvp = !e.pvp; return ok({ pvp: e.pvp }); },
  capture: (c, a) => {
    const t = c.world.entities.get(String(a.target)); const me = c.world.entities.get(c.entityId)!; if (!t || t.kind !== 'monster' || t.dead) return fail('INVALID_TARGET');
    const sp = MONSTERS[t.defId!]!.capturable; if (!sp) return fail('NOT_CAPTURABLE'); if (Math.hypot(t.x - me.x, t.y - me.y) > 120) return fail('OUT_OF_RANGE');
    const r = c.svc.tryCapture(sp, t.hp / t.maxHp); if (r.ok && r.data?.success) { t.dead = true; t.deadAt = c.world.now(); t.ai!.state = 'dead'; c.world.fx.push({ t: 'death', id: t.id, x: t.x, y: t.y }); } return r;
  },
  // --- inventory & equipment ---
  useItem: (c, a) => { const r = c.svc.useItem(String(a.uid)); const e = c.world.entities.get(c.entityId); if (r.ok && e) { const st = r.data as any; if (st?.status) applyStatus(e.effects, st.status, e.id, st.durationMs ?? 10000, 100); if (st?.grant === 'teleport_town') return c.changeMap('emberglen'); e.hp = c.svc.p.hp; e.mp = c.svc.p.mp; c.world.refreshPlayer(c.entityId); if (ITEMS[c.svc.findInv(String(a.uid))?.defId ?? '']?.slot) c.world.refreshPlayer(c.entityId); } c.world.syncPet(c.entityId); return r; },
  equip: (c, a) => { const r = c.svc.equip(String(a.uid)); c.world.refreshPlayer(c.entityId); return r; },
  unequip: (c, a) => { const r = c.svc.unequip(a.slot as Slot); c.world.refreshPlayer(c.entityId); return r; },
  sell: (c, a) => (near(c, 'shop') || near(c, 'blacksmith') ? c.svc.sellItem(String(a.uid), a.qty ? Number(a.qty) : undefined) : fail('NEED_SHOP_NPC', 'Visit a shop NPC to sell')),
  bulkSell: (c, a) => (near(c, 'shop') ? c.svc.bulkSell(a.rarities ?? ['common']) : fail('NEED_SHOP_NPC')),
  dismantle: (c, a) => c.svc.dismantle(String(a.uid)),
  lock: (c, a) => c.svc.toggleLock(String(a.uid)),
  sort: (c) => c.svc.sortInventory(),
  split: (c, a) => c.svc.splitStack(String(a.uid), Number(a.n)),
  storage: (c, a) => (near(c, 'storage') ? c.svc.storageMove(String(a.uid), !!a.toStorage) : fail('NEED_STORAGE_NPC', 'Visit Oswin (warehouse)')),
  allocate: (c, a) => { const r = c.svc.allocate(a.stat, Number(a.n) || 1); c.world.refreshPlayer(c.entityId); return r; },
  resetStats: (c) => { const r = c.svc.resetStats(); c.world.refreshPlayer(c.entityId); return r; },
  learnSkill: (c, a) => { const r = c.svc.learnSkill(String(a.skill)); c.world.refreshPlayer(c.entityId); return r; },
  resetSkills: (c) => c.svc.resetSkills(),
  hotbar: (c, a) => c.svc.setHotbar(Number(a.i), a.id ?? null),
  ascend: (c) => c.svc.ascend(),
  setTitle: (c, a) => { const r = c.svc.setTitle(a.id ?? null); c.world.refreshPlayer(c.entityId); return r; },
  settings: (c, a) => { Object.assign(c.svc.p.settings, a.settings ?? {}); return ok(); },
  heal: (c) => { if (!near(c, 'healer')) return fail('NEED_HEALER'); const e = c.world.entities.get(c.entityId)!; e.hp = e.maxHp; e.mp = e.maxMp; e.effects = e.effects.filter((x) => !['poison', 'burn', 'bleed', 'curse'].includes(x.id)); return ok(); },
  // --- enhancement ---
  repair: (c) => (near(c, 'blacksmith') ? (() => { const r = c.svc.repairAll(); c.world.refreshPlayer(c.entityId); return r; })() : fail('NEED_BLACKSMITH', 'Visit Brunhild the blacksmith, or use a Tinker Kit')),
  refinePreview: (c, a) => ok(c.svc.refinePreview(String(a.uid))),
  refine: (c, a) => (near(c, 'blacksmith') ? (() => { const r = c.svc.refine(String(a.uid), !!a.protect, !!a.bless); c.world.refreshPlayer(c.entityId); return r; })() : fail('NEED_BLACKSMITH', 'Visit Brunhild the blacksmith')),
  socket: (c, a) => (near(c, 'enchanter') ? c.svc.socketGem(String(a.item), String(a.gem)) : fail('NEED_ENCHANTER')),
  unsocket: (c, a) => (near(c, 'enchanter') ? c.svc.unsocketGem(String(a.item), Number(a.idx)) : fail('NEED_ENCHANTER')),
  fuseGem: (c, a) => (near(c, 'enchanter') ? c.svc.fuseGems(String(a.defId)) : fail('NEED_ENCHANTER')),
  enchant: (c, a) => (near(c, 'enchanter') ? c.svc.enchant(String(a.uid), a.locks ?? []) : fail('NEED_ENCHANTER')),
  insertCard: (c, a) => (near(c, 'enchanter') ? c.svc.insertCard(String(a.uid), String(a.card)) : fail('NEED_ENCHANTER')),
  inscribe: (c, a) => (near(c, 'enchanter') ? c.svc.inscribeStone(String(a.uid), String(a.skill)) : fail('NEED_ENCHANTER')),
  refineStone: (c, a) => (near(c, 'enchanter') ? c.svc.refineStone(String(a.uid)) : fail('NEED_ENCHANTER')),
  refineGem: (c, a) => (near(c, 'enchanter') ? (() => { const r = c.svc.refineGem(String(a.uid), Number(a.idx)); c.world.refreshPlayer(c.entityId); return r; })() : fail('NEED_ENCHANTER')),
  enhanceCosmetic: (c, a) => (near(c, 'enchanter') ? (() => { const r = c.svc.enhanceCosmetic(String(a.uid), a.fodder ? String(a.fodder) : undefined); c.world.refreshPlayer(c.entityId); return r; })() : fail('NEED_ENCHANTER')),
  reinscribe: (c, a) => (near(c, 'enchanter') ? c.svc.reinscribeStone(String(a.uid)) : fail('NEED_ENCHANTER')),
  petRune: (c, a) => { const r = c.svc.petRune(String(a.pet), String(a.rune), !!a.remove); c.world.syncPet(c.entityId); c.world.refreshPlayer(c.entityId); return r; },
  expandStorage: (c) => (near(c, 'storage') ? c.svc.expandStorage() : fail('NEED_STORAGE_NPC', 'Visit Oswin (warehouse)')),
  visitFarm: (c, a) => {
    // Artifact: visit a simulated friend's farm (generated from their name). Server overrides with the real friend's farm.
    const f = c.svc.p.friends.find((x) => x.name === a.name); if (!f) return fail('NOT_FRIENDS', 'You can only visit friends’ farms');
    let h = 0; for (const ch of f.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const pick = <T,>(arr: T[], i: number) => arr[(h >> (i % 24)) % arr.length]!;
    const species = Object.keys(PETS); const decos = ['deco_lantern', 'deco_bench', 'deco_flowers', 'deco_fountain'];
    c.session.visit = { owner: f.name, simulated: true, likes: h % 40, pets: Array.from({ length: 3 + (h % 4) }, (_, i) => ({ species: pick(species, i * 3), level: 1 + ((h >> i) % 30) })), decorations: Array.from({ length: 4 + (h % 5) }, (_, i) => ({ itemId: pick(decos, i * 5), x: 4 + i * 2, y: 15 + (i % 2) * 2, rot: i % 4 })) };
    return c.changeMap('pet_farm');
  },
  likeFarm: (c) => { const v = c.session.visit; if (!v) return fail('NOT_VISITING'); const k = `like:${v.owner}:${new Date(c.world.now()).toISOString().slice(0, 10)}`; if (c.svc.p.counters[k]) return fail('ALREADY_LIKED', 'You already liked this farm today'); c.svc.p.counters[k] = 1; v.likes++; c.svc.earn('gold', 50, 'farm_like_reward'); return ok({ likes: v.likes }); },
  slotStone: (c, a) => { const it = c.svc.findInv(String(a.uid)); if (!it?.stone?.skillId) return fail('NOT_INSCRIBED'); if (!it.locked && c.svc.equippedStones().length >= 4) return fail('STONE_SLOTS_FULL'); it.locked = !it.locked; return ok({ slotted: it.locked }); },
  // --- quests & NPCs ---
  interact: (c, a) => { const n = NPCS[String(a.npc)]; const me = c.world.entities.get(c.entityId)!; if (!n || n.map !== c.world.mapId) return fail('INVALID'); if (!c.dev && Math.hypot(n.x * TILE + 16 - me.x, n.y * TILE + 16 - me.y) > 160) return fail('TOO_FAR'); c.svc.talkTo(n.id); return ok({ npc: n.id, quests: npcQuests(n.id) }); },
  acceptQuest: (c, a) => c.svc.acceptQuest(String(a.id)),
  abandonQuest: (c, a) => c.svc.abandonQuest(String(a.id)),
  completeQuest: (c, a) => { const q = QUESTS[String(a.id)]; if (!q) return fail('INVALID'); if (!c.dev && !near(c, 'quest') && !near(c, 'board') && !Object.values(NPCS).some((n) => n.id === q.giver && n.map === c.world.mapId)) return fail('RETURN_TO_GIVER', `Return to ${NPCS[q.giver]?.name.en}`); const r = c.svc.completeQuest(q.id, a.choice); c.world.refreshPlayer(c.entityId); return r; },
  buy: (c, a) => { const npc = Object.values(NPCS).find((n) => n.shop === a.shop); if (!c.dev && npc && !near(c, npc.roles[0]!) && !near(c, 'shop')) return fail('NEED_SHOP_NPC'); return c.svc.buy(String(a.shop), String(a.item), Number(a.qty) || 1); },
  craft: (c, a) => (near(c, 'crafting') || c.world.mapId === 'house' ? c.svc.craft(String(a.recipe), Number(a.times) || 1, a.focus ? String(a.focus) : undefined) : fail('NEED_WORKSTATION', 'Visit Juno or use your house workbench')),
  // --- pets / farm / mounts / housing ---
  hatch: (c, a) => c.svc.hatchEgg(String(a.egg), c.dev && !!a.instant),
  feed: (c, a) => c.svc.feedPet(String(a.pet), a.food),
  summonPet: (c, a) => { const r = c.svc.summonPet(a.pet ?? null); c.world.syncPet(c.entityId); c.world.refreshPlayer(c.entityId); return r; },
  starUp: (c, a) => c.svc.starUpPet(String(a.pet), String(a.fodder)),
  evolve: (c, a) => { const r = c.svc.evolvePet(String(a.pet)); c.world.syncPet(c.entityId); return r; },
  releasePet: (c, a) => { const r = c.svc.releasePet(String(a.pet)); c.world.syncPet(c.entityId); return r; },
  renamePet: (c, a) => c.svc.renamePet(String(a.pet), String(a.name)),
  farmAssign: (c, a) => { const r = c.svc.farmAssign(String(a.pet), !!a.on); c.world.syncPet(c.entityId); return r; },
  farmFood: (c, a) => c.svc.farmAddFood(Number(a.qty) || 10),
  farmSettle: (c) => ok(c.svc.settleFarm()),
  feederUp: (c) => c.svc.upgradeFeeder(),
  farmExpand: (c) => c.svc.expandFarm(),
  farmLike: (c) => { c.svc.p.farm.likes++; return ok(); },
  decorPlace: (c, a) => c.session.visit ? fail('VISITING', 'You are visiting someone else’s farm') : c.svc.placeDecoration(String(a.item), Number(a.x), Number(a.y), !!a.house),
  decorRemove: (c, a) => c.svc.removeDecoration(Number(a.i), !!a.house),
  decorRotate: (c, a) => c.svc.rotateDecoration(Number(a.i), !!a.house),
  setMount: (c, a) => { const r = c.svc.setMount(a.id ?? null); c.world.refreshPlayer(c.entityId); return r; },
  ride: (c) => { const me = c.world.entities.get(c.entityId)!; const inCombat = [...c.world.entities.values()].some((x) => x.kind === 'monster' && !x.dead && x.targetId === c.entityId); const def = MAPS[c.world.mapId]!; const r = c.svc.toggleRide(inCombat, !def.instanced || def.biome === 'farm'); c.world.refreshPlayer(c.entityId); void me; return r; },
  mountUp: (c, a) => c.svc.upgradeMount(String(a.id)),
  // --- TCG (§43) ---
  openPack: (c, a) => c.svc.openCardPack(String(a.uid)),
  saveDeck: (c, a) => c.svc.saveDeck(String(a.id), String(a.name).slice(0, 24), a.cards ?? []),
  setDeck: (c, a) => { if (!c.svc.p.tcg.decks.some((d) => d.id === a.id)) return fail('INVALID'); c.svc.p.tcg.activeDeck = String(a.id); return ok(); },
  craftCard: (c, a) => c.svc.craftCard(String(a.card)),
  dustCard: (c, a) => c.svc.dustCard(String(a.card)),
  tcgStart: (c, a) => {
    if (c.session.tcg && c.session.tcg.state.winner === null) return fail('MATCH_IN_PROGRESS');
    const deck = c.svc.p.tcg.decks.find((d) => d.id === c.svc.p.tcg.activeDeck); if (!deck) return fail('NO_DECK');
    const mode = (a.mode ?? 'ai') as 'ai' | 'tower' | 'ranked' | 'casual'; const floor = c.svc.p.tcg.tower + 1;
    const decks = Object.values(STARTER_DECKS); const opp = decks[(mode === 'tower' ? floor : c.svc.rng.int(0, 6)) % decks.length]!;
    const seed = c.svc.rng.int(1, 2 ** 30); const state = newMatch(deck.cards, opp.cards, seed);
    if (mode === 'tower') { state.sides[1].hero += floor * 2; state.sides[1].maxMana = Math.min(3, Math.floor(floor / 3)); }
    c.session.tcg = { state, mode, oppName: mode === 'tower' ? `Tower Floor ${floor}` : `${opp.name.en} AI`, oppRating: 900 + c.svc.rng.int(0, 300), settled: false };
    runAi(c); return ok(viewFor(state, 0));
  },
  tcgAction: (c, a) => {
    const m = c.session.tcg; if (!m) return fail('NO_MATCH'); const err = applyAction(m.state, 0, a.action as TcgAction); if (err) return fail(err);
    runAi(c); return ok(viewFor(m.state, 0));
  },
  tcgChallenge: (c, a) => { const t = c.world.entities.get(String(a.target)); if (!t || t.kind !== 'bot') return fail('INVALID_TARGET', 'Select a player to challenge'); const r = COMMANDS.tcgStart!(c, { mode: 'casual' }); if (r.ok && c.session.tcg) c.session.tcg.oppName = `${t.name} [sim]`; return r; },
  friendsStatus: (c) => ok(c.svc.p.friends.map((f) => { const e = [...c.world.entities.values()].find((x) => (x.kind === 'bot' || x.kind === 'player') && x.name === f.name); return { name: f.name, online: !!e, map: e ? c.world.mapId : null, simulated: e?.kind === 'bot' }; })),
  tcgView: (c) => (c.session.tcg ? ok(viewFor(c.session.tcg.state, 0)) : fail('NO_MATCH')),
  // --- gacha / pass / events / missions ---
  gacha: (c, a) => (CONFIG.featureFlags.paidRandomRewards || c.mode === 'local' || a.ticket ? c.svc.gachaDraw(a.times === 10 ? 10 : 1, !!a.ticket) : fail('FEATURE_DISABLED')),
  buyPass: (c) => c.svc.buyPremiumPass(),
  claimPass: (c, a) => c.svc.claimPass(Number(a.level), !!a.premium),
  claimLogin: (c) => c.svc.claimLogin(),
  claimMission: (c, a) => c.svc.claimMission(String(a.id)),
  claimChest: (c, a) => c.svc.claimChest(Number(a.i)),
  claimEvent: (c, a) => c.svc.claimEventMission(String(a.ev), String(a.id)),
  premiumPurchase: () => (CONFIG.featureFlags.realPayments ? fail('NOT_IMPLEMENTED') : fail('PAYMENTS_DISABLED', 'Real payments are disabled (feature flag). Sandbox only.')),
  // --- mail ---
  mailClaim: (c, a) => c.svc.claimMail(String(a.id)),
  mailClaimAll: (c) => c.svc.claimAllMail(),
  mailDelete: (c, a) => c.svc.deleteMail(String(a.id)),
  mailRead: (c, a) => { const m = c.svc.p.mail.find((x) => x.id === a.id); if (m) m.read = true; return ok(); },
  mailSend: (c, a) => {
    const to = c.findPlayerByName?.(String(a.to)); if (!to) return fail('PLAYER_NOT_FOUND', c.mode === 'local' ? 'In the artifact other players are simulated; mail to them is not delivered.' : 'Player not found');
    const gold = Number(a.gold) || 0; if (!c.svc.spend('gold', gold + 10, 'mail_fee')) return fail('NOT_ENOUGH_GOLD'); to.svc.sendMail(c.svc.p.name, String(a.subject ?? '').slice(0, 40), String(a.body ?? '').slice(0, 300), [], gold); return ok();
  },
  // --- travel / instances ---
  teleport: (c, a) => { if (!near(c, 'teleport') && !c.dev) return fail('NEED_WAYGATE', 'Talk to Quill (Waygate Keeper)'); const m = MAPS[String(a.map)]; if (!m || m.instanced) return fail('INVALID'); if (c.svc.p.level < m.levelReq && !c.dev) return fail('LEVEL_TOO_LOW'); if (!c.dev && !c.svc.spend('gold', 50, 'teleport')) return fail('NOT_ENOUGH_GOLD'); return c.changeMap(m.id); },
  portal: (c, a) => { const me = c.world.entities.get(c.entityId)!; const p = MAPS[c.world.mapId]!.portals[Number(a.i)]; if (!p) return fail('INVALID'); if (Math.hypot(p.x * TILE + 16 - me.x, p.y * TILE + 16 - me.y) > 96 && !c.dev) return fail('TOO_FAR'); const dest = MAPS[p.to]!; if (c.svc.p.level < dest.levelReq && !c.dev) return fail('LEVEL_TOO_LOW', `Requires level ${dest.levelReq}`); if (p.to === 'mossy_hollow') return COMMANDS.enterDungeon!(c, { id: 'mossy_hollow' }); if (p.to === 'pet_farm') c.session.visit = null; return c.changeMap(p.to, p.tx * TILE + 16, p.ty * TILE + 16); },
  enterDungeon: (c, a) => { const d = DUNGEONS[String(a.id)]; if (!d) return fail('INVALID'); if (d.type === 'daily' && !near(c, 'dungeon') && !c.dev) return fail('NEED_WARDEN'); const r = c.svc.startDungeon(d.id); if (!r.ok) return r; return c.changeMap(d.map, undefined, undefined, { dungeon: d.id }); },
  leaveInstance: (c) => { const back = c.session.prevMap ?? { map: 'emberglen', x: 28 * TILE + 16, y: 24 * TILE + 16 }; c.session.prevMap = null; return c.changeMap(back.map, back.x, back.y); },
  arenaJoin: (c, a) => { if (!near(c, 'arena') && !c.dev) return fail('NEED_ARENA_MASTER'); return c.changeMap('arena', undefined, undefined, { arena: String(a.mode ?? '1v1') }); },
  arenaSettle: (c) => {
    const ar = c.world.arena; const s = c.session.arena; if (!ar || !ar.done || !s || s.settled) return fail('NOT_FINISHED'); s.settled = true;
    const myTeam = c.world.teamOf(c.world.entities.get(c.entityId)!); const win = ar.winner === myTeam; const delta = c.svc.recordPvp(win, 'Arena', 1000 + c.svc.rng.int(-100, 150)); return ok({ win, delta });
  },
  // --- economy (§35–38) ---
  marketList: (c, a) => wrapEco(() => c.market.list(c.svc, String(a.uid), big(a.price), a.qty ? Number(a.qty) : undefined)),
  marketBuy: (c, a) => wrapEco(() => c.market.buy(c.svc, String(a.id))),
  marketCancel: (c, a) => wrapEco(() => c.market.cancel(c.svc, String(a.id))),
  buyOrder: (c, a) => wrapEco(() => c.market.placeBuyOrder(c.svc, String(a.defId), big(a.price), Number(a.qty) || 1)),
  cancelBuyOrder: (c, a) => wrapEco(() => c.market.cancelBuyOrder(c.svc, String(a.id))),
  auctionCreate: (c, a) => wrapEco(() => c.market.createAuction(c.svc, String(a.uid), big(a.start), a.buyNow ? big(a.buyNow) : null, Math.min(48, Math.max(1, Number(a.hours) || 1)) * 3600_000 / (c.mode === 'local' ? 60 : 1))),
  auctionBid: (c, a) => wrapEco(() => c.market.bid(c.svc, String(a.id), big(a.amount))),
  auctionBuyNow: (c, a) => wrapEco(() => c.market.buyNowAuction(c.svc, String(a.id))),
  exchangePlace: (c, a) => wrapEco(() => c.market.exchangePlace(c.svc, a.side === 'sell' ? 'sell' : 'buy', big(a.price), big(a.qty))),
  exchangeCancel: (c, a) => wrapEco(() => c.market.exchangeCancel(c.svc, String(a.id))),
  tradeOpen: (c, a) => {
    if (c.mode === 'local') { const bot = c.world.entities.get(String(a.target)); if (!bot || bot.kind !== 'bot') return fail('INVALID_PARTNER'); const t = c.market.openTrade(c.svc, `sim:${bot.name}`); c.session.trade = t; c.session.tradePartner = bot.name; if (c.market.ledger.available(`sim:${bot.name}`, 'gold') < 5000n) c.market.ledger.mint(`sim:${bot.name}`, 'gold', 20000n, 'sim_trader'); return ok({ id: t.id, partner: bot.name }); }
    return fail('USE_SERVER_TRADE');
  },
  tradeOffer: (c, a) => { const t = c.session.trade; if (!t) return fail('NO_TRADE'); for (const u of a.items ?? []) { const it = c.svc.findInv(u); if (!it || it.locked || it.bound) return fail('ITEM_NOT_TRADEABLE'); } if (c.svc.gold() < big(a.gold)) return fail('NOT_ENOUGH_GOLD'); return wrapEco(() => { c.market.tradeOffer(t, 'a', a.items ?? [], big(a.gold)); simTradeResponse(c); return { offerB: t.offerB }; }); },
  tradeLock: (c) => { const t = c.session.trade; if (!t) return fail('NO_TRADE'); c.market.tradeLock(t, 'a'); return ok(); },
  tradeConfirm: (c) => { const t = c.session.trade; if (!t) return fail('NO_TRADE'); return wrapEco(() => { const done = c.market.tradeConfirm(t, 'a', c.svc); if (done) { c.session.trade = null; c.svc.note(`Trade completed with ${c.session.tradePartner} [sim]`); } return { done }; }); },
  tradeCancel: (c) => { if (c.session.trade) c.session.trade.state = 'cancelled'; c.session.trade = null; return ok(); },
  // --- social (§39–41) ---
  chat: (c, a) => { const ch = ['local', 'world', 'party', 'guild', 'trade', 'help'].includes(a.ch) ? a.ch : 'local'; if (ch === 'guild' && !c.svc.p.guild) return fail('NO_GUILD'); c.world.chat(c.entityId, ch, String(a.msg ?? '')); return ok(); },
  friendAdd: (c, a) => { const name = String(a.name).slice(0, 20); if (!name || c.svc.p.friends.some((f) => f.name === name)) return fail('INVALID'); if (c.svc.p.blocked.includes(name)) return fail('BLOCKED'); if (c.svc.p.friends.length >= 100) return fail('FRIEND_LIMIT'); c.svc.p.friends.push({ name, note: '', since: c.world.now() }); return ok(); },
  friendRemove: (c, a) => { c.svc.p.friends = c.svc.p.friends.filter((f) => f.name !== a.name); return ok(); },
  block: (c, a) => { const n = String(a.name); if (!c.svc.p.blocked.includes(n)) c.svc.p.blocked.push(n); c.svc.p.friends = c.svc.p.friends.filter((f) => f.name !== n); return ok(); },
  unblock: (c, a) => { c.svc.p.blocked = c.svc.p.blocked.filter((x) => x !== a.name); return ok(); },
  partyInvite: (c, a) => {
    const me = c.world.entities.get(c.entityId)!; const t = c.world.entities.get(String(a.target)); if (!t || (t.kind !== 'bot' && t.kind !== 'player') || t.id === me.id) return fail('INVALID_TARGET');
    if (c.svc.p.blocked.includes(t.name)) return fail('BLOCKED');
    const pid = me.partyId ?? uid('party'); const members = c.world.parties.get(pid) ?? [me.id]; if (members.length >= CONFIG.partyMax) return fail('PARTY_FULL'); if (t.partyId) return fail('ALREADY_IN_PARTY');
    me.partyId = pid; t.partyId = pid; members.push(t.id); c.world.parties.set(pid, members); return ok({ party: pid, members });
  },
  partyLeave: (c) => { const me = c.world.entities.get(c.entityId)!; if (!me.partyId) return fail('NO_PARTY'); const m = c.world.parties.get(me.partyId) ?? []; for (const id of m) { const e = c.world.entities.get(id); if (e) e.partyId = null; } c.world.parties.delete(me.partyId); return ok(); },
  partyKick: (c, a) => { const me = c.world.entities.get(c.entityId)!; if (!me.partyId) return fail('NO_PARTY'); const m = c.world.parties.get(me.partyId)!; if (m[0] !== me.id) return fail('NOT_LEADER'); const i = m.indexOf(String(a.id)); if (i <= 0) return fail('INVALID'); m.splice(i, 1); const e = c.world.entities.get(String(a.id)); if (e) e.partyId = null; return ok(); },
  guildCreate: (c, a) => {
    if (c.svc.p.guild) return fail('ALREADY_IN_GUILD'); if (!near(c, 'guild')) return fail('NEED_GUILD_CLERK'); const name = String(a.name ?? '').trim(); if (!/^[\p{L}\p{N} ]{3,16}$/u.test(name)) return fail('INVALID_NAME');
    if (!c.svc.spend('gold', 10000, 'guild_create')) return fail('NOT_ENOUGH_GOLD', 'Founding costs 10,000 Gold');
    c.svc.p.guild = { id: uid('g'), name, role: 'leader', contribution: 0, level: 1, exp: 0, storage: [], log: [`${c.svc.p.name} founded the guild.`] }; c.world.refreshPlayer(c.entityId); return ok();
  },
  guildDonate: (c, a) => { const g = c.svc.p.guild; if (!g) return fail('NO_GUILD'); const n = Math.max(100, Number(a.gold) || 0); const today = `gd:${new Date(c.world.now()).toISOString().slice(0, 10)}`; if ((c.svc.p.counters[today] ?? 0) + n > 50000) return fail('DAILY_DONATION_CAP'); if (!c.svc.spend('gold', n, 'guild_donation')) return fail('NOT_ENOUGH_GOLD'); c.svc.p.counters[today] = (c.svc.p.counters[today] ?? 0) + n; g.exp += Math.floor(n / 10); g.contribution += Math.floor(n / 10); c.svc.earn('guild_token', Math.floor(n / 100), 'guild'); while (g.exp >= guildLevelExp(g.level)) { g.exp -= guildLevelExp(g.level); g.level++; g.log.unshift(`Guild reached level ${g.level}`); } g.log.unshift(`${c.svc.p.name} donated ${n}G`); g.log.length = Math.min(30, g.log.length); return ok(); },
  guildStorage: (c, a) => { const g = c.svc.p.guild; if (!g) return fail('NO_GUILD'); if (a.deposit) { const i = c.svc.p.inventory.findIndex((x) => x.uid === a.uid); if (i < 0) return fail('NOT_FOUND'); const it = c.svc.p.inventory[i]!; if (it.bound) return fail('ITEM_BOUND'); g.storage.push(c.svc.p.inventory.splice(i, 1)[0]!); g.log.unshift(`${c.svc.p.name} deposited ${ITEMS[it.defId]!.name.en}`); return ok(); } if (!guildCan(g.role, 'storage_withdraw')) return fail('NO_PERMISSION'); const i = g.storage.findIndex((x) => x.uid === a.uid); if (i < 0) return fail('NOT_FOUND'); if (c.svc.freeSlots() <= 0) return fail('INVENTORY_FULL'); const it = g.storage.splice(i, 1)[0]!; c.svc.p.inventory.push(it); g.log.unshift(`${c.svc.p.name} withdrew ${ITEMS[it.defId]!.name.en}`); return ok(); },
  guildLeave: (c) => { if (!c.svc.p.guild) return fail('NO_GUILD'); c.svc.p.guild = null; c.world.refreshPlayer(c.entityId); return ok(); },
  guildBuff: (c) => { const g = c.svc.p.guild; if (!g) return fail('NO_GUILD'); if (g.level < 2) return fail('GUILD_LEVEL_2'); const e = c.world.entities.get(c.entityId)!; applyStatus(e.effects, 'atk_up', e.id, 600000, 0); c.world.refreshPlayer(c.entityId); return ok(); },
  propose: (c, a) => {
    if (c.svc.p.marriage) return fail('ALREADY_MARRIED'); if (!near(c, 'marriage')) return fail('NEED_OFFICIANT'); const f = c.svc.p.friends.find((x) => x.name === a.name); if (!f) return fail('MUST_BE_FRIENDS');
    if (c.world.now() - f.since < (c.dev ? 0 : 3 * 60_000)) return fail('FRIENDSHIP_TOO_NEW', 'Be friends for at least 3 minutes'); if (!c.svc.removeItem('wedding_ring', 1) && !c.svc.spend('gold', 10000, 'wedding')) return fail('NEED_RING', 'Need a Hearthbound Ring or 10,000 Gold');
    // in artifact the partner is simulated and always consents; server requires mutual acceptance
    c.svc.p.marriage = { partner: f.name, since: c.world.now(), anniversary: 0 }; if (!c.svc.p.titles.includes('title_hearthbound')) c.svc.p.titles.push('title_hearthbound'); c.svc.addItem('costume_festival', 1); c.world.fx.push({ t: 'notice', msg: `${c.svc.p.name} and ${f.name} are now wed!` }); return ok();
  },
  divorce: (c) => { if (!c.svc.p.marriage) return fail('NOT_MARRIED'); c.svc.p.marriage = null; c.svc.p.titles = c.svc.p.titles.filter((t) => t !== 'title_hearthbound'); if (c.svc.p.title === 'title_hearthbound') c.svc.p.title = null; return ok(); },
  report: (c, a) => { c.svc.note(`Report filed against ${String(a.name).slice(0, 20)} (${String(a.reason).slice(0, 40)}). Moderators will review.`); return ok({ ticket: uid('rpt') }); },
  // --- developer / testing panel (dev mode only) ---
  dev: (c, a) => {
    if (!c.dev) return fail('FORBIDDEN', 'Developer commands are disabled in production');
    const s = c.svc; const me = c.world.entities.get(c.entityId)!;
    switch (a.op) {
      case 'level': { const target = Math.min(CONFIG.levelCap, Number(a.n) || s.p.level + 10); while (s.p.level < target) { const before = s.p.level; s.gainExp(1e9, 'dev'); if (s.p.level === before) { s.addItem('boss_heart', 9); s.ascend(); if (s.p.level === before && s.p.ascension >= 3) break; } } c.world.refreshPlayer(c.entityId); me.hp = me.maxHp; me.mp = me.maxMp; return ok(); }
      case 'exp': s.gainExp(Number(a.n) || 10000, 'dev'); c.world.refreshPlayer(c.entityId); return ok();
      case 'gold': s.earn('gold', Number(a.n) || 100000, 'dev_grant'); return ok();
      case 'crystal': s.earn('crystal', Number(a.n) || 10000, 'dev_grant'); return ok();
      case 'currency': s.earn(a.c, Number(a.n) || 1000, 'dev_grant'); return ok();
      case 'item': if (!ITEMS[a.id]) return fail('UNKNOWN_ITEM'); s.addItem(a.id, Number(a.n) || 1, { rollOptions: true }); return ok();
      case 'materials': for (const id of ['refine_ore', 'refine_ore_hi', 'enchant_stone', 'ward_scroll', 'stone_dust', 'star_dust', 'gem_dust', 'iron_ore', 'oak_log', 'herb_green', 'herb_blue', 'slime_gel', 'berry', 'wheat', 'fish_carp', 'soft_fur', 'cloth', 'capture_net', 'pet_food', 'pet_egg', 'gacha_ticket', 'card_pack', 'boss_heart', 'wisp_dust', 'ember_core', 'pine_log', 'copper_ore', 'silver_ore', 'beetle_shell', 'fish_trout', 'frost_shard', 'herb_gold', 'tool_pickaxe', 'tool_rod', 'deco_lantern', 'deco_flowers', 'wedding_ring', 'gem_ruby_1', 'gem_sapphire_1', 'skill_stone']) s.addItem(id, ['tool_pickaxe', 'tool_rod', 'wedding_ring'].includes(id) ? 1 : 20); return ok();
      case 'skills': for (const sk of CLASSES[s.p.classId]!.skills) s.p.skillRanks[sk.id] = Math.max(s.p.skillRanks[sk.id] ?? 0, 1); s.p.hotbar = CLASSES[s.p.classId]!.skills.filter((x) => x.type !== 'passive').slice(0, 8).map((x) => x.id); c.world.refreshPlayer(c.entityId); return ok();
      case 'class': { const r = s.changeClass(String(a.id)); c.world.refreshPlayer(c.entityId); return r; }
      case 'spawn': { const m = c.world.spawnMonster(String(a.id), me.x + 80, me.y); m.ai!.homeX = m.x; m.ai!.homeY = m.y; return ok({ id: m.id }); }
      case 'boss': if (c.world.map.def.biome !== 'crater') return fail('GO_TO_CRATER'); c.world.spawnWorldBoss(a.id); return ok();
      case 'map': return c.changeMap(String(a.id));
      case 'teleport': c.world.entities.get(c.entityId)!.x = Number(a.x); c.world.entities.get(c.entityId)!.y = Number(a.y); return ok();
      case 'pet': s.addPet(String(a.id ?? 'pet_phoenix')); return ok();
      case 'mount': for (const m of Object.values(MOUNTS)) if (!s.p.mounts.includes(m.id)) { s.p.mounts.push(m.id); s.p.mountLevels[m.id] = 0; } s.p.activeMount ??= 'pony'; return ok();
      case 'farmTime': s.p.farm.lastSettle -= (Number(a.h) || 2) * 3600_000; for (const e of s.p.eggs) e.hatchAt = 0; return ok(s.settleFarm());
      case 'wear': for (const it of Object.values(s.p.equipment)) if (it) it.durability = Math.max(0, Number(a.n ?? 15)); c.world.refreshPlayer(c.entityId); return ok();
      case 'heal': me.hp = me.maxHp; me.mp = me.maxMp; me.dead = false; for (const k of Object.keys(me.cds)) me.cds[k] = 0; return ok();
      case 'cards': for (const mc of Object.keys(PETS)) void mc; for (const m of Object.values(MONSTERS).slice(0, 12)) s.p.monsterCards[`mc_${m.id}`] = (s.p.monsterCards[`mc_${m.id}`] ?? 0) + 2; s.checkAchievements(); return ok();
      case 'pass': s.gainPassExp(1000); return ok();
      case 'mail': s.sendMail('GM', 'Test delivery', 'Developer test mail.', [{ itemId: 'potion_hp_m', qty: 5 }], 1000); return ok();
      case 'friend': s.p.friends.push({ name: String(a.name ?? 'Juniper'), note: 'test', since: 0 }); return ok();
      default: return fail('UNKNOWN_DEV_OP');
    }
  },
};

function wrapEco(fn: () => unknown): Result { try { return ok(fn()); } catch (e) { if (e instanceof EconomyError) return fail(e.code, e.message); throw e; } }
function runAi(c: CommandContext) {
  const m = c.session.tcg!; let guard = 0;
  while (m.state.winner === null && m.state.active === 1 && guard++ < 60) applyAction(m.state, 1, aiChooseAction(m.state, 1));
  if (m.state.winner !== null && !m.settled) { m.settled = true; c.svc.recordTcg(m.state.winner === 0, m.mode, m.oppRating); }
}
function simTradeResponse(c: CommandContext) {
  // Simulated partner (artifact only): values offered items at 60% of reference and pays gold, or offers a potion bundle.
  const t = c.session.trade!; const val = t.offerA.items.reduce((s, u) => s + c.market.refPrice(c.svc.findInv(u)!.defId) * c.svc.findInv(u)!.qty, 0) * 0.6 + Number(t.offerA.gold);
  t.offerB = { items: [], gold: BigInt(Math.floor(val)) }; c.market.tradeLock(t, 'b'); t.confirmB = true;
}

/** Execute with rate limit + error isolation (anti-spam §61). */
export function executeCommand(ctx: CommandContext, cmd: string, args: Args = {}): Result {
  const now = ctx.world.now(); const s = ctx.session;
  if (!s.lastCmdAt || now - s.lastCmdAt > 1000) { s.lastCmdAt = now; s.cmdCount = 0; }
  s.cmdCount = (s.cmdCount ?? 0) + 1; if (ctx.mode === 'server' && s.cmdCount > RATE_LIMIT_PER_SEC && cmd !== 'move') return fail('RATE_LIMITED'); // local single-player adapter is not rate limited
  const h = COMMANDS[cmd]; if (!h) return fail('UNKNOWN_COMMAND');
  if (typeof args !== 'object' || args === null) return fail('INVALID_PAYLOAD');
  try { return h(ctx, args); } catch (e: any) { return fail('INTERNAL', e?.message ?? String(e)); }
}
export const COMMAND_NAMES = Object.keys(COMMANDS);
export { walletId };
