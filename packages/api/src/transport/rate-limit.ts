/**
 * @module transport/rate-limit
 * @description
 * Parsers for HTTP rate-limit headers used by AWAF and most modern APIs.
 *
 * Supports:
 * - `Retry-After`: both delta-seconds and HTTP-date forms (RFC 7231 §7.1.3).
 * - `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`:
 *   the GitHub-style convention. `X-RateLimit-Reset` is interpreted as an
 *   epoch-seconds timestamp (matches GitHub) and falls back to delta-seconds
 *   if the value is small (< 86400) — matches Cloudflare/Vercel behavior.
 *
 * All functions are pure and return `undefined` for malformed/missing headers
 * — never throw.
 */

/**
 * Snapshot of rate-limit state derived from response headers. All fields
 * are optional because servers vary widely in which headers they emit.
 */
export interface RateLimitInfo {
  /** Total request budget per window. */
  readonly limit?: number;
  /** Remaining request budget. */
  readonly remaining?: number;
  /** Epoch-seconds timestamp at which the window resets. */
  readonly resetEpochSec?: number;
  /** Suggested wait time in ms before the next request. */
  readonly retryAfterMs?: number;
}

/**
 * Parse `Retry-After` into a wait-duration in milliseconds.
 *
 * @param headers - The `Headers` object from a `Response`.
 * @returns Wait time in ms, or `undefined` if the header is missing/malformed.
 */
export function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (raw === null || raw === '') return undefined;

  // Delta-seconds form.
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000);
  }

  // HTTP-date form.
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const now = Date.now();
    const delta = asDate - now;
    return delta > 0 ? delta : 0;
  }

  return undefined;
}

/**
 * Parse the canonical X-RateLimit-* triplet plus `Retry-After`.
 * Returns an empty object when no rate-limit headers are present.
 */
export function parseRateLimit(headers: Headers): RateLimitInfo {
  const out: {
    limit?: number;
    remaining?: number;
    resetEpochSec?: number;
    retryAfterMs?: number;
  } = {};

  const limit = headers.get('X-RateLimit-Limit');
  if (limit !== null) {
    const n = Number(limit);
    if (Number.isFinite(n)) out.limit = n;
  }

  const remaining = headers.get('X-RateLimit-Remaining');
  if (remaining !== null) {
    const n = Number(remaining);
    if (Number.isFinite(n)) out.remaining = n;
  }

  const reset = headers.get('X-RateLimit-Reset');
  if (reset !== null) {
    const n = Number(reset);
    if (Number.isFinite(n) && n >= 0) {
      // Heuristic: large numbers are epoch-seconds (post-2001), small ones
      // are delta-seconds from now (Cloudflare/Vercel style).
      if (n >= 1_000_000_000) {
        out.resetEpochSec = n;
      } else {
        out.resetEpochSec = Math.floor(Date.now() / 1000) + n;
      }
    }
  }

  const retry = parseRetryAfterMs(headers);
  if (retry !== undefined) {
    out.retryAfterMs = retry;
  }

  return out;
}
