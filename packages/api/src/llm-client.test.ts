import { describe, expect, it, vi } from 'vitest';
import {
  ALPHABET_FREE_LLM_ENDPOINT,
  AlphabetLlmClient,
  AlphabetLlmError,
} from './llm-client.js';

describe('AlphabetLlmClient', () => {
  it('uses the managed free gateway by default without authorization', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).not.toMatchObject({ Authorization: expect.any(String) });
      return new Response(
        JSON.stringify({
          text: 'A bounded adaptive plan.',
          receipt: { requestId: 'req-free', access: 'free' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = new AlphabetLlmClient({ fetch: fetchMock });
    const result = await client.complete([
      { role: 'user', content: 'Design a calm adaptive interface.' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      ALPHABET_FREE_LLM_ENDPOINT,
      expect.objectContaining({ method: 'POST', credentials: 'omit' }),
    );
    expect(result.receipt.access).toBe('free');
  });

  it('fails closed when premium is selected during beta', async () => {
    const fetchMock = vi.fn();
    const client = new AlphabetLlmClient({
      mode: 'premium',
      fetch: fetchMock,
    });

    await expect(
      client.complete([{ role: 'user', content: 'Hello' }]),
    ).rejects.toMatchObject<Partial<AlphabetLlmError>>({
      code: 'PREMIUM_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps BYOK credentials out of provider errors', async () => {
    const secret = 'never-include-this-key';
    const client = new AlphabetLlmClient({
      mode: 'byok',
      providerBaseUrl: 'https://provider.example/v1',
      apiKey: secret,
      model: 'model-a',
      fetch: vi.fn(async () => new Response(null, { status: 401 })),
    });

    try {
      await client.complete([{ role: 'user', content: 'Hello' }]);
      throw new Error('Expected BYOK request to fail');
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
