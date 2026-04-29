/**
 * @file pipeline.bench.ts
 * @description
 * Vitest benchmarks for the new pipeline primitives — `defineStep`,
 * `compose`, `parallel`, plus tracing overhead. Compares against the
 * baseline of just calling a function directly so the pipeline overhead
 * is visible.
 */

import { bench, describe } from 'vitest';
import {
  defineStep,
  parallel,
  pipe,
  makeStepContext,
  TraceCollector,
  noopTracer,
} from './index.js';
import { ok } from '../../types/result.js';

const inc = defineStep<number, number>('inc', (n) => ok(n + 1));
const double = defineStep<number, number>('double', (n) => ok(n * 2));
const stringify = defineStep<number, string>('stringify', (n) => ok(`#${n}`));

const composed = pipe(inc, double, stringify);
const par = parallel({ a: inc, b: double });

const noopCtx = makeStepContext({ tracer: noopTracer });

describe('pipeline primitives', () => {
  bench('plain function call (baseline)', () => {
    const result = `#${(1 + 1) * 2}`;
    if (result.length === 0) throw new Error('unreachable');
  });

  bench('single Step.run (noop tracer)', async () => {
    await inc.run(1, noopCtx);
  });

  bench('compose 3-stage pipe (noop tracer)', async () => {
    await composed.run(1, noopCtx);
  });

  bench('parallel of 2 steps (noop tracer)', async () => {
    await par.run(1, noopCtx);
  });

  bench('compose 3-stage pipe (TraceCollector)', async () => {
    const tracer = new TraceCollector();
    await composed.run(1, makeStepContext({ tracer }));
  });
});
