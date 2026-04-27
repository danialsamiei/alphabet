/**
 * @file awaf-client.test.ts
 * @description Unit tests for AwafClient — all 16 endpoints.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { AwafClient } from './awaf-client.js';
import type {
  ConsentRequest,
  PreferenceRequest,
  InteractRequest,
  SuggestionsQuery,
  TechnologyPulseQuery,
  TechnologyPulseBriefRequest,
  StoreMemoryRequest,
  GetMemoryQuery,
  EraseMemoryRequest,
  ClawQueryRequest,
  ClawIngestRequest,
  ClawAdminAuditRequest,
  VisitorInsightsQuery,
  PulseSourcesQuery,
  ConsentResponse,
  SuggestionsResponse,
  TechnologyPulseResponse,
  StoreMemoryResponse,
  GetMemoryResponse,
  EraseMemoryResponse,
  ClawQueryResponse,
  ClawIngestResponse,
  ClawAdminAuditResponse,
  VisitorInsightsResponse,
  PulseSourcesResponse,
} from './types.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000/api';

const CLIENT = new AwafClient({
  apiBaseUrl: BASE_URL,
  bearerToken: 'test-bearer-token',
  apiKey: 'test-api-key',
  timeoutMs: 1000,
  maxRetries: 0,
});

const CLIENT_NO_AUTH = new AwafClient({
  apiBaseUrl: BASE_URL,
  timeoutMs: 1000,
  maxRetries: 0,
});

/** موک پاسخ موفق با داده T. */
function mockSuccess<T>(data: T): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ...data, success: true }),
  }));
}

/** موک پاسخ HTTP error. */
function mockHttpError(status: number, errorCode = 'SERVER_ERROR'): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: errorCode, message: 'Error' } }),
  }));
}

/** موک خطای شبکه. */
function mockNetworkError(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));
}

/** موک پاسخ با success=false در body. */
function mockApiFailure(errorCode = 'API_FAILURE'): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: false, error: { code: errorCode, message: 'Failed' } }),
  }));
}

/** دریافت هدرهای fetch mock آخرین فراخوانی. */
function lastCallHeaders(): Record<string, string> {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls[0];
  if (call === undefined) return {};
  const [, init] = call as [string, RequestInit];
  return (init?.headers ?? {}) as Record<string, string>;
}

/** دریافت URL آخرین فراخوانی fetch. */
function lastCallUrl(): string {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls[0];
  if (call === undefined) return '';
  const [url] = call as [string];
  return url;
}

/** دریافت method آخرین فراخوانی fetch. */
function lastCallMethod(): string {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls[0];
  if (call === undefined) return '';
  const [, init] = call as [string, RequestInit];
  return init?.method ?? '';
}

afterEach(() => vi.restoreAllMocks());

// ─── Group 1: Context Handshake ───────────────────────────────────────────────

