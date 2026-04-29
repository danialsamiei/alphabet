/**
 * Tests for hand-authored Alphabet envelope/handshake schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  alphabetErrorSchema,
  alphabetRequestSchema,
  alphabetResponseSchema,
  consentTierSchema,
  handshakePayloadSchema,
  handshakeResultSchema,
  responseMetaSchema,
} from './schemas.js';
import { v } from './structural.js';

describe('contracts/runtime/schemas — primitives', () => {
  it('consentTierSchema accepts the four documented tiers', () => {
    expect(consentTierSchema.validate('NO_MEMORY').success).toBe(true);
    expect(consentTierSchema.validate('ANONYMOUS').success).toBe(true);
    expect(consentTierSchema.validate('CONSENTED').success).toBe(true);
    expect(consentTierSchema.validate('ENRICHED').success).toBe(true);
  });
  it('consentTierSchema rejects unknown tiers', () => {
    expect(consentTierSchema.validate('PARTIAL').success).toBe(false);
    expect(consentTierSchema.validate('').success).toBe(false);
  });

  it('responseMetaSchema requires processingTimeMs and respondedAt', () => {
    const valid = { processingTimeMs: 12, respondedAt: '2026-01-01T00:00:00Z' };
    expect(responseMetaSchema.validate(valid).success).toBe(true);
    expect(responseMetaSchema.validate({ respondedAt: 'now' }).success).toBe(false);
  });

  it('alphabetErrorSchema accepts the {code, message} minimal shape', () => {
    expect(alphabetErrorSchema.validate({ code: 'X', message: 'y' }).success).toBe(true);
    expect(alphabetErrorSchema.validate({ code: 'X' }).success).toBe(false);
  });
});

describe('contracts/runtime/schemas — AlphabetRequest envelope', () => {
  const payloadSchema = v.object({ language: v.string() });
  const reqSchema = alphabetRequestSchema(payloadSchema);

  const validRequest = {
    protocol: 'API' as const,
    endpoint: '/api/alphabet/v1/context/handshake',
    visitorId: 'vst_123',
    sessionId: 'ses_456',
    consentTier: 'NO_MEMORY' as const,
    payload: { language: 'en' },
    timestamp: '2026-01-01T00:00:00Z',
    requestId: 'req_789',
  };

  it('accepts a well-formed request envelope', () => {
    const r = reqSchema.validate(validRequest);
    expect(r.success).toBe(true);
  });

  it('rejects unknown protocol', () => {
    const r = reqSchema.validate({ ...validRequest, protocol: 'GRPC' });
    expect(r.success).toBe(false);
  });

  it('rejects payload mismatches and surfaces the path', () => {
    const r = reqSchema.validate({ ...validRequest, payload: { language: 0 } });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.details.issues![0]!;
      expect(issue.path).toEqual(['payload', 'language']);
    }
  });
});

describe('contracts/runtime/schemas — AlphabetResponse envelope', () => {
  const dataSchema = v.object({ ok: v.boolean() });
  const resSchema = alphabetResponseSchema(dataSchema);

  const meta = { processingTimeMs: 1, respondedAt: '2026-01-01T00:00:00Z' };

  it('accepts a success response with data', () => {
    expect(
      resSchema.validate({
        requestId: 'r1',
        success: true,
        data: { ok: true },
        meta,
      }).success,
    ).toBe(true);
  });

  it('accepts a failure response with error', () => {
    expect(
      resSchema.validate({
        requestId: 'r1',
        success: false,
        error: { code: 'BAD', message: 'nope' },
        meta,
      }).success,
    ).toBe(true);
  });

  it('rejects responses missing meta', () => {
    expect(
      resSchema.validate({ requestId: 'r1', success: true, data: { ok: true } }).success,
    ).toBe(false);
  });

  it('reports validation path inside data', () => {
    const r = resSchema.validate({
      requestId: 'r1',
      success: true,
      data: { ok: 'yes' },
      meta,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.details.issues![0]!.path).toEqual(['data', 'ok']);
    }
  });
});

describe('contracts/runtime/schemas — handshake payload & result', () => {
  it('handshakePayloadSchema accepts a minimal payload', () => {
    expect(handshakePayloadSchema.validate({}).success).toBe(true);
  });

  it('handshakePayloadSchema accepts a fully populated payload', () => {
    const r = handshakePayloadSchema.validate({
      language: 'fa',
      timezone: 'Asia/Tehran',
      userAgent: 'curl/8',
      viewport: { width: 1280, height: 720, dpr: 2 },
      capabilities: { webgl2: true, hardwareConcurrency: 8 },
      preferences: { reducedMotion: false, colorScheme: 'dark' },
      privacy: { doNotTrack: false, globalPrivacyControl: true },
      geo: { country: 'IR', timezone: 'Asia/Tehran' },
    });
    expect(r.success).toBe(true);
  });

  it('handshakePayloadSchema rejects malformed nested viewport', () => {
    const r = handshakePayloadSchema.validate({ viewport: { width: 'big' } });
    expect(r.success).toBe(false);
  });

  it('handshakeResultSchema accepts a minimal valid handshake result', () => {
    const r = handshakeResultSchema.validate({
      visitorId: 'vst_1',
      sessionId: 'ses_1',
      selectedLayer: 'STATIC',
      uiConfig: { locale: 'en-US', direction: 'ltr' },
    });
    expect(r.success).toBe(true);
  });

  it('handshakeResultSchema rejects unknown layer values', () => {
    const r = handshakeResultSchema.validate({
      visitorId: 'a',
      sessionId: 'b',
      selectedLayer: 'WEBGPU',
      uiConfig: { locale: 'en', direction: 'ltr' },
    });
    expect(r.success).toBe(false);
  });

  it('handshakeResultSchema reports the offending direction value', () => {
    const r = handshakeResultSchema.validate({
      visitorId: 'a',
      sessionId: 'b',
      selectedLayer: 'STATIC',
      uiConfig: { locale: 'en', direction: 'sideways' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.details.issues![0]!.path).toEqual(['uiConfig', 'direction']);
    }
  });
});
