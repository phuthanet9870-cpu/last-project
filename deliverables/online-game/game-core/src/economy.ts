/**
 * Economy primitives (§33–38): integer BigInt currency, double-entry ledger, reservations,
 * price-time-priority order book, auction state machine. Pure & deterministic; the online server
 * wraps these in PostgreSQL transactions, the artifact runs them locally.
 */
export type Currency = 'gold' | 'crystal' | 'arena_token' | 'boss_coin' | 'card_dust' | 'star_dust' | 'guild_token' | 'event_token';
export const CURRENCIES: Currency[] = ['gold', 'crystal', 'arena_token', 'boss_coin', 'card_dust', 'star_dust', 'guild_token', 'event_token'];

export interface LedgerEntry { txId: string; account: string; currency: Currency; amount: bigint; reason: string; ts: number }
export interface WalletBalance { available: bigint; reserved: bigint }

export class EconomyError extends Error { constructor(public code: string, msg?: string) { super(msg ?? code); } }

/** Double-entry ledger. System accounts: `system:mint:<reason>` (faucets) and `system:burn:<reason>` (sinks) may go negative/positive; player accounts may not. */
export class Ledger {
  entries: LedgerEntry[] = [];
  balances = new Map<string, Map<Currency, WalletBalance>>();
  private applied = new Set<string>();
  private seq = 0;
  /** Persistence hooks (server): accounts whose balances changed and entries posted since last flush. */
  dirty = new Set<string>(); pending: LedgerEntry[] = []; trackPending = false;

  bal(account: string, c: Currency): WalletBalance {
    let m = this.balances.get(account); if (!m) { m = new Map(); this.balances.set(account, m); }
    let b = m.get(c); if (!b) { b = { available: 0n, reserved: 0n }; m.set(c, b); }
    return b;
  }
  available(account: string, c: Currency): bigint { return this.bal(account, c).available; }

