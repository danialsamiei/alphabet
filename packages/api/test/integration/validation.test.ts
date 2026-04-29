/**
 * Validation tests: a malformed mock response surfaces as a
 * `ValidationError`, never as a thrown exception.
 *
 * The `Validator<T>.validate` API is the structural-vs-semantic boundary:
 * the compiler guarantees the *shape* of the type, but a wire payload
 * could still be wrong (server bug, version mismatch). These tests prove
 * that:
 *
 * 1. A correct mock response validates as `Result.success`.
 * 2. An incorrect mock response validates as `Result.error` with a
 *    `path[]` that points at the offending field.
 * 3. The validation never throws.
 */
import { describe, it, expect } from 'vitest';
import { fullRoute } from '@alphabet/core';
import {
  alphabetResponseSchema,
  handshakeResultSchema,
  v,
} from '@alphabet/core/contracts/runtime';
import { createMockServer } from '../../src/mock/index.js';

describe('runtime validation — well-formed mock responses', () => {
  it('handshake response passes the typed schema', async () => {
    const mock = createMockServer({ seed: 1 });
    const response = await mock.request(fullRoute('contextHandshake'), {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const json = (await response.json()) as { data: unknown };
    const result = handshakeResultSchema.validate(json.data);
    expect(result.success).toBe(true);
  });
});

describe('runtime validation — malformed responses fail without throwing', () => {
  it('returns Result.error for a missing required field', async () => {
    // Fake a malformed response by validating a hand-crafted payload.
    const malformed = {
      requestId: 'r1',
      success: true,
      data: {
        // visitorId missing on purpose
        sessionId: 'ses_1',
        selectedLayer: 'STATIC',
        uiConfig: { locale: 'en', direction: 'ltr' },
      },
      meta: { processingTimeMs: 0, respondedAt: '1970-01-01T00:00:00Z' },
    };
    const schema = alphabetResponseSchema(handshakeResultSchema);
    let threw = false;
    let result: ReturnType<typeof schema.validate> | undefined;
    try {
      result = schema.validate(malformed);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result?.success).toBe(false);
    if (result && !result.success) {
      const paths = result.error.details.issues!.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('visitorId'))).toBe(true);
    }
  });

  it('returns Result.error when meta is missing', () => {
    const schema = alphabetResponseSchema(v.object({ ok: v.boolean() }));
    const result = schema.validate({ requestId: 'r', success: true, data: { ok: true } });
    expect(result.success).toBe(false);
  });

  it('returns Result.error for type mismatches with a clear path', () => {
    const schema = alphabetResponseSchema(v.object({ ok: v.boolean() }));
    const result = schema.validate({
      requestId: 'r',
      success: true,
      data: { ok: 'yes' },
      meta: { processingTimeMs: 0, respondedAt: '1970-01-01T00:00:00Z' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.details.issues![0]!;
      expect(issue.path).toEqual(['data', 'ok']);
      expect(issue.expected).toBe('boolean');
      expect(issue.received).toBe('string');
    }
  });
});
