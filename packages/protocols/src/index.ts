/**
 * @module @alphabet/protocols
 * @description
 * Alphabet Protocol adapter layer — Direct API, MCP, A2A, QR Handoff.
 *
 * Alphabet normalizes context, consent, memory permissions, and UI
 * adaptation signals across protocols. It is **not** an LLM provider
 * SDK; provider integrations live behind the optional `ai-sdk` adapter
 * interface and remain provider-agnostic.
 */

// ─── Re-exports from @alphabet/core ──────────────────────────────────────────────
export type { ProtocolType } from '@alphabet/core';

// ─── Contract types ──────────────────────────────────────────────────────────
export type {
  AlphabetProtocolRequest,
  AlphabetProtocolResponse,
  AlphabetToolContext,
  AlphabetConsentScope,
  AlphabetConsentOperation,
  AlphabetMemoryPermission,
} from './contract.js';

// ─── Errors ──────────────────────────────────────────────────────────────────
export type {
  AlphabetProtocolError,
  AlphabetProtocolErrorCode,
} from './errors/index.js';
export { protocolError } from './errors/index.js';

// ─── Normalizers ─────────────────────────────────────────────────────────────
export {
  makeConsentScope,
  validateConsentScope,
  evaluateMemoryPermission,
  ensureNoPIIInContext,
  looksLikePII,
} from './normalizers/index.js';

// ─── Adapters ────────────────────────────────────────────────────────────────
export {
  DirectApiAdapter,
} from './direct-api/index.js';
export type {
  DirectApiRequestBody,
  AuthoritativeConsentState,
} from './direct-api/index.js';

export {
  McpAdapter,
  ALPHABET_MCP_TOOLS,
  ALPHABET_MCP_TOOL_MANIFESTS,
} from './mcp/index.js';
export type {
  AlphabetMcpToolName,
  AlphabetMcpToolManifest,
  JsonSchema,
  McpAdapterOptions,
  MemoryQueryBackend,
  ContextHandshakeResult,
  MemoryQueryResult,
  ConsentStatusResult,
  AdaptiveLayerExplainResult,
} from './mcp/index.js';

export {
  A2AAdapter,
  ALPHABET_A2A_AGENT_CARD,
} from './a2a/index.js';
export type {
  A2AAdapterOptions,
  A2ATask,
  A2ATaskMessage,
  A2ATaskPart,
  AlphabetA2AAgentCard,
} from './a2a/index.js';

export { QrHandoffAdapter } from './qr-handoff/index.js';
export type {
  QrHandoffPayload,
  QrEncodeOptions,
  QrDecodeOptions,
} from './qr-handoff/index.js';

// ─── Optional AI SDK adapter contract ────────────────────────────────────────
export type {
  AlphabetAiRequest,
  AlphabetAiResponse,
  AlphabetAiProviderAdapter,
} from './ai-sdk/index.js';
