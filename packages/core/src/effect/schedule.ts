/**
 * @module effect/schedule
 * @description
 * `Schedule` — a description of a retry/repeat policy. A schedule decides
 * (a) whether to keep going given an attempt count, and (b) how long to
 * wait before the next attempt. Schedules compose with `&&` (intersect:
 * stop when either says stop) — exposed as `scheduleBoth`.
 *
 * The algebra is intentionally tiny — exponential backoff with decorrelated
 * jitter is the only knob most consumers need. Custom policies are decks
 * of cards away.
 */

import {
  type Effect,
  asyncExit,
  runEffect,
} from './effect.js';

/**
 * State machine: `next(attempt)` returns the **delay before the next
 * attempt** in milliseconds, or `undefined` to stop.
 */
export interface Schedule {
  readonly name: string;
  /**
   * @param attempt zero-based attempt index that just **failed**.
   * @returns delay in ms before the next attempt, or `undefined` to give up.
   */
  next(attempt: number): number | undefined;
}

/** RNG hook so schedules with jitter remain deterministic in tests. */
export type ScheduleRandom = () => number;

const defaultRandom: ScheduleRandom = (): number => {
  if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { crypto?: Crypto }).crypto?.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1);
    (globalThis as { crypto: Crypto }).crypto.getRandomValues(buf);
    return ((buf[0] ?? 0) >>> 0) / 0x1_0000_0000;
  }
  // Fail loudly rather than silently degrade jitter to a constant — a
  // deterministic 0.5 here would defeat the very purpose of jitter
  // (thundering-herd avoidance) without telling the caller.
  throw new Error(
    'effect/schedule: crypto.getRandomValues is unavailable. Pass an explicit ' +
      'ScheduleRandom to exponentialJitter()/withJitter() in environments without WebCrypto.',
  );
};

// ─── Concrete schedules ──────────────────────────────────────────────────────

/** Always stop. */
export const scheduleNever: Schedule = {
  name: 'never',
  next: () => undefined,
};

/**
 * `recurs(n)` — retry up to `n` times with no delay.
 */
export function scheduleRecurs(n: number): Schedule {
  const cap = Math.max(0, Math.floor(n));
  return {
    name: `recurs(${cap})`,
    next: (attempt) => (attempt + 1 <= cap ? 0 : undefined),
  };
}

/**
 * `exponential(baseMs, factor=2, capMs=10_000)` — pure exponential backoff.
 */
export function scheduleExponential(
  baseMs: number,
  factor = 2,
  capMs = 10_000,
): Schedule {
  const safeBase = Math.max(1, baseMs);
  return {
    name: `exponential(${safeBase}ms, ×${factor})`,
    next: (attempt) => {
      const delay = Math.min(capMs, safeBase * Math.pow(factor, attempt));
      return Math.max(0, delay);
    },
  };
}

/**
 * `exponentialJitter` — decorrelated jitter (Marc Brooker, AWS Architecture
 * blog) over a base schedule. Uses `random` (default: `crypto.getRandomValues`).
 *
 *   delay_n = clamp(random(base, prev_delay × factor), 0, capMs)
 */
export function scheduleExponentialJitter(
  baseMs: number,
  factor = 3,
  capMs = 10_000,
  random: ScheduleRandom = defaultRandom,
): Schedule {
  const safeBase = Math.max(1, baseMs);
  let prev = safeBase;
  return {
    name: `exponentialJitter(${safeBase}ms)`,
    next: (_attempt) => {
      const upper = Math.min(capMs, prev * factor);
      const lower = safeBase;
      const delay = lower + random() * Math.max(0, upper - lower);
      prev = Math.min(delay, capMs);
      return Math.max(0, Math.min(delay, capMs));
    },
  };
}

/**
 * Intersect two schedules: stop when **either** says stop. Delay is the
 * **maximum** of both proposed delays so the slower one wins.
 */
export function scheduleBoth(a: Schedule, b: Schedule): Schedule {
  return {
    name: `${a.name} && ${b.name}`,
    next: (attempt) => {
      const da = a.next(attempt);
      const db = b.next(attempt);
      if (da === undefined || db === undefined) return undefined;
      return Math.max(da, db);
    },
  };
}

// ─── Retry interpreter ───────────────────────────────────────────────────────

/**
 * Retry an effect according to a schedule. The effect is retried only on
 * **typed failure** (`Fail<E>`); defects (`Die`) and interruptions
 * propagate unchanged on the first occurrence.
 *
 * The implementation runs the inner effect with `runEffect` between
 * sleeps, capturing each `Exit` and consulting the schedule. Because we
 * use `asyncExit`, the typed failure channel is preserved end-to-end.
 *
 * @example
 * const flaky = tryPromise(() => fetchUser(id), () => 'NETWORK' as const);
 * const robust = retry(flaky, scheduleRecurs(3));
 */
export function retry<R, E, A>(
  effect: Effect<R, E, A>,
  schedule: Schedule,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Effect<R, E, A> {
  return asyncExit<E, A>(async (signal) => {
    let attempt = 0;
    // We always run with `undefined` env at the boundary; users that need
    // an environment must `provide` it before reaching `retry`.
    while (true) {
      const exit = await runEffect(effect, undefined as unknown as R, signal);
      if (exit._tag === 'Success') return exit;
      if (exit.cause._tag === 'Die' || exit.cause._tag === 'Interrupt') {
        return exit;
      }
      const delay = schedule.next(attempt);
      if (delay === undefined) return exit;
      await sleep(delay);
      if (signal?.aborted === true) return exit;
      attempt += 1;
    }
  }) as Effect<R, E, A>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, Math.max(0, ms)));
}
