/**
 * @module effect/effect
 * @description
 * In-house **Effect-style runtime** for `@alphabet/core`. Models a lazy,
 * cancellable async computation `Effect<R, E, A>`:
 *
 *   - `R` — environment type (services available to the effect)
 *   - `E` — typed failure channel
 *   - `A` — success channel
 *
 * **Why in-house.** `@alphabet/core` is published as zero-dependency,
 * tree-shakeable, edge-safe. Adding `effect` + `@effect/schema` brings
 * ~100KB of runtime tree and a peer-dependency expectation we don't want
 * to push onto downstream consumers (`@alphabet/api`, `@alphabet/ui`,
 * `apps/demo`). This module gives Alphabet 95% of the ergonomics of
 * Effect — `succeed`/`fail`/`flatMap`/`catchAll`/`zip`/`all`/`race` plus
 * `Schedule` and `Layer<R>` — for ~400 LOC of dependency-free TS.
 *
 * **Failure model.** Every Effect carries a `Cause<E>` (see `./cause.ts`).
 * `catchAll` recovers from typed `Fail<E>` only; defects (`Die`) and
 * interruptions (`Interrupt`) propagate. This matches Effect-TS / ZIO
 * semantics and is enforced at runtime by `runEffect`.
 *
 * **Interruption.** Every run takes an optional `AbortSignal`. When the
 * signal aborts, the next continuation observes an interruption and
 * short-circuits with `causeInterrupt`. Currently-pending `async` work is
 * not forcibly cancelled (we don't pretend to control external Promises),
 * but its result is discarded.
 *
 * **No throwing.** The public API never throws on failure — `runEffect`
 * always resolves with an `Exit<E, A>`.
 */

import {
  type Cause,
  causeBoth,
  causeDie,
  causeFail,
  causeInterrupt,
  causeIsInterrupted,
  causeThen,
} from './cause.js';
import { type Exit, exitFailure, exitSuccess } from './exit.js';

// ─── Symbol marker ────────────────────────────────────────────────────────────

const EFFECT_TAG = Symbol.for('@alphabet/core/effect');

// ─── Step IR ─────────────────────────────────────────────────────────────────
//
// Effect is implemented as a small, opaque tagged-union of "steps". Users
// never see these; they construct effects with the public combinators.

type Step<R, E, A> =
  | { readonly _tag: 'Succeed'; readonly value: A }
  | { readonly _tag: 'Fail'; readonly cause: Cause<E> }
  | { readonly _tag: 'Sync'; readonly thunk: () => A }
  | {
      readonly _tag: 'Async';
      readonly resume: (
        signal: AbortSignal | undefined,
      ) => Promise<Exit<E, A>>;
    }
  | {
      readonly _tag: 'FlatMap';
      readonly first: Effect<R, E, unknown>;
      readonly cont: (a: unknown) => Effect<R, E, A>;
    }
  | {
      readonly _tag: 'CatchAll';
      readonly first: Effect<R, unknown, A>;
      readonly recover: (e: unknown) => Effect<R, E, A>;
    }
  | { readonly _tag: 'Provide'; readonly first: Effect<unknown, E, A>; readonly r: R };

/**
 * `Effect<R, E, A>` — a lazy, cancellable description of an async
 * computation that requires `R`, may fail with `E`, and succeeds with `A`.
 * Run with `runEffect(effect, environment, signal?)`.
 */
export interface Effect<R, E, A> {
  readonly [EFFECT_TAG]: true;
  readonly step: Step<R, E, A>;
}

function makeEffect<R, E, A>(step: Step<R, E, A>): Effect<R, E, A> {
  return { [EFFECT_TAG]: true, step };
}

// ─── Constructors ────────────────────────────────────────────────────────────

/** Lift a value into an effect. Always succeeds. */
export function succeed<A>(value: A): Effect<unknown, never, A> {
  return makeEffect({ _tag: 'Succeed', value });
}

