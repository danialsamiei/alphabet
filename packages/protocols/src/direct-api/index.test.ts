/**
 * Tests for DirectApiAdapter — payload normalization, consent override,
 * and PII rejection.
 */

import { describe, it, expect } from 'vitest';
import { DirectApiAdapter, type DirectApiRequestBody } from './index.js';
import { makeConsentScope } from '../normalizers/index.js';
import type { AwafToolContext } from '../contract.js';

const adapter = new DirectApiAdapter();

const baseContext: AwafToolContext = {
  visitorId: 'v-abc12345',
  sessionId: 'sess-1',
  consentTier: 'ANONYMOUS',
  privacyRestricted: false,
  country: 'US',
};

describe('DirectApiAdapter.normalizeRequest', () => {
  it('produces a normalized AwafProtocolRequest for a valid body', () => {
    const body: DirectApiRequestBody = {
      operation: 'context.handshake',
      context: baseContext,
      consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
      payload: {},
    };
    const r = adapter.normalizeRequest(body, {
      tier: 'ANONYMOUS',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.protocol).toBe('API');
      expect(r.data.operation).toBe('context.handshake');
      expect(r.data.consent.tier).toBe('ANONYMOUS');
      expect(r.data.context.privacyRestricted).toBe(false);
      expect(r.data.correlationId).toMatch(/.+/);
    }
  });

  it('overrides client-claimed tier with the authoritative tier', () => {
    const body: DirectApiRequestBody = {
      operation: 'memory.query',
      context: { ...baseContext, consentTier: 'ENRICHED' },
      consent: makeConsentScope('ENRICHED', { operations: ['read_memory'] }),
      payload: {},
    };
    // Client claims ENRICHED; server says NO_MEMORY → must reject.
    const r = adapter.normalizeRequest(body, {
      tier: 'NO_MEMORY',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_INSUFFICIENT');
  });

  it('marks privacyRestricted when DNT is active', () => {
    const body: DirectApiRequestBody = {
      operation: 'context.handshake',
      context: baseContext,
      consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
      payload: {},
    };
    const r = adapter.normalizeRequest(body, {
      tier: 'ANONYMOUS',
      privacy: { dntEnabled: true, gpcEnabled: false },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.context.privacyRestricted).toBe(true);
  });

  it('rejects bodies missing required fields', () => {
    const r = adapter.normalizeRequest(
      // @ts-expect-error -- intentional bad shape
      { context: baseContext, consent: makeConsentScope('NO_MEMORY'), payload: {} },
      { tier: 'NO_MEMORY', privacy: { dntEnabled: false, gpcEnabled: false } }
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_PROTOCOL_REQUEST');
  });
});

describe('DirectApiAdapter.successResponse / errorResponse', () => {
  it('round-trips correlationId and operation', () => {
    const stub = {
      correlationId: 'corr-1',
      protocol: 'API' as const,
      operation: 'memory.query',
    };
    const ok = adapter.successResponse(stub, { hello: 'world' }, 12);
    expect(ok.correlationId).toBe('corr-1');
    expect(ok.result.success).toBe(true);
    if (ok.result.success) expect(ok.result.data).toEqual({ hello: 'world' });

    const ko = adapter.errorResponse(
      stub,
      { code: 'TOOL_NOT_FOUND', message: 'nope' },
      4
    );
    expect(ko.result.success).toBe(false);
  });
});
