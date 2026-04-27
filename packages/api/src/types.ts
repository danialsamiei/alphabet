/**
 * @module api-types
 * @description
 * تمام تایپ‌های درخواست و پاسخ برای ۱۶ endpoint در @awaf/api.
 * Request and response types for all 16 AWAF API endpoints.
 */

import type { AWAFError } from '@awaf/core';
import type { ConsentTier, MemoryDomain, TrustTier, SuggestionActionIntent } from '@awaf/core';

// ─── Group 1: Context Handshake (Endpoints 2–3) ───────────────────────────────

/**
 * یک هدف رضایت — کاربر برای هر هدف رضایت جداگانه می‌دهد.
 */
export interface ConsentPurpose {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly granted: boolean;
}

/**
 * payload درخواست POST /api/context/consent.
 */
export interface ConsentRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly action: 'grant' | 'revoke' | 'upgrade' | 'downgrade';
  readonly tier: ConsentTier;
  readonly purposes?: ConsentPurpose[];
  readonly duration?: 'session' | '30d' | '90d' | '1y';
}

/**
 * پاسخ POST /api/context/consent.
 */
export interface ConsentResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly action: string;
  readonly previousTier: ConsentTier;
  readonly currentTier: ConsentTier;
  readonly state: 'pending' | 'granted' | 'revoked';
  readonly grantedAt?: string;
  readonly expiresAt?: string;
  readonly purposes?: ConsentPurpose[];
  readonly transparencyReport?: {
    readonly dataCollected: string[];
    readonly dataShared: string[];
    readonly retentionDays: number;
    readonly rightToErasure: boolean;
  };
  readonly error?: AWAFError;
}

/**
 * payload درخواست POST /api/context/preference.
 */
export interface PreferenceRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly language?: string;
  readonly topics?: string[];
  readonly contentDepth?: 'overview' | 'deep' | 'expert';
  readonly notificationPrefs?: 'none' | 'session' | 'persistent';
  readonly theme?: 'auto' | 'light' | 'dark';
  readonly overrideHandshake?: boolean;
}

/**
 * پاسخ POST /api/context/preference.
 */
export interface PreferenceResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly preferences: {
    readonly language: string;
    readonly topics: string[];
    readonly contentDepth: string;
    readonly notificationPrefs: string;
    readonly theme: string;
  };
  readonly updatedAt: string;
  readonly effectiveTier: ConsentTier;
  readonly error?: AWAFError;
}

// ─── Group 2: Visitor Interaction (Endpoints 4–6) ────────────────────────────

/**
 * گزینه suggestion برای کاربر.
 *
 * The `intentType` describes the UI/action affordance of the suggestion
 * (a {@link SuggestionActionIntent}), **not** the visitor's domain-level
 * purpose. For high-level visitor intent classification use
 * `DomainIntent` from `@awaf/core`.
 */
export interface SuggestionOption {
  readonly id: string;
  readonly label: string;
  readonly intentType: SuggestionActionIntent;
  readonly confidence: number;
  readonly icon?: string;
  readonly action: 'navigate' | 'interact' | 'consent_prompt';
  readonly requiresConsent: boolean;
  readonly targetUrl?: string;
}

/**
 * payload درخواست POST /api/interact.
 */
export interface InteractRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly message: string;
  readonly inputMode: 'text' | 'voice';
  readonly context?: {
    readonly previousMessages?: { readonly role: 'user' | 'assistant'; readonly content: string }[];
    readonly pageUrl?: string;
    readonly pageTitle?: string;
    readonly selectedText?: string;
  };
  readonly streaming?: boolean;
  readonly suggestFollowUps?: boolean;
}

/**
 * رفرنس در پاسخ interact.
 */
export interface InteractReference {
  readonly title: string;
  readonly url: string;
  readonly trustTier: TrustTier;
}

/**
 * پاسخ POST /api/interact (non-streaming).
 */
export interface InteractResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly response: {
    readonly text: string;
    readonly suggestions?: SuggestionOption[];
    readonly references?: InteractReference[];
  };
  readonly tokenUsage: {
    readonly prompt: number;
    readonly completion: number;
    readonly total: number;
  };
  readonly streaming: false;
  readonly error?: AWAFError;
}

/**
 * رویداد SSE برای POST /api/interact (streaming).
 */
export interface InteractStreamEvent {
  readonly type: 'token' | 'suggestion' | 'reference' | 'done' | 'error';
  readonly data: string | SuggestionOption | { readonly title: string; readonly url: string } | AWAFError;
}

/**
 * پاسخ POST /api/voice/transcribe.
 */
export interface VoiceTranscribeResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly transcription: {
    readonly text: string;
    readonly confidence: number;
    readonly language: string;
    readonly durationMs: number;
    readonly words?: { readonly word: string; readonly start: number; readonly end: number }[];
  };
  readonly error?: AWAFError;
}

/**
 * query parameters برای GET /api/suggestions.
 */
export interface SuggestionsQuery {
  readonly visitorId: string;
  readonly sessionId?: string;
  readonly pageUrl?: string;
  readonly intentHint?: string;
  readonly limit?: number;
  readonly includeRequiresConsent?: boolean;
}

