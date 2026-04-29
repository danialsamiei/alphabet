/**
 * @module privacy-wasm/anonymity-set
 * @description
 * `AnonymitySet` — a **counting Bloom filter** + a **k-anonymity gate**.
 *
 * Goal: let a consumer answer "have I seen at least `k` distinct visitors
 * with this attribute combination?" *without* storing any visitor ids.
 *
 * Why counting (vs. classical) Bloom filter? Classical filters are
 * insert-only. We need to support *expiry windows* (visitors leaving a
 * cohort after their session ends) so each bucket holds a small counter
 * (4 bits) that can be decremented. False positives still occur — that
 * is what makes it a privacy primitive: the set never reveals an *exact*
 * count.
 *
 * Hashing: by default we use the WebCrypto SHA-256 (`sha256`) and split
 * the 256-bit digest into `numHashes` independent indices. Consumers
 * may inject a faster hasher via `hashFn` — typically the BLAKE3 WASM
 * one from `loadBlake3Wasm()` once it is registered.
 *
 * Privacy posture:
 *   - The internal counters are bounded → no monotonic profile build-up.
 *   - The filter does not store any input bytes — only counter increments.
 *   - The k-gate exposes only `{passed: boolean}` to the caller.
 */

import { sha256 } from './hash.js';

const BITS_PER_COUNTER = 4;
const COUNTER_MAX = (1 << BITS_PER_COUNTER) - 1;
const COUNTERS_PER_BYTE = 8 / BITS_PER_COUNTER;

export interface AnonymitySetOptions {
  /** Total number of counters (≥ 64). Default 4 096. */
  readonly size?: number;
  /** Number of hash functions (1–8). Default 4. */
  readonly numHashes?: number;
  /** Required minimum count for `gate(k)`. Default 5. */
  readonly k?: number;
  /** Optional injected synchronous hasher; defaults to async `sha256`. */
  readonly hashFn?: (input: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}

export class AnonymitySet {
  private readonly size: number;
  private readonly numHashes: number;
  private readonly k: number;
  private readonly hashFn: (input: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  /** Packed 4-bit counters; `size` counters total. */
  private readonly counters: Uint8Array;
  private inserted = 0;

  constructor(options: AnonymitySetOptions = {}) {
    this.size = Math.max(64, options.size ?? 4_096);
    this.numHashes = Math.min(8, Math.max(1, options.numHashes ?? 4));
    this.k = Math.max(1, options.k ?? 5);
    this.hashFn = options.hashFn ?? sha256;
    const bytes = Math.ceil(this.size / COUNTERS_PER_BYTE);
    this.counters = new Uint8Array(bytes);
  }

  /** Number of counters (size of the filter). */
  capacity(): number {
    return this.size;
  }

  /** Number of (saturated) inserts performed. */
  insertedCount(): number {
    return this.inserted;
  }

  /**
   * Add `key` to the set, incrementing all `numHashes` counters
   * (saturating at COUNTER_MAX). `key` is hashed once; we derive the
   * `numHashes` indices from non-overlapping slices of the digest.
   */
  async add(key: string | Uint8Array): Promise<void> {
    const idxs = await this.indicesOf(key);
    for (const i of idxs) this.bump(i, +1);
    this.inserted += 1;
  }

  /**
   * Remove `key` from the set. Decrements counters (saturating at 0).
   * False-positives in the original `add` may cause a `remove` to also
   * affect unrelated cohorts — this is inherent to counting Bloom
   * filters and acceptable for the anonymity-set use case.
   */
  async remove(key: string | Uint8Array): Promise<void> {
    const idxs = await this.indicesOf(key);
    for (const i of idxs) this.bump(i, -1);
  }

  /**
   * Estimated count for `key`. Lower bound — the true count is at most
   * the minimum of the `numHashes` counters.
   */
  async estimate(key: string | Uint8Array): Promise<number> {
    const idxs = await this.indicesOf(key);
    let min = COUNTER_MAX;
    for (const i of idxs) {
      const v = this.read(i);
      if (v < min) min = v;
    }
    return min;
  }

  /**
   * **k-anonymity gate.** Returns `true` iff the estimated count for
   * `key` is ≥ `k` (defaults to the gate's configured `k`). This is the
   * primary public API for callers wanting "have I seen enough peers".
   */
  async gate(key: string | Uint8Array, kOverride?: number): Promise<boolean> {
    const k = Math.max(1, kOverride ?? this.k);
    const est = await this.estimate(key);
    return est >= k;
  }

  /** Reset all counters and the insert tally. */
  reset(): void {
    this.counters.fill(0);
    this.inserted = 0;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async indicesOf(key: string | Uint8Array): Promise<readonly number[]> {
    const bytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const digest = await this.hashFn(bytes);
    const out: number[] = [];
    // We need 4 bytes per index. SHA-256 gives 32 bytes → up to 8 indices.
    for (let h = 0; h < this.numHashes; h += 1) {
      const o = (h * 4) % digest.length;
      const u32 =
        ((digest[o] as number) |
          ((digest[(o + 1) % digest.length] as number) << 8) |
          ((digest[(o + 2) % digest.length] as number) << 16) |
          ((digest[(o + 3) % digest.length] as number) << 24)) >>>
        0;
      out.push(u32 % this.size);
    }
    return out;
  }

  private read(idx: number): number {
    const byte = idx >>> 1;
    const isHigh = (idx & 1) === 1;
    const v = this.counters[byte] as number;
    return isHigh ? (v >> 4) & 0x0f : v & 0x0f;
  }

  private write(idx: number, v: number): void {
    const byte = idx >>> 1;
    const isHigh = (idx & 1) === 1;
    const cur = this.counters[byte] as number;
    const clamped = Math.max(0, Math.min(COUNTER_MAX, v));
    if (isHigh) {
      this.counters[byte] = (cur & 0x0f) | ((clamped & 0x0f) << 4);
    } else {
      this.counters[byte] = (cur & 0xf0) | (clamped & 0x0f);
    }
  }

  private bump(idx: number, delta: number): void {
    const cur = this.read(idx);
    this.write(idx, cur + delta);
  }
}
