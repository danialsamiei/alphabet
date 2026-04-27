/**
 * @module @awaf/api
 * @description
 * پکیج API Client — AwafClient (تمام ۱۶ endpoint)، HandshakeClient، و re-exports از @awaf/core.
 * API Client package — AwafClient (all 16 endpoints), HandshakeClient, and re-exports from @awaf/core.
 */

export type { AWAFRequest, AWAFResponse } from '@awaf/core';

// ─── Route Contracts (re-exported from @awaf/core) ───────────────────────────
export {
  API_VERSION_PREFIX,
  LEGACY_API_PREFIX,
  AWAF_ROUTES,
  AWAF_ROUTE_STATUS,
  fullRoute,
  joinRoute,
  normalizeApiBaseUrl,
} from '@awaf/core';
export type { AwafRouteKey, AwafRoutePath, AwafRouteStatus } from '@awaf/core';

// ─── Intent Vocabularies (re-exported from @awaf/core) ───────────────────────
export {
  DOMAIN_INTENTS,
  SUGGESTION_ACTION_INTENTS,
} from '@awaf/core';
export type { DomainIntent, SuggestionActionIntent } from '@awaf/core';

// ─── Legacy HandshakeClient ───────────────────────────────────────────────────
export { HandshakeClient } from './handshake-client.js';
export type { HandshakeClientOptions } from './handshake-client.js';

// ─── Unified AwafClient (all 16 endpoints) ────────────────────────────────────
export { AwafClient } from './awaf-client.js';
export type { AwafClientOptions } from './awaf-client.js';

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