/** Fail with a typed domain error. */
export function fail<E>(error: E): Effect<unknown, E, never> {
  return makeEffect({ _tag: 'Fail', cause: causeFail(error) });
}

/** Crash with a defect (programmer error). Defects bypass `catchAll`. */
export function die(defect: unknown): Effect<unknown, never, never> {
  return makeEffect({ _tag: 'Fail', cause: causeDie(defect) });
}

/** Synchronous, never-failing computation. Throws become defects. */
export function sync<A>(thunk: () => A): Effect<unknown, never, A> {
  return makeEffect({ _tag: 'Sync', thunk });
}

/** Synchronous computation that may fail with a typed error. */
export function syncEither<E, A>(
  thunk: () => { readonly success: true; readonly data: A } | { readonly success: false; readonly error: E },
): Effect<unknown, E, A> {
  return makeEffect({
    _tag: 'Async',
    resume: async (): Promise<Exit<E, A>> => {
      try {
        const r = thunk();
        return r.success ? exitSuccess(r.data) : exitFailure(causeFail(r.error));
      } catch (e) {
        return exitFailure(causeDie(e));
      }
    },
  });
}

/**
 * Asynchronous effect from a Promise factory. The factory receives the
 * run-time `AbortSignal` so it can opt into cancellation.
 *
 * Throws (rejections) become **defects**, not failures. To signal a typed
 * failure, return a rejected Promise containing the typed error and use
 * `tryPromise` instead.
 */
export function async<A>(
  resume: (signal: AbortSignal | undefined) => Promise<A>,
): Effect<unknown, never, A> {
  return makeEffect({
    _tag: 'Async',
    resume: async (signal): Promise<Exit<never, A>> => {
      try {
        const v = await resume(signal);
        return exitSuccess(v);
      } catch (e) {
        return exitFailure(causeDie(e));
      }
    },
  });
}

/**
 * Asynchronous effect from a producer that returns an `Exit<E, A>` directly.
 * Useful for combinators like `retry`/`race` that compose Exits, since the
 * `Async` IR step natively carries an Exit.
 */
export function asyncExit<E, A>(
  resume: (signal: AbortSignal | undefined) => Promise<Exit<E, A>>,
): Effect<unknown, E, A> {
  return makeEffect({
    _tag: 'Async',
    resume: async (signal): Promise<Exit<E, A>> => {
      try {
        return await resume(signal);
      } catch (e) {
        return exitFailure(causeDie(e));
      }
    },
  });
}

/**
 * Asynchronous effect from a Promise that may legitimately reject. The
 * `mapError` function turns a rejection reason into a typed `E`.
 */
export function tryPromise<E, A>(
  resume: (signal: AbortSignal | undefined) => Promise<A>,
  mapError: (reason: unknown) => E,
): Effect<unknown, E, A> {
  return makeEffect({
    _tag: 'Async',
    resume: async (signal): Promise<Exit<E, A>> => {
      try {
        const v = await resume(signal);
        return exitSuccess(v);
      } catch (e) {
        return exitFailure(causeFail(mapError(e)));
      }
    },
  });
}

// ─── Combinators ─────────────────────────────────────────────────────────────

export function map<R, E, A, B>(
  e: Effect<R, E, A>,
  f: (a: A) => B,
): Effect<R, E, B> {
  return flatMap(e, (a) => succeed(f(a)) as Effect<R, E, B>);
}

export function flatMap<R, E, A, B>(
  e: Effect<R, E, A>,
  f: (a: A) => Effect<R, E, B>,
): Effect<R, E, B> {
  return makeEffect({
    _tag: 'FlatMap',
    first: e as Effect<R, E, unknown>,
    cont: f as (a: unknown) => Effect<R, E, B>,
  });
}

