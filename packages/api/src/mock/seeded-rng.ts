/**
 * @module mock/seeded-rng
 * @description
 * `xoshiro128**` — a tiny, fast, statistically-respectable PRNG used by
 * the in-process mock server to produce **deterministic** responses. Same
 * seed → same byte-for-byte response, every time. This is what makes
 * mock-driven CI flake-free.
 *
 * Reference: https://prng.di.unimi.it/xoshiro128starstar.c
 *
 * State is four 32-bit words; period 2^128 - 1; passes BigCrush.
 *
 * NOT cryptographically secure — never use this for security purposes.
 */

/** A seeded PRNG returning uniform values. */
export interface SeededRng {
  /** Uniform `[0, 1)` double. */
  next(): number;
  /** Uniform integer in `[min, max)`. */
  nextInt(min: number, max: number): number;
  /** Pick one element of an array uniformly. */
  pick<T>(arr: readonly T[]): T;
  /** Reset to the initial seed. */
  reset(): void;
  /** Snapshot the current state (for branching tests). */
  state(): [number, number, number, number];
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/**
 * Construct a deterministic {@link SeededRng}.
 *
 * @param seed - 32-bit unsigned seed. The same seed always produces the same sequence.
 */
export function createSeededRng(seed: number): SeededRng {
  const initialSeed = seed >>> 0;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;

  const seedState = (s: number): void => {
    const sm = splitmix32(s);
    s0 = sm();
    s1 = sm();
    s2 = sm();
    s3 = sm();
  };
  seedState(initialSeed);

  const nextU32 = (): number => {
    const result = (Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9)) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotl(s3, 11);
    return result;
  };

  return {
    next(): number {
      // Convert two 32-bit words to a 53-bit double in [0,1).
      const hi = nextU32() >>> 5; // 27 bits
      const lo = nextU32() >>> 6; // 26 bits
      return (hi * 0x4000000 + lo) / 2 ** 53;
    },
    nextInt(min: number, max: number): number {
      if (max <= min) throw new Error('nextInt: max must be > min');
      const range = max - min;
      // Unbiased rejection-free int from u32 — for small ranges this bias is negligible.
      return min + (nextU32() % range);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('pick: empty array');
      return arr[this.nextInt(0, arr.length)] as T;
    },
    reset(): void {
      seedState(initialSeed);
    },
    state(): [number, number, number, number] {
      return [s0, s1, s2, s3];
    },
  };
}
