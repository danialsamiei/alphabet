/**
 * Tests for the retry decorator and decorrelated jitter.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  decorrelatedJitter,
  isRetriableStatus,
  withRetry,
  NetworkError,
  type RetryPolicy,
} from '../../src/transport/retry.js';
import type { Fetcher } from '../../src/transport/fetcher.js';

function jsonResponse(status: number, body: unknown = {}, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const noSleep = (_ms: number): Promise<void> => Promise.resolve();

describe('transport/retry — pure functions', () => {
  it('isRetriableStatus matches 5xx, 408, and 429', () => {
    expect(isRetriableStatus(500)).toBe(true);
    expect(isRetriableStatus(503)).toBe(true);
    expect(isRetriableStatus(429)).toBe(true);
    expect(isRetriableStatus(408)).toBe(true);
    expect(isRetriableStatus(400)).toBe(false);
    expect(isRetriableStatus(404)).toBe(false);
    expect(isRetriableStatus(200)).toBe(false);
  });

  it('decorrelatedJitter stays within [base, prev*3] and respects cap', () => {
    const random = () => 0.99; // worst case
    const base = 100;
    const cap = 5_000;

    let prev = base;
    const sequence: number[] = [];
    for (let i = 0; i < 10; i++) {
      const next = decorrelatedJitter(prev, base, cap, random);
      sequence.push(next);
      expect(next).toBeGreaterThanOrEqual(base);
      expect(next).toBeLessThanOrEqual(cap);
      // Allow 1 ms rounding tolerance.
      expect(next).toBeLessThanOrEqual(Math.max(base, prev * 3) + 1);
      prev = next;
    }
    // The first jump should respect base*3 as the upper bound (= 300).
    expect(sequence[0]).toBeLessThanOrEqual(300 + 1);
  });

  it('decorrelatedJitter with random=0 returns base', () => {
    expect(decorrelatedJitter(1000, 100, 5000, () => 0)).toBe(100);
  });
});

describe('transport/retry — withRetry decorator', () => {
  function counterFetcher(responses: Array<Response | Error>): {
    fetcher: Fetcher;
    callCount: () => number;
  } {
    let i = 0;
    const fetcher: Fetcher = {
      async request(_input, _init) {
        const r = responses[i++];
        if (r === undefined) throw new Error('No more queued responses');
        if (r instanceof Error) throw r;
        return r;
      },
    };
    return { fetcher, callCount: () => i };
  }

  const policy: Partial<RetryPolicy> = {
    maxRetries: 3,
    baseDelayMs: 1,
    maxDelayMs: 10,
    sleep: noSleep,
    random: () => 0,
  };

  it('returns 200 on first try without retrying', async () => {
    const { fetcher, callCount } = counterFetcher([jsonResponse(200, { ok: true })]);
    const wrapped = withRetry(fetcher, policy);
    const r = await wrapped.request('http://x', { method: 'GET' });
    expect(r.status).toBe(200);
    expect(callCount()).toBe(1);
  });

  it('retries on 503 and eventually succeeds', async () => {
    const { fetcher, callCount } = counterFetcher([
      jsonResponse(503),
      jsonResponse(503),
      jsonResponse(200, { ok: true }),
    ]);
    const wrapped = withRetry(fetcher, policy);
    const r = await wrapped.request('http://x', { method: 'GET' });
    expect(r.status).toBe(200);
    expect(callCount()).toBe(3);
  });

  it('returns the last response if maxRetries exhausted', async () => {
    const { fetcher, callCount } = counterFetcher([
      jsonResponse(503),
      jsonResponse(503),
      jsonResponse(503),
      jsonResponse(503),
    ]);
    const wrapped = withRetry(fetcher, policy);
    const r = await wrapped.request('http://x', { method: 'GET' });
    expect(r.status).toBe(503);
    expect(callCount()).toBe(4); // initial + 3 retries
  });

  it('does NOT retry on 4xx (other than 408/429)', async () => {
    const { fetcher, callCount } = counterFetcher([jsonResponse(400)]);
    const wrapped = withRetry(fetcher, policy);
    const r = await wrapped.request('http://x', { method: 'POST' });
    expect(r.status).toBe(400);
    expect(callCount()).toBe(1);
  });

  it('retries on 429 and honors Retry-After', async () => {
    const sleepCalls: number[] = [];
    const { fetcher } = counterFetcher([
      jsonResponse(429, {}, { 'Retry-After': '2' }),
      jsonResponse(200),
    ]);
    const wrapped = withRetry(fetcher, {
      ...policy,
      maxDelayMs: 5_000,
      sleep: (ms) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      },
    });
    const r = await wrapped.request('http://x', { method: 'GET' });
    expect(r.status).toBe(200);
    // Retry-After=2 → 2000ms.
    expect(sleepCalls[0]).toBe(2_000);
  });

  it('retries on network error and eventually succeeds', async () => {
    const { fetcher, callCount } = counterFetcher([
      new TypeError('fetch failed'),
      jsonResponse(200),
    ]);
    const wrapped = withRetry(fetcher, policy);
    const r = await wrapped.request('http://x', { method: 'GET' });
    expect(r.status).toBe(200);
    expect(callCount()).toBe(2);
  });

  it('throws NetworkError when network fails for all attempts', async () => {
    const { fetcher } = counterFetcher([
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
    ]);
    const wrapped = withRetry(fetcher, policy);
    await expect(wrapped.request('http://x', { method: 'GET' })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('propagates AbortError without retrying', async () => {
    const ac = new AbortController();
    ac.abort();
    const fetcher: Fetcher = {
      request() {
        throw new DOMException('aborted', 'AbortError');
      },
    };
    const wrapped = withRetry(fetcher, policy);
    await expect(wrapped.request('http://x', { method: 'GET', signal: ac.signal })).rejects
      .toThrow(/abort/i);
  });

  it('does not retry once the caller aborts mid-flight', async () => {
    const ac = new AbortController();
    let calls = 0;
    const fetcher: Fetcher = {
      async request() {
        calls++;
        if (calls === 1) {
          // Abort *after* returning a 503: next iteration should bail.
          ac.abort();
          return jsonResponse(503);
        }
        return jsonResponse(200);
      },
    };
    const wrapped = withRetry(fetcher, policy);
    await expect(
      wrapped.request('http://x', { method: 'GET', signal: ac.signal }),
    ).rejects.toThrow(/abort/i);
    expect(calls).toBe(1);
  });
});

describe('transport/retry — property: backoff sequence is bounded', () => {
  it('over 1000 random jitter steps stays within the cap', () => {
    let prev = 100;
    const seen: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const next = decorrelatedJitter(prev, 100, 5_000, Math.random);
      seen.push(next);
      expect(next).toBeGreaterThanOrEqual(100);
      expect(next).toBeLessThanOrEqual(5_000);
      prev = next;
    }
    // Distribution sanity: the sequence should not collapse to base only.
    const unique = new Set(seen).size;
    expect(unique).toBeGreaterThan(50);
  });

  it('vi.fn-tracked sleep is invoked exactly maxRetries times for 503-loop', async () => {
    const sleep = vi.fn(noSleep);
    const fetcher: Fetcher = {
      request: () => Promise.resolve(jsonResponse(503)),
    };
    const wrapped = withRetry(fetcher, {
      maxRetries: 4,
      baseDelayMs: 1,
      maxDelayMs: 10,
      sleep,
      random: () => 0,
    });
    await wrapped.request('http://x', { method: 'GET' });
    expect(sleep).toHaveBeenCalledTimes(4);
  });
});
