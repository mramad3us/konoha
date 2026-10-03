/**
 * Seeded, serializable PRNG (sfc32). The only source of randomness in the simulation.
 */

export type RngState = [number, number, number, number];

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | RngState = 1) {
    if (Array.isArray(seed)) {
      [this.a, this.b, this.c, this.d] = seed;
    } else {
      // splitmix32 to spread a single seed over the state
      let s = seed >>> 0;
      const mix = () => {
        s = (s + 0x9e3779b9) >>> 0;
        let z = s;
        z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
        z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
        return (z ^ (z >>> 16)) >>> 0;
      };
      this.a = mix(); this.b = mix(); this.c = mix(); this.d = mix();
      for (let i = 0; i < 12; i++) this.nextU32();
    }
  }

  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick: weights need not sum to 1. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, w);
    let roll = this.next() * total;
    for (const [v, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return v;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Derive an independent generator (e.g. for map generation) without disturbing this one's sequence much. */
  fork(): Rng {
    return new Rng([this.nextU32(), this.nextU32(), this.nextU32(), this.nextU32()]);
  }

  get state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }
}

/** Stateless deterministic hash of two ints → [0, 2^31). For visual variation, never for gameplay. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 0x7fffffff;
}

/** Hash a string to a 32-bit seed. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
