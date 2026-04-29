/**
 * @file effect.test.ts
 * @description Unit tests for the in-house Effect runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  succeed,
  fail,
  die,
  sync,
  async,
  asyncExit,
  tryPromise,
  map,
  flatMap,
  catchAll,
  mapError,
  zip,
  all,
  race,
  runEffect,
  isEffect,
} from './effect.js';
import { causeFail, causeIsInterrupted } from './cause.js';
import { exitToResult } from './exit.js';

describe('Effect / constructors', () => {
  it('succeed yields Success', async () => {
    const exit = await runEffect(succeed(42), undefined);
    expect(exit._tag).toBe('Success');
    if (exit._tag === 'Success') expect(exit.value).toBe(42);
  });

  it('fail yields Failure(Fail(error))', async () => {
    const exit = await runEffect(fail({ code: 'X', message: 'm' }), undefined);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      expect(exit.cause).toEqual(causeFail({ code: 'X', message: 'm' }));
    }
  });

  it('die yields Failure(Die(defect))', async () => {
    const exit = await runEffect(die(new Error('boom')), undefined);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      expect(exit.cause._tag).toBe('Die');
    }
  });

  it('sync wraps a thunk', async () => {
    const exit = await runEffect(
      sync(() => 'hello'),
      undefined,
    );
    expect(exit._tag).toBe('Success');
    if (exit._tag === 'Success') expect(exit.value).toBe('hello');
  });

  it('sync converts thrown errors into Die', async () => {
    const exit = await runEffect(
      sync<never>(() => {
        throw new Error('nope');
      }),
      undefined,
    );
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(exit.cause._tag).toBe('Die');
  });

  it('isEffect distinguishes effects', () => {
    expect(isEffect(succeed(1))).toBe(true);
    expect(isEffect(42)).toBe(false);
    expect(isEffect(null)).toBe(false);
  });
});

describe('Effect / map + flatMap', () => {
  it('map transforms success', async () => {
    const exit = await runEffect(map(succeed(2), (n) => n * 3), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(6);
  });

  it('flatMap chains effects', async () => {
    const program = flatMap(succeed(2), (n) => succeed(n + 10));
    const exit = await runEffect(program, undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(12);
  });

  it('flatMap short-circuits on failure', async () => {
    const program = flatMap(fail<string>('oops'), () => succeed(1));
    const exit = await runEffect(program, undefined);
    expect(exit._tag).toBe('Failure');
  });

  it('deep flatMap chains do not blow the stack', async () => {
    let e = succeed(0) as ReturnType<typeof succeed<number>>;
    for (let i = 0; i < 5_000; i++) {
      e = flatMap(e, (n) => succeed(n + 1));
    }
    const exit = await runEffect(e, undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(5_000);
  });
});

describe('Effect / catchAll', () => {
  it('recovers from typed failures', async () => {
    const program = catchAll(fail<string>('bad'), (e) => succeed(`recovered:${e}`));
    const exit = await runEffect(program, undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe('recovered:bad');
  });

  it('does NOT recover from defects (Die)', async () => {
    const program = catchAll(die(new Error('boom')), () => succeed('never'));
    const exit = await runEffect(program, undefined);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(exit.cause._tag).toBe('Die');
  });

  it('mapError changes the failure type', async () => {
    const program = mapError(fail<string>('x'), (e) => `wrapped:${e}`);
    const exit = await runEffect(program, undefined);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      expect(exit.cause.error).toBe('wrapped:x');
    }
  });
});

describe('Effect / async', () => {
  it('async lifts a promise', async () => {
    const exit = await runEffect(
      async(() => Promise.resolve(7)),
      undefined,
    );
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(7);
  });

  it('async rejection becomes a defect', async () => {
    const exit = await runEffect(
      async(() => Promise.reject(new Error('net'))),
      undefined,
    );
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(exit.cause._tag).toBe('Die');
  });

  it('tryPromise rejection becomes a typed Fail', async () => {
    const exit = await runEffect(
      tryPromise(
        () => Promise.reject(new Error('net')),
        () => 'NETWORK' as const,
      ),
      undefined,
    );
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      expect(exit.cause.error).toBe('NETWORK');
    }
  });

  it('asyncExit lets producer return Exit directly', async () => {
    const exit = await runEffect(
      asyncExit<string, number>(async () => ({ _tag: 'Success', value: 99 })),
      undefined,
    );
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(99);
  });
});

describe('Effect / interruption', () => {
  it('aborted signal short-circuits the effect', async () => {
    const ac = new AbortController();
    ac.abort();
    const exit = await runEffect(succeed(1), undefined, ac.signal);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(causeIsInterrupted(exit.cause)).toBe(true);
  });

  it('signal aborted mid-async surfaces as Interrupt', async () => {
    const ac = new AbortController();
    const program = async(
      () =>
        new Promise<number>((resolve) => {
          setTimeout(() => resolve(42), 5);
        }),
    );
    setTimeout(() => ac.abort(), 1);
    const exit = await runEffect(program, undefined, ac.signal);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') expect(causeIsInterrupted(exit.cause)).toBe(true);
  });
});

describe('Effect / zip + all + race', () => {
  it('zip combines two successes', async () => {
    const exit = await runEffect(zip(succeed('a'), succeed('b')), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toEqual(['a', 'b']);
  });

  it('all collects all successes', async () => {
    const exit = await runEffect(all([succeed(1), succeed(2), succeed(3)]), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toEqual([1, 2, 3]);
  });

  it('all combines failures with Both', async () => {
    const exit = await runEffect(
      all([fail<string>('a'), fail<string>('b')]),
      undefined,
    );
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      expect(exit.cause._tag === 'Both' || exit.cause._tag === 'Fail').toBe(true);
    }
  });

  it('race returns the first success', async () => {
    const slow = async(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 50)),
    );
    const fast = async(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('fast'), 1)),
    );
    const exit = await runEffect(race([slow, fast]), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe('fast');
  });
});

describe('Effect / exitToResult bridge', () => {
  it('Success → ok', async () => {
    const exit = await runEffect(succeed(7), undefined);
    const r = exitToResult(exit);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(7);
  });

  it('Fail → err with original AlphabetError', async () => {
    const exit = await runEffect(fail({ code: 'X', message: 'oops' }), undefined);
    const r = exitToResult(exit);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('X');
  });

  it('Die → err with EFFECT_DIED', async () => {
    const exit = await runEffect(die(new Error('boom')), undefined);
    const r = exitToResult(exit);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('EFFECT_DIED');
  });

  it('Interrupt → err with EFFECT_INTERRUPTED', async () => {
    const ac = new AbortController();
    ac.abort();
    const exit = await runEffect(succeed(1), undefined, ac.signal);
    const r = exitToResult(exit);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('EFFECT_INTERRUPTED');
  });
});
