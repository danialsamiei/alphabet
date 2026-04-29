/**
 * @module transport/retry
 * @description
 * Exponential-backoff retry with **decorrelated jitter** (Marsaglia-style),
 * built on top of the {@link Fetcher} interface. Decorrelated jitter is the
 * AWS-recommended algorithm because it avoids the thundering-herd problem of
 * "full jitter" while still bounding worst-case latency well under straight
 * exponential backoff.
 *
 * The recurrence is:
 *
 *     sleep_n = min(cap, random_between(base, sleep_{n-1} * 3))
 *
 * The retry decision tree is:
 * - **AbortError** from the caller's signal → propagate immediately, no retry.
 * - **Network error** (fetch threw) → retry, up to `maxRetries`.
 * - **HTTP 5xx** → retry.
 * - **HTTP 429** → retry, but if `Retry-After` is present, sleep for at least
 *   that long (clamped by `cap`).
 * - **Anything else (1xx/2xx/3xx/4xx)** → return the response unchanged.
 *
 * Idempotency is the caller's concern; see `./idempotency.ts`.
 */

import { type Fetcher } from './fetcher.js';
import { parseRetryAfterMs } from './rate-limit.js';

/**
 * Configuration for {@link withRetry}. All fields have safe defaults.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (does not count the initial try). Default: 2. */
  readonly maxRetries: number;
  /** Base delay in ms for the first retry. Default: 100ms. */
  readonly baseDelayMs: number;
  /** Cap delay in ms (no single sleep exceeds this). Default: 5000ms. */
  readonly maxDelayMs: number;
  /** PRNG returning a uniform value in `[0, 1)`. Defaults to `Math.random`. */
  readonly random?: () => number;
  /** Sleep function. Defaults to `setTimeout`. Replaced in tests for determinism. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Default retry policy. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 100,
  maxDelayMs: 5_000,
};

/**
 * Decorrelated jitter step. Pure; safe to test independently.
 *
 * @param previousSleepMs - The previous sleep duration (for the first retry, pass `baseDelayMs`).
 * @param baseDelayMs     - The base delay parameter.
 * @param maxDelayMs      - The cap.
 * @param random          - PRNG returning `[0, 1)`.
 * @returns Next sleep duration in ms.
 */
export function decorrelatedJitter(
  previousSleepMs: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const upper = Math.max(baseDelayMs, previousSleepMs * 3);
  // Uniform in [base, upper), then clamp by cap.
  const candidate = baseDelayMs + random() * (upper - baseDelayMs);
  return Math.min(maxDelayMs, Math.max(0, Math.round(candidate)));
}

/**
 * Should this {@link Response} be retried?
 *
 * The rule is conservative on purpose: only 5xx and 429 are retried. 408
 * (Request Timeout) is retried because it indicates a transient server-side
 * timeout.
 */
export function isRetriableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

/** Sentinel error indicating a network-level failure (vs. an HTTP error). */
export class NetworkError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(
      cause instanceof Error
        ? `Network error: ${cause.message}`
        : 'Network error',
    );
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Wrap a {@link Fetcher} with retry + decorrelated jitter behavior.
 *
 * The returned `Fetcher` honors `init.signal` cancellation between attempts
 * (no extra retries are issued once the caller aborts) and on network
 * errors (re-throws if the cause is `AbortError`).
 *
 * @example
 * const fetcher = withRetry(defaultFetcher, { maxRetries: 3, baseDelayMs: 50 });
 */
export function withRetry(
  fetcher: Fetcher,
  policy: Partial<RetryPolicy> = {},
): Fetcher {
  const cfg: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
  const random = cfg.random ?? Math.random;
  const sleep = cfg.sleep ?? defaultSleep;

  return {
    async request(input, init) {
      let attempt = 0;
      let previousSleepMs = cfg.baseDelayMs;

      // First try.
      // We loop attempt=0..maxRetries inclusive (so up to maxRetries+1 calls).
       
      while (true) {
        if (init.signal?.aborted === true) {
          throw new DOMException(
            'Request aborted before dispatch',
            'AbortError',
          );
        }

        let response: Response | undefined;
        let networkErr: unknown;
        try {
          response = await fetcher.request(input, init);
        } catch (e) {
          if (
            e instanceof DOMException && e.name === 'AbortError'
          ) {
            throw e;
          }
          if (
            (e as { name?: string } | undefined)?.name === 'AbortError'
          ) {
            throw e;
          }
          networkErr = e;
        }

        if (response !== undefined && !isRetriableStatus(response.status)) {
          return response;
        }

        if (attempt >= cfg.maxRetries) {
          if (response !== undefined) return response;
          throw new NetworkError(networkErr);
        }

        // Compute sleep for the next attempt.
        let waitMs = decorrelatedJitter(
          previousSleepMs,
          cfg.baseDelayMs,
          cfg.maxDelayMs,
          random,
        );
        // Honor Retry-After if present.
        if (response !== undefined) {
          const ra = parseRetryAfterMs(response.headers);
          if (ra !== undefined) {
            waitMs = Math.min(cfg.maxDelayMs, Math.max(waitMs, ra));
          }
        }
        previousSleepMs = waitMs;
        attempt += 1;
        await sleep(waitMs);
      }
    },
  };
}
