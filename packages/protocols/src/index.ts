/**
 * @module @awaf/protocols
 * @description
 * AWAF Protocol adapter layer — Direct API, MCP, A2A, QR Handoff.
 *
 * AWAF normalizes context, consent, memory permissions, and UI
 * adaptation signals across protocols. It is **not** an LLM provider
 * SDK; provider integrations live behind the optional `ai-sdk` adapter
 * interface and remain provider-agnostic.
 */

// ─── Re-exports from @awaf/core ──────────────────────────────────────────────
export type { ProtocolType } from '@awaf/core';

// ─── Contract types ──────────────────────────────────────────────────────────
export type {
  AwafProtocolRequest,
  AwafProtocolResponse,
  AwafToolContext,
  AwafConsentScope,
  AwafConsentOperation,
  AwafMemoryPermission,
} from './contract.js';

// ─── Errors ──────────────────────────────────────────────────────────────────
export type {
  AwafProtocolError,
  AwafProtocolErrorCode,
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
  AWAF_MCP_TOOLS,
  AWAF_MCP_TOOL_MANIFESTS,
} from './mcp/index.js';
export type {
  AwafMcpToolName,
  AwafMcpToolManifest,
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
  AWAF_A2A_AGENT_CARD,
} from './a2a/index.js';
export type {
  A2AAdapterOptions,
  A2ATask,
  A2ATaskMessage,
  A2ATaskPart,
  AwafA2AAgentCard,
} from './a2a/index.js';

export { QrHandoffAdapter } from './qr-handoff/index.js';
export type {
  QrHandoffPayload,
  QrEncodeOptions,
  QrDecodeOptions,
} from './qr-handoff/index.js';

// ─── Optional AI SDK adapter contract ────────────────────────────────────────
export type {
  AwafAiRequest,
  AwafAiResponse,
  AwafAiProviderAdapter,
} from './ai-sdk/index.js';
