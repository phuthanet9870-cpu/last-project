/**
 * Marketplace / Auction / Crystal Exchange / Direct Trade / Social (§35–41).
 * MarketService is world-scoped and operates on a shared Ledger with escrow. In the artifact the
 * "other players" are SIMULATED traders (accounts prefixed `sim:`), clearly labelled in the UI.
 */
import { CONFIG } from './config.js';
import { EconomyError, Ledger, OrderBook, feeOf, placeBid, settleAuction, type Auction } from './economy.js';
import { ITEMS, type ItemInstance } from './items.js';
import { newItem, walletId, type PlayerService } from './player.js';
import { Rng, uid } from './rng.js';

export interface Listing { payTo?: string; id: string; seller: string; sellerName: string; item: ItemInstance; price: bigint; ts: number; expiresAt: number; status: 'active' | 'sold' | 'cancelled' | 'expired'; simulated: boolean }
export interface BuyOrder { id: string; buyer: string; defId: string; price: bigint; qty: number; filled: number; status: 'open' | 'filled' | 'cancelled' }
export interface TradeSession { id: string; a: string; b: string; offerA: { items: string[]; gold: bigint }; offerB: { items: ItemInstance[]; gold: bigint }; lockA: boolean; lockB: boolean; confirmA: boolean; confirmB: boolean; state: 'open' | 'done' | 'cancelled' }

const SIM_SELLERS = ['Marigold', 'Thorn', 'Basil', 'Corvin', 'Elowen', 'Fennick', 'Hazel', 'Ivo'];
export class MarketService {
  listings: Listing[] = []; buyOrders: BuyOrder[] = []; auctions: Auction[] = []; book = new OrderBook(true); priceHistory: Record<string, { ts: number; price: number }[]> = {};
  exchangeHistory: { ts: number; price: number; qty: number }[] = []; trades: TradeSession[] = []; private lastSim = 0;
  /** Personal market history (§35): buys/sales/auctions/exchange per wallet account. */
  history: { ts: number; kind: 'buy' | 'sell' | 'auction_won' | 'auction_sold' | 'xbuy' | 'xsell'; account: string; item: string; qty: number; price: number }[] = [];
  /** Crystal holding period (§37): exchange purchases are held in `hold:<acct>` until releaseAt. */
  holds: { id: string; acct: string; amount: bigint; releaseAt: number }[] = [];
  /** Called for every new listing (wishlist price alerts). */
  onNewListing?: (l: Listing) => void;
  log(kind: MarketService['history'][number]['kind'], account: string, item: string, qty: number, price: number) { this.history.push({ ts: this.now(), kind, account, item, qty, price }); if (this.history.length > 2000) this.history.splice(0, this.history.length - 2000); }
  /** Sales proceeds go to the account-wide collection box (shared by all characters on the account). */
  static collectionOf(accountId: string) { return `coll:${accountId}`; }
  collectable(accountId: string): bigint { return this.ledger.available(MarketService.collectionOf(accountId), 'gold'); }
  collectSales(svc: PlayerService): bigint { const from = MarketService.collectionOf(svc.p.accountId); const amt = this.ledger.available(from, 'gold'); if (amt <= 0n) throw new EconomyError('NOTHING_TO_COLLECT'); this.ledger.transfer(from, walletId(svc.p), 'gold', amt, 'sales_collection', `collect:${from}:${this.now()}:${amt}`); svc.emit({ type: 'currency', c: 'gold', delta: Number(amt) }); return amt; }
  waitingCrystal(acct: string): bigint { return this.holds.filter((h) => h.acct === acct).reduce((s, h) => s + h.amount, 0n); }
  releaseHolds() { const now = this.now(); for (const h of [...this.holds]) if (h.releaseAt <= now) { this.ledger.transfer(`hold:${h.acct}`, h.acct, 'crystal', h.amount, 'crystal_hold_release', `hold:${h.id}`); this.holds.splice(this.holds.indexOf(h), 1); } }
  bestSellers(hours = 24, n = 10) { const since = this.now() - hours * 3600_000; const out: { defId: string; sales: number; avg: number }[] = []; for (const [defId, h] of Object.entries(this.priceHistory)) { const r = h.filter((x) => x.ts >= since); if (r.length) out.push({ defId, sales: r.length, avg: Math.round(r.reduce((s, x) => s + x.price, 0) / r.length) }); } return out.sort((a, b) => b.sales - a.sales).slice(0, n); }
  /** OHLC candles for the exchange (bucketMs = 1m / 5m / 1h). */
  candles(bucketMs: number, n = 30) { const m = new Map<number, { o: number; h: number; l: number; c: number; v: number }>(); for (const t of this.exchangeHistory) { const k = Math.floor(t.ts / bucketMs); const c = m.get(k); if (!c) m.set(k, { o: t.price, h: t.price, l: t.price, c: t.price, v: t.qty }); else { c.h = Math.max(c.h, t.price); c.l = Math.min(c.l, t.price); c.c = t.price; c.v += t.qty; } } return [...m.entries()].sort((a, b) => a[0] - b[0]).slice(-n).map(([k, c]) => ({ t: k * bucketMs, ...c })); }
  constructor(public ledger: Ledger, public rng = new Rng(), public now: () => number = Date.now) {}