  /** Post a balanced transaction. legs must sum to zero per currency. Idempotent by key. */
  post(legs: { account: string; currency: Currency; amount: bigint }[], reason: string, idempotencyKey?: string, ts = Date.now()): string {
    const key = idempotencyKey ?? `auto_${++this.seq}_${ts}`;
    if (this.applied.has(key)) return key;
    const sums = new Map<Currency, bigint>();
    for (const l of legs) sums.set(l.currency, (sums.get(l.currency) ?? 0n) + l.amount);
    for (const [c, s] of sums) if (s !== 0n) throw new EconomyError('UNBALANCED', `ledger unbalanced for ${c}: ${s}`);
    for (const l of legs) if (!l.account.startsWith('system:') && this.bal(l.account, l.currency).available + l.amount < 0n) throw new EconomyError('INSUFFICIENT_FUNDS', `${l.account} lacks ${l.currency}`);
    for (const l of legs) { this.bal(l.account, l.currency).available += l.amount; const e = { txId: key, account: l.account, currency: l.currency, amount: l.amount, reason, ts }; this.entries.push(e); this.dirty.add(l.account); if (this.trackPending) this.pending.push(e); }
    this.applied.add(key);
    if (this.entries.length > 5000) this.entries.splice(0, this.entries.length - 5000);
    return key;
  }
  mint(account: string, c: Currency, amount: bigint, reason: string, key?: string) { if (amount <= 0n) return; this.post([{ account: `system:mint:${reason}`, currency: c, amount: -amount }, { account, currency: c, amount }], reason, key); }
  burn(account: string, c: Currency, amount: bigint, reason: string, key?: string) { if (amount <= 0n) return; this.post([{ account, currency: c, amount: -amount }, { account: `system:burn:${reason}`, currency: c, amount }], reason, key); }
  transfer(from: string, to: string, c: Currency, amount: bigint, reason: string, key?: string) { this.post([{ account: from, currency: c, amount: -amount }, { account: to, currency: c, amount }], reason, key); }
  /** Move available → reserved (escrow) without leaving the account. */
  reserve(account: string, c: Currency, amount: bigint) { this.dirty.add(account); const b = this.bal(account, c); if (amount < 0n || b.available < amount) throw new EconomyError('INSUFFICIENT_FUNDS'); b.available -= amount; b.reserved += amount; }
  release(account: string, c: Currency, amount: bigint) { this.dirty.add(account); const b = this.bal(account, c); if (amount < 0n || b.reserved < amount) throw new EconomyError('RESERVATION_MISMATCH'); b.reserved -= amount; b.available += amount; }
  /** Settle from reserved funds directly to another account (escrowed payment). */
  settleReserved(from: string, legs: { to: string; amount: bigint }[], c: Currency, reason: string, key?: string) {
    const total = legs.reduce((s, l) => s + l.amount, 0n);
    const b = this.bal(from, c); if (b.reserved < total) throw new EconomyError('RESERVATION_MISMATCH');
    b.reserved -= total; b.available += total; // unreserve then post atomically (single-threaded)
    try { this.post([{ account: from, currency: c, amount: -total }, ...legs.map((l) => ({ account: l.to, currency: c, amount: l.amount }))], reason, key); }
    catch (e) { b.available -= total; b.reserved += total; throw e; }
  }
  /** Invariant check used by tests and admin reconciliation: every txId sums to 0 per currency, no player negative. */
  verify(): { ok: boolean; problems: string[] } {
    const problems: string[] = []; const tx = new Map<string, bigint>();
    for (const e of this.entries) { const k = `${e.txId}|${e.currency}`; tx.set(k, (tx.get(k) ?? 0n) + e.amount); }
    for (const [k, v] of tx) if (v !== 0n) problems.push(`unbalanced ${k}`);
    for (const [acc, m] of this.balances) if (!acc.startsWith('system:')) for (const [c, b] of m) if (b.available < 0n || b.reserved < 0n) problems.push(`negative ${acc} ${c}`);
    return { ok: problems.length === 0, problems };
  }
  /** Faucet/sink analytics (§38). */
  flows(): { currency: Currency; minted: bigint; burned: bigint }[] {
    const out = new Map<Currency, { minted: bigint; burned: bigint }>();
    for (const e of this.entries) { const o = out.get(e.currency) ?? { minted: 0n, burned: 0n }; if (e.account.startsWith('system:mint:')) o.minted += -e.amount; if (e.account.startsWith('system:burn:')) o.burned += e.amount; out.set(e.currency, o); }
    return [...out].map(([currency, v]) => ({ currency, ...v }));
  }
  serialize(): any { return { b: [...this.balances].map(([a, m]) => [a, [...m].map(([c, v]) => [c, v.available.toString(), v.reserved.toString()])]), e: this.entries.slice(-500).map((x) => ({ ...x, amount: x.amount.toString() })), k: [...this.applied].slice(-2000), s: this.seq }; }
  static deserialize(o: any): Ledger {
    const l = new Ledger(); if (!o) return l;
    for (const [a, arr] of o.b ?? []) for (const [c, av, rv] of arr) { const b = l.bal(a, c); b.available = BigInt(av); b.reserved = BigInt(rv); }
    l.entries = (o.e ?? []).map((x: any) => ({ ...x, amount: BigInt(x.amount) })); l.applied = new Set(o.k ?? []); l.seq = o.s ?? 0; return l;
  }
}

export function feeOf(amount: bigint, bps: number): bigint { return (amount * BigInt(bps)) / 10000n; } // floor rounding, documented in TRANSACTION_RULES

