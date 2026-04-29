/**
 * @module @awaf/protocols/v2/sdk
 * @description
 * High-level TypeScript SDK for AwafProtocol v2.
 *
 * `AwafAiClient` wires the four innovations together:
 *   1. Provider fan-out (any `AwafProviderAdapter`, including the
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

import { ok, err, type Result, type PrivacySignals } from '@awaf/core';
import type {
  AwafChatMessage,
  AwafGenerationRequest,
  AwafGenerationResponse,
  AwafProviderAdapter,
  AwafStreamChunk,
} from '../types.js';
import type { AwafProtocolError } from '../../errors/index.js';
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

export interface AwafAiClientOptions {
  readonly provider: AwafProviderAdapter;
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
export interface AwafAiCallOptions {
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
 * Apply the AWAF transformations (consent injection → PII redaction
 * → compression). Returns the prepared request, plus diagnostics that
 * callers can log without leaking PII.
 */
export function prepareRequest(
  request: AwafGenerationRequest,
  options: AwafAiClientOptions,
  callOptions: AwafAiCallOptions,
): {
  readonly request: AwafGenerationRequest;
  readonly diagnostics: {
    readonly redactedCount: number;
    readonly redactedKinds: readonly string[];
    readonly tokensBeforeCompression: number;
    readonly tokensAfterCompression: number;
  };
} {
  const privacy = callOptions.privacy ?? options.defaultPrivacy ?? DEFAULT_PRIVACY;

  // Step 1: optional consent-aware prelude.
  let messages: readonly AwafChatMessage[] = request.messages;
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
 * High-level AwafProtocol v2 client. Stateless beyond its bound
 * provider — safe to share across requests in a server runtime.
 */
export class AwafAiClient {
  constructor(private readonly options: AwafAiClientOptions) {}

  /** Replace the provider — useful for hot-swap during failover tests. */
  withProvider(provider: AwafProviderAdapter): AwafAiClient {
    return new AwafAiClient({ ...this.options, provider });
  }

  /**
   * Stream chunks. The first chunk emitted may be `error` if consent
   * proof verification fails.
   */
  async *stream(
    request: AwafGenerationRequest,
    callOptions: AwafAiCallOptions = {},
  ): AsyncIterable<AwafStreamChunk> {
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
    request: AwafGenerationRequest,
    callOptions: AwafAiCallOptions = {},
  ): Promise<Result<AwafGenerationResponse, AwafProtocolError>> {
    const proofErr = await this.verifyProof(callOptions);
    if (proofErr !== null) return err(proofErr);
    const { request: prepared } = prepareRequest(request, this.options, callOptions);
    return this.options.provider.generate(prepared);
  }

  /** Returns `null` on success, or the typed error on failure. */
  private async verifyProof(
    callOptions: AwafAiCallOptions,
  ): Promise<AwafProtocolError | null> {
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
export function createAwafAiClient(options: AwafAiClientOptions): AwafAiClient {
  return new AwafAiClient(options);
}

// ─── Re-exports of common types so consumers only need this entry ────────────

export type { AwafProviderAdapter, AwafGenerationRequest, AwafGenerationResponse, AwafStreamChunk };
export { ok, err };
export type { Result };
