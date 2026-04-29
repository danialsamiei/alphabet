/**
 * @module contracts/runtime/validator
 * @description
 * Runtime validation primitives for the Alphabet API boundary.
 *
 * The {@link Validator} interface is the abstract contract: every validator
 * takes an `unknown` input and returns a `Result<T, ValidationError>`. The
 * generic parameter `T` is the **narrowed** output type — validators are
 * **type predicates with structured failure information**.
 *
 * This module is intentionally dependency-free. A separate `zod-validator.ts`
 * module (introduced in a follow-up) will adapt `zod` to this interface so
 * consumers can opt in via dynamic import without forcing zod onto everyone.
 *
 * @example
 * import { v, validateOrError } from '@alphabet/core/contracts/runtime';
 *
 * const userSchema = v.object({
 *   id: v.string(),
 *   age: v.number(),
 *   email: v.optional(v.string()),
 * });
 *
 * const result = userSchema.validate(input);
 * if (!result.success) {
 *   console.error(result.error.path, result.error.message);
 * }
 */

import type { AlphabetError, Result } from '../../types/result.js';
import { err, ok } from '../../types/result.js';

// ─── ValidationError ──────────────────────────────────────────────────────────

/**
 * Structured validation failure. Extends {@link AlphabetError} so that callers
 * already returning `Result<T, AlphabetError>` do not need to widen their error
 * union — a validation failure is just one more `AlphabetError` variant with a
 * stable `code: 'VALIDATION_ERROR'`.
 *
 * The `path` array points at the offending field; e.g. for input
 * `{ user: { age: 'not a number' } }` the path is `['user', 'age']`.
 *
 * The `expected` and `received` strings are **not** the offending values
 * themselves — they describe shapes (e.g. `'number'`, `'object'`). This is
 * intentional: validation messages must never leak PII.
 */
export interface ValidationError extends AlphabetError {
  readonly code: 'VALIDATION_ERROR';
  readonly message: string;
  readonly details: {
    readonly path: readonly (string | number)[];
    readonly expected: string;
    readonly received: string;
    readonly issues?: readonly ValidationIssue[];
  };
}

/**
 * One leaf issue inside a {@link ValidationError}. Used to aggregate multiple
 * failures from a single object validation pass (e.g. all field errors).
 */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly expected: string;
  readonly received: string;
  readonly message: string;
}

// ─── Validator interface ──────────────────────────────────────────────────────

/**
 * Abstract validator contract. A validator narrows `unknown` to `T` or
 * returns a {@link ValidationError}. Validators are pure, deterministic,
 * and synchronous.
 *
 * @template T - The narrowed output type when validation succeeds.
 */
export interface Validator<T> {
  /** Stable identifier of the validator implementation, e.g. `'structural'`. */
  readonly kind: string;
  /**
   * Run validation. Never throws; failures are returned as `Result.error`.
   *
   * @param input - Untrusted input from any source (network, storage, message).
   * @returns `Result<T, ValidationError>`.
   */
  validate(input: unknown): Result<T, ValidationError>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a {@link ValidationError} with a single issue.
 */
export function validationError(
  path: readonly (string | number)[],
  expected: string,
  received: string,
  message?: string,
): ValidationError {
  const finalMessage = message ?? `Expected ${expected} at ${formatPath(path)}, received ${received}`;
  return {
    code: 'VALIDATION_ERROR',
    message: finalMessage,
    details: { path, expected, received },
  };
}

/**
 * Aggregate multiple {@link ValidationIssue}s into a single error.
 * Returns the first issue's path/expected/received as the top-level summary.
 */
export function aggregateValidationError(
  issues: readonly ValidationIssue[],
): ValidationError {
  const first = issues[0];
  if (first === undefined) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed (no issues recorded)',
      details: { path: [], expected: 'unknown', received: 'unknown', issues: [] },
    };
  }
  const summary = issues.length === 1
    ? first.message
    : `${issues.length} validation issues; first: ${first.message}`;
  return {
    code: 'VALIDATION_ERROR',
    message: summary,
    details: {
      path: first.path,
      expected: first.expected,
      received: first.received,
      issues,
    },
  };
}

/**
 * Convenience: run a validator and return its `Result` directly. Equivalent
 * to `validator.validate(input)` but semantically clearer at call sites.
 */
export function validateOrError<T>(
  validator: Validator<T>,
  input: unknown,
): Result<T, ValidationError> {
  return validator.validate(input);
}

/** Format a JSON path array as a dotted string (`'user.address[0].city'`). */
export function formatPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return '$';
  let out = '$';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (/^[A-Za-z_$][\w$]*$/.test(seg)) out += `.${seg}`;
    else out += `[${JSON.stringify(seg)}]`;
  }
  return out;
}

/** typeof-style coarse type tag, distinguishing `null` and `array`. */
export function describeRuntimeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ─── Internal: build a ValidationError out of an unsuccessful validation ──────

/** @internal */
export function failValidation<T>(
  path: readonly (string | number)[],
  expected: string,
  received: unknown,
  message?: string,
): Result<T, ValidationError> {
  return err(
    validationError(
      path,
      expected,
      describeRuntimeType(received),
      message,
    ),
  );
}

/** @internal */
export function passValidation<T>(value: T): Result<T, ValidationError> {
  return ok(value);
}
