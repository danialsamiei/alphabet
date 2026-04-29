/**
 * @module effect/exit
 * @description
 * `Exit<E, A>` — the result of running an `Effect`. Either a `Success<A>`
 * (carrying the produced value) or a `Failure<E>` (carrying a `Cause<E>`).
 *
 * `Exit` is a richer cousin of `Result<A, E>`: where `Result` only knows
 * about a single domain error `E`, `Exit` distinguishes failures from
 * defects from interruption via its embedded `Cause`. It bridges back to
 * `Result` via `exitToResult`, which collapses defects and interrupts into
 * synthetic `AlphabetError`s so existing call-sites that only consume
 * `Result` keep working.
 */

import { type AlphabetError, type Result, ok, err } from '../types/result.js';
import {
  type Cause,
  causeDefects,
  causeFailures,
  causeIsInterrupted,
  causePretty,
} from './cause.js';

// ─── Tagged union ────────────────────────────────────────────────────────────

export type Exit<E, A> =
  | { readonly _tag: 'Success'; readonly value: A }
  | { readonly _tag: 'Failure'; readonly cause: Cause<E> };

// ─── Constructors ────────────────────────────────────────────────────────────

export function exitSuccess<A>(value: A): Exit<never, A> {
  return { _tag: 'Success', value };
}

export function exitFailure<E>(cause: Cause<E>): Exit<E, never> {
  return { _tag: 'Failure', cause };
}

// ─── Predicates ──────────────────────────────────────────────────────────────

export function exitIsSuccess<E, A>(
  e: Exit<E, A>,
): e is { _tag: 'Success'; value: A } {
  return e._tag === 'Success';
}

export function exitIsFailure<E, A>(
  e: Exit<E, A>,
): e is { _tag: 'Failure'; cause: Cause<E> } {
  return e._tag === 'Failure';
}

// ─── Bridges ─────────────────────────────────────────────────────────────────

/**
 * Collapse an `Exit<AlphabetError, A>` into a plain `Result<A, AlphabetError>`.
 *
 * - `Success(a)`         → `ok(a)`
 * - `Failure(Fail(e))`   → `err(e)`         (first failure wins)
 * - `Failure(Die(x))`    → `err(EFFECT_DIED)` (defects surface as DIED)
 * - `Failure(Interrupt)` → `err(EFFECT_INTERRUPTED)`
 *
 * This is the canonical way to consume an Effect from non-Effect code.
 */
export function exitToResult<A>(
  exit: Exit<AlphabetError, A>,
): Result<A, AlphabetError> {
  if (exit._tag === 'Success') return ok(exit.value);
  const cause = exit.cause;
  const failures = causeFailures(cause);
  if (failures.length > 0) {
    // Strip path/cause-tree internals — return the first domain error verbatim.
    return err(failures[0] as AlphabetError);
  }
  if (causeIsInterrupted(cause)) {
    return err({
      code: 'EFFECT_INTERRUPTED',
      message: 'Effect was interrupted before producing a value',
    });
  }
  const defects = causeDefects(cause);
  return err({
    code: 'EFFECT_DIED',
    message:
      defects.length > 0
        ? `Effect died: ${describeDefect(defects[0])}`
        : 'Effect died with no recorded defect',
    details: { trace: causePretty(cause) },
  });
}

function describeDefect(d: unknown): string {
  if (d instanceof Error) return d.message;
  if (typeof d === 'string') return d;
  try {
    return JSON.stringify(d);
  } catch {
    return String(d);
  }
}