// ---------------- Order book (§37) ----------------
export interface Order { id: string; owner: string; side: 'buy' | 'sell'; price: bigint; qty: bigint; filled: bigint; ts: number; seq: number; status: 'open' | 'filled' | 'cancelled' }
export interface Fill { buyOrder: string; sellOrder: string; buyer: string; seller: string; price: bigint; qty: bigint; ts: number }
export class OrderBook {
  bids: Order[] = []; asks: Order[] = []; trades: Fill[] = []; private seq = 0;
  constructor(public selfTradePrevention = true) {}
  /** Limit order matching at resting price; price-time priority. Returns fills; remainder rests. */
  place(o: Omit<Order, 'filled' | 'seq' | 'status'>): { order: Order; fills: Fill[] } {
    if (o.qty <= 0n || o.price <= 0n) throw new EconomyError('INVALID_ORDER');
    const order: Order = { ...o, filled: 0n, seq: ++this.seq, status: 'open' };
    const fills: Fill[] = [];
    const book = order.side === 'buy' ? this.asks : this.bids;
    while (order.filled < order.qty && book.length) {
      const best = book[0]!;
      const crosses = order.side === 'buy' ? best.price <= order.price : best.price >= order.price;
      if (!crosses) break;
      if (this.selfTradePrevention && best.owner === order.owner) { best.status = 'cancelled'; book.shift(); continue; }
      const q = minB(order.qty - order.filled, best.qty - best.filled);
      order.filled += q; best.filled += q;
      const f: Fill = { buyOrder: order.side === 'buy' ? order.id : best.id, sellOrder: order.side === 'sell' ? order.id : best.id, buyer: order.side === 'buy' ? order.owner : best.owner, seller: order.side === 'sell' ? order.owner : best.owner, price: best.price, qty: q, ts: o.ts };
      fills.push(f); this.trades.push(f);
      if (best.filled === best.qty) { best.status = 'filled'; book.shift(); }
    }
    if (order.filled === order.qty) order.status = 'filled';
    else { const own = order.side === 'buy' ? this.bids : this.asks; own.push(order); this.sort(); }
    return { order, fills };
  }
  cancel(id: string, owner: string): Order | null {
    for (const book of [this.bids, this.asks]) { const i = book.findIndex((x) => x.id === id && x.owner === owner); if (i >= 0) { const [o] = book.splice(i, 1); o!.status = 'cancelled'; return o!; } }
    return null;
  }
  private sort() { this.bids.sort((a, b) => (b.price === a.price ? a.seq - b.seq : b.price > a.price ? 1 : -1)); this.asks.sort((a, b) => (a.price === b.price ? a.seq - b.seq : a.price > b.price ? 1 : -1)); }
  depth(levels = 8) {
    const agg = (arr: Order[]) => { const m = new Map<string, bigint>(); for (const o of arr) m.set(o.price.toString(), (m.get(o.price.toString()) ?? 0n) + o.qty - o.filled); return [...m].slice(0, levels).map(([p, q]) => ({ price: BigInt(p), qty: q })); };
    return { bids: agg(this.bids), asks: agg(this.asks) };
  }
}
const minB = (a: bigint, b: bigint) => (a < b ? a : b);

// ---------------- Auction (§36) ----------------
export interface Auction { id: string; seller: string; itemUid: string; itemDefId: string; start: bigint; buyNow: bigint | null; current: bigint; bidder: string | null; endsAt: number; status: 'active' | 'sold' | 'expired' | 'bought'; bids: { bidder: string; amount: bigint; ts: number }[] }
export function minNextBid(a: Auction, incBps: number): bigint { return a.bidder ? a.current + maxB(1n, feeOf(a.current, incBps)) : a.start; }
const maxB = (a: bigint, b: bigint) => (a > b ? a : b);
/** Place bid: reserves bidder funds, refunds previous bidder (outbid). Anti-snipe extension. */
export function placeBid(ledger: Ledger, a: Auction, bidder: string, amount: bigint, now: number, incBps: number, antiSnipeMs: number) {
  if (a.status !== 'active' || now >= a.endsAt) throw new EconomyError('AUCTION_CLOSED');
  if (bidder === a.seller) throw new EconomyError('SELF_BID');
  if (amount < minNextBid(a, incBps)) throw new EconomyError('BID_TOO_LOW');
  ledger.reserve(bidder, 'gold', amount);
  if (a.bidder) ledger.release(a.bidder, 'gold', a.current);
  a.current = amount; a.bidder = bidder; a.bids.push({ bidder, amount, ts: now });
  if (a.endsAt - now < antiSnipeMs) a.endsAt = now + antiSnipeMs;
}
/** Settle exactly once: winner pays from reservation, seller receives minus fee (sink). */
export function settleAuction(ledger: Ledger, a: Auction, now: number, feeBps: number): 'sold' | 'expired' | null {
  if (a.status !== 'active' || now < a.endsAt) return null;
  if (!a.bidder) { a.status = 'expired'; return 'expired'; }
  const fee = feeOf(a.current, feeBps);
  ledger.settleReserved(a.bidder, [{ to: a.seller, amount: a.current - fee }, { to: 'system:burn:auction_fee', amount: fee }], 'gold', 'auction_settle', `auction:${a.id}`);
  a.status = 'sold'; return 'sold';
}
