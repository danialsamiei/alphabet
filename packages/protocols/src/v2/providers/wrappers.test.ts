/**
 * @file wrappers.test.ts
 * @description Smoke tests for the thin OpenAI-compatible wrapper
 * adapters (OpenAI, Grok, Mistral, Fireworks). Each wrapper just
 * forwards into `createOpenAiCompatAdapter` with a vendor-specific
 * id/name/baseUrl, so we verify:
 *   1. The returned adapter exposes the expected `id` and `name`.
 *   2. The wrapper forwards HTTP traffic to the configured (or default)
 *      base URL.
 *   3. Caller-supplied `baseUrl` overrides the vendor default.
 */

import { describe, it, expect } from 'vitest';
import { createOpenAiProvider } from './openai.js';
import { createGrokProvider } from './grok.js';
import { createMistralProvider } from './mistral.js';
import { createFireworksProvider } from './fireworks.js';
import type { AlphabetGenerationRequest, AlphabetStreamChunk } from '../types.js';

const REQ: AlphabetGenerationRequest = {
  model: 'm',
  messages: [{ role: 'user', content: 'hi' }],
  context: {
    visitorId: 'v',
    sessionId: 's',
    consentTier: 'NO_MEMORY',
    privacyRestricted: false,
  },
};

function sse(chunks: readonly string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(ctl) {
      const enc = new TextEncoder();
      for (const c of chunks) ctl.enqueue(enc.encode(`data: ${c}\n\n`));
      ctl.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

interface Spec {
  readonly create: (opts: {
    apiKey: string;
    baseUrl?: string;
    fetch: (input: string, init?: RequestInit) => Promise<Response>;
  }) => { id: string; name: string; stream: (req: AlphabetGenerationRequest) => AsyncIterable<AlphabetStreamChunk> };
  readonly id: string;
  readonly name: string;
  readonly defaultHost: string;
}

const SPECS: readonly Spec[] = [
  {
    create: createOpenAiProvider,
    id: 'openai',
    name: 'OpenAI',
    defaultHost: 'api.openai.com',
  },
  {
    create: createGrokProvider,
    id: 'grok',
    name: 'xAI Grok',
    defaultHost: 'api.x.ai',
  },
  {
    create: createMistralProvider,
    id: 'mistral',
    name: 'Mistral',
    defaultHost: 'api.mistral.ai',
  },
  {
    create: createFireworksProvider,
    id: 'fireworks',
    name: 'Fireworks AI',
    defaultHost: 'api.fireworks.ai',
  },
];

describe.each(SPECS)('createOpenAiCompat wrapper: $id', (spec) => {
  it(`exposes id="${spec.id}" and name="${spec.name}"`, () => {
    const provider = spec.create({
      apiKey: 'k',
      fetch: async () => new Response(null, { status: 200 }),
    });
    expect(provider.id).toBe(spec.id);
    expect(provider.name).toBe(spec.name);
  });

  it('uses the vendor default base URL when none is supplied', async () => {
    let captured = '';
    const provider = spec.create({
      apiKey: 'k',
      fetch: async (url) => {
        captured = url;
        return sse([
          JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
          JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          '[DONE]',
        ]);
      },
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(captured).toContain(spec.defaultHost);
    expect(captured).toMatch(/\/chat\/completions$/);
  });

  it('honours an explicit baseUrl override', async () => {
    let captured = '';
    const provider = spec.create({
      apiKey: 'k',
      baseUrl: 'https://proxy.example.test/v9',
      fetch: async (url) => {
        captured = url;
        return sse(['[DONE]']);
      },
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const _ of provider.stream(REQ)) out.push(_);
    expect(captured.startsWith('https://proxy.example.test/v9/')).toBe(true);
    expect(captured).not.toContain(spec.defaultHost);
  });
});
