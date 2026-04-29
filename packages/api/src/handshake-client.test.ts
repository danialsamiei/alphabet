/**
 * @file handshake-client.test.ts
 * @description Unit tests for HandshakeClient using fetch mock.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { HandshakeClient } from './handshake-client.js';
import type { HandshakeRequestPayload, AlphabetResponse, HandshakeResult, ResponseMeta } from '@alphabet/core';
import type { VisitorId, SessionId, RequestId } from '@alphabet/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VISITOR_ID = 'anon-test-visitor-id' as VisitorId;
const MOCK_SESSION_ID = 'sess-abc123' as SessionId;
const MOCK_REQUEST_ID = 'req-test-1' as RequestId;

const BASE_OPTIONS = {
  apiBaseUrl: 'http://localhost:3000/api',
  visitorId: VISITOR_ID,
  timeoutMs: 1000,
  maxRetries: 0,
};

const MOCK_PAYLOAD: HandshakeRequestPayload = {
  language: 'fa',
  timezone: 'Asia/Tehran',
  deviceClass: 'desktop',
  platform: 'Linux',
  screenWidth: 1440,
  screenHeight: 900,
  devicePixelRatio: 1,
  webglSupported: true,
  dntEnabled: false,
  gpcEnabled: false,
  referrer: '',
};

const MOCK_RESULT: HandshakeResult = {
  success: true,
  sessionId: MOCK_SESSION_ID,
  uiConfig: {
    locale: 'fa-IR',
    direction: 'rtl',
    theme: 'auto',
    heroCopy: 'به دنیای وب‌آگاه خوش آمدید',
    consentRequired: false,
  },
  consentGranted: false,
};

const MOCK_META: ResponseMeta = {
  processingTimeMs: 12,
  respondedAt: new Date().toISOString(),
};

function mockFetchSuccess(result: HandshakeResult): void {
  const response: AlphabetResponse<HandshakeResult> = {
    requestId: MOCK_REQUEST_ID,
    success: true,
    data: result,
    meta: MOCK_META,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(response),
  }));
}

function mockFetchError(status: number, message: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: 'SERVER_ERROR', message } }),
  }));
}

function mockFetchNetworkError(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));
}

// ─── HandshakeClient.execute() ────────────────────────────────────────────────

describe('HandshakeClient.execute()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return success on 200 response', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient(BASE_OPTIONS);
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.uiConfig.locale).toBe('fa-IR');
      expect(result.data.uiConfig.direction).toBe('rtl');
    }
  });

  it('should call POST /api/context/handshake', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient(BASE_OPTIONS);
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/context/handshake');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('should include visitorId in request body', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient(BASE_OPTIONS);
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { visitorId: string };
    expect(body.visitorId).toBe(VISITOR_ID);
  });

  it('should fail with HANDSHAKE_HTTP_ERROR on 4xx', async () => {
    mockFetchError(400, 'Bad request');
    const client = new HandshakeClient(BASE_OPTIONS);
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('HANDSHAKE_HTTP_ERROR');
    }
  });

  it('should fail with HANDSHAKE_HTTP_ERROR on 500 (no retry)', async () => {
    mockFetchError(500, 'Server error');
    const client = new HandshakeClient({ ...BASE_OPTIONS, maxRetries: 0 });
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('HANDSHAKE_HTTP_ERROR');
    }
  });

  it('should retry on 500 and succeed on second attempt', async () => {
    // First call fails, second succeeds
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          requestId: MOCK_REQUEST_ID,
          success: true,
          data: MOCK_RESULT,
          meta: MOCK_META,
        } satisfies AlphabetResponse<HandshakeResult>),
      })
    );

    const client = new HandshakeClient({ ...BASE_OPTIONS, maxRetries: 2 });
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(true);
  });

  it('should fail with HANDSHAKE_NETWORK_ERROR on network failure', async () => {
    mockFetchNetworkError();
    const client = new HandshakeClient(BASE_OPTIONS);
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('HANDSHAKE_NETWORK_ERROR');
    }
  });

  it('should fail with HANDSHAKE_INVALID_RESPONSE when success=false in body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        requestId: MOCK_REQUEST_ID,
        success: false,
        error: { code: 'CUSTOM_ERROR', message: 'Invalid' },
        meta: MOCK_META,
      } satisfies AlphabetResponse<HandshakeResult>),
    }));

    const client = new HandshakeClient(BASE_OPTIONS);
    const result = await client.execute(MOCK_PAYLOAD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CUSTOM_ERROR');
    }
  });

  it('should strip trailing slash from apiBaseUrl', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient({ ...BASE_OPTIONS, apiBaseUrl: 'http://localhost:3000/api/' });
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:3000/api/context/handshake');
  });

  it('appends /api/alphabet/v1 when apiBaseUrl has no prefix', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient({ ...BASE_OPTIONS, apiBaseUrl: 'http://localhost:3000' });
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:3000/api/alphabet/v1/context/handshake');
  });

  it('appends /api/alphabet/v1 when apiBaseUrl is bare with trailing slash', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient({ ...BASE_OPTIONS, apiBaseUrl: 'http://localhost:3000/' });
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:3000/api/alphabet/v1/context/handshake');
  });

  it('leaves a fully-qualified /api/alphabet/v1 base alone', async () => {
    mockFetchSuccess(MOCK_RESULT);
    const client = new HandshakeClient({ ...BASE_OPTIONS, apiBaseUrl: 'http://localhost:3000/api/alphabet/v1' });
    await client.execute(MOCK_PAYLOAD);

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:3000/api/alphabet/v1/context/handshake');
  });
});
