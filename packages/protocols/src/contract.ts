/**
 * @module @alphabet/protocols/contract
 * @description
 * Normalized Alphabet protocol contract — the shared shape every adapter
 * (Direct API, MCP, A2A, QR Handoff) must convert to and from.
 *
 * The contract intentionally **does not** model LLM provider concepts
 * (chat messages, tool calls, embeddings, …). Adapters live above this
 * layer and translate provider-specific payloads into Alphabet terms:
 * context, consent, memory permissions, and UI adaptation signals.
 */

import type {
  ConsentTier,
  MemoryDomain,
  ProtocolType,
  CapabilityLayer,
  Result,
} from '@alphabet/core';
import type { AlphabetProtocolError } from './errors/index.js';

// ─── Consent Scope ───────────────────────────────────────────────────────────

/**
 * Operation an adapter wants to perform on the user's behalf. Mapped to
 * the Alphabet privacy policy helpers (`canStoreMemory`, `canPersonalize`, …).
 */
export type AlphabetConsentOperation =
  | 'read_context'
  | 'read_memory'
  | 'write_memory'
  | 'personalize'
  | 'analytics'
  | 'precise_geo';

/**
 * Normalized consent scope attached to every protocol request. Adapters
 * fill this in based on what the incoming payload is asking for; the
 * Direct API adapter (and downstream consumers) then validates the scope
 * against the visitor's current `ConsentTier` and privacy signals.
 */
export interface AlphabetConsentScope {
  /** Current tier as known by the caller — never trusted blindly */
  readonly tier: ConsentTier;
  /** Operations the adapter wants to perform */
  readonly operations: readonly AlphabetConsentOperation[];
  /** Memory domains touched (empty if no memory access) */
  readonly memoryDomains: readonly MemoryDomain[];
  /** Whether the caller honours DNT/GPC (defensive default: true) */
  readonly respectsPrivacySignals: boolean;
}

// ─── Memory Permission ───────────────────────────────────────────────────────

/**
 * Read/write decision for a single memory domain. Returned by
 * `evaluateMemoryPermission` so adapters can short-circuit without
 * re-implementing the consent ladder.
 */
export interface AlphabetMemoryPermission {
  readonly domain: MemoryDomain;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  /** Minimum consent tier required to satisfy both read and write */
  readonly requiredTier: ConsentTier;
  /** Human-readable reason for denial (no PII) */
  readonly reason?: string;
}

// ─── Tool Context ────────────────────────────────────────────────────────────

/**
 * Subset of visitor/session context every adapter is allowed to expose to
 * tools and external agents. Intentionally narrow: no IP, no precise geo,
 * no raw user-agent. Adapters must redact further if needed.
 */
export interface AlphabetToolContext {
  /** Stable but rotating visitor identifier */
  readonly visitorId: string;
  /** Ephemeral session identifier */
  readonly sessionId: string;
  /** Current consent tier */
  readonly consentTier: ConsentTier;
  /** Selected UI capability layer (if known) */
  readonly layer?: CapabilityLayer;
  /** Negotiated locale — e.g. "fa-IR" */
  readonly locale?: string;
  /** Coarse country code (ISO 3166-1 alpha-2) — never city/lat/lon */
  readonly country?: string;
  /** Whether DNT or GPC is currently active */
  readonly privacyRestricted: boolean;
}

// ─── Protocol Request / Response ─────────────────────────────────────────────

/**
 * Normalized Alphabet request. Every adapter converts its native incoming
 * payload (REST body, MCP tool call, A2A task message, QR handoff
 * payload) into this shape before dispatching to the rest of the SDK.
 *
 * @template TPayload - Adapter-specific payload (kept opaque on purpose)
 */
export interface AlphabetProtocolRequest<TPayload = unknown> {
  /** Source protocol */
  readonly protocol: ProtocolType;
  /** Logical operation name — e.g. "context.handshake", "memory.query" */
  readonly operation: string;
  /** Tool/agent context */
  readonly context: AlphabetToolContext;
  /** Consent scope claimed by the caller */
  readonly consent: AlphabetConsentScope;
  /** Adapter-specific payload */
  readonly payload: TPayload;
  /** Correlation id for tracing */
  readonly correlationId: string;
  /** Receive timestamp (ISO 8601) */
  readonly receivedAt: string;
}

/**
 * Normalized Alphabet response.
 *
 * @template TData - Operation-specific result data
 */
export interface AlphabetProtocolResponse<TData = unknown> {
  readonly correlationId: string;
  readonly protocol: ProtocolType;
  readonly operation: string;
  readonly result: Result<TData, AlphabetProtocolError>;
  /** Server-side processing time in milliseconds */
  readonly processingTimeMs: number;
  readonly respondedAt: string;
}
