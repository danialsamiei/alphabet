/**
 * @file sdk.test.ts
 * @description End-to-end test of the AlphabetAiClient — exercises the full
 * pipeline (consent injection → PII redaction → compression → provider).
 */

import { describe, it, expect, vi } from 'vitest';
import { AlphabetAiClient, prepareRequest } from './index.js';
import type { AlphabetGenerationRequest, AlphabetProviderAdapter, AlphabetStreamChunk } from '../types.js';

const REQ_BASE: Omit<AlphabetGenerationRequest, 'messages'> = {
  model: 'm',
  context: {
    visitorId: 'v',
    sessionId: 's',
    consentTier: 'CONSENTED',
    locale: 'fa-IR',
    country: 'IR',
    layer: 'CSS_3D',
    privacyRestricted: false,
  },
};

function captureProvider(): {
  adapter: AlphabetProviderAdapter;
  lastRequest: () => AlphabetGenerationRequest | undefined;
} {
  let last: AlphabetGenerationRequest | undefined;
  const adapter: AlphabetProviderAdapter = {
    id: 'mock',
    name: 'mock',
    // eslint-disable-next-line @typescript-eslint/require-await
    stream: async function* (req): AsyncIterable<AlphabetStreamChunk> {
      last = req;
      yield { type: 'text-delta', text: 'ok' };
      yield { type: 'finish', reason: 'stop' };
    },
    generate: async (req) => {
      last = req;
      return {
        success: true,
        data: { text: 'ok', toolCalls: [], finishReason: 'stop', model: req.model, providerId: 'mock' },
      };
    },
  };
  return { adapter, lastRequest: () => last };
}

describe('prepareRequest', () => {
  it('redacts PII from messages before dispatch', () => {
    const { request, diagnostics } = prepareRequest(
      {
        ...REQ_BASE,
        messages: [{ role: 'user', content: 'email me at me@x.co' }],
      },
      { provider: { id: 'p', name: 'p', stream: async function* () {}, generate: async () => ({ success: true, data: { text: '', toolCalls: [], finishReason: 'stop', model: '', providerId: 'p' } }) } },
      {},
    );
    expect(diagnostics.redactedCount).toBeGreaterThan(0);
    const userMsg = request.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).not.toContain('me@x.co');
  });

  it('prepends a consent-aware system prelude', () => {
    const { request } = prepareRequest(
      {
        ...REQ_BASE,
        messages: [{ role: 'user', content: 'hello' }],
      },
      { provider: { id: 'p', name: 'p', stream: async function* () {}, generate: async () => ({ success: true, data: { text: '', toolCalls: [], finishReason: 'stop', model: '', providerId: 'p' } }) } },
      {},
    );
    expect(request.messages[0]?.role).toBe('system');
    expect(request.messages[0]?.content).toContain('consent_tier');
  });

  it('compresses to fit token budget', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}: ${'x'.repeat(200)}`,
    }));
    const { request } = prepareRequest(
      { ...REQ_BASE, messages, sampling: { tokenBudget: 100 } },
      { provider: { id: 'p', name: 'p', stream: async function* () {}, generate: async () => ({ success: true, data: { text: '', toolCalls: [], finishReason: 'stop', model: '', providerId: 'p' } }) } },
      {},
    );
    expect(request.messages.length).toBeLessThan(20);
  });
});

describe('AlphabetAiClient', () => {
  it('generates via the underlying provider', async () => {
    const { adapter, lastRequest } = captureProvider();
    const client = new AlphabetAiClient({ provider: adapter });
    const r = await client.generate({
      ...REQ_BASE,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.success).toBe(true);
    expect(lastRequest()?.messages[0]?.role).toBe('system');
  });

  it('streams chunks from the provider', async () => {
    const { adapter } = captureProvider();
    const client = new AlphabetAiClient({ provider: adapter });
    const out: string[] = [];
    for await (const c of client.stream({ ...REQ_BASE, messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text-delta') out.push(c.text);
    }
    expect(out).toEqual(['ok']);
  });

  it('refuses dispatch when consent proof verification fails', async () => {
    const { adapter, lastRequest } = captureProvider();
    const client = new AlphabetAiClient({ provider: adapter });
    const kp = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const r = await client.generate(
      { ...REQ_BASE, messages: [{ role: 'user', content: 'hi' }] },
      {
        consentProof: {
          token: 'bogus.token',
          publicKey: kp.publicKey,
          expectedAudience: 'alphabet:demo',
        },
      },
    );
    expect(r.success).toBe(false);
    expect(lastRequest()).toBeUndefined();
  });

  it('respects disablePiiRedaction', () => {
    const { adapter } = captureProvider();
    const client = new AlphabetAiClient({ provider: adapter, disablePiiRedaction: true });
    const onChunk = vi.fn();
    return (async () => {
      for await (const c of client.stream({
        ...REQ_BASE,
        messages: [{ role: 'user', content: 'me@x.co' }],
      })) onChunk(c);
      expect(onChunk).toHaveBeenCalled();
    })();
  });
});