/**
 * پاسخ GET /api/suggestions.
 */
export interface SuggestionsResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly suggestions: SuggestionOption[];
  readonly generatedAt: string;
  readonly error?: AWAFError;
}

// ─── Group 3: Technology Pulse (Endpoints 7–8) ────────────────────────────────

/**
 * query parameters برای GET /api/technology-pulse.
 */
export interface TechnologyPulseQuery {
  readonly category?: string;
  readonly trustTier?: TrustTier;
  readonly source?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: 'publishedAt' | 'ingestedAt' | 'trustScore';
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * یک سیگنال technology در Technology Pulse.
 */
export interface TechnologySignal {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly category: string;
  readonly trustTier: TrustTier;
  readonly provenanceChain: { readonly source: string; readonly url: string; readonly accessedAt: string }[];
  readonly rawText: string;
  readonly url: string;
  readonly publishedAt: string;
  readonly ingestedAt: string;
}

/**
 * پاسخ GET /api/technology-pulse.
 */
export interface TechnologyPulseResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly signals: TechnologySignal[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
  readonly facets: {
    readonly categories: { readonly name: string; readonly count: number }[];
    readonly sources: { readonly name: string; readonly count: number }[];
    readonly trustTiers: { readonly tier: string; readonly count: number }[];
  };
  readonly error?: AWAFError;
}

/**
 * payload درخواست POST /api/technology-pulse/brief.
 */
export interface TechnologyPulseBriefRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly period: 'daily' | 'weekly';
  readonly categories?: string[];
  readonly maxLength?: 'short' | 'medium' | 'long';
  readonly focusTopics?: string[];
}

/**
 * پاسخ POST /api/technology-pulse/brief.
 */
export interface TechnologyPulseBriefResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly brief: {
    readonly title: string;
    readonly period: string;
    readonly generatedAt: string;
    readonly summary: string;
    readonly highlights: { readonly title: string; readonly description: string; readonly signalId: string }[];
    readonly categoryBreakdown: { readonly category: string; readonly count: number; readonly topSignal: string }[];
    readonly trustDistribution: { readonly tier: string; readonly count: number }[];
  };
  readonly error?: AWAFError;
}

// ─── Group 4: Memory (Endpoints 9–11) ────────────────────────────────────────

/**
 * payload درخواست POST /api/visitor/memory.
 */
export interface StoreMemoryRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly domain: MemoryDomain;
  readonly content: string;
  readonly vectorEmbedding?: number[];
  readonly privacyLabel: 'correlation_allowed' | 'isolated' | 'governance_required';
  readonly ttlDays?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * پاسخ POST /api/visitor/memory.
 */
export interface StoreMemoryResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly memory: {
    readonly memoryId: string;
    readonly domain: MemoryDomain;
    readonly content: string;
    readonly privacyLabel: string;
    readonly createdAt: string;
    readonly expiresAt?: string;
  };
  readonly consentTier: ConsentTier;
  readonly tokensUsed: number;
  readonly error?: AWAFError;
}

/**
 * query parameters برای GET /api/visitor/memory.
 */
export interface GetMemoryQuery {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly domain?: MemoryDomain;
  readonly search?: string;
  readonly limit?: number;
  readonly includeExpired?: boolean;
}

/**
 * پاسخ GET /api/visitor/memory.
 */
export interface GetMemoryResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly memories: {
    readonly memoryId: string;
    readonly domain: MemoryDomain;
    readonly content: string;
    readonly vectorEmbedding?: number[];
    readonly privacyLabel: string;
    readonly createdAt: string;
    readonly expiresAt?: string;
  }[];
  readonly total: number;
  readonly consentTier: ConsentTier;
  readonly error?: AWAFError;
}

/**
 * payload درخواست DELETE /api/visitor/memory.
 */
export interface EraseMemoryRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly scope: 'all' | 'domain' | 'specific';
  readonly domain?: MemoryDomain;
  readonly memoryIds?: string[];
  readonly reason: 'user_request' | 'expired' | 'gdpr_article_17' | 'ccpa_deletion';
  readonly confirmationToken: string;
}

/**
 * پاسخ DELETE /api/visitor/memory.
 */
export interface EraseMemoryResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly scope: string;
  readonly deletedCount: number;
  readonly deletedIds: string[];
  readonly confirmationId: string;
  readonly gdprReceipt?: {
    readonly article: string;
    readonly processingDate: string;
    readonly retentionDaysRemaining: number;
    readonly thirdPartyNotifications: string[];
  };
  readonly error?: AWAFError;
}

// ─── Group 5: OpenClaw Mesh (Endpoints 12–14) ────────────────────────────────

/**
 * payload درخواست POST /api/claw/query.
 */
export interface ClawQueryRequest {
  readonly visitorId: string;
  readonly sessionId: string;
  readonly query: string;
  readonly domains?: MemoryDomain[];
  readonly minTrustLevel?: TrustTier;
  readonly maxResults?: number;
  readonly recencyBias?: number;
  readonly includeProvenance?: boolean;
}

