/**
 * Integration tests: the mock server should accept and respond to all 16
 * AWAF endpoints with envelopes that pass runtime validation.
 *
 * These tests are the W1 exit criterion: a consumer can install
 * `@awaf/api`, point it at the mock server, and round-trip every endpoint
 * with no external services.
 */
import { describe, it, expect } from 'vitest';
import { AWAF_ROUTES, fullRoute } from '@awaf/core';
import {
  awafResponseSchema,
  responseMetaSchema,
  v,
  handshakeResultSchema,
} from '@awaf/core/contracts/runtime';
import { createMockServer } from '../../src/mock/index.js';
import { withRetry } from '../../src/transport/retry.js';

const noSleep = (_ms: number): Promise<void> => Promise.resolve();

describe('mock server — envelope shape (all 16 endpoints)', () => {
  const mock = createMockServer({ seed: 7 });
  const passthroughSchema = awafResponseSchema(v.unknown());

  // Method × path matrix for all 16 endpoints.
  const cases: Array<{ key: keyof typeof AWAF_ROUTES; method: string; body?: unknown }> = [
    { key: 'contextHandshake', method: 'POST', body: { language: 'en' } },
    { key: 'contextConsent', method: 'POST', body: { tier: 'CONSENTED' } },
    { key: 'contextPreference', method: 'POST', body: { reducedMotion: false } },
    { key: 'interact', method: 'POST', body: { prompt: 'hi' } },
    { key: 'voiceTranscribe', method: 'POST', body: {} },
    { key: 'suggestions', method: 'GET' },
    { key: 'technologyPulse', method: 'GET' },
    { key: 'technologyPulseBrief', method: 'POST', body: { period: 'daily' } },
    { key: 'visitorMemoryStore', method: 'POST', body: { content: 'x' } },
    { key: 'visitorMemoryRead', method: 'GET' },
    { key: 'visitorMemoryDelete', method: 'DELETE', body: { scope: 'all' } },
    { key: 'clawQuery', method: 'POST', body: { query: 'x' } },
    { key: 'clawIngest', method: 'POST', body: { content: 'x' } },
    { key: 'clawAdminAudit', method: 'POST', body: { action: 'inspect' } },
    { key: 'adminVisitorInsights', method: 'GET' },
    { key: 'adminPulseSources', method: 'GET' },
  ];

  it.each(cases)('$method $key returns a valid AWAFResponse envelope', async ({ key, method, body }) => {
    const path = fullRoute(key);
    const response = await mock.request(path, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(200);

    const json = await response.json();
    const validated = passthroughSchema.validate(json);
    expect(validated.success).toBe(true);
    if (!validated.success) {
      console.error('Validation failure for', key, validated.error);
    }

    // ResponseMeta must always be present and valid.
    const env = json as { meta: unknown };
    expect(responseMetaSchema.validate(env.meta).success).toBe(true);
  });
});

describe('mock server — handshake validates against the typed schema', () => {
  it('returns a HandshakeResult that passes runtime validation', async () => {
    const mock = createMockServer({ seed: 42 });
    const response = await mock.request(fullRoute('contextHandshake'), {
      method: 'POST',
      body: JSON.stringify({ language: 'en', timezone: 'UTC' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const json = (await response.json()) as { data: unknown };
    const r = handshakeResultSchema.validate(json.data);
    expect(r.success).toBe(true);
  });
});

describe('mock server — determinism', () => {
  it('two servers with the same seed produce byte-identical responses', async () => {
    const mockA = createMockServer({ seed: 99 });
    const mockB = createMockServer({ seed: 99 });
    const url = fullRoute('contextHandshake');
    const init = {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    };
    const a = await (await mockA.request(url, init)).text();
    const b = await (await mockB.request(url, init)).text();
    expect(a).toBe(b);
  });

  it('reset() returns the seed to its initial state', async () => {
    const mock = createMockServer({ seed: 5 });
    const url = fullRoute('contextHandshake');
    const init = {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    };
    const first = await (await mock.request(url, init)).text();
    mock.reset();
    const second = await (await mock.request(url, init)).text();
    // The requestId encodes the call counter, which reset() also resets.
    expect(first).toBe(second);
  });
});

describe('mock server — unknown route returns 404 envelope', () => {
  it('returns a 404 with a structured AWAFError', async () => {
    const mock = createMockServer({ seed: 1 });
    const response = await mock.request('/api/awaf/v1/does/not/exist', { method: 'GET' });
    expect(response.status).toBe(404);
    const json = (await response.json()) as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});

describe('mock server — forced failure + retry composition', () => {
  it('first 2 calls fail with 503, retry decorator recovers on 3rd', async () => {
    const mock = createMockServer({ seed: 1, forceFailure: { failFirst: 2, status: 503 } });
    const fetcher = withRetry(mock, {
      maxRetries: 4,
      baseDelayMs: 1,
      maxDelayMs: 5,
      sleep: noSleep,
      random: () => 0,
    });
    const url = fullRoute('suggestions');
    const r = await fetcher.request(url, { method: 'GET' });
    expect(r.status).toBe(200);
    expect(mock.callCount()).toBe(3); // initial + 2 retries
  });

  it('returns the configured failure status when retries are exhausted', async () => {
    const mock = createMockServer({ seed: 1, forceFailure: { failFirst: 5, status: 503 } });
    const fetcher = withRetry(mock, {
      maxRetries: 1,
      baseDelayMs: 1,
      maxDelayMs: 5,
      sleep: noSleep,
      random: () => 0,
    });
    const r = await fetcher.request(fullRoute('suggestions'), { method: 'GET' });
    expect(r.status).toBe(503);
    expect(mock.callCount()).toBe(2);
  });
});

describe('mock server — legacy /api prefix is also routed', () => {
  it('accepts /api/context/handshake and the canonical /api/awaf/v1 path', async () => {
    const mock = createMockServer({ seed: 1 });
    const init = { method: 'POST', body: JSON.stringify({}) };
    const a = await mock.request('/api/context/handshake', init);
    const b = await mock.request('/api/awaf/v1/context/handshake', init);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });
});