export function catchAll<R, E, E2, A>(
  e: Effect<R, E, A>,
  recover: (error: E) => Effect<R, E2, A>,
): Effect<R, E2, A> {
  return makeEffect({
    _tag: 'CatchAll',
    first: e as Effect<R, unknown, A>,
    recover: recover as (e: unknown) => Effect<R, E2, A>,
  });
}

export function mapError<R, E, E2, A>(
  e: Effect<R, E, A>,
  f: (error: E) => E2,
): Effect<R, E2, A> {
  return catchAll(e, (err) => fail(f(err)) as Effect<R, E2, A>);
}

export function provide<R, E, A>(e: Effect<R, E, A>, r: R): Effect<unknown, E, A> {
  return makeEffect({ _tag: 'Provide', first: e as Effect<unknown, E, A>, r });
}

// ─── Public type guard ───────────────────────────────────────────────────────

export function isEffect(x: unknown): x is Effect<unknown, unknown, unknown> {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as Record<symbol, unknown>)[EFFECT_TAG] === true
  );
}

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Run an effect to an `Exit`. Never throws. Honours `signal` interruption
 * at every continuation boundary.
 *
 * The interpreter is iterative (heap-allocated continuation stack) so it
 * never overflows the JS call stack on deep `flatMap` chains.
 */
export async function runEffect<R, E, A>(
  effect: Effect<R, E, A>,
  environment: R,
  signal?: AbortSignal,
): Promise<Exit<E, A>> {
  type Cont = (value: unknown) => Effect<R, E, unknown>;
  type Recover = (error: unknown) => Effect<R, E, unknown>;
  type Frame =
    | { readonly _tag: 'Map'; readonly cont: Cont }
    | { readonly _tag: 'Catch'; readonly recover: Recover };

  const stack: Frame[] = [];
  let current: Effect<R, E, unknown> = effect as Effect<R, E, unknown>;
  let env: R = environment;

  while (true) {
    if (signal?.aborted === true) {
      return exitFailure(causeInterrupt) as Exit<E, A>;
    }

    const step = current.step;

    if (step._tag === 'FlatMap') {
      stack.push({ _tag: 'Map', cont: step.cont as Cont });
      current = step.first;
      continue;
    }
    if (step._tag === 'CatchAll') {
      stack.push({ _tag: 'Catch', recover: step.recover as Recover });
      current = step.first as Effect<R, E, unknown>;
      continue;
    }
    if (step._tag === 'Provide') {
      env = step.r;
      current = step.first as Effect<R, E, unknown>;
      continue;
    }

    // Terminal step — produce an Exit then unwind frames.
    let exit: Exit<unknown, unknown>;
    if (step._tag === 'Succeed') {
      exit = exitSuccess(step.value);
    } else if (step._tag === 'Fail') {
      exit = exitFailure(step.cause as Cause<unknown>);
    } else if (step._tag === 'Sync') {
      try {
        exit = exitSuccess(step.thunk());
      } catch (e) {
        exit = exitFailure(causeDie(e));
      }
    } else {
      // Async
      let asyncExit: Exit<unknown, unknown>;
      try {
        asyncExit = (await step.resume(signal)) as Exit<unknown, unknown>;
      } catch (e) {
        // tryPromise/async already trap, but defensive in case a custom
        // resume violates contract.
        asyncExit = exitFailure(causeDie(e));
      }
      if (asyncExit._tag === 'Success' && (signal as AbortSignal | undefined)?.aborted) {
        // The async resolved but we were interrupted in flight.
        asyncExit = exitFailure(causeInterrupt);
      }
      exit = asyncExit;
    }

    // Unwind stack: feed `exit` through frames until one consumes it
    // (Map for Success, Catch for typed Failure) or the stack empties.
    let consumed = false;
    while (stack.length > 0 && !consumed) {
      const frame = stack.pop() as Frame;
      if (exit._tag === 'Success' && frame._tag === 'Map') {
        current = frame.cont(exit.value);
        consumed = true;
        break;
      }
      if (exit._tag === 'Failure' && frame._tag === 'Catch') {
        const firstFail = firstFailureOf(exit.cause);
        if (firstFail !== undefined && !causeIsInterrupted(exit.cause)) {
          current = frame.recover(firstFail);
          consumed = true;
          break;
        }
      }
      // Otherwise: Map on failure (skip), Catch on success (skip),
      // or Catch on Die/Interrupt (skip — defects/interrupts bypass catch).
    }

    if (!consumed) {
      void env; // env reads unused when no Provide frames remain
      return exit as Exit<E, A>;
    }
  }
}