  refPrice(defId: string): number { const h = this.priceHistory[defId]; if (h?.length) return Math.round(h.slice(-10).reduce((s, x) => s + x.price, 0) / Math.min(10, h.length)); return Math.max(5, ITEMS[defId]?.price ?? 10); }
  myListings(svc: PlayerService) { return this.listings.filter((l) => l.seller === walletId(svc.p) && l.status === 'active'); }
  slotsUsed(svc: PlayerService) { const a = walletId(svc.p); return this.myListings(svc).length + this.buyOrders.filter((o) => o.buyer === a && o.status === 'open').length + this.auctions.filter((x) => x.seller === a && x.status === 'active').length; }

  /** List an item: moves it from inventory into market escrow atomically. Unit price × qty. */
  list(svc: PlayerService, itemUid: string, price: bigint, qty?: number): Listing {
    const it = svc.findInv(itemUid); if (!it) throw new EconomyError('NOT_FOUND'); if (it.locked) throw new EconomyError('ITEM_LOCKED'); if (it.bound || !ITEMS[it.defId]!.tradeable) throw new EconomyError('ITEM_BOUND');
    if (price <= 0n || price > 10_000_000_000n) throw new EconomyError('INVALID_PRICE'); if (this.slotsUsed(svc) >= CONFIG.marketSlots) throw new EconomyError('NO_MARKET_SLOT');
    const n = Math.min(qty ?? it.qty, it.qty); if (n <= 0) throw new EconomyError('INVALID_QTY');
    let escrow: ItemInstance;
    if (n < it.qty) { it.qty -= n; escrow = { ...newItem(it.defId, n) }; } else { svc.p.inventory.splice(svc.p.inventory.indexOf(it), 1); escrow = it; }
    const l: Listing = { id: uid('lst'), seller: walletId(svc.p), payTo: MarketService.collectionOf(svc.p.accountId), sellerName: svc.p.name, item: escrow, price, ts: this.now(), expiresAt: this.now() + 48 * 3600_000, status: 'active', simulated: false };
    this.listings.push(l); this.onNewListing?.(l); return l;
  }
  cancel(svc: PlayerService, listingId: string) {
    const l = this.listings.find((x) => x.id === listingId && x.seller === walletId(svc.p)); if (!l || l.status !== 'active') throw new EconomyError('NOT_ACTIVE');
    if (svc.freeSlots() <= 0) throw new EconomyError('INVENTORY_FULL');
    l.status = 'cancelled'; svc.p.inventory.push(l.item);
  }
  /** Buy: atomic gold transfer (buyer → seller − fee → sink) + ownership transfer; status check prevents double purchase. */
  buy(svc: PlayerService, listingId: string): Listing {
    const l = this.listings.find((x) => x.id === listingId); if (!l || l.status !== 'active') throw new EconomyError('LISTING_GONE');
    if (l.seller === walletId(svc.p)) throw new EconomyError('OWN_LISTING');
    const total = l.price * BigInt(l.item.qty); if (svc.gold() < total) throw new EconomyError('INSUFFICIENT_FUNDS');
    if (svc.slotsNeeded(l.item.defId, l.item.qty) > svc.freeSlots()) throw new EconomyError('INVENTORY_FULL');
    const fee = feeOf(total, CONFIG.marketFeeBps);
    this.ledger.post([{ account: walletId(svc.p), currency: 'gold', amount: -total }, { account: l.payTo ?? l.seller, currency: 'gold', amount: total - fee }, { account: 'system:burn:market_tax', currency: 'gold', amount: fee }], 'market_buy', `buy:${l.id}`);
    l.status = 'sold'; svc.p.inventory.push(l.item); this.log('buy', walletId(svc.p), l.item.defId, l.item.qty, Number(total)); this.log('sell', l.seller, l.item.defId, l.item.qty, Number(total - fee)); svc.emit({ type: 'currency', c: 'gold', delta: -Number(total) });
    (this.priceHistory[l.item.defId] ??= []).push({ ts: this.now(), price: Number(l.price) });
    return l;
  }
  placeBuyOrder(svc: PlayerService, defId: string, price: bigint, qty: number): BuyOrder {
    if (!ITEMS[defId] || qty <= 0 || price <= 0n) throw new EconomyError('INVALID'); if (this.slotsUsed(svc) >= CONFIG.marketSlots) throw new EconomyError('NO_MARKET_SLOT');
    this.ledger.reserve(walletId(svc.p), 'gold', price * BigInt(qty));
    const o: BuyOrder = { id: uid('bo'), buyer: walletId(svc.p), defId, price, qty, filled: 0, status: 'open' }; this.buyOrders.push(o); return o;
  }
  cancelBuyOrder(svc: PlayerService, id: string) { const o = this.buyOrders.find((x) => x.id === id && x.buyer === walletId(svc.p) && x.status === 'open'); if (!o) throw new EconomyError('NOT_ACTIVE'); this.ledger.release(o.buyer, 'gold', o.price * BigInt(o.qty - o.filled)); o.status = 'cancelled'; }

