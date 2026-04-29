/**
 * @file anthropic.test.ts
 * @description Tests for the Anthropic Messages API adapter — verifies
 * SSE decoding of text deltas, tool-use blocks, finish reasons + usage
 * normalization, mapping of system/tool messages, and HTTP error path.
 */

import { describe, it, expect } from 'vitest';
import { createAnthropicProvider } from './anthropic.js';
import type {
  AlphabetGenerationRequest,
  AlphabetStreamChunk,
} from '../types.js';

const REQ: AlphabetGenerationRequest = {
  model: 'claude-test',
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

describe('createAnthropicProvider', () => {
  it('decodes text content_block_delta events into text-delta chunks and a finish chunk with usage', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hel' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'lo' },
        }),
        JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { input_tokens: 4, output_tokens: 2 },
        }),
        JSON.stringify({ type: 'message_stop' }),
      ]);
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const chunks: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) chunks.push(c);
    const text = chunks
      .filter((c): c is Extract<AlphabetStreamChunk, { type: 'text-delta' }> => c.type === 'text-delta')
      .map((c) => c.text)
      .join('');
    expect(text).toBe('Hello');
    const finish = chunks.find(
      (c): c is Extract<AlphabetStreamChunk, { type: 'finish' }> => c.type === 'finish',
    );
    expect(finish?.reason).toBe('stop');
    expect(finish?.usage?.promptTokens).toBe(4);
    expect(finish?.usage?.completionTokens).toBe(2);
  });

  it('decodes tool_use blocks as tool-call-delta chunks', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'call_a', name: 'lookup' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"x":1}' },
        }),
        JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
        }),
      ]);
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const r = await provider.generate(REQ);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.toolCalls.length).toBe(1);
    expect(r.data.toolCalls[0]?.id).toBe('call_a');
    expect(r.data.toolCalls[0]?.name).toBe('lookup');
    expect(r.data.toolCalls[0]?.arguments).toBe('{"x":1}');
    expect(r.data.finishReason).toBe('tool_call');
  });

  it('maps the max_tokens stop reason to "length"', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'hi' },
        }),
        JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'max_tokens' },
        }),
      ]);
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const r = await provider.generate(REQ);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.finishReason).toBe('length');
  });

  it('emits structured-delta when structuredOutput is requested', async () => {
    const fetch = async (): Promise<Response> =>
      sse([
        JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: '{"a":1}' },
        }),
        JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
        }),
      ]);
    const provider = createAnthropicProvider({
      apiKey: 'k',
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

  it('returns an error chunk on non-2xx HTTP responses', async () => {
    const fetch = async (): Promise<Response> =>
      new Response('forbidden', { status: 403 });
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(out.length).toBe(1);
    expect(out[0]?.type).toBe('error');
  });

  it('returns an error chunk when the underlying fetch rejects', async () => {
    const fetch = async (): Promise<Response> => {
      throw new Error('network');
    };
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(out.length).toBe(1);
    expect(out[0]?.type).toBe('error');
  });

  it('sends x-api-key, anthropic-version and configured headers', async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetch = async (_url: string, init?: RequestInit): Promise<Response> => {
      capturedHeaders = init?.headers as Record<string, string>;
      return sse([
        JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
      ]);
    };
    const provider = createAnthropicProvider({
      apiKey: 'sk-test',
      baseUrl: 'https://example.test/v1',
      anthropicVersion: '2024-01-01',
      headers: { 'x-extra': 'yes' },
      fetch,
    });
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(REQ)) out.push(c);
    expect(capturedHeaders['x-api-key']).toBe('sk-test');
    expect(capturedHeaders['anthropic-version']).toBe('2024-01-01');
    expect(capturedHeaders['x-extra']).toBe('yes');
  });

  it('translates system/tool/assistant-with-tool-calls messages into the Anthropic schema', async () => {
    let capturedBody: unknown = null;
    const fetch = async (_url: string, init?: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return sse([
        JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
      ]);
    };
    const provider = createAnthropicProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1',
      fetch,
    });
    const reqWithSystemAndTools: AlphabetGenerationRequest = {
      ...REQ,
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Question?' },
        {
          role: 'assistant',
          content: 'Looking up.',
          toolCalls: [
            { id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
            { id: 'call_2', name: 'broken', arguments: 'not-json' },
          ],
        },
        { role: 'tool', content: '"answer"', toolCallId: 'call_1' },
      ],
      tools: [
        { name: 'lookup', description: 'a', parameters: { type: 'object' } },
      ],
      sampling: { temperature: 0.2, topP: 0.9, maxTokens: 256, stopSequences: ['END'] },
    };
    const out: AlphabetStreamChunk[] = [];
    for await (const c of provider.stream(reqWithSystemAndTools)) out.push(c);
    const body = capturedBody as {
      system: string;
      messages: Array<{ role: string; content: Array<{ type: string }> }>;
      tools: unknown[];
      max_tokens: number;
      temperature: number;
      top_p: number;
      stop_sequences: string[];
    };
    expect(body.system).toBe('You are helpful.\nBe concise.');
    expect(body.tools.length).toBe(1);
    expect(body.max_tokens).toBe(256);
    expect(body.temperature).toBe(0.2);
    expect(body.top_p).toBe(0.9);
    expect(body.stop_sequences).toEqual(['END']);
    // assistant + tool-result blocks present
    const assistant = body.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content.some((b) => b.type === 'tool_use')).toBe(true);
    // tool message becomes a user-role tool_result block
    const toolResult = body.messages.find((m) =>
      m.content.some((b) => b.type === 'tool_result'),
    );
    expect(toolResult?.role).toBe('user');
  });
});