function firstFailureOf<E>(cause: Cause<E>): E | undefined {
  if (cause._tag === 'Fail') return cause.error;
  if (cause._tag === 'Then' || cause._tag === 'Both') {
    const left = firstFailureOf(cause.left);
    if (left !== undefined) return left;
    return firstFailureOf(cause.right);
  }
  return undefined;
}

// ─── Combinators that depend on the runner ──────────────────────────────────

/**
 * Sequentially zip two effects into a tuple. Both must succeed.
 * The second effect runs only if the first succeeded.
 */
export function zip<R, E, A, B>(
  a: Effect<R, E, A>,
  b: Effect<R, E, B>,
): Effect<R, E, readonly [A, B]> {
  return flatMap(a, (av) => map(b, (bv) => [av, bv] as const));
}

/**
 * Run several effects in parallel and collect their successes.
 * If any fails, the combined cause uses `Both` so all failures are visible.
 *
 * Cancellation: this honours the run-time `AbortSignal` because each
 * inner runEffect re-checks it; we don't need to wire a child controller.
 */
export function all<R, E, A>(
  effects: ReadonlyArray<Effect<R, E, A>>,
): Effect<R, E, readonly A[]> {
  return makeEffect({
    _tag: 'Async',
    resume: async (signal): Promise<Exit<E, readonly A[]>> => {
      // Environment intentionally undefined — `all` requires effects to have
      // been provided already, or to use `unknown` env.
      const exits = await Promise.all(
        effects.map((e) => runEffect(e, undefined as unknown as R, signal)),
      );
      const values: A[] = [];
      let combined: Cause<E> = { _tag: 'Empty' };
      let anyFailure = false;
      for (const exit of exits) {
        if (exit._tag === 'Failure') {
          anyFailure = true;
          combined = causeBoth(combined, exit.cause);
        } else if (!anyFailure) {
          values.push(exit.value);
        }
      }
      if (anyFailure) return exitFailure(combined);
      return exitSuccess(values);
    },
  });
}

/**
 * Race several effects; first success wins. If all fail, combined cause
 * uses sequential `Then` of all failures so the order of arrival is
 * preserved.
 */
export function race<R, E, A>(
  effects: ReadonlyArray<Effect<R, E, A>>,
): Effect<R, E, A> {
  if (effects.length === 0) {
    return die(new Error('race: empty effect array')) as unknown as Effect<R, E, A>;
  }
  return makeEffect({
    _tag: 'Async',
    resume: async (signal): Promise<Exit<E, A>> => {
      const inner = new AbortController();
      const onOuter = (): void => inner.abort();
      signal?.addEventListener('abort', onOuter, { once: true });
      try {
        const promises = effects.map((e) => runEffect(e, undefined as unknown as R, inner.signal));
        let cause: Cause<E> = { _tag: 'Empty' };
        let pending = promises.length;
        return await new Promise<Exit<E, A>>((resolve) => {
          for (const p of promises) {
            void p.then((exit) => {
              if (exit._tag === 'Success') {
                inner.abort();
                resolve(exit);
                return;
              }
              cause = causeThen(cause, exit.cause);
              pending -= 1;
              if (pending === 0) resolve(exitFailure(cause));
            });
          }
        });
      } finally {
        signal?.removeEventListener('abort', onOuter);
      }
    },
  });
}
