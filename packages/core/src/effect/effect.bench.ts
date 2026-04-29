/**
 * @file effect.bench.ts
 * @description
 * Benchmarks for the Effect runtime — baseline (plain function) vs single
 * `succeed`, vs short flatMap chains, vs deep flatMap chains, vs catchAll.
 */

import { bench, describe } from 'vitest';
import {
  succeed,
  flatMap,
  catchAll,
  fail,
  runEffect,
} from './effect.js';

const fortyTwo = succeed(42);

describe('Effect runtime', () => {
  bench('plain JS baseline', () => {
    const x = 42;
    if (x !== 42) throw new Error('unreachable');
  });

  bench('runEffect(succeed)', async () => {
    await runEffect(fortyTwo, undefined);
  });

  bench('flatMap × 5', async () => {
    let e = fortyTwo;
    for (let i = 0; i < 5; i++) e = flatMap(e, (n) => succeed(n + 1));
    await runEffect(e, undefined);
  });

  bench('flatMap × 50', async () => {
    let e = fortyTwo;
    for (let i = 0; i < 50; i++) e = flatMap(e, (n) => succeed(n + 1));
    await runEffect(e, undefined);
  });

  bench('catchAll on success path (no recovery)', async () => {
    const e = catchAll(succeed(1), () => succeed(2));
    await runEffect(e, undefined);
  });

  bench('catchAll on failure path (recovery taken)', async () => {
    const e = catchAll(fail<string>('x'), () => succeed(2));
    await runEffect(e, undefined);
  });
});