  // ---- auction ----
  createAuction(svc: PlayerService, itemUid: string, start: bigint, buyNow: bigint | null, durationMs: number): Auction {
    const it = svc.findInv(itemUid); if (!it || it.locked || it.bound) throw new EconomyError('INVALID_ITEM'); if (this.slotsUsed(svc) >= CONFIG.marketSlots) throw new EconomyError('NO_MARKET_SLOT'); if (start <= 0n || (buyNow !== null && buyNow <= start)) throw new EconomyError('INVALID_PRICE');
    svc.p.inventory.splice(svc.p.inventory.indexOf(it), 1);
    const a: Auction = { payTo: MarketService.collectionOf(svc.p.accountId), id: uid('auc'), seller: walletId(svc.p), itemUid: it.uid, itemDefId: it.defId, start, buyNow, current: 0n, bidder: null, endsAt: this.now() + durationMs, status: 'active', bids: [] };
    (a as any).item = it; this.auctions.push(a); return a;
  }
  bid(svc: PlayerService, auctionId: string, maxAmount: bigint) { const a = this.auctions.find((x) => x.id === auctionId); if (!a) throw new EconomyError('NOT_FOUND'); return placeBid(this.ledger, a, walletId(svc.p), maxAmount, this.now(), CONFIG.auctionMinIncrementBps, CONFIG.auctionAntiSnipeMs); }
  buyNowAuction(svc: PlayerService, auctionId: string) {
    const a = this.auctions.find((x) => x.id === auctionId); if (!a || a.status !== 'active' || !a.buyNow) throw new EconomyError('INVALID'); if (a.seller === walletId(svc.p)) throw new EconomyError('SELF_BID');
    const fee = feeOf(a.buyNow, CONFIG.marketFeeBps);
    this.ledger.post([{ account: walletId(svc.p), currency: 'gold', amount: -a.buyNow }, { account: a.payTo ?? a.seller, currency: 'gold', amount: a.buyNow - fee }, { account: 'system:burn:auction_fee', currency: 'gold', amount: fee }], 'auction_buynow', `bn:${a.id}`);
    if (a.bidder) this.ledger.release(a.bidder, 'gold', a.maxBids?.[a.bidder] ?? a.current); this.log('auction_won', walletId(svc.p), a.itemDefId, 1, Number(a.buyNow)); this.log('auction_sold', a.seller, a.itemDefId, 1, Number(a.buyNow - fee));
    a.status = 'bought'; a.bidder = walletId(svc.p); a.current = a.buyNow; svc.p.inventory.push((a as any).item);
  }
  /** Settle expired auctions exactly once (worker job in online mode). Delivers items to winner/seller via callbacks. */
  settleAuctions(deliver: (account: string, item: ItemInstance) => void) {
    for (const a of this.auctions) { const r = settleAuction(this.ledger, a, this.now(), CONFIG.marketFeeBps); if (r === 'sold') { deliver(a.bidder!, (a as any).item); this.log('auction_won', a.bidder!, a.itemDefId, 1, Number(a.current)); this.log('auction_sold', a.seller, a.itemDefId, 1, Number(a.current)); } if (r === 'expired') deliver(a.seller, (a as any).item); }
    for (const l of this.listings) if (l.status === 'active' && this.now() > l.expiresAt) { l.status = 'expired'; deliver(l.seller, l.item); }
  }

