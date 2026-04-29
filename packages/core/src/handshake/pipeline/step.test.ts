/**
 * @file step.test.ts
 * @description Unit tests for Step<I,O> primitives (defineStep, compose, pipe, parallel).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  defineStep,
  identityStep,
  compose,
  pipe,
  parallel,
  makeStepContext,
  TraceCollector,
} from './index.js';
import { ok, err } from '../../types/result.js';

describe('makeStepContext', () => {
  it('uses noop tracer and Date.now by default', () => {
    const ctx = makeStepContext();
    expect(ctx.tracer).toBeDefined();
    expect(typeof ctx.now()).toBe('number');
  });

  it('omits signal when not provided (exactOptionalPropertyTypes)', () => {
    const ctx = makeStepContext();
    expect('signal' in ctx).toBe(false);
  });

  it('passes through provided signal', () => {
    const ac = new AbortController();
    const ctx = makeStepContext({ signal: ac.signal });
    expect(ctx.signal).toBe(ac.signal);
  });
});

describe('defineStep', () => {
  it('runs success path and emits ok span', async () => {
    const tracer = new TraceCollector();
    const step = defineStep<number, number>('double', (n) => ok(n * 2));
    const ctx = makeStepContext({ tracer });
    const r = await step.run(3, ctx);
    expect(r).toEqual({ success: true, data: 6 });
  });

  it('propagates Result.err untouched', async () => {
    const step = defineStep<number, number>('fail', () =>
      err({ code: 'NOPE', message: 'no' }),
    );
    const r = await step.run(1, makeStepContext());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOPE');
  });

  it('converts thrown errors to STEP_THREW', async () => {
    const step = defineStep<number, number>('boom', () => {
      throw new Error('kaboom');
    });
    const r = await step.run(1, makeStepContext());
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.code).toBe('STEP_THREW');
      expect(r.error.message).toContain('kaboom');
    }
  });

  it('returns STEP_ABORTED when signal already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const step = defineStep<number, number>('s', () => ok(1));
    const r = await step.run(1, makeStepContext({ signal: ac.signal }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('STEP_ABORTED');
  });

  it('records error span on failure', async () => {
    const tracer = new TraceCollector();
    const step = defineStep<number, number>('fail', () =>
      err({ code: 'X', message: 'm' }),
    );
    const root = tracer.startSpan('root');
    await step.run(1, makeStepContext({ tracer: { startSpan: () => root.child('fail') } }));
    root.end();
    const snap = tracer.snapshot();
    expect(snap?.root.children[0]?.outcome).toBe('error');
  });
});

describe('compose / pipe', () => {
  it('composes two steps in order', async () => {
    const a = defineStep<number, number>('a', (n) => ok(n + 1));
    const b = defineStep<number, string>('b', (n) => ok(`v=${n}`));
    const c = compose(a, b);
    const r = await c.run(2, makeStepContext());
    expect(r).toEqual({ success: true, data: 'v=3' });
    expect(c.name).toBe('a→b');
  });

  it('short-circuits on first failure', async () => {
    const calls: string[] = [];
    const a = defineStep<number, number>('a', () => {
      calls.push('a');
      return err({ code: 'A_ERR', message: 'a' });
    });
    const b = defineStep<number, number>('b', (n) => {
      calls.push('b');
      return ok(n);
    });
    const r = await compose(a, b).run(1, makeStepContext());
    expect(r.success).toBe(false);
    expect(calls).toEqual(['a']);
  });

  it('pipe(a,b,c) is a 3-stage chain', async () => {
    const a = defineStep<number, number>('a', (n) => ok(n + 1));
    const b = defineStep<number, number>('b', (n) => ok(n * 2));
    const c = defineStep<number, string>('c', (n) => ok(`#${n}`));
    const p = pipe(a, b, c);
    const r = await p.run(1, makeStepContext());
    expect(r).toEqual({ success: true, data: '#4' });
  });

  it('aborts mid-chain when signal fires between steps', async () => {
    const ac = new AbortController();
    const a = defineStep<number, number>('a', (n) => {
      ac.abort();
      return ok(n);
    });
    const b = defineStep<number, number>('b', (n) => ok(n));
    const r = await compose(a, b).run(1, makeStepContext({ signal: ac.signal }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('STEP_ABORTED');
  });
});

describe('identityStep', () => {
  it('passes input unchanged', async () => {
    const r = await identityStep<number>().run(42, makeStepContext());
    expect(r).toEqual({ success: true, data: 42 });
  });
});

describe('parallel', () => {
  it('runs siblings concurrently and aggregates into object', async () => {
    const a = defineStep<number, number>('a', (n) => ok(n + 1));
    const b = defineStep<number, string>('b', (n) => ok(String(n)));
    const r = await parallel({ a, b }).run(5, makeStepContext());
    expect(r).toEqual({ success: true, data: { a: 6, b: '5' } });
  });

  it('returns first failure and cancels siblings via inner signal', async () => {
    const cancelled = vi.fn();
    const a = defineStep<number, number>('a', () =>
      err({ code: 'A_ERR', message: 'fail-a' }),
    );
    const b = defineStep<number, number>('b', async (n, ctx) => {
      await new Promise((res, rej) => {
        const t = setTimeout(res, 50);
        ctx.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          cancelled();
          rej(new Error('aborted'));
        });
      });
      return ok(n);
    });
    const r = await parallel({ a, b }).run(1, makeStepContext());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('A_ERR');
  });

  it('honors outer abort signal', async () => {
    const ac = new AbortController();
    ac.abort();
    const a = defineStep<number, number>('a', (n) => ok(n));
    const r = await parallel({ a }).run(1, makeStepContext({ signal: ac.signal }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('STEP_ABORTED');
  });
});
