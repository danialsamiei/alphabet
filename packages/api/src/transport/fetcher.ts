/**
 * @module transport/fetcher
 * @description
 * The {@link Fetcher} interface is the single seam between `AwafClient` and
 * the underlying HTTP transport. By depending on this interface rather than
 * `globalThis.fetch` directly, we get three things for free:
 *
 * 1. **Testability.** Unit tests inject a deterministic `Fetcher` and never
 *    need to mock the global.
 * 2. **Pluggability.** A consumer can wrap the default fetcher with auth
 *    refresh, telemetry, or service-mesh routing without forking the client.
 * 3. **Mock-server interop.** `@awaf/api/mock` exposes a `Fetcher` that
 *    routes requests in-process — no `globalThis` patching required.
 *
 * The interface is intentionally minimal: one `request(input, init)` method
 * that returns the same `Promise<Response>` contract as `fetch`. Everything
 * else (retry, rate-limit parsing, idempotency keys) is layered **above**
 * this interface as decorators.
 */

/**
 * Minimal HTTP transport contract used by the AWAF SDK.
 *
 * Conforms to the relevant subset of the WHATWG Fetch API; an
 * implementation backed directly by `globalThis.fetch` is provided as
 * {@link defaultFetcher}.
 */
export interface Fetcher {
  /**
   * Execute a single HTTP request. MUST behave like `globalThis.fetch`:
   * - Resolve with a `Response` for any HTTP status (including 4xx/5xx).
   * - Reject only on network failure or `AbortSignal` abort.
   * - Honor `init.signal` for cancellation.
   */
  request(input: string, init: RequestInit): Promise<Response>;
}

/**
 * Compose two `AbortSignal`s into one that aborts when either does.
 * If `secondary` is undefined, returns `primary` unchanged.
 *
 * @param primary - The main signal (typically per-request timeout).
 * @param secondary - Optional caller-supplied signal.
 * @returns A composite signal.
 */
export function composeSignals(
  primary: AbortSignal,
  secondary: AbortSignal | undefined,
): AbortSignal {
  if (secondary === undefined) return primary;
  if (typeof (AbortSignal as unknown as { any?: unknown }).any === 'function') {
    return (AbortSignal as unknown as {
      any: (signals: AbortSignal[]) => AbortSignal;
    }).any([primary, secondary]);
  }
  // Fallback for Node 18 / older runtimes lacking AbortSignal.any.
  const controller = new AbortController();
  const onAbort = (reason: unknown): void => {
    controller.abort(reason);
  };
  if (primary.aborted) {
    controller.abort((primary as unknown as { reason?: unknown }).reason);
  } else {
    primary.addEventListener('abort', () => onAbort((primary as unknown as { reason?: unknown }).reason), { once: true });
  }
  if (secondary.aborted) {
    controller.abort((secondary as unknown as { reason?: unknown }).reason);
  } else {
    secondary.addEventListener('abort', () => onAbort((secondary as unknown as { reason?: unknown }).reason), { once: true });
  }
  return controller.signal;
}

/**
 * Default {@link Fetcher} that delegates to `globalThis.fetch`. Pure pass-through.
 */
export const defaultFetcher: Fetcher = {
  request(input, init) {
    return fetch(input, init);
  },
};
