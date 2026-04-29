/**
 * @file openai-compat.test.ts
 * @description End-to-end tests for the OpenAI-compatible adapter
 * with mocked fetch.
 */

import { describe, it, expect } from 'vitest';
import { createOpenAiCompatAdapter } from './openai-compat.js';
import type { AlphabetGenerationRequest, AlphabetStreamChunk } from '../types.js';

const REQ: AlphabetGenerationRequest = {
  model: 'gpt-test',
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

describe('createOpenAiCompatAdapter', () => {
  it('decodes content deltas and finish reason', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
        JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
        JSON.stringify({
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
        '[DONE]',
      ]);
    const provider = createOpenAiCompatAdapter({
      id: 'test',
      name: 'test',
      apiKey: 'x',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    const text = out.filter((c) => c.type === 'text-delta').map((c) => (c as { text: string }).text).join('');
    expect(text).toBe('Hello');
    const finish = out.find((c) => c.type === 'finish');
    expect(finish?.type).toBe('finish');
  });

  it('decodes tool call deltas', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_1', function: { name: 'lookup', arguments: '{"x":' } },
                ],
              },
            },
          ],
        }),
        JSON.stringify({
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: '1}' } }] } },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]);
    const provider = createOpenAiCompatAdapter({
      id: 'test',
      name: 'test',
      apiKey: 'x',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const r = await provider.generate(REQ);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.toolCalls.length).toBe(1);
    expect(r.data.toolCalls[0]?.name).toBe('lookup');
    expect(r.data.toolCalls[0]?.arguments).toBe('{"x":1}');
  });

  it('emits an error chunk on HTTP failure', async () => {
    const fetch = async (): Promise<Response> =>
      new Response('forbidden', { status: 403 });
    const provider = createOpenAiCompatAdapter({
      id: 'test',
      name: 'test',
      apiKey: 'x',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(out.length).toBe(1);
    expect(out[0]?.type).toBe('error');
  });

  it('parses structured-output deltas as structured-delta', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({ choices: [{ delta: { content: '{"a":' } }] }),
        JSON.stringify({ choices: [{ delta: { content: '1}' } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        '[DONE]',
      ]);
    const provider = createOpenAiCompatAdapter({
      id: 'test',
      name: 'test',
      apiKey: 'x',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const r = await provider.generate({
      ...REQ,
      structuredOutput: { mode: 'json' },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.structured).toEqual({ a: 1 });
  });

  it('honours abort signals', async () => {
    const ctl = new AbortController();
    const fetch: Parameters<typeof createOpenAiCompatAdapter>[0]['fetch'] = (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const provider = createOpenAiCompatAdapter({
      id: 'test',
      name: 'test',
      apiKey: 'x',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    setTimeout(() => ctl.abort(), 0);
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream({ ...REQ, signal: ctl.signal })) out.push(c);
    expect(out[0]?.type).toBe('error');
  });
});
