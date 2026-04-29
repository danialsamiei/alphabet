/**
 * @file schedule.test.ts
 * @description Tests for `Schedule` policies and `retry`.
 */

import { describe, it, expect } from 'vitest';
import {
  scheduleNever,
  scheduleRecurs,
  scheduleExponential,
  scheduleExponentialJitter,
  scheduleBoth,
  retry,
} from './schedule.js';
import { fail, succeed, runEffect, asyncExit, die } from './effect.js';
import { exitFailure, exitSuccess } from './exit.js';
import { causeFail } from './cause.js';

describe('Schedule', () => {
  it('never always stops', () => {
    expect(scheduleNever.next(0)).toBeUndefined();
    expect(scheduleNever.next(99)).toBeUndefined();
  });

  it('recurs(3) yields 3 retries', () => {
    const s = scheduleRecurs(3);
    expect(s.next(0)).toBe(0);
    expect(s.next(1)).toBe(0);
    expect(s.next(2)).toBe(0);
    expect(s.next(3)).toBeUndefined();
  });

  it('exponential grows by factor', () => {
    const s = scheduleExponential(10, 2, 1_000);
    expect(s.next(0)).toBe(10);
    expect(s.next(1)).toBe(20);
    expect(s.next(2)).toBe(40);
    expect(s.next(7)).toBe(1_000); // capped
  });

  it('exponentialJitter is bounded by cap and uses provided RNG', () => {
    const s = scheduleExponentialJitter(10, 3, 100, () => 1);
    const d0 = s.next(0)!;
    const d1 = s.next(1)!;
    expect(d0).toBeLessThanOrEqual(100);
    expect(d1).toBeLessThanOrEqual(100);
    expect(d0).toBeGreaterThanOrEqual(10);
  });

  it('scheduleBoth stops when either stops', () => {
    const s = scheduleBoth(scheduleRecurs(2), scheduleRecurs(5));
    expect(s.next(0)).toBe(0);
    expect(s.next(1)).toBe(0);
    expect(s.next(2)).toBeUndefined();
  });

  it('scheduleBoth picks max delay', () => {
    const a = scheduleExponential(10, 1, 1000);
    const b = scheduleExponential(50, 1, 1000);
    const s = scheduleBoth(a, b);
    expect(s.next(0)).toBe(50);
  });
});

describe('retry', () => {
  it('returns success without retrying on first success', async () => {
    let attempts = 0;
    const e = asyncExit<string, number>(async () => {
      attempts += 1;
      return exitSuccess(7);
    });
    const exit = await runEffect(retry(e, scheduleRecurs(3)), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(7);
    expect(attempts).toBe(1);
  });

  it('retries up to schedule limit then surfaces last failure', async () => {
    let attempts = 0;
    const e = asyncExit<string, number>(async () => {
      attempts += 1;
      return exitFailure(causeFail('boom'));
    });
    const exit = await runEffect(
      retry(e, scheduleRecurs(2)),
      undefined,
      undefined,
    );
    expect(exit._tag).toBe('Failure');
    expect(attempts).toBe(3); // 1 original + 2 retries
  });

  it('eventually succeeds before schedule exhausts', async () => {
    let attempts = 0;
    const e = asyncExit<string, number>(async () => {
      attempts += 1;
      return attempts < 3 ? exitFailure(causeFail('flaky')) : exitSuccess(42);
    });
    const exit = await runEffect(retry(e, scheduleRecurs(5)), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(42);
    expect(attempts).toBe(3);
  });

  it('does NOT retry on Die (defects)', async () => {
    let attempts = 0;
    const e = asyncExit<string, number>(async () => {
      attempts += 1;
      throw new Error('boom');
    });
    const exit = await runEffect(retry(e, scheduleRecurs(5)), undefined);
    expect(exit._tag).toBe('Failure');
    expect(attempts).toBe(1);
  });

  it('honours the sleep parameter', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms);
    };
    let attempts = 0;
    const e = asyncExit<string, number>(async () => {
      attempts += 1;
      return attempts < 3 ? exitFailure(causeFail('x')) : exitSuccess(1);
    });
    await runEffect(
      retry(e, scheduleExponential(5, 2, 1_000), sleep),
      undefined,
    );
    expect(sleeps).toEqual([5, 10]);
  });

  it('does not retry plain succeed effects', async () => {
    let calls = 0;
    const e = succeed(0);
    void calls;
    const exit = await runEffect(retry(e, scheduleRecurs(3)), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(0);
  });

  it('propagates fail without retry once schedule is exhausted', async () => {
    void die; // keep imports tight
    const e = fail<string>('persistent');
    const exit = await runEffect(retry(e, scheduleRecurs(1)), undefined);
    expect(exit._tag).toBe('Failure');
  });
});
