/**
 * @module @alphabet/protocols/v2/sdk
 * @description
 * High-level TypeScript SDK for AlphabetProtocol v2.
 *
 * `AlphabetAiClient` wires the four innovations together:
 *   1. Provider fan-out (any `AlphabetProviderAdapter`, including the
 *      fallback chain).
 *   2. Privacy-preserving prompt engineering — automatic PII
 *      redaction + consent-aware system prelude.
 *   3. Memory-efficient context compression — driven by the request's
 *      `sampling.tokenBudget` (or a client-level default).
 *   4. Optional cryptographic consent proof verification — if the
 *      caller passes a `ConsentProofToken`, the SDK verifies it before
 *      dispatch and refuses to proceed when verification fails.
 *
 * The SDK never logs PII, never persists messages, and never holds a
 * provider's API key beyond the bound adapter's lifetime.
 */

import { ok, err, type Result, type PrivacySignals } from '@alphabet/core';
import type {
  AlphabetChatMessage,
  AlphabetGenerationRequest,
  AlphabetGenerationResponse,
  AlphabetProviderAdapter,
  AlphabetStreamChunk,
} from '../types.js';
import type { AlphabetProtocolError } from '../../errors/index.js';
import { redactPromptPII, injectConsentAwareContext } from '../privacy/index.js';
import {
  compose,
  DEFAULT_COMPRESSION,
  estimateMessagesTokens,
  type CompressionStrategy,
} from '../compression/index.js';
import {
  verifyConsentProof,
  type ConsentProofToken,
} from '../consent-proof/index.js';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface AlphabetAiClientOptions {
  readonly provider: AlphabetProviderAdapter;
  /** Authoritative privacy signals — must be supplied per-request. */
  readonly defaultPrivacy?: PrivacySignals;
  /** Default token budget if `sampling.tokenBudget` is missing. */
  readonly defaultTokenBudget?: number;
  /** Override the compression pipeline (default: DEFAULT_COMPRESSION). */
  readonly compression?: readonly CompressionStrategy[];
  /** Disable PII redaction (e.g. when upstream is already trusted). */
  readonly disablePiiRedaction?: boolean;
  /** Disable consent-aware prelude injection. */
  readonly disableConsentInjection?: boolean;
}

/**
 * Per-call options consumed by `stream` / `generate`. The `consentProof`
 * is verified server-side before dispatch and surfaced via the response.
 */
export interface AlphabetAiCallOptions {
  /** Authoritative privacy signals for this request. */
  readonly privacy?: PrivacySignals;
  readonly consentProof?: {
    readonly token: ConsentProofToken;
    readonly publicKey: CryptoKey;
    readonly expectedAudience: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PRIVACY: PrivacySignals = { dntEnabled: false, gpcEnabled: false };

/**
 * Apply the Alphabet transformations (consent injection → PII redaction
 * → compression). Returns the prepared request, plus diagnostics that
 * callers can log without leaking PII.
 */
export function prepareRequest(
  request: AlphabetGenerationRequest,
  options: AlphabetAiClientOptions,
  callOptions: AlphabetAiCallOptions,
): {
  readonly request: AlphabetGenerationRequest;
  readonly diagnostics: {
    readonly redactedCount: number;
    readonly redactedKinds: readonly string[];
    readonly tokensBeforeCompression: number;
    readonly tokensAfterCompression: number;
  };
} {
  const privacy = callOptions.privacy ?? options.defaultPrivacy ?? DEFAULT_PRIVACY;

  // Step 1: optional consent-aware prelude.
  let messages: readonly AlphabetChatMessage[] = request.messages;
  if (options.disableConsentInjection !== true) {
    const prelude = injectConsentAwareContext(request.context, { privacy });
    messages = [prelude, ...messages];
  }

  // Step 2: PII redaction.
  let redactedCount = 0;
  let redactedKinds: readonly string[] = [];
  if (options.disablePiiRedaction !== true) {
    const r = redactPromptPII(messages);
    messages = r.messages;
    redactedCount = r.report.redactedCount;
    redactedKinds = r.report.kinds;
  }

  const tokensBefore = estimateMessagesTokens(messages);

  // Step 3: compression.
  const budget =
    request.sampling?.tokenBudget ?? options.defaultTokenBudget ?? Number.POSITIVE_INFINITY;
  const strategies = options.compression ?? DEFAULT_COMPRESSION;
  const compressed = Number.isFinite(budget)
    ? compose(strategies, messages, budget)
    : { messages, tokens: tokensBefore };

  return {
    request: { ...request, messages: compressed.messages },
    diagnostics: {
      redactedCount,
      redactedKinds,
      tokensBeforeCompression: tokensBefore,
      tokensAfterCompression: compressed.tokens,
    },
  };
}

// ─── Client ──────────────────────────────────────────────────────────────────

/**
 * High-level AlphabetProtocol v2 client. Stateless beyond its bound
 * provider — safe to share across requests in a server runtime.
 */
export class AlphabetAiClient {
  constructor(private readonly options: AlphabetAiClientOptions) {}

  /** Replace the provider — useful for hot-swap during failover tests. */
  withProvider(provider: AlphabetProviderAdapter): AlphabetAiClient {
    return new AlphabetAiClient({ ...this.options, provider });
  }

  /**
   * Stream chunks. The first chunk emitted may be `error` if consent
   * proof verification fails.
   */
  async *stream(
    request: AlphabetGenerationRequest,
    callOptions: AlphabetAiCallOptions = {},
  ): AsyncIterable<AlphabetStreamChunk> {
    const proofErr = await this.verifyProof(callOptions);
    if (proofErr !== null) {
      yield { type: 'error', error: proofErr };
      return;
    }
    const { request: prepared } = prepareRequest(request, this.options, callOptions);
    yield* this.options.provider.stream(prepared);
  }

  /** Non-streaming generation. */
  async generate(
    request: AlphabetGenerationRequest,
    callOptions: AlphabetAiCallOptions = {},
  ): Promise<Result<AlphabetGenerationResponse, AlphabetProtocolError>> {
    const proofErr = await this.verifyProof(callOptions);
    if (proofErr !== null) return err(proofErr);
    const { request: prepared } = prepareRequest(request, this.options, callOptions);
    return this.options.provider.generate(prepared);
  }

  /** Returns `null` on success, or the typed error on failure. */
  private async verifyProof(
    callOptions: AlphabetAiCallOptions,
  ): Promise<AlphabetProtocolError | null> {
    const proof = callOptions.consentProof;
    if (proof === undefined) return null;
    const result = await verifyConsentProof({
      token: proof.token,
      publicKey: proof.publicKey,
      expectedAudience: proof.expectedAudience,
    });
    return result.success ? null : result.error;
  }
}

/** Convenience factory mirroring the rest of the v2 surface. */
export function createAlphabetAiClient(options: AlphabetAiClientOptions): AlphabetAiClient {
  return new AlphabetAiClient(options);
}

// ─── Re-exports of common types so consumers only need this entry ────────────

export type { AlphabetProviderAdapter, AlphabetGenerationRequest, AlphabetGenerationResponse, AlphabetStreamChunk };
export { ok, err };
export type { Result };