/**
 * یک نتیجه جستجوی OpenClaw.
 */
export interface ClawQueryResult {
  readonly memoryId: string;
  readonly domain: MemoryDomain;
  readonly content: string;
  readonly similarity: number;
  readonly provenance?: { readonly source: string; readonly url: string; readonly accessedAt: string }[];
  readonly createdAt: string;
}

/**
 * پاسخ POST /api/claw/query.
 */
export interface ClawQueryResponse {
  readonly requestId: string;
  readonly visitorId: string;
  readonly success: boolean;
  readonly results: ClawQueryResult[];
  readonly query: {
    readonly original: string;
    readonly vectorEmbedding: number[];
    readonly processingMs: number;
  };
  readonly totalResults: number;
  readonly domainsSearched: MemoryDomain[];
  readonly error?: AWAFError;
}

/**
 * payload درخواست POST /api/claw/ingest.
 */
export interface ClawIngestRequest {
  readonly apiKey: string;
  readonly domain: MemoryDomain;
  readonly content: string;
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly trustTier: TrustTier;
  };
  readonly category?: string;
  readonly metadata?: Record<string, unknown>;
  readonly generateVector?: boolean;
}

/**
 * پاسخ POST /api/claw/ingest.
 */
export interface ClawIngestResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly memoryId: string;
  readonly domain: MemoryDomain;
  readonly provenanceValidated: boolean;
  readonly vectorGenerated: boolean;
  readonly tokensUsed: number;
  readonly duplicateCheck: {
    readonly isDuplicate: boolean;
    readonly similarTo?: string[];
  };
  readonly error?: AWAFError;
}

/**
 * payload درخواست POST /api/claw/admin/audit.
 */
export interface ClawAdminAuditRequest {
  readonly apiKey: string;
  readonly action: 'inspect' | 'delete' | 'anonymize' | 'export';
  readonly visitorId: string;
  readonly domain?: MemoryDomain;
  readonly filters?: {
    readonly dateFrom?: string;
    readonly dateTo?: string;
    readonly privacyLabel?: string;
  };
}

/**
 * پاسخ POST /api/claw/admin/audit.
 */
export interface ClawAdminAuditResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly action: string;
  readonly visitorId: string;
  readonly results: {
    readonly memoryId: string;
    readonly domain: MemoryDomain;
    readonly content: string;
    readonly privacyLabel: string;
    readonly createdAt: string;
    readonly consentTier: ConsentTier;
  }[];
  readonly auditLogId: string;
  readonly gdprCompliant: boolean;
  readonly error?: AWAFError;
}

// ─── Group 6: Admin (Endpoints 15–16) ────────────────────────────────────────

/**
 * query parameters برای GET /api/admin/visitor-insights.
 */
export interface VisitorInsightsQuery {
  readonly apiKey: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly country?: string;
  readonly granularity?: 'hourly' | 'daily' | 'weekly';
  readonly metrics?: ('visitors' | 'sessions' | 'consentRate' | 'tierDistribution' | 'languageDistribution' | 'deviceDistribution')[];
}

/**
 * پاسخ GET /api/admin/visitor-insights.
 */
export interface VisitorInsightsResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly period: { readonly from: string; readonly to: string };
  readonly summary: {
    readonly totalVisitors: number;
    readonly totalSessions: number;
    readonly avgSessionDuration: number;
    readonly consentRate: number;
  };
  readonly timeSeries: {
    readonly timestamp: string;
    readonly visitors: number;
    readonly sessions: number;
    readonly consentRate: number;
  }[];
  readonly distributions: {
    readonly consentTiers: { readonly tier: string; readonly count: number; readonly percentage: number }[];
    readonly languages: { readonly language: string; readonly count: number; readonly percentage: number }[];
    readonly devices: { readonly device: string; readonly count: number; readonly percentage: number }[];
    readonly countries: { readonly country: string; readonly count: number; readonly percentage: number }[];
  };
  readonly kAnonymityCheck: {
    readonly kValue: number;
    readonly compliant: boolean;
    readonly warnings: string[];
  };
  readonly generatedAt: string;
  readonly error?: AWAFError;
}

/**
 * query parameters برای GET /api/admin/technology-pulse/sources.
 */
export interface PulseSourcesQuery {
  readonly apiKey: string;
  readonly trustTier?: TrustTier;
  readonly status?: 'active' | 'paused' | 'deprecated';
  readonly category?: string;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * یک منبع Technology Pulse.
 */
export interface PulseSource {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly trustTier: TrustTier;
  readonly category: string;
  readonly status: 'active' | 'paused' | 'deprecated';
  readonly ingestionCount: number;
  readonly lastIngestedAt?: string;
  readonly avgTrustScore: number;
  readonly provenanceValidationRate: number;
}

/**
 * پاسخ GET /api/admin/technology-pulse/sources.
 */
export interface PulseSourcesResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly sources: PulseSource[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
  };
  readonly summary: {
    readonly totalSources: number;
    readonly activeSources: number;
    readonly t1Count: number;
    readonly t2Count: number;
    readonly t3Count: number;
  };
  readonly error?: AWAFError;
}
