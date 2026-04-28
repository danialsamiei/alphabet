/**
 * @file trace.test.ts
 * @description Unit tests for TraceCollector / Span.
 */

import { describe, it, expect } from 'vitest';
import { TraceCollector, noopTracer } from './trace.js';

describe('TraceCollector', () => {
  it('records a single ok span', () => {
    let t = 0;
    const tracer = new TraceCollector({ now: () => (t += 10) });
    const s = tracer.startSpan('root');
    s.end();
    const snap = tracer.snapshot();
    expect(snap?.root.name).toBe('root');
    expect(snap?.root.outcome).toBe('ok');
    expect(snap?.root.durationMs).toBe(10);
    expect(snap?.root.children).toEqual([]);
  });

  it('captures nested children in completion order', () => {
    let t = 0;
    const tracer = new TraceCollector({ now: () => (t += 1) });
    const root = tracer.startSpan('root');
    const a = root.child('a');
    const b = root.child('b');
    b.end();
    a.end();
    root.end();
    const snap = tracer.snapshot();
    expect(snap?.root.children.map((c) => c.name)).toEqual(['b', 'a']);
  });

  it('records error and cancel outcomes', () => {
    const tracer = new TraceCollector();
    const s1 = tracer.startSpan('err');
    s1.fail('BAD');
    const snap1 = tracer.snapshot();
    expect(snap1?.root.outcome).toBe('error');
    expect(snap1?.root.errorMessage).toBe('BAD');

    const tracer2 = new TraceCollector();
    const s2 = tracer2.startSpan('cancel');
    s2.cancel();
    expect(tracer2.snapshot()?.root.outcome).toBe('cancelled');
  });

  it('ignores end() after first finish', () => {
    const tracer = new TraceCollector();
    const s = tracer.startSpan('s');
    s.end();
    s.fail('TOO_LATE');
    expect(tracer.snapshot()?.root.outcome).toBe('ok');
  });

  it('attributes are recorded and frozen', () => {
    const tracer = new TraceCollector();
    const s = tracer.startSpan('s', { phase: 'collect' });
    s.setAttribute('count', 3);
    s.end();
    const snap = tracer.snapshot();
    expect(snap?.root.attributes).toEqual({ phase: 'collect', count: 3 });
    expect(() => {
      (snap?.root.attributes as Record<string, unknown>)['x'] = 1;
    }).toThrow();
  });

  it('snapshot is undefined until root ends', () => {
    const tracer = new TraceCollector();
    const s = tracer.startSpan('open');
    expect(tracer.snapshot()).toBeUndefined();
    s.end();
    expect(tracer.snapshot()).toBeDefined();
  });
});

describe('noopTracer', () => {
  it('all methods are no-ops', () => {
    const s = noopTracer.startSpan('x');
    s.setAttribute('a', 1);
    const c = s.child('c');
    c.end();
    s.end();
    s.fail('shouldnt throw');
    s.cancel();
    expect(true).toBe(true);
  });
});