  // ---- crystal exchange (§37): price in Gold per 1 Crystal ----
  exchangePlace(svc: PlayerService, side: 'buy' | 'sell', price: bigint, qty: bigint) {
    const acct = walletId(svc.p); if (price <= 0n || qty <= 0n || qty > 100000n) throw new EconomyError('INVALID_ORDER');
    if (side === 'buy') this.ledger.reserve(acct, 'gold', price * qty); else this.ledger.reserve(acct, 'crystal', qty);
    const r = this.book.place({ id: uid('xo'), owner: acct, side, price, qty, ts: this.now() });
    this.settleFills(r.fills);
    if (side === 'buy') { // release excess reservation when filled below limit price
      const spentAtLimit = r.fills.reduce((s, f) => s + (price - f.price) * f.qty, 0n); if (spentAtLimit > 0n) this.ledger.release(acct, 'gold', spentAtLimit);
    }
    return r;
  }
  exchangeCancel(svc: PlayerService, orderId: string) { const o = this.book.cancel(orderId, walletId(svc.p)); if (!o) throw new EconomyError('NOT_FOUND'); const rem = o.qty - o.filled; if (o.side === 'buy') this.ledger.release(o.owner, 'gold', o.price * rem); else this.ledger.release(o.owner, 'crystal', rem); }
  private settleFills(fills: ReturnType<OrderBook['place']>['fills']) {
    for (const f of fills) {
      const gold = f.price * f.qty; const fee = feeOf(gold, CONFIG.exchangeFeeBps);
      this.ledger.settleReserved(f.buyer, [{ to: f.seller, amount: gold - fee }, { to: 'system:burn:exchange_fee', amount: fee }], 'gold', 'exchange', `xf:${f.buyOrder}:${f.sellOrder}:${f.qty}:${f.ts}`);
      this.ledger.settleReserved(f.seller, [{ to: f.buyer, amount: f.qty }], 'crystal', 'exchange', `xc:${f.buyOrder}:${f.sellOrder}:${f.qty}:${f.ts}`);
      if (f.buyer.startsWith('p:') && CONFIG.crystalHoldMs > 0) { const hid = `${f.buyOrder}:${f.sellOrder}:${f.ts}`; this.ledger.transfer(f.buyer, `hold:${f.buyer}`, 'crystal', f.qty, 'crystal_hold', `holdin:${hid}`); this.holds.push({ id: hid, acct: f.buyer, amount: f.qty, releaseAt: this.now() + CONFIG.crystalHoldMs }); }
      if (f.buyer.startsWith('p:')) this.log('xbuy', f.buyer, 'crystal', Number(f.qty), Number(gold)); if (f.seller.startsWith('p:')) this.log('xsell', f.seller, 'crystal', Number(f.qty), Number(gold - fee));
      this.exchangeHistory.push({ ts: f.ts, price: Number(f.price), qty: Number(f.qty) }); if (this.exchangeHistory.length > 500) this.exchangeHistory.shift();
    }
  }

