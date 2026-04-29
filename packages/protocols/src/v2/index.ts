/**
 * @module @alphabet/protocols/v2
 * @description
 * AlphabetProtocol v2 — additive surface for streaming AI generation,
 * built-in providers (OpenAI, Anthropic, Grok, Gemini, Mistral,
 * Fireworks), provider fallback chain, privacy-preserving prompt
 * engineering, predictive capability forecasting, and cryptographic
 * consent proofs.
 *
 * v2 is purely additive — it does not modify the v1 contract. Consumers
 * can adopt v2 incrementally and continue using `DirectApiAdapter`,
 * `McpAdapter`, `A2AAdapter`, and `QrHandoffAdapter` from the root
 * entry point.
 */

// ─── Core types ──────────────────────────────────────────────────────────────
export type {
  AlphabetChatRole,
  AlphabetChatMessage,
  AlphabetToolDefinition,
  AlphabetToolCall,
  AlphabetStructuredOutputMode,
  AlphabetStructuredOutputSpec,
  AlphabetSampling,
  AlphabetGenerationRequest,
  AlphabetGenerationResponse,
  AlphabetFinishReason,
  AlphabetUsage,
  AlphabetStreamChunk,
  AlphabetProviderAdapter,
} from './types.js';

// ─── Compression ─────────────────────────────────────────────────────────────
export {
  estimateTokens,
  estimateMessagesTokens,
  compressByPriority,
  compressBySlidingWindow,
  compressBySemanticDedupe,
  compose as composeCompression,
  DEFAULT_COMPRESSION,
} from './compression/index.js';
export type { CompressionStrategy } from './compression/index.js';

// ─── Privacy ─────────────────────────────────────────────────────────────────
export {
  redactPromptPII,
  redactPromptString,
  injectConsentAwareContext,
} from './privacy/index.js';
export type {
  RedactionReport,
  ConsentAwareInjectionOptions,
} from './privacy/index.js';

// ─── Consent proof ───────────────────────────────────────────────────────────
export {
  signConsentProof,
  verifyConsentProof,
  generateConsentProofKeyPair,
} from './consent-proof/index.js';
export type {
  ConsentProofPayload,
  ConsentProofToken,
  SignConsentProofOptions,
  VerifyConsentProofOptions,
} from './consent-proof/index.js';

// ─── Pulse v2 ────────────────────────────────────────────────────────────────
export { ProactiveLayerForecaster } from './pulse/index.js';
export type {
  LayerForecastHint,
  ProactiveLayerForecasterOptions,
} from './pulse/index.js';

// ─── Providers ───────────────────────────────────────────────────────────────
export * from './providers/index.js';

// ─── SDK ─────────────────────────────────────────────────────────────────────
export {
  AlphabetAiClient,
  createAlphabetAiClient,
  prepareRequest,
} from './sdk/index.js';
export type {
  AlphabetAiClientOptions,
  AlphabetAiCallOptions,
} from './sdk/index.js';
