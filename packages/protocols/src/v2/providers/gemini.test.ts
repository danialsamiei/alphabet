/**
 * @file gemini.test.ts
 * @description Tests for the Gemini Generative Language API adapter —
 * verifies SSE decoding, tool/function call mapping, finish-reason
 * mapping (STOP/MAX_TOKENS/SAFETY), URL composition with API key, and
 * HTTP error path.
 */

import { describe, it, expect } from 'vitest';
import { createGeminiProvider } from './gemini.js';
import type {
  AlphabetGenerationRequest,
  AlphabetStreamChunk,
} from '../types.js';

const REQ: AlphabetGenerationRequest = {
  model: 'gemini-1.5-flash',
  messages: [{ role: 'user', content: 'hello' }],
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

describe('createGeminiProvider', () => {
  it('decodes text parts into text-delta chunks and finish with usage', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: 'Hel' }] } },
          ],
        }),
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' },
          ],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 2,
            totalTokenCount: 5,
          },
        }),
      ]);
    const provider = createGeminiProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const r = await provider.generate(REQ);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.text).toBe('Hello');
    expect(r.data.finishReason).toBe('stop');
    expect(r.data.usage?.promptTokens).toBe(3);
    expect(r.data.usage?.completionTokens).toBe(2);
    expect(r.data.usage?.totalTokens).toBe(5);
  });

  it('decodes functionCall parts into tool calls', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ functionCall: { name: 'lookup', args: { q: 'x' } } }],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      ]);
    const provider = createGeminiProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const r = await provider.generate(REQ);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.toolCalls.length).toBe(1);
    expect(r.data.toolCalls[0]?.name).toBe('lookup');
    expect(JSON.parse(r.data.toolCalls[0]?.arguments ?? '{}')).toEqual({ q: 'x' });
  });

  it('maps MAX_TOKENS to length and SAFETY to content_filter', async () => {
    const provider = (finishReason: string): ReturnType<typeof createGeminiProvider> =>
      createGeminiProvider({
        apiKey: 'k',
        baseUrl: 'https://example.test/v1beta',
        fetch: async (): Promise<Response> =>
          sse([
            JSON.stringify({
              candidates: [
                { content: { parts: [{ text: 'x' }] }, finishReason },
              ],
            }),
          ]),
      });
    const r1 = await provider('MAX_TOKENS').generate(REQ);
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.finishReason).toBe('length');
    const r2 = await provider('SAFETY').generate(REQ);
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.finishReason).toBe('content_filter');
    const r3 = await provider('RECITATION').generate(REQ);
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data.finishReason).toBe('content_filter');
  });

  it('embeds the API key into the URL when present', async () => {
    let captured = '';
    const fetch = async (url: string): Promise<Response> => {
      captured = url;
      return sse([
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' },
          ],
        }),
      ]);
    };
    const provider = createGeminiProvider({
      apiKey: 'secret-key',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(captured).toContain('key=secret-key');
    expect(captured).toContain(':streamGenerateContent');
    expect(captured).toContain('alt=sse');
    expect(captured).toContain(encodeURIComponent('gemini-1.5-flash'));
  });

  it('omits the API key when apiKey is empty (Vertex header-auth case)', async () => {
    let captured = '';
    const fetch = async (url: string): Promise<Response> => {
      captured = url;
      return sse([
        JSON.stringify({
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        }),
      ]);
    };
    const provider = createGeminiProvider({
      apiKey: '',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(captured).not.toContain('key=');
    expect(captured).toContain('alt=sse');
  });

  it('returns an error chunk on non-2xx HTTP responses', async () => {
    const fetch = async (): Promise<Response> =>
      new Response('boom', { status: 500 });
    const provider = createGeminiProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(out.length).toBe(1);
    expect(out[0]?.type).toBe('error');
  });

  it('returns an error chunk when fetch rejects', async () => {
    const fetch = async (): Promise<Response> => {
      throw new Error('offline');
    };
    const provider = createGeminiProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(out[0]?.type).toBe('error');
  });

  it('packs system messages into systemInstruction and tool messages into functionResponse', async () => {
    let capturedBody: unknown = null;
    const fetch = async (_url: string, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return sse([
        JSON.stringify({
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        }),
      ]);
    };
    const provider = createGeminiProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1beta',
      fetch,
    });
    const reqRich: AlphabetGenerationRequest = {
      ...REQ,
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'what?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', name: 'lookup', arguments: '{"q":"x"}' }],
        },
        { role: 'tool', content: '"ok"', toolCallId: 'c1', name: 'lookup' },
      ],
      tools: [{ name: 'lookup', description: 'd', parameters: { type: 'object' } }],
      sampling: { temperature: 0.5, topP: 0.8, maxTokens: 64, stopSequences: ['Z'] },
      structuredOutput: { mode: 'json_schema', schema: { type: 'object' } },
    };
    const out: AlphabetStreamChunk[] = [];
    for await (const _c of provider.stream(reqRich)) out.push(_c);
    const body = capturedBody as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: unknown[] }>;
      tools: Array<{ functionDeclarations: unknown[] }>;
      generationConfig: Record<string, unknown>;
    };
    expect(body.systemInstruction.parts[0]?.text).toBe('be terse');
    expect(body.tools[0]?.functionDeclarations.length).toBe(1);
    expect(body.generationConfig.temperature).toBe(0.5);
    expect(body.generationConfig.topP).toBe(0.8);
    expect(body.generationConfig.maxOutputTokens).toBe(64);
    expect(body.generationConfig.stopSequences).toEqual(['Z']);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual({ type: 'object' });
    // model role appears for assistant turn
    expect(body.contents.some((c) => c.role === 'model')).toBe(true);
  });
});