  // ---- direct trade (§38) — two-phase lock+confirm; any change resets both confirmations ----
  openTrade(a: PlayerService, partnerAccount: string): TradeSession { const t: TradeSession = { id: uid('tr'), a: walletId(a.p), b: partnerAccount, offerA: { items: [], gold: 0n }, offerB: { items: [], gold: 0n }, lockA: false, lockB: false, confirmA: false, confirmB: false, state: 'open' }; this.trades.push(t); return t; }
  tradeOffer(t: TradeSession, side: 'a' | 'b', items: string[] | ItemInstance[], gold: bigint) { if (t.state !== 'open') throw new EconomyError('TRADE_CLOSED'); if (gold < 0n) throw new EconomyError('INVALID'); if (side === 'a') t.offerA = { items: items as string[], gold }; else t.offerB = { items: items as ItemInstance[], gold }; t.lockA = t.lockB = t.confirmA = t.confirmB = false; }
  tradeLock(t: TradeSession, side: 'a' | 'b') { if (side === 'a') t.lockA = true; else t.lockB = true; }
  tradeConfirm(t: TradeSession, side: 'a' | 'b', svcA: PlayerService) {
    if (!t.lockA || !t.lockB) throw new EconomyError('NOT_LOCKED'); if (side === 'a') t.confirmA = true; else t.confirmB = true;
    if (!(t.confirmA && t.confirmB)) return false;
    // validate all, then mutate (single transaction)
    const items = t.offerA.items.map((u) => svcA.findInv(u)); if (items.some((i) => !i || i.locked || i.bound)) { t.state = 'cancelled'; throw new EconomyError('ITEM_INVALID'); }
    const needSlots = t.offerB.items.length - items.length; if (needSlots > svcA.freeSlots()) { t.state = 'cancelled'; throw new EconomyError('INVENTORY_FULL'); }
    const legs = [] as { account: string; currency: 'gold'; amount: bigint }[];
    if (t.offerA.gold > 0n) legs.push({ account: t.a, currency: 'gold', amount: -t.offerA.gold }, { account: t.b, currency: 'gold', amount: t.offerA.gold });
    if (t.offerB.gold > 0n) legs.push({ account: t.b, currency: 'gold', amount: -t.offerB.gold }, { account: t.a, currency: 'gold', amount: t.offerB.gold });
    if (legs.length) this.ledger.post(legs, 'direct_trade', `trade:${t.id}`);
    for (const i of items) svcA.p.inventory.splice(svcA.p.inventory.indexOf(i!), 1);
    for (const i of t.offerB.items) svcA.p.inventory.push(i);
    t.state = 'done'; return true;
  }

