/** Deterministic seeded RNG (sfc32). Server-authoritative in online mode; local in artifact mode. */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;
  constructor(seed: number | number[] = Date.now()) {
    const s = Array.isArray(seed) ? seed : [seed ^ 0xdeadbeef, seed * 2654435761, seed ^ 0x9e3779b9, (seed >>> 3) ^ 0x85ebca6b];
    this.a = s[0]! >>> 0; this.b = s[1]! >>> 0; this.c = s[2]! >>> 0; this.d = s[3]! >>> 0;
    for (let i = 0; i < 15; i++) this.next();
  }
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]!; }
  weighted<T extends { weight: number }>(arr: readonly T[]): T {
    const total = arr.reduce((s, x) => s + x.weight, 0);
    let r = this.next() * total;
    for (const x of arr) { r -= x.weight; if (r < 0) return x; }
    return arr[arr.length - 1]!;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j]!, arr[i]!]; }
    return arr;
  }
  getState(): number[] { return [this.a, this.b, this.c, this.d]; }
  static fromState(s: number[]): Rng { const r = new Rng(0); r.a = s[0]!; r.b = s[1]!; r.c = s[2]!; r.d = s[3]!; return r; }
}

let uidCounter = 0;
export function uid(prefix = 'id'): string {
  uidCounter = (uidCounter + 1) % 1e9;
  return `${prefix}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
/** Unpredictable RNG for random rewards on the server (gacha, card packs): every draw comes from `source` (e.g. crypto.randomInt). */
export class SecureRng extends Rng { private source?: () => number; constructor(source: () => number) { super(1); this.source = source; } override next(): number { return this.source ? this.source() : super.next(); } } // super() warms up via next() before source is set
