/**
 * @module effect/schema
 * @description
 * `Schema<A>` — declarative, composable runtime validators for Effect
 * pipelines. This is a thin, opt-in adapter on top of the existing
 * `contracts/runtime/structural` validators, so we never fork validation
 * truth: the same `Validator<A>` powers both API-boundary checks and
 * Effect-side validation. Difference is ergonomics and integration:
 *
 *   - `Schema<A>` exposes `parse(input): Result<A, ValidationError>` and
 *     `decode(input): Effect<unknown, ValidationError, A>`, so a schema
 *     drops directly into a `flatMap` chain.
 *   - `transform(s, f)` lifts a synchronous decode into the schema layer.
 *   - `refine(s, predicate, message)` adds a guard with a typed message.
 *
 * This is **not** a re-implementation of `@effect/schema`; it is a
 * small, dependency-free bridge between Alphabet's existing Validator and
 * the Effect runtime. Roughly 80 LOC.
 */

import { type Result, ok, err } from '../types/result.js';
import {
  type Validator,
  type ValidationError,
  failValidation,
} from '../contracts/runtime/validator.js';
import { v as structural } from '../contracts/runtime/structural.js';
import { type Effect, fail as effectFail, succeed } from './effect.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A schema is just a Validator with an Effect-friendly façade. */
export interface Schema<A> {
  readonly validator: Validator<A>;
  parse(input: unknown): Result<A, ValidationError>;
  decode(input: unknown): Effect<unknown, ValidationError, A>;
}

// ─── Wrap a Validator ────────────────────────────────────────────────────────

/**
 * Wrap any `Validator<A>` (typically built with `v.string()`/`v.object(...)`)
 * into a `Schema<A>`.
 */
export function fromValidator<A>(validator: Validator<A>): Schema<A> {
  return {
    validator,
    parse(input): Result<A, ValidationError> {
      return validator.validate(input);
    },
    decode(input): Effect<unknown, ValidationError, A> {
      const r = validator.validate(input);
      return r.success ? succeed<A>(r.data) : effectFail<ValidationError>(r.error);
    },
  };
}

// ─── Sugar — re-export the structural builders as `s` ────────────────────────

/**
 * `s.string()`, `s.number()`, `s.object({...})` etc. — same combinators
 * as `v.*` from `contracts/runtime`, but each builder returns a
 * `Schema<A>` instead of a `Validator<A>`.
 *
 * Subset is intentional — only the operations used by Effect pipelines
 * today are surfaced. Add more as consumers need them.
 */
export const s = {
  string: (): Schema<string> => fromValidator(structural.string()),
  number: (): Schema<number> => fromValidator(structural.number()),
  boolean: (): Schema<boolean> => fromValidator(structural.boolean()),
  literal: <L extends string | number | boolean | null>(value: L): Schema<L> =>
    fromValidator(structural.literal(value)),
  enum: <E extends string>(values: readonly E[]): Schema<E> =>
    fromValidator(structural.enum(values)),
  array: <A>(item: Schema<A>): Schema<readonly A[]> =>
    fromValidator(structural.array(item.validator)),
  object: <O extends Record<string, Schema<unknown>>>(
    fields: O,
  ): Schema<{ readonly [K in keyof O]: O[K] extends Schema<infer A> ? A : never }> => {
    const validators: Record<string, Validator<unknown>> = {};
    for (const k of Object.keys(fields)) {
      const f = fields[k] as Schema<unknown>;
      validators[k] = f.validator;
    }
    return fromValidator(
      structural.object(validators) as unknown as Validator<{
        readonly [K in keyof O]: O[K] extends Schema<infer A> ? A : never;
      }>,
    );
  },
  optional: <A>(inner: Schema<A>): Schema<A | undefined> =>
    fromValidator(structural.optional(inner.validator)),
} as const;

// ─── Refinement & transform ──────────────────────────────────────────────────

/** Add a runtime predicate guard on top of an existing schema. */
export function refine<A>(
  base: Schema<A>,
  predicate: (a: A) => boolean,
  expected: string,
): Schema<A> {
  return fromValidator({
    kind: `${base.validator.kind}.refined`,
    validate: (input): Result<A, ValidationError> => {
      const r = base.validator.validate(input);
      if (!r.success) return r;
      if (predicate(r.data)) return ok(r.data);
      return failValidation<A>([], expected, input);
    },
  });
}

/**
 * Transform a successfully-decoded `A` into a `B` via a synchronous
 * function. `f` may itself fail by returning a `Result<B, string>` —
 * the failing message becomes the `expected` field of the issue.
 */
export function transform<A, B>(
  base: Schema<A>,
  f: (a: A) => Result<B, string>,
): Schema<B> {
  return fromValidator({
    kind: `${base.validator.kind}.transform`,
    validate: (input): Result<B, ValidationError> => {
      const r = base.validator.validate(input);
      if (!r.success) return r;
      const t = f(r.data);
      if (t.success) return ok(t.data);
      return failValidation<B>([], t.error, input);
    },
  });
}

// silence unused-var when callers rely on type re-exports
void err;
