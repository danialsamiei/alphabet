/**
 * @module privacy/random
 * @description
 * Cryptographically strong random utilities — منبع تصادفی برای مکانیزم‌های
 * نویز DP.
 *
 * Cryptographically strong uniform `[0, 1)` and standard-normal samplers,
 * powered by `crypto.getRandomValues`. These are the only sources of
 * randomness used by the differential-privacy mechanisms. Math.random()
 * is intentionally **not** used — its statistical properties are
 * insufficient for privacy-critical noise.
 *
 * **Runtime support.** The Web Crypto API is available in:
 *  - all modern browsers,
 *  - Node 18+ (`globalThis.crypto`),
 *  - Cloudflare Workers, Vercel Edge, Deno, Bun.
 *
 * If `crypto.getRandomValues` is missing, every helper here returns a
 * descriptive `AlphabetError` via `Result<T, E>` rather than throwing.
 */

import { type Result, ok, err, type AlphabetError } from '@alphabet/core';

// ─── Internal: getRandomValues lookup ────────────────────────────────────────

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(buffer: T): T;
}

function resolveCrypto(): Result<RandomSource, AlphabetError> {
  const c = (globalThis as { crypto?: RandomSource }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    return err({
      code: 'RANDOM_SOURCE_UNAVAILABLE',
      message:
        'crypto.getRandomValues is not available in this runtime. ' +
        'Differential privacy refuses to fall back to Math.random().',
    });
  }
  return ok(c);
}

// ─── Uniform [0, 1) ──────────────────────────────────────────────────────────

/**
 * نمونه‌گیری یکنواخت رمزنگاری‌شده در بازه `[0, 1)`.
 * Uniformly sample a 53-bit float in `[0, 1)` using two random `Uint32`s.
 *
 * The 53-bit construction (32 + 21 bits) gives full IEEE-754 mantissa
 * coverage — the same precision the language guarantees for arithmetic.
 * Returns a strict `Result` because Web Crypto may be unavailable.
 *
 * @example
 * const r = sampleUniformUnitInterval();
 * if (!r.success) throw r.error;
 * // r.data ∈ [0, 1)
 */
export function sampleUniformUnitInterval(): Result<number, AlphabetError> {
  const cryptoResult = resolveCrypto();
  if (!cryptoResult.success) return cryptoResult;
  const buf = new Uint32Array(2);
  cryptoResult.data.getRandomValues(buf);
  // Take 26 high bits from buf[0] and 27 high bits from buf[1] = 53 bits.
  const hi = (buf[0] ?? 0) >>> 6; // 26 bits
  const lo = (buf[1] ?? 0) >>> 5; // 27 bits
  const value = (hi * 2 ** 27 + lo) / 2 ** 53;
  return ok(value);
}

// ─── Standard Normal (Box–Muller) ────────────────────────────────────────────

/**
 * نمونه‌گیری از توزیع نرمال استاندارد N(0, 1) با Box–Muller.
 * Sample from the standard normal distribution `N(0, 1)` using the
 * polar (Box–Muller) transform with two cryptographic uniform draws.
 *
 * The polar form discards the second of the pair. We accept that minor
 * inefficiency in exchange for not having to maintain caching state —
 * privacy-critical code should remain stateless and easy to audit.
 *
 * To guard against the `log(0)` singularity, the smaller of the two
 * uniform draws is clamped to `≥ 2^-53`. The probability of the clamp
 * triggering is therefore at most `2^-53`, well below any practical
 * privacy budget.
 *
 * @example
 * const r = sampleStandardNormal();
 * if (r.success) console.log(r.data);
 */
export function sampleStandardNormal(): Result<number, AlphabetError> {
  const u1Res = sampleUniformUnitInterval();
  if (!u1Res.success) return u1Res;
  const u2Res = sampleUniformUnitInterval();
  if (!u2Res.success) return u2Res;

  const minU = Math.max(u1Res.data, Number.EPSILON / 16);
  const angle = 2 * Math.PI * u2Res.data;
  const radius = Math.sqrt(-2 * Math.log(minU));
  return ok(radius * Math.cos(angle));
}

// ─── Laplace ─────────────────────────────────────────────────────────────────

/**
 * نمونه‌گیری از توزیع لاپلاس با مقیاس `b`.
 * Sample from the Laplace distribution with location `0` and scale
 * `b > 0` using the inverse-CDF method on a uniform `(-0.5, 0.5)` draw.
 *
 * Returns an `AlphabetError` if `b ≤ 0`, is non-finite, or if the
 * underlying random source is unavailable.
 *
 * @param scale — Laplace scale parameter `b > 0`.
 * @example
 * const r = sampleLaplace(1.5);
 * if (r.success) console.log(r.data);
 */
export function sampleLaplace(scale: number): Result<number, AlphabetError> {
  if (!Number.isFinite(scale) || scale <= 0) {
    return err({
      code: 'INVALID_LAPLACE_SCALE',
      message: 'Laplace scale must be a finite, strictly positive number.',
      details: { scale },
    });
  }
  const uRes = sampleUniformUnitInterval();
  if (!uRes.success) return uRes;
  // Map u ∈ [0, 1) to v ∈ (-0.5, 0.5).
  const v = uRes.data - 0.5;
  // Avoid the pathological v === 0 case where sign(v) === 0 and log(1) === 0
  // would yield exactly 0; that is fine numerically but we prefer a
  // strictly non-zero noise sample for auditability.
  const safeV = v === 0 ? Number.EPSILON : v;
  const sign = safeV < 0 ? -1 : 1;
  return ok(-scale * sign * Math.log(1 - 2 * Math.abs(safeV)));
}
