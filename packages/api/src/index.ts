/**
 * @module @alphabet/api
 * @description
 * پکیج API Client — AlphabetClient (تمام ۱۶ endpoint)، HandshakeClient، و re-exports از @alphabet/core.
 * API Client package — AlphabetClient (all 16 endpoints), HandshakeClient, and re-exports from @alphabet/core.
 */

export type { AlphabetRequest, AlphabetResponse } from '@alphabet/core';

// ─── Route Contracts (re-exported from @alphabet/core) ───────────────────────────
export {
  API_VERSION_PREFIX,
  LEGACY_API_PREFIX,
  ALPHABET_ROUTES,
  ALPHABET_ROUTE_STATUS,
  fullRoute,
  joinRoute,
  normalizeApiBaseUrl,
} from '@alphabet/core';
export type { AlphabetRouteKey, AlphabetRoutePath, AlphabetRouteStatus } from '@alphabet/core';

// ─── Intent Vocabularies (re-exported from @alphabet/core) ───────────────────────
export {
  DOMAIN_INTENTS,
  SUGGESTION_ACTION_INTENTS,
} from '@alphabet/core';
export type { DomainIntent, SuggestionActionIntent } from '@alphabet/core';

// ─── Legacy HandshakeClient ───────────────────────────────────────────────────
export { HandshakeClient } from './handshake-client.js';
export type { HandshakeClientOptions } from './handshake-client.js';

// ─── Unified AlphabetClient (all 16 endpoints) ────────────────────────────────────
export { AlphabetClient } from './alphabet-client.js';
export type { AlphabetClientOptions } from './alphabet-client.js';

// ─── Request / Response Types ─────────────────────────────────────────────────
export type {
  // Group 1: Context Handshake
  ConsentPurpose,
  ConsentRequest,
  ConsentResponse,
  PreferenceRequest,
  PreferenceResponse,

  // Group 2: Visitor Interaction
  SuggestionOption,
  InteractRequest,
  InteractReference,
  InteractResponse,
  InteractStreamEvent,
  VoiceTranscribeResponse,
  SuggestionsQuery,
  SuggestionsResponse,

  // Group 3: Technology Pulse
  TechnologyPulseQuery,
  TechnologySignal,
  TechnologyPulseResponse,
  TechnologyPulseBriefRequest,
  TechnologyPulseBriefResponse,

  // Group 4: Memory
  StoreMemoryRequest,
  StoreMemoryResponse,
  GetMemoryQuery,
  GetMemoryResponse,
  EraseMemoryRequest,
  EraseMemoryResponse,

  // Group 5: OpenClaw Mesh
  ClawQueryRequest,
  ClawQueryResult,
  ClawQueryResponse,
  ClawIngestRequest,
  ClawIngestResponse,
  ClawAdminAuditRequest,
  ClawAdminAuditResponse,

  // Group 6: Admin
  VisitorInsightsQuery,
  VisitorInsightsResponse,
  PulseSourcesQuery,
  PulseSource,
  PulseSourcesResponse,
} from './types.js';
