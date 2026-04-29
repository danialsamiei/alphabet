/**
 * @file fallback-chain.test.ts
 * @description Tests for the v2 provider fallback chain.
 */

import { describe, it, expect } from 'vitest';
import { createFallbackChain } from './fallback-chain.js';
import type {
  AwafGenerationRequest,
  AwafProviderAdapter,
  AwafStreamChunk,
} from '../types.js';
import { protocolError } from '../../errors/index.js';

const REQ: AwafGenerationRequest = {
  model: 'm',
  messages: [{ role: 'user', content: 'hi' }],
  context: {
    visitorId: 'v',
    sessionId: 's',
    consentTier: 'NO_MEMORY',
    privacyRestricted: false,
  },
};

function failProvider(id: string, status: number | undefined = undefined): AwafProviderAdapter {
  return {
    id,
    name: id,
    // eslint-disable-next-line @typescript-eslint/require-await
    stream: async function* () {
      yield {
        type: 'error',
        error: protocolError('ADAPTER_NOT_CONFIGURED', `${id} unavailable`, {
          ...(status !== undefined ? { status } : {}),
        }),
      } as AwafStreamChunk;
    },
    generate: async () => ({ success: false, error: protocolError('ADAPTER_NOT_CONFIGURED', `${id} bad`) }),
  };
}

function okProvider(id: string, text: string): AwafProviderAdapter {
  return {
    id,
    name: id,
    // eslint-disable-next-line @typescript-eslint/require-await
    stream: async function* () {
      yield { type: 'text-delta', text } as AwafStreamChunk;
      yield { type: 'finish', reason: 'stop' } as AwafStreamChunk;
    },
    generate: async () => ({
      success: true,
      data: { text, toolCalls: [], finishReason: 'stop', model: 'm', providerId: id },
    }),
  };
}

describe('createFallbackChain', () => {
  it('uses the first successful provider', async () => {
    const chain = createFallbackChain({
      providers: [okProvider('a', 'A'), okProvider('b', 'B')],
    });
    const chunks: AwafStreamChunk[] = [];
    for await (const c of chain.stream(REQ)) chunks.push(c);
    expect(chunks.find((c) => c.type === 'text-delta')).toEqual({ type: 'text-delta', text: 'A' });
  });

  it('falls back when the first provider errors before any chunk', async () => {
    const calls: string[] = [];
    const chain = createFallbackChain({
      providers: [failProvider('a'), okProvider('b', 'B')],
      onFallback: (i) => calls.push(`${i.fromProviderId}->${i.toProviderId ?? 'none'}`),
    });
    const chunks: AwafStreamChunk[] = [];
    for await (const c of chain.stream(REQ)) chunks.push(c);
    expect(calls).toEqual(['a->b']);
    expect(chunks.find((c) => c.type === 'text-delta')).toEqual({ type: 'text-delta', text: 'B' });
  });

  it('does not fall back on non-retryable errors', async () => {
    const chain = createFallbackChain({
      providers: [failProvider('a', 400), okProvider('b', 'B')],
    });
    const chunks: AwafStreamChunk[] = [];
    for await (const c of chain.stream(REQ)) chunks.push(c);
    // 400 is not retryable; chain returns the original error.
    expect(chunks.some((c) => c.type === 'error')).toBe(true);
    expect(chunks.find((c) => c.type === 'text-delta')).toBeUndefined();
  });

  it('retries on 5xx and 429', async () => {
    const chain = createFallbackChain({
      providers: [failProvider('a', 503), okProvider('b', 'B')],
    });
    const texts: string[] = [];
    for await (const c of chain.stream(REQ)) {
      if (c.type === 'text-delta') texts.push(c.text);
    }
    expect(texts).toEqual(['B']);
  });

  it('uses modelByProvider override', async () => {
    let receivedModel = '';
    const probe: AwafProviderAdapter = {
      id: 'a',
      name: 'a',
      // eslint-disable-next-line @typescript-eslint/require-await
      stream: async function* (req) {
        receivedModel = req.model;
        yield { type: 'text-delta', text: '.' };
        yield { type: 'finish', reason: 'stop' };
      },
      generate: async (req) => ({
        success: true,
        data: { text: '.', toolCalls: [], finishReason: 'stop', model: req.model, providerId: 'a' },
      }),
    };
    const chain = createFallbackChain({
      providers: [probe],
      modelByProvider: { a: 'override-model' },
    });
    for await (const _c of chain.stream(REQ)) {
      // drain
    }
    expect(receivedModel).toBe('override-model');
  });

  it('throws when no providers are configured', () => {
    expect(() => createFallbackChain({ providers: [] })).toThrow();
  });

  it('emits a terminal error chunk if every provider fails', async () => {
    const chain = createFallbackChain({
      providers: [failProvider('a'), failProvider('b')],
    });
    const chunks: AwafStreamChunk[] = [];
    for await (const c of chain.stream(REQ)) chunks.push(c);
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.type).toBe('error');
  });
});