  // ---- simulation of other traders (artifact only) ----
  simulate(svc: PlayerService) {
    const now = this.now(); if (now - this.lastSim < 4000) return; this.lastSim = now; const rng = this.rng; this.releaseHolds();
    // ensure sim traders have funds (minted from a labelled faucet so ledger stays balanced)
    for (const n of SIM_SELLERS) { const a = `sim:${n}`; if (this.ledger.available(a, 'gold') < 50_000n) this.ledger.mint(a, 'gold', 200_000n, 'sim_trader'); if (this.ledger.available(a, 'crystal') < 2_000n) this.ledger.mint(a, 'crystal', 5_000n, 'sim_trader'); }
    // new sim listings
    const active = this.listings.filter((l) => l.status === 'active' && l.simulated).length;
    if (active < 24) for (let i = 0; i < 3; i++) {
      const pool = Object.values(ITEMS).filter((d) => d.tradeable && d.reqLevel <= svc.p.level + 15 && !['quest', 'ticket'].includes(d.type)); const d = rng.pick(pool); const seller = rng.pick(SIM_SELLERS);
      const qty = d.stack > 1 ? rng.int(1, 20) : 1; const price = BigInt(Math.max(1, Math.round(this.refPrice(d.id) * (0.7 + rng.next() * 0.9))));
      const sl: Listing = { id: uid('lst'), seller: `sim:${seller}`, sellerName: `${seller} [sim]`, item: newItem(d.id, qty, rng), price, ts: now, expiresAt: now + 3600_000, status: 'active', simulated: true }; this.listings.push(sl); this.onNewListing?.(sl);
    }
    // sim buyers purchase fairly priced player listings
    for (const l of this.listings) if (l.status === 'active' && !l.simulated && Number(l.price) <= this.refPrice(l.item.defId) * 1.4 && rng.chance(0.25)) {
      const buyer = `sim:${rng.pick(SIM_SELLERS)}`; const total = l.price * BigInt(l.item.qty); const fee = feeOf(total, CONFIG.marketFeeBps);
      try { this.ledger.post([{ account: buyer, currency: 'gold', amount: -total }, { account: l.payTo ?? l.seller, currency: 'gold', amount: total - fee }, { account: 'system:burn:market_tax', currency: 'gold', amount: fee }], 'market_buy_sim', `buy:${l.id}`); l.status = 'sold'; svc.bump('market_sales'); this.log('sell', l.seller, l.item.defId, l.item.qty, Number(total - fee)); svc.note(`Sold ${ITEMS[l.item.defId]!.name.en} ×${l.item.qty} for ${total - fee}G (after ${fee}G tax) to ${buyer.slice(4)} [sim] — collect it at the market`); svc.emit({ type: 'currency', c: 'gold', delta: 0 }); (this.priceHistory[l.item.defId] ??= []).push({ ts: now, price: Number(l.price) }); } catch { /* sim buyer lacks funds */ }
    }
    // sim sellers fill player buy orders at or below limit
    for (const o of this.buyOrders) if (o.status === 'open' && Number(o.price) >= this.refPrice(o.defId) * 0.8 && rng.chance(0.3)) {
      const seller = `sim:${rng.pick(SIM_SELLERS)}`; const q = Math.min(o.qty - o.filled, rng.int(1, o.qty - o.filled)); const total = o.price * BigInt(q); const fee = feeOf(total, CONFIG.marketFeeBps);
      this.ledger.settleReserved(o.buyer, [{ to: seller, amount: total - fee }, { to: 'system:burn:market_tax', amount: fee }], 'gold', 'buy_order_fill', `bof:${o.id}:${o.filled}`);
      o.filled += q; if (o.filled >= o.qty) o.status = 'filled'; svc.addItem(o.defId, q, { source: 'buy_order' }); svc.note(`Buy order filled: ${ITEMS[o.defId]!.name.en} ×${q}`);
    }
    // sim auctions + bids
    if (this.auctions.filter((a) => a.status === 'active').length < 6) { const d = rng.pick(Object.values(ITEMS).filter((x) => x.type === 'weapon' || x.type === 'armor' || x.type === 'gem')); const a: Auction = { id: uid('auc'), seller: `sim:${rng.pick(SIM_SELLERS)}`, itemUid: uid('it'), itemDefId: d.id, start: BigInt(Math.max(10, Math.floor(d.price * 0.6))), buyNow: BigInt(d.price * 2), current: 0n, bidder: null, endsAt: now + rng.int(3, 10) * 60_000, status: 'active', bids: [] }; (a as any).item = newItem(d.id, 1, rng); this.auctions.push(a); }
    for (const a of this.auctions) if (a.status === 'active' && rng.chance(0.15)) { const b = `sim:${rng.pick(SIM_SELLERS)}`; if (b !== a.seller && a.bidder !== b) { const amt = a.bidder ? a.current + a.current / 10n + 1n : a.start; if (!a.buyNow || amt < a.buyNow) { try { placeBid(this.ledger, a, b, amt, now, CONFIG.auctionMinIncrementBps, CONFIG.auctionAntiSnipeMs); } catch { /* ignore */ } } } }
    // market maker on exchange: keep ~5 levels each side around a drifting mid price
    const mid = 150 + Math.round(Math.sin(now / 600000) * 8);
    const depth = this.book.depth(10);
    if (depth.asks.length < 5) for (let i = 0; i < 5; i++) { const mm = `sim:${rng.pick(SIM_SELLERS)}`; const q = BigInt(rng.int(20, 300)); try { this.ledger.reserve(mm, 'crystal', q); this.settleFills(this.book.place({ id: uid('xo'), owner: mm, side: 'sell', price: BigInt(mid + 1 + i * rng.int(1, 3)), qty: q, ts: now }).fills); } catch { /* */ } }
    if (depth.bids.length < 5) for (let i = 0; i < 5; i++) { const mm = `sim:${rng.pick(SIM_SELLERS)}`; const q = BigInt(rng.int(20, 300)); const p = BigInt(mid - 1 - i * rng.int(1, 3)); try { this.ledger.reserve(mm, 'gold', p * q); this.settleFills(this.book.place({ id: uid('xo'), owner: mm, side: 'buy', price: p, qty: q, ts: now }).fills); } catch { /* */ } }
    // cleanup
    if (this.listings.length > 300) this.listings = this.listings.filter((l) => l.status === 'active').concat(this.listings.filter((l) => l.status !== 'active').slice(-50));
  }
  serialize() {
    const big = (_k: string, v: any) => (typeof v === 'bigint' ? `${v}n` : v);
    return JSON.parse(JSON.stringify({ listings: this.listings.filter((l) => l.status === 'active'), buyOrders: this.buyOrders.filter((o) => o.status === 'open'), auctions: this.auctions.filter((a) => a.status === 'active').map((a) => ({ ...a, item: (a as any).item })), priceHistory: this.priceHistory, bids: this.book.bids, asks: this.book.asks, xh: this.exchangeHistory.slice(-300), hist: this.history.slice(-300), holds: this.holds }, big));
  }
  load(o: any) {
    if (!o) return; const rev = (v: any): any => (typeof v === 'string' && /^-?\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rev(x)])) : v);
    const r = rev(o); this.listings = r.listings ?? []; this.buyOrders = r.buyOrders ?? []; this.auctions = r.auctions ?? []; this.priceHistory = r.priceHistory ?? {}; this.book.bids = r.bids ?? []; this.book.asks = r.asks ?? []; this.exchangeHistory = r.xh ?? []; this.history = r.hist ?? []; this.holds = r.holds ?? [];
  }
}

// ---------------- Social (§39–41) ----------------
export interface GuildState { id: string; name: string; level: number; exp: number; members: { name: string; role: 'leader' | 'officer' | 'member'; simulated: boolean; contribution: number }[]; announcement: string; log: string[]; buffs: string[] }
export const GUILD_PERMS: Record<'leader' | 'officer' | 'member', string[]> = { leader: ['invite', 'kick', 'promote', 'announce', 'storage_withdraw', 'disband', 'transfer'], officer: ['invite', 'kick', 'announce', 'storage_withdraw'], member: [] };
export function guildCan(role: 'leader' | 'officer' | 'member', perm: string) { return GUILD_PERMS[role].includes(perm); }
export function guildLevelExp(level: number) { return 1000 * level * level; }
