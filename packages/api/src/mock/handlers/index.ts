/**
 * @module mock/handlers
 * @description
 * Deterministic handlers for every Alphabet endpoint. Each handler returns a
 * standard `AlphabetResponse` envelope with seeded values so tests can assert
 * exact equality.
 *
 * Adding a new handler:
 * 1. Implement a function with the {@link RouteHandler} signature.
 * 2. Register it in `routeHandlers` keyed by the matching `ALPHABET_ROUTES` key.
 * 3. Add an integration test in `test/integration/`.
 */

import { ALPHABET_ROUTES } from '@alphabet/core';
import type { SeededRng } from '../seeded-rng.js';

/** Context object passed to every handler. */
export interface MockHandlerContext {
  readonly method: string;
  readonly url: URL;
  readonly headers: Headers;
  readonly payload: unknown;
  readonly rng: SeededRng;
  readonly callCount: number;
}

export type RouteHandler = (ctx: MockHandlerContext) => Response;

const ISO = (): string => new Date(0).toISOString();

function envelope(
  ctx: MockHandlerContext,
  data: unknown,
  meta: Partial<{ processingTimeMs: number; rateLimitRemaining: number; rateLimitResetSec: number }> = {},
): Response {
  const body = {
    requestId: `req_mock_${ctx.callCount}`,
    success: true,
    data,
    meta: {
      processingTimeMs: meta.processingTimeMs ?? ctx.rng.nextInt(5, 50),
      respondedAt: ISO(),
      ...(meta.rateLimitRemaining !== undefined ? { rateLimitRemaining: meta.rateLimitRemaining } : {}),
      ...(meta.rateLimitResetSec !== undefined ? { rateLimitResetSec: meta.rateLimitResetSec } : {}),
    },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function methodNotAllowed(method: string): Response {
  return new Response(
    JSON.stringify({
      requestId: 'req_mock_mna',
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${method} not allowed` },
      meta: { processingTimeMs: 0, respondedAt: ISO() },
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } },
  );
}

const LAYERS = ['R3F', 'CSS3D', 'CANVAS2D', 'STATIC', 'TEXT_ONLY'] as const;
const TIERS = ['NO_MEMORY', 'ANONYMOUS', 'CONSENTED', 'ENRICHED'] as const;
const DOMAINS = ['general', 'site_specific', 'visitor', 'class_notes', 'ideas', 'social', 'tech_pulse'] as const;
const TRUST = ['T1', 'T2', 'T3'] as const;

// ─── Handlers ────────────────────────────────────────────────────────────────

const handlerHandshake: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  const visitorId = `vst_${ctx.rng.nextInt(100000, 999999).toString(16)}`;
  const sessionId = `ses_${ctx.rng.nextInt(100000, 999999).toString(16)}`;
  return envelope(ctx, {
    visitorId,
    sessionId,
    selectedLayer: ctx.rng.pick(LAYERS),
    uiConfig: {
      locale: 'en-US',
      direction: 'ltr',
      theme: 'auto',
      heroCopy: 'Welcome to Alphabet',
      consentRequired: true,
      cssVariables: { '--alphabet-accent': '#3366cc' },
    },
    privacyMode: 'standard',
  });
};

const handlerConsent: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    visitorId: 'vst_mock',
    consentTier: ctx.rng.pick(TIERS),
    grantedAt: ISO(),
    expiresAt: '2030-01-01T00:00:00Z',
    receipt: { id: `rcpt_${ctx.callCount}`, hash: 'sha256-mock' },
  });
};

const handlerPreference: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    visitorId: 'vst_mock',
    preferences: { reducedMotion: false, locale: 'en-US' },
    updatedAt: ISO(),
  });
};

const handlerInteract: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    requestId: `req_mock_${ctx.callCount}`,
    visitorId: 'vst_mock',
    sessionId: 'ses_mock',
    response: { text: 'Hello from the Alphabet mock server.', tokensUsed: 12 },
    consentTier: 'ANONYMOUS',
    streaming: false,
  });
};

const handlerVoiceTranscribe: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    requestId: `req_mock_${ctx.callCount}`,
    transcript: 'Mock transcript: hello world',
    durationMs: ctx.rng.nextInt(500, 2000),
    language: 'en',
  });
};

const handlerSuggestions: RouteHandler = (ctx) => {
  if (ctx.method !== 'GET') return methodNotAllowed(ctx.method);
  const max = Number(ctx.url.searchParams.get('limit') ?? '3');
  const count = Math.max(1, Math.min(10, Number.isFinite(max) ? max : 3));
  const suggestions = Array.from({ length: count }, (_, i) => ({
    id: `sug_${ctx.callCount}_${i}`,
    label: `Suggestion ${i + 1}`,
    intentType: ctx.rng.pick(['explore', 'learn', 'compare'] as const),
    score: Number(ctx.rng.next().toFixed(3)),
  }));
  return envelope(ctx, { suggestions, generatedAt: ISO() });
};

const handlerPulse: RouteHandler = (ctx) => {
  if (ctx.method !== 'GET') return methodNotAllowed(ctx.method);
  const limit = Math.max(1, Math.min(20, Number(ctx.url.searchParams.get('limit') ?? '5')));
  const signals = Array.from({ length: limit }, (_, i) => ({
    id: `sig_${ctx.callCount}_${i}`,
    title: `Signal ${i + 1}`,
    summary: 'Deterministic mock signal',
    trustTier: ctx.rng.pick(TRUST),
    publishedAt: ISO(),
  }));
  return envelope(ctx, { signals, total: signals.length });
};

const handlerPulseBrief: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    brief: {
      title: 'Daily Technology Pulse',
      period: 'daily',
      generatedAt: ISO(),
      summary: 'Mock brief summary.',
      highlights: [{ title: 'A', description: 'B', signalId: 'sig_mock_0' }],
      categoryBreakdown: [{ category: 'AI', count: 3, topSignal: 'sig_mock_0' }],
      trustDistribution: [{ tier: 'T1', count: 2 }, { tier: 'T2', count: 1 }],
    },
  });
};

const handlerMemoryStore: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    memory: {
      memoryId: `mem_${ctx.callCount}`,
      domain: ctx.rng.pick(DOMAINS),
      content: 'mock content',
      privacyLabel: 'isolated',
      createdAt: ISO(),
    },
    consentTier: 'CONSENTED',
    tokensUsed: ctx.rng.nextInt(1, 50),
  });
};

const handlerMemoryRead: RouteHandler = (ctx) => {
  if (ctx.method === 'DELETE') return handlerMemoryDelete(ctx);
  if (ctx.method !== 'GET') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    memories: [
      {
        memoryId: `mem_${ctx.callCount}`,
        domain: 'general',
        content: 'mock memory',
        privacyLabel: 'correlation_allowed',
        createdAt: ISO(),
      },
    ],
    total: 1,
    consentTier: 'CONSENTED',
  });
};

const handlerMemoryDelete: RouteHandler = (ctx) => {
  if (ctx.method !== 'DELETE') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    scope: 'all',
    deletedCount: ctx.rng.nextInt(0, 5),
    deletedIds: [`mem_${ctx.callCount}`],
    confirmationId: `conf_${ctx.callCount}`,
  });
};

const handlerClawQuery: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    results: [],
    query: { original: 'mock', vectorEmbedding: [], processingMs: 1 },
    totalResults: 0,
    domainsSearched: ['general'],
  });
};

const handlerClawIngest: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    memoryId: `mem_${ctx.callCount}`,
    domain: 'general',
    provenanceValidated: true,
    vectorGenerated: false,
    tokensUsed: 0,
    duplicateCheck: { isDuplicate: false },
  });
};

const handlerClawAdminAudit: RouteHandler = (ctx) => {
  if (ctx.method !== 'POST') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    action: 'inspect',
    visitorId: 'vst_mock',
    results: [],
    auditLogId: `audit_${ctx.callCount}`,
    gdprCompliant: true,
  });
};

const handlerAdminInsights: RouteHandler = (ctx) => {
  if (ctx.method !== 'GET') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    period: { from: ISO(), to: ISO() },
    summary: { totalVisitors: 0, totalSessions: 0, avgSessionDuration: 0, consentRate: 0 },
    timeSeries: [],
    distributions: { consentTiers: [], languages: [], devices: [], countries: [] },
    kAnonymityCheck: { kValue: 5, compliant: true, warnings: [] },
    generatedAt: ISO(),
  });
};

const handlerAdminPulseSources: RouteHandler = (ctx) => {
  if (ctx.method !== 'GET') return methodNotAllowed(ctx.method);
  return envelope(ctx, {
    sources: [],
    pagination: { page: 1, limit: 20, total: 0 },
    summary: { totalSources: 0, activeSources: 0, t1Count: 0 },
  });
};

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Map of {@link ALPHABET_ROUTES} keys to their mock handler functions. Note that
 * the `visitorMemoryStore`, `visitorMemoryRead`, and `visitorMemoryDelete`
 * keys all share the same path; resolution is by HTTP method inside the
 * handler. The store-key handler is the canonical entry; the read-key
 * dispatches on method.
 */
export const routeHandlers: Readonly<Record<keyof typeof ALPHABET_ROUTES, RouteHandler>> = {
  contextHandshake: handlerHandshake,
  contextConsent: handlerConsent,
  contextPreference: handlerPreference,
  interact: handlerInteract,
  voiceTranscribe: handlerVoiceTranscribe,
  suggestions: handlerSuggestions,
  technologyPulse: handlerPulse,
  technologyPulseBrief: handlerPulseBrief,
  // All three share the same path '/visitor/memory'; the unified handler
  // dispatches by HTTP method.
  visitorMemoryStore: (ctx) => {
    if (ctx.method === 'POST') return handlerMemoryStore(ctx);
    if (ctx.method === 'GET') return handlerMemoryRead(ctx);
    if (ctx.method === 'DELETE') return handlerMemoryDelete(ctx);
    return methodNotAllowed(ctx.method);
  },
  visitorMemoryRead: handlerMemoryRead,
  visitorMemoryDelete: handlerMemoryDelete,
  clawQuery: handlerClawQuery,
  clawIngest: handlerClawIngest,
  clawAdminAudit: handlerClawAdminAudit,
  adminVisitorInsights: handlerAdminInsights,
  adminPulseSources: handlerAdminPulseSources,
};
