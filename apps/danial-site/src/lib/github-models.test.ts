/**
 * @file github-models.test.ts
 * @description
 * Unit tests for the GitHub Models client. Network is mocked — these
 * tests run without a `GITHUB_TOKEN` and verify request shape +
 * response parsing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  chat,
  DEFAULT_MODEL,
  GITHUB_MODELS_ENDPOINT,
  type ChatRequest,
} from './github-models.js';

function mockOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  ) as unknown as typeof fetch;
}

const sampleSuccess = {
  id: 'chatcmpl-1',
  model: DEFAULT_MODEL,
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hi, I am Danial’s assistant.' },
      finish_reason: 'stop',
    },
  ],
};

describe('chat()', () => {
  it('POSTs JSON to the default proxy path with the expected envelope', async () => {
    const fetchImpl = mockOk(sampleSuccess);
    const req: ChatRequest = {
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
    };

    await chat(req, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('/api/assistant');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    // Browser path: NO authorization header — token lives on the proxy.
    expect(headers.authorization).toBeUndefined();

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(512);
  });

  it('targets the real GitHub Models endpoint and adds Bearer auth when given a token', async () => {
    const fetchImpl = mockOk(sampleSuccess);

    await chat(
      { model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'hi' }] },
      { fetchImpl, endpoint: GITHUB_MODELS_ENDPOINT, token: 'ghp_test_123' }
    );

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(GITHUB_MODELS_ENDPOINT);
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer ghp_test_123'
    );
  });

  it('parses the assistant content from a well-formed response', async () => {
    const fetchImpl = mockOk(sampleSuccess);
    const reply = await chat(
      { model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'hi' }] },
      { fetchImpl }
    );
    expect(reply.content).toBe('Hi, I am Danial’s assistant.');
    expect(reply.model).toBe(DEFAULT_MODEL);
    expect(reply.finishReason).toBe('stop');
  });

  it('throws a descriptive error on non-2xx responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' })
    ) as unknown as typeof fetch;

    await expect(
      chat(
        { model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'hi' }] },
        { fetchImpl }
      )
    ).rejects.toThrow(/429/);
  });

  it('throws when the response payload is missing choices[]', async () => {
    const fetchImpl = mockOk({ id: 'x', model: DEFAULT_MODEL });
    await expect(
      chat(
        { model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'hi' }] },
        { fetchImpl }
      )
    ).rejects.toThrow(/choices/);
  });
});
