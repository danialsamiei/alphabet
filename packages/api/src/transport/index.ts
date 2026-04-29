/**
 * @module transport
 * @description
 * Internal transport primitives for `@alphabet/api`.
 *
 * The public `AlphabetClient` accepts an optional `TransportPolicy` that wraps
 * its underlying {@link Fetcher} with retry, rate-limit visibility, and
 * idempotency-key auto-generation. None of these primitives are exported
 * at the package root in PR-1 — they are reachable via the dedicated
 * `@alphabet/api/transport` subpath for advanced consumers, but the default
 * public surface remains the existing `AlphabetClient` class.
 */

export { defaultFetcher, composeSignals } from './fetcher.js';
export type { Fetcher } from './fetcher.js';

export {
  withRetry,
  decorrelatedJitter,
  isRetriableStatus,
  NetworkError,
  DEFAULT_RETRY_POLICY,
} from './retry.js';
export type { RetryPolicy } from './retry.js';

export { parseRateLimit, parseRetryAfterMs } from './rate-limit.js';
export type { RateLimitInfo } from './rate-limit.js';

export {
  generateIdempotencyKey,
  isUnsafeMethod,
  withIdempotencyKey,
} from './idempotency.js';
