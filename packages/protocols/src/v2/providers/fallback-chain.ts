/**
 * @module @alphabet/protocols/v2/providers/fallback-chain
 * @description
 * Provider fallback chain — tries adapters in order, advancing to the
 * next one on retryable failures (network errors, HTTP 5xx, 429, or
 * adapter-emitted `error` chunks before any successful chunk).
 *
 * Once the first adapter has emitted at least one non-error chunk, the
 * chain commits to that adapter; subsequent errors propagate as-is so
 * partial output is never dropped silently.
 *
 * The chain itself satisfies `AlphabetProviderAdapter`, so it can be wrapped
 * by another chain or used anywhere a provider is expected.
 */

import type {
  AlphabetGenerationRequest,
  AlphabetProviderAdapter,
  AlphabetStreamChunk,
} from '../types.js';
import { collapseStream } from './shared.js';
import { protocolError, type AlphabetProtocolError } from '../../errors/index.js';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface FallbackChainOptions {
  /** Adapters to try, in order. Must be non-empty. */
  readonly providers: readonly AlphabetProviderAdapter[];
  /**
   * Per-provider model override. Keys are provider ids; values
   * override `request.model`. Useful when models are named
   * differently across providers (`gpt-4o-mini` vs `claude-3-5-haiku`).
   */
  readonly modelByProvider?: Readonly<Record<string, string>>;
  /**
   * Predicate that decides whether an error from a provider should
   * trigger a fallback. Defaults to retrying on transport errors,
   * 5xx, 429, and `ADAPTER_NOT_CONFIGURED`.
   */
  readonly shouldFallback?: (error: AlphabetProtocolError) => boolean;
  /** Hook invoked whenever a fallback occurs (observability). */
  readonly onFallback?: (info: {
    readonly fromProviderId: string;
    readonly toProviderId: string | null;
    readonly error: AlphabetProtocolError;
  }) => void;
  /** Optional id for the chain itself. */
  readonly id?: string;
}

const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'ADAPTER_NOT_CONFIGURED',
  'CRYPTO_UNAVAILABLE',
]);

function defaultShouldFallback(error: AlphabetProtocolError): boolean {
  const status = (error.details as { status?: number } | undefined)?.status;
  if (typeof status === 'number') {
    if (status >= 500) return true;
    if (status === 408 || status === 425 || status === 429) return true;
    return false;
  }
  return RETRYABLE_CODES.has(error.code);
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Build a provider adapter that delegates to a chain of providers
 * with retry-on-fallback semantics.
 */
export function createFallbackChain(options: FallbackChainOptions): AlphabetProviderAdapter {
  if (options.providers.length === 0) {
    throw new Error('FallbackChain requires at least one provider');
  }
  const chainId = options.id ?? 'fallback-chain';
  const shouldFallback = options.shouldFallback ?? defaultShouldFallback;

  async function* stream(req: AlphabetGenerationRequest): AsyncIterable<AlphabetStreamChunk> {
    let lastError: AlphabetProtocolError | undefined;
    for (let i = 0; i < options.providers.length; i += 1) {
      const provider = options.providers[i] as AlphabetProviderAdapter;
      const next = options.providers[i + 1];
      const model = options.modelByProvider?.[provider.id] ?? req.model;
      const scopedReq: AlphabetGenerationRequest = { ...req, model };

      let firstChunkSeen = false;
      let providerError: AlphabetProtocolError | undefined;
      try {
        for await (const c of provider.stream(scopedReq)) {
          if (c.type === 'error' && !firstChunkSeen) {
            providerError = c.error;
            break;
          }
          firstChunkSeen = true;
          yield c;
          if (c.type === 'finish') return;
        }
      } catch (e) {
        providerError = protocolError(
          'ADAPTER_NOT_CONFIGURED',
          `Provider ${provider.id} threw`,
          { cause: (e as Error).message },
        );
      }

      if (firstChunkSeen) {
        // Already committed to this provider; surface any pending error
        // and stop the chain.
        if (providerError !== undefined) {
          yield { type: 'error', error: providerError };
        }
        return;
      }

      if (providerError !== undefined) {
        lastError = providerError;
        const fallbackable = shouldFallback(providerError);
        options.onFallback?.({
          fromProviderId: provider.id,
          toProviderId: fallbackable && next !== undefined ? next.id : null,
          error: providerError,
        });
        if (!fallbackable) break;
        continue;
      }

      // Provider produced no chunks at all: treat as failure and try next.
      lastError = protocolError(
        'ADAPTER_NOT_CONFIGURED',
        `Provider ${provider.id} produced no chunks`,
      );
    }
    yield {
      type: 'error',
      error:
        lastError ?? protocolError('ADAPTER_NOT_CONFIGURED', 'No provider succeeded'),
    };
  }

  return {
    id: chainId,
    name: 'Alphabet Fallback Chain',
    stream,
    generate: async (req) => collapseStream(chainId, req.model, stream(req), req.structuredOutput !== undefined),
  };
}