describe('postHandshake()', () => {
  it('calls POST /context/handshake without auth header', async () => {
    mockSuccess({ sessionId: 'sess-123', uiConfig: null, consentGranted: null });
    await CLIENT.postHandshake({
      language: 'fa', timezone: 'Asia/Tehran', deviceClass: 'desktop',
      platform: 'Linux', screenWidth: 1440, screenHeight: 900,
      devicePixelRatio: 1, webglSupported: true, dntEnabled: false,
      gpcEnabled: false, referrer: '',
    });

    expect(lastCallUrl()).toBe(`${BASE_URL}/context/handshake`);
    expect(lastCallMethod()).toBe('POST');
    expect(lastCallHeaders()['Authorization']).toBeUndefined();
  });

  it('returns success result on 200', async () => {
    const data = { success: true, sessionId: 'sess-abc', uiConfig: null, consentGranted: false };
    mockSuccess(data);
    const result = await CLIENT.postHandshake({
      language: 'en', timezone: 'UTC', deviceClass: 'mobile',
      platform: 'Android', screenWidth: 375, screenHeight: 667,
      devicePixelRatio: 2, webglSupported: false, dntEnabled: true,
      gpcEnabled: false, referrer: '',
    });

    expect(result.success).toBe(true);
  });

  it('returns error result on network failure', async () => {
    mockNetworkError();
    const result = await CLIENT.postHandshake({
      language: 'en', timezone: 'UTC', deviceClass: 'desktop',
      platform: 'Linux', screenWidth: 1280, screenHeight: 800,
      devicePixelRatio: 1, webglSupported: true, dntEnabled: false,
      gpcEnabled: false, referrer: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NETWORK_ERROR');
  });
});

describe('postConsent()', () => {
  const PAYLOAD: ConsentRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    action: 'grant', tier: 'ANONYMOUS',
    purposes: [{ id: 'p1', name: 'P1', description: 'desc', granted: true }],
    duration: '30d',
  };

  it('calls POST /context/consent with Bearer header', async () => {
    const response: Partial<ConsentResponse> = {
      requestId: 'req-1', visitorId: 'anon-test', action: 'grant',
      previousTier: 'NO_MEMORY', currentTier: 'ANONYMOUS', state: 'granted',
    };
    mockSuccess(response);
    await CLIENT.postConsent(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/context/consent`);
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('returns UNAUTHORIZED error on 401', async () => {
    mockHttpError(401, 'UNAUTHORIZED');
    const result = await CLIENT.postConsent(PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('returns API_FAILURE on success=false in body', async () => {
    mockApiFailure('CONSENT_REQUIRED');
    const result = await CLIENT.postConsent(PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONSENT_REQUIRED');
  });
});

describe('postPreference()', () => {
  const PAYLOAD: PreferenceRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    language: 'fa', topics: ['AI'], theme: 'dark',
  };

  it('calls POST /context/preference with Bearer header', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test', preferences: {
      language: 'fa', topics: ['AI'], contentDepth: 'overview', notificationPrefs: 'none', theme: 'dark',
    }, updatedAt: '', effectiveTier: 'ANONYMOUS' });
    await CLIENT.postPreference(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/context/preference`);
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

// ─── Group 2: Visitor Interaction ────────────────────────────────────────────

describe('postInteract()', () => {
  const PAYLOAD: InteractRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    message: 'Hello', inputMode: 'text',
  };

  it('calls POST /interact with Bearer header', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test',
      response: { text: 'Hi!' }, tokenUsage: { prompt: 10, completion: 5, total: 15 }, streaming: false });
    await CLIENT.postInteract(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/interact`);
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('forces streaming:false in request body', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test',
      response: { text: 'Hi!' }, tokenUsage: { prompt: 10, completion: 5, total: 15 }, streaming: false });
    await CLIENT.postInteract({ ...PAYLOAD, streaming: true }); // caller says streaming=true but postInteract forces false

    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { streaming: boolean };
    expect(body.streaming).toBe(false);
  });

  it('returns error on 429', async () => {
    mockHttpError(429, 'RATE_LIMIT_EXCEEDED');
    const result = await CLIENT.postInteract(PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('getSuggestions()', () => {
  const QUERY: SuggestionsQuery = { visitorId: 'anon-test', limit: 6 };

  it('calls GET /suggestions with query params (no auth)', async () => {
    const data: Partial<SuggestionsResponse> = {
      requestId: 'req-1', visitorId: 'anon-test', suggestions: [], generatedAt: '',
    };
    mockSuccess(data);
    await CLIENT_NO_AUTH.getSuggestions(QUERY);

    expect(lastCallUrl()).toContain(`${BASE_URL}/suggestions?`);
    expect(lastCallUrl()).toContain('visitorId=anon-test');
    expect(lastCallUrl()).toContain('limit=6');
    expect(lastCallMethod()).toBe('GET');
    expect(lastCallHeaders()['Authorization']).toBeUndefined();
  });
});

describe('postVoiceTranscribe()', () => {
  it('calls POST /voice/transcribe with Bearer header and FormData', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test',
      transcription: { text: 'سلام', confidence: 0.95, language: 'fa', durationMs: 2000 } });
    const blob = new Blob(['audio'], { type: 'audio/mp3' });
    await CLIENT.postVoiceTranscribe('anon-test', 'sess-test', blob, 'fa');

    expect(lastCallUrl()).toBe(`${BASE_URL}/voice/transcribe`);
    expect(lastCallMethod()).toBe('POST');
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

// ─── Group 3: Technology Pulse ────────────────────────────────────────────────

describe('getTechnologyPulse()', () => {
  const QUERY: TechnologyPulseQuery = { category: 'AI', trustTier: 'T1', page: 1, limit: 20 };

  it('calls GET /technology-pulse with query params (no auth)', async () => {
    const data: Partial<TechnologyPulseResponse> = {
      requestId: 'req-1', signals: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      facets: { categories: [], sources: [], trustTiers: [] },
    };
    mockSuccess(data);
    await CLIENT_NO_AUTH.getTechnologyPulse(QUERY);

    expect(lastCallUrl()).toContain(`${BASE_URL}/technology-pulse?`);
    expect(lastCallUrl()).toContain('category=AI');
    expect(lastCallUrl()).toContain('trustTier=T1');
    expect(lastCallHeaders()['Authorization']).toBeUndefined();
  });
});

describe('postTechnologyPulseBrief()', () => {
  const PAYLOAD: TechnologyPulseBriefRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test', period: 'daily',
  };

  it('calls POST /technology-pulse/brief with Bearer header', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test', brief: {
      title: 'Daily Brief', period: 'daily', generatedAt: '',
      summary: 'Summary', highlights: [], categoryBreakdown: [], trustDistribution: [],
    } });
    await CLIENT.postTechnologyPulseBrief(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/technology-pulse/brief`);
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

// ─── Group 4: Memory ──────────────────────────────────────────────────────────

describe('postVisitorMemory()', () => {
  const PAYLOAD: StoreMemoryRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    domain: 'visitor', content: 'User prefers dark theme',
    privacyLabel: 'isolated',
  };

  it('calls POST /visitor/memory with Bearer header', async () => {
    const data: Partial<StoreMemoryResponse> = {
      requestId: 'req-1', visitorId: 'anon-test',
      memory: { memoryId: 'mem-abc', domain: 'visitor', content: '', privacyLabel: 'isolated', createdAt: '' },
      consentTier: 'CONSENTED', tokensUsed: 5,
    };
    mockSuccess(data);
    await CLIENT.postVisitorMemory(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/visitor/memory`);
    expect(lastCallMethod()).toBe('POST');
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('returns CONSENT_REQUIRED on 403', async () => {
    mockHttpError(403, 'CONSENT_REQUIRED');
    const result = await CLIENT.postVisitorMemory(PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONSENT_REQUIRED');
  });
});

describe('getVisitorMemory()', () => {
  const QUERY: GetMemoryQuery = { visitorId: 'anon-test', sessionId: 'sess-test', domain: 'visitor' };

  it('calls GET /visitor/memory with query params and Bearer header', async () => {
    const data: Partial<GetMemoryResponse> = {
      requestId: 'req-1', visitorId: 'anon-test', memories: [], total: 0, consentTier: 'CONSENTED',
    };
    mockSuccess(data);
    await CLIENT.getVisitorMemory(QUERY);

    expect(lastCallUrl()).toContain(`${BASE_URL}/visitor/memory?`);
    expect(lastCallUrl()).toContain('domain=visitor');
    expect(lastCallMethod()).toBe('GET');
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

describe('deleteVisitorMemory()', () => {
  const PAYLOAD: EraseMemoryRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    scope: 'all', reason: 'gdpr_article_17', confirmationToken: 'ct-abc',
  };

  it('calls DELETE /visitor/memory with Bearer header', async () => {
    const data: Partial<EraseMemoryResponse> = {
      requestId: 'req-1', visitorId: 'anon-test', scope: 'all',
      deletedCount: 5, deletedIds: [], confirmationId: 'cfm-abc',
    };
    mockSuccess(data);
    await CLIENT.deleteVisitorMemory(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/visitor/memory`);
    expect(lastCallMethod()).toBe('DELETE');
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

// ─── Group 5: OpenClaw Mesh ───────────────────────────────────────────────────

describe('postClawQuery()', () => {
  const PAYLOAD: ClawQueryRequest = {
    visitorId: 'anon-test', sessionId: 'sess-test',
    query: 'latest AI developments', domains: ['tech_pulse'],
  };

  it('calls POST /claw/query with Bearer header', async () => {
    const data: Partial<ClawQueryResponse> = {
      requestId: 'req-1', visitorId: 'anon-test', results: [],
      query: { original: '', vectorEmbedding: [], processingMs: 10 },
      totalResults: 0, domainsSearched: ['tech_pulse'],
    };
    mockSuccess(data);
    await CLIENT.postClawQuery(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/claw/query`);
    expect(lastCallHeaders()['Authorization']).toBe('Bearer test-bearer-token');
  });
});

describe('postClawIngest()', () => {
  const PAYLOAD: ClawIngestRequest = {
    apiKey: 'ak_claw_xxx', domain: 'tech_pulse',
    content: 'MIT announced a breakthrough in quantum computing',
    source: { name: 'MIT News', url: 'https://news.mit.edu', trustTier: 'T1' },
    generateVector: true,
  };

  it('calls POST /claw/ingest with X-API-Key header', async () => {
    const data: Partial<ClawIngestResponse> = {
      requestId: 'req-1', memoryId: 'mem-abc', domain: 'tech_pulse',
      provenanceValidated: true, vectorGenerated: true, tokensUsed: 20,
      duplicateCheck: { isDuplicate: false },
    };
    mockSuccess(data);
    await CLIENT.postClawIngest(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/claw/ingest`);
    expect(lastCallHeaders()['X-API-Key']).toBe('test-api-key');
    expect(lastCallHeaders()['Authorization']).toBeUndefined();
  });
});

describe('postClawAdminAudit()', () => {
  const PAYLOAD: ClawAdminAuditRequest = {
    apiKey: 'ak_admin_xxx', action: 'inspect', visitorId: 'anon-test',
  };

  it('calls POST /claw/admin/audit with X-API-Key header', async () => {
    const data: Partial<ClawAdminAuditResponse> = {
      requestId: 'req-1', action: 'inspect', visitorId: 'anon-test',
      results: [], auditLogId: 'aud-abc', gdprCompliant: true,
    };
    mockSuccess(data);
    await CLIENT.postClawAdminAudit(PAYLOAD);

    expect(lastCallUrl()).toBe(`${BASE_URL}/claw/admin/audit`);
    expect(lastCallHeaders()['X-API-Key']).toBe('test-api-key');
  });
});

// ─── Group 6: Admin ───────────────────────────────────────────────────────────

describe('getAdminVisitorInsights()', () => {
  const QUERY: VisitorInsightsQuery = {
    apiKey: 'ak_admin_xxx', dateFrom: '2026-04-01', granularity: 'daily',
  };

  it('calls GET /admin/visitor-insights with X-API-Key header', async () => {
    const data: Partial<VisitorInsightsResponse> = {
      requestId: 'req-1',
      period: { from: '2026-04-01', to: '2026-04-27' },
      summary: { totalVisitors: 100, totalSessions: 200, avgSessionDuration: 120, consentRate: 0.6 },
      timeSeries: [], distributions: { consentTiers: [], languages: [], devices: [], countries: [] },
      kAnonymityCheck: { kValue: 5, compliant: true, warnings: [] },
      generatedAt: '',
    };
    mockSuccess(data);
    await CLIENT.getAdminVisitorInsights(QUERY);

    expect(lastCallUrl()).toContain(`${BASE_URL}/admin/visitor-insights?`);
    expect(lastCallUrl()).toContain('granularity=daily');
    expect(lastCallMethod()).toBe('GET');
    expect(lastCallHeaders()['X-API-Key']).toBe('test-api-key');
  });
});

describe('getAdminPulseSources()', () => {
  const QUERY: PulseSourcesQuery = {
    apiKey: 'ak_admin_xxx', trustTier: 'T1', status: 'active',
  };

  it('calls GET /admin/technology-pulse/sources with X-API-Key header', async () => {
    const data: Partial<PulseSourcesResponse> = {
      requestId: 'req-1', sources: [],
      pagination: { page: 1, limit: 20, total: 0 },
      summary: { totalSources: 0, activeSources: 0, t1Count: 0, t2Count: 0, t3Count: 0 },
    };
    mockSuccess(data);
    await CLIENT.getAdminPulseSources(QUERY);

    expect(lastCallUrl()).toContain(`${BASE_URL}/admin/technology-pulse/sources?`);
    expect(lastCallUrl()).toContain('trustTier=T1');
    expect(lastCallHeaders()['X-API-Key']).toBe('test-api-key');
  });
});

// ─── Retry Behavior ───────────────────────────────────────────────────────────

describe('retry on 5xx', () => {
  it('retries on 503 and succeeds on second attempt', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          success: true, requestId: 'req-1', visitorId: 'anon-test',
          suggestions: [], generatedAt: '',
        }),
      }),
    );

    const client = new AwafClient({ apiBaseUrl: BASE_URL, maxRetries: 2, timeoutMs: 1000 });
    const result = await client.getSuggestions({ visitorId: 'anon-test' });

    expect(result.success).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 4xx', async () => {
    mockHttpError(400, 'VALIDATION_ERROR');
    const client = new AwafClient({ apiBaseUrl: BASE_URL, maxRetries: 2, timeoutMs: 1000 });
    const result = await client.getSuggestions({ visitorId: 'anon-test' });

    expect(result.success).toBe(false);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

// ─── URL Builder ──────────────────────────────────────────────────────────────

describe('URL building', () => {
  it('strips trailing slash from apiBaseUrl', async () => {
    const client = new AwafClient({ apiBaseUrl: `${BASE_URL}/`, maxRetries: 0, timeoutMs: 1000 });
    mockSuccess({ requestId: 'req-1', signals: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      facets: { categories: [], sources: [], trustTiers: [] } });
    await client.getTechnologyPulse({});

    expect(lastCallUrl()).toMatch(/^http:\/\/localhost:3000\/api\/technology-pulse/);
  });

  it('skips undefined/null query params', async () => {
    mockSuccess({ requestId: 'req-1', visitorId: 'anon-test', suggestions: [], generatedAt: '' });
    const q: SuggestionsQuery = { visitorId: 'anon-test' }; // no limit, no sessionId
    await CLIENT_NO_AUTH.getSuggestions(q);

    const url = lastCallUrl();
    expect(url).not.toContain('limit=');
    expect(url).not.toContain('sessionId=');
    expect(url).toContain('visitorId=anon-test');
  });
});
