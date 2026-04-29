/**
 * @module mock/server
 * @description
 * In-process Alphabet mock server.
 *
 * Implements all 16 Alphabet endpoints with **deterministic** responses
 * (seeded RNG) and a Fetcher-compatible `dispatch(input, init)` method.
 * No external dependencies. No `globalThis` patching by default — opt
 * into that via {@link installFetchShim} for end-to-end demos.
 *
 * @example
 * import { createMockServer } from '@alphabet/api/mock';
 * import { withRetry } from '@alphabet/api/transport';
 *
 * const mock = createMockServer({ seed: 42 });
 * const fetcher = withRetry(mock); // mock implements Fetcher
 * const res = await fetcher.request('/api/alphabet/v1/context/handshake', {
 *   method: 'POST',
 *   body: JSON.stringify({ language: 'en' }),
 * });
 * // res.json() returns a deterministic AlphabetResponse envelope
 */

import { ALPHABET_ROUTES, API_VERSION_PREFIX, LEGACY_API_PREFIX } from '@alphabet/core';
import type { Fetcher } from '../transport/fetcher.js';
import { type SeededRng, createSeededRng } from './seeded-rng.js';
import {
  type RouteHandler,
  type MockHandlerContext,
  routeHandlers,
} from './handlers/index.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Configuration for {@link createMockServer}. */
export interface MockServerOptions {
  /** PRNG seed; same seed → same responses. Default: `1`. */
  readonly seed?: number;
  /** Artificial latency in ms applied to every response. Default: `0`. */
  readonly latencyMs?: number;
  /**
   * If set, the first N requests return the configured failure status. Used
   * by tests to exercise the retry path. After N calls, all responses are
   * normal.
   */
  readonly forceFailure?: {
    readonly failFirst: number;
    readonly status: number;
    readonly headers?: Record<string, string>;
  };
}

/** Handle to a running in-process mock server. */
export interface MockServerHandle extends Fetcher {
  /** Reset the seeded PRNG and request counters. */
  reset(): void;
  /** How many requests have been dispatched since last reset. */
  callCount(): number;
  /** Bypass the Fetcher interface (lower-level dispatch) for unit tests. */
  dispatch(input: string, init: RequestInit): Promise<Response>;
  /** The seeded PRNG, exposed for handler authors writing extensions. */
  rng: SeededRng;
}

// ─── Implementation ───────────────────────────────────────────────────────────

const NOT_FOUND_BODY = {
  requestId: 'req_mock_unknown',
  success: false,
  error: { code: 'NOT_FOUND', message: 'No mock handler for this route' },
  meta: { processingTimeMs: 0, respondedAt: '1970-01-01T00:00:00Z' },
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Resolve the Alphabet route key for a given URL path. Tolerates both the
 * canonical `/api/alphabet/v1` prefix and the legacy `/api` prefix so the
 * mock matches the same set of paths as `normalizeApiBaseUrl`.
 */
function resolveRoute(pathname: string): {
  key: keyof typeof ALPHABET_ROUTES;
  relative: string;
} | undefined {
  let relative = pathname;
  if (relative.startsWith(API_VERSION_PREFIX)) {
    relative = relative.slice(API_VERSION_PREFIX.length);
  } else if (relative.startsWith(`${LEGACY_API_PREFIX}/alphabet/v1`)) {
    // Defensive: nothing should generate this, but accept it.
    relative = relative.slice(`${LEGACY_API_PREFIX}/alphabet/v1`.length);
  } else if (relative.startsWith(LEGACY_API_PREFIX)) {
    relative = relative.slice(LEGACY_API_PREFIX.length);
  }
  if (relative === '' || !relative.startsWith('/')) {
    relative = `/${relative}`;
  }
  for (const [key, value] of Object.entries(ALPHABET_ROUTES)) {
    if (relative === value) {
      return { key: key as keyof typeof ALPHABET_ROUTES, relative: value };
    }
  }
  return undefined;
}

/** Compute the relative path of an absolute or origin-relative URL. */
function getPathname(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      return new URL(input).pathname;
    } catch {
      return input;
    }
  }
  if (input.startsWith('/')) {
    const q = input.indexOf('?');
    return q === -1 ? input : input.slice(0, q);
  }
  return input;
}

const sleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms));

/**
 * Create an in-process Alphabet mock server.
 *
 * The returned handle is a {@link Fetcher} (so it composes with `withRetry`
 * and friends) and also exposes lower-level `dispatch`, `reset`, `callCount`
 * methods for tests that want to assert on request counts.
 */
export function createMockServer(
  options: MockServerOptions = {},
): MockServerHandle {
  const seed = options.seed ?? 1;
  const latencyMs = options.latencyMs ?? 0;
  const forceFailure = options.forceFailure;
  const rng = createSeededRng(seed);
  let counter = 0;

  const dispatch = async (input: string, init: RequestInit): Promise<Response> => {
    counter += 1;
    if (latencyMs > 0) await sleep(latencyMs);

    if (
      forceFailure !== undefined &&
      forceFailure.failFirst > 0 &&
      counter <= forceFailure.failFirst
    ) {
      return new Response(
        JSON.stringify({
          requestId: `req_mock_fail_${counter}`,
          success: false,
          error: {
            code: 'MOCK_FORCED_FAILURE',
            message: `Forced failure on call #${counter}`,
          },
          meta: { processingTimeMs: 0, respondedAt: new Date(0).toISOString() },
        }),
        {
          status: forceFailure.status,
          headers: {
            'Content-Type': 'application/json',
            ...(forceFailure.headers ?? {}),
          },
        },
      );
    }

    const pathname = getPathname(input);
    const resolved = resolveRoute(pathname);
    if (resolved === undefined) {
      return jsonResponse(NOT_FOUND_BODY, 404);
    }

    const handler: RouteHandler | undefined = routeHandlers[resolved.key];
    if (handler === undefined) {
      return jsonResponse(NOT_FOUND_BODY, 404);
    }

    let payload: unknown = undefined;
    if (
      init.body !== undefined &&
      init.body !== null &&
      typeof init.body === 'string' &&
      init.body.length > 0
    ) {
      try {
        payload = JSON.parse(init.body);
      } catch {
        payload = undefined;
      }
    }

    const url = pathname.includes('?')
      ? new URL(`http://mock.local${pathname}`)
      : new URL(`http://mock.local${pathname}${typeof input === 'string' && input.includes('?') ? input.slice(input.indexOf('?')) : ''}`);

    const ctx: MockHandlerContext = {
      method: (init.method ?? 'GET').toUpperCase(),
      url,
      headers: new Headers(init.headers),
      payload,
      rng,
      callCount: counter,
    };

    return handler(ctx);
  };

  return {
    rng,
    dispatch,
    request: dispatch,
    reset(): void {
      rng.reset();
      counter = 0;
    },
    callCount(): number {
      return counter;
    },
  };
}
