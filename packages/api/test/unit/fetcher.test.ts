/**
 * @file fetcher.test.ts
 * @description Tests for the transport seam — `defaultFetcher` (must
 * delegate verbatim to globalThis.fetch) and `composeSignals` (must
 * abort if either signal aborts and degrade gracefully on runtimes
 * lacking `AbortSignal.any`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeSignals, defaultFetcher } from '../../src/transport/fetcher.js';

describe('defaultFetcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates request() to globalThis.fetch and forwards arguments unchanged', async () => {
    const fakeResponse = new Response('ok', { status: 200 });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse);
    const init: RequestInit = { method: 'POST', body: 'x' };
    const out = await defaultFetcher.request('https://example.test/v1/x', init);
    expect(out).toBe(fakeResponse);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('https://example.test/v1/x', init);
  });
});

describe('composeSignals', () => {
  it('returns the primary signal unchanged when secondary is undefined', () => {
    const a = new AbortController();
    expect(composeSignals(a.signal, undefined)).toBe(a.signal);
  });

  it('produces a composite signal that aborts when the primary aborts', () => {
    const a = new AbortController();
    const b = new AbortController();
    const composed = composeSignals(a.signal, b.signal);
    expect(composed.aborted).toBe(false);
    a.abort(new Error('primary'));
    expect(composed.aborted).toBe(true);
  });

  it('produces a composite signal that aborts when the secondary aborts', () => {
    const a = new AbortController();
    const b = new AbortController();
    const composed = composeSignals(a.signal, b.signal);
    expect(composed.aborted).toBe(false);
    b.abort(new Error('secondary'));
    expect(composed.aborted).toBe(true);
  });

  it('returns an already-aborted signal when the primary is already aborted', () => {
    const a = new AbortController();
    a.abort(new Error('preempt'));
    const b = new AbortController();
    const composed = composeSignals(a.signal, b.signal);
    expect(composed.aborted).toBe(true);
  });

  it('returns an already-aborted signal when the secondary is already aborted', () => {
    const a = new AbortController();
    const b = new AbortController();
    b.abort(new Error('preempt'));
    const composed = composeSignals(a.signal, b.signal);
    expect(composed.aborted).toBe(true);
  });

  it('falls back gracefully when AbortSignal.any is unavailable', () => {
    const original = (AbortSignal as unknown as { any?: unknown }).any;
    Reflect.deleteProperty(AbortSignal as unknown as Record<string, unknown>, 'any');
    try {
      const a = new AbortController();
      const b = new AbortController();
      const composed = composeSignals(a.signal, b.signal);
      expect(composed.aborted).toBe(false);
      a.abort(new Error('via fallback primary'));
      expect(composed.aborted).toBe(true);

      // And the secondary path of the fallback:
      const c = new AbortController();
      const d = new AbortController();
      const composed2 = composeSignals(c.signal, d.signal);
      d.abort(new Error('via fallback secondary'));
      expect(composed2.aborted).toBe(true);
    } finally {
      if (original !== undefined) {
        (AbortSignal as unknown as { any: unknown }).any = original;
      }
    }
  });

  it('handles already-aborted primary in the fallback path', () => {
    const original = (AbortSignal as unknown as { any?: unknown }).any;
    Reflect.deleteProperty(AbortSignal as unknown as Record<string, unknown>, 'any');
    try {
      const a = new AbortController();
      a.abort(new Error('pre-aborted'));
      const b = new AbortController();
      const composed = composeSignals(a.signal, b.signal);
      expect(composed.aborted).toBe(true);
    } finally {
      if (original !== undefined) {
        (AbortSignal as unknown as { any: unknown }).any = original;
      }
    }
  });

  it('handles already-aborted secondary in the fallback path', () => {
    const original = (AbortSignal as unknown as { any?: unknown }).any;
    Reflect.deleteProperty(AbortSignal as unknown as Record<string, unknown>, 'any');
    try {
      const a = new AbortController();
      const b = new AbortController();
      b.abort(new Error('pre-aborted'));
      const composed = composeSignals(a.signal, b.signal);
      expect(composed.aborted).toBe(true);
    } finally {
      if (original !== undefined) {
        (AbortSignal as unknown as { any: unknown }).any = original;
      }
    }
  });
});
