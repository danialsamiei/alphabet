/**
 * @file retry.test.ts
 * @description Unit tests for withRetry + decorrelatedJitter.
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry, decorrelatedJitter } from './retry.js';
import { ok, err } from '../../types/result.js';

describe('decorrelatedJitter', () => {
  it('respects [base, prev*3] range and cap', () => {
    // random=0 → lo=base; random=1 → hi
    expect(decorrelatedJitter(100, 50, 1000, () => 0)).toBe(50);
    expect(decorrelatedJitter(100, 50, 1000, () => 1)).toBe(300);
    expect(decorrelatedJitter(500, 50, 200, () => 1)).toBe(200); // capped
  });

  it('floors at base when prev<base', () => {
    expect(decorrelatedJitter(10, 50, 1000, () => 0)).toBe(50);
  });
});

describe('withRetry', () => {
  it('returns success on first attempt without sleeping', async () => {
    const sleep = vi.fn(async () => {});
    const r = await withRetry(async () => ok(7), { sleep });
    expect(r).toEqual({ success: true, data: 7 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries up to maxAttempts then returns last error', async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        return err({ code: 'TRANSIENT', message: 'flaky' });
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, sleep: async () => {}, random: () => 0 },
    );
    expect(calls).toBe(3);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('TRANSIENT');
  });

  it('stops on non-retryable error', async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        return err({ code: 'PERMANENT', message: 'no' });
      },
      {
        maxAttempts: 5,
        sleep: async () => {},
        isRetryable: (e) => e.code !== 'PERMANENT',
      },
    );
    expect(calls).toBe(1);
    expect(r.success).toBe(false);
  });

  it('emits onAttempt callbacks', async () => {
    const seen: Array<{ attempt: number; outcome: string }> = [];
    let n = 0;
    await withRetry(
      async () => {
        n++;
        return n < 2 ? err({ code: 'X', message: 'x' }) : ok('done');
      },
      {
        maxAttempts: 3,
        sleep: async () => {},
        random: () => 0,
        onAttempt: (i) => seen.push({ attempt: i.attempt, outcome: i.outcome }),
      },
    );
    expect(seen).toEqual([
      { attempt: 1, outcome: 'error' },
      { attempt: 2, outcome: 'ok' },
    ]);
  });

  it('returns RETRY_ABORTED when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const r = await withRetry(async () => ok(1), { signal: ac.signal });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('RETRY_ABORTED');
  });

  it('returns RETRY_ABORTED if sleep throws (signal aborted mid-wait)', async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        return err({ code: 'X', message: 'x' });
      },
      {
        maxAttempts: 3,
        sleep: async () => {
          throw new Error('aborted');
        },
      },
    );
    expect(n).toBe(1);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('RETRY_ABORTED');
  });
});
