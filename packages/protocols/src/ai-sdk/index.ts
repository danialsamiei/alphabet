/**
 * @module @awaf/protocols/ai-sdk
 * @description
 * Optional AI SDK adapter interface — designed to be compatible with
 * Vercel AI SDK and similar provider abstractions, but without requiring
 * any of them as a runtime dependency.
 *
 * AWAF intentionally does **not** become an LLM provider SDK. This module
 * is a thin contract: callers can plug their own provider in by
 * implementing `AwafAiProviderAdapter` and pass the result through the
 * normalized AWAF context.
 *
 * If a consumer decides to use Vercel AI SDK, they can add it as a peer
 * dependency in their own application; this package never imports it.
 */

import type { Result } from '@awaf/core';
import type { AwafToolContext } from '../contract.js';
import type { AwafProtocolError } from '../errors/index.js';

/**
 * Normalized AI request as understood by AWAF. Provider-agnostic. The
 * adapter is responsible for translating this into whichever shape the
 * underlying SDK expects.
 */
export interface AwafAiRequest {
  /** PII-free visitor context for adaptive behaviour. */
  readonly context: AwafToolContext;
  /** Free-form prompt — caller is responsible for redacting PII. */
  readonly prompt: string;
  /** Optional system instructions. */
  readonly system?: string;
  /** Maximum tokens the caller is willing to spend. */
  readonly maxTokens?: number;
}

/** Normalized AI response. */
export interface AwafAiResponse {
  readonly text: string;
  /** Tokens consumed by the underlying provider, if known. */
  readonly tokensUsed?: number;
}

/**
 * Provider-agnostic adapter contract. Implementations may wrap Vercel AI
 * SDK, OpenAI SDK, Anthropic SDK, etc. They must:
 *   • Never log PII.
 *   • Honour `context.privacyRestricted` (no behavioural personalization).
 *   • Return errors via the AWAF `Result` pattern.
 */
export interface AwafAiProviderAdapter {
  readonly id: string;
  generate(request: AwafAiRequest): Promise<Result<AwafAiResponse, AwafProtocolError>>;
}
