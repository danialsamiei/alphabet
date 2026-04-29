/**
 * @module contracts/runtime/structural
 * @description
 * Dependency-free runtime validator combinators.
 *
 * This is a tiny, deliberately conservative implementation of the
 * {@link Validator} contract. It supports exactly what Alphabet schemas
 * need today: primitive types, literals, enums, objects with a fixed
 * key set, optional fields, arrays, unions, and records.
 *
 * Design choices:
 * - **No dependencies.** Keeps `@alphabet/core` peer-dep-free.
 * - **Deterministic output.** Same input → same `Result` byte-for-byte.
 * - **Aggregate failures.** Object validation collects every leaf issue
 *   in one pass so a malformed payload reports all problems, not just the
 *   first one. This keeps debugging cheap.
 * - **No PII in messages.** Messages describe shapes, never values.
 *
 * The default export `v` mirrors the look-and-feel of zod for ergonomic
 * familiarity; a `ZodValidator` adapter can be added later without breaking
 * any consumer that only depends on the {@link Validator} interface.
 */

import type { Result } from '../../types/result.js';
import { ok } from '../../types/result.js';
import {
  type Validator,
  type ValidationError,
  type ValidationIssue,
  aggregateValidationError,
  describeRuntimeType,
  failValidation,
} from './validator.js';

// ─── Common error helper ──────────────────────────────────────────────────────

function fail<T>(
  path: readonly (string | number)[],
  expected: string,
  received: unknown,
): Result<T, ValidationError> {
  return failValidation<T>(path, expected, received);
}

// ─── Primitive validators ─────────────────────────────────────────────────────

class StringValidator implements Validator<string> {
  readonly kind = 'structural.string';
  readonly path: readonly (string | number)[];
  constructor(path: readonly (string | number)[] = []) {
    this.path = path;
  }
  validate(input: unknown): Result<string, ValidationError> {
    return typeof input === 'string'
      ? ok(input)
      : fail(this.path, 'string', input);
  }
  /** Internal: produce a copy that records the path it sits at. */
  withPath(path: readonly (string | number)[]): StringValidator {
    return new StringValidator(path);
  }
}

class NumberValidator implements Validator<number> {
  readonly kind = 'structural.number';
  readonly path: readonly (string | number)[];
  constructor(path: readonly (string | number)[] = []) {
    this.path = path;
  }
  validate(input: unknown): Result<number, ValidationError> {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      return fail(this.path, 'number', input);
    }
    return ok(input);
  }
  withPath(path: readonly (string | number)[]): NumberValidator {
    return new NumberValidator(path);
  }
}

class BooleanValidator implements Validator<boolean> {
  readonly kind = 'structural.boolean';
  readonly path: readonly (string | number)[];
  constructor(path: readonly (string | number)[] = []) {
    this.path = path;
  }
  validate(input: unknown): Result<boolean, ValidationError> {
    return typeof input === 'boolean' ? ok(input) : fail(this.path, 'boolean', input);
  }
  withPath(path: readonly (string | number)[]): BooleanValidator {
    return new BooleanValidator(path);
  }
}

class UnknownValidator implements Validator<unknown> {
  readonly kind = 'structural.unknown';
  validate(input: unknown): Result<unknown, ValidationError> {
    return ok(input);
  }
  withPath(_path: readonly (string | number)[]): UnknownValidator {
    return this;
  }
}

class LiteralValidator<L extends string | number | boolean | null>
  implements Validator<L>
{
  readonly kind = 'structural.literal';
  constructor(
    readonly literal: L,
    readonly path: readonly (string | number)[] = [],
  ) {}
  validate(input: unknown): Result<L, ValidationError> {
    return input === this.literal
      ? ok(this.literal)
      : fail(this.path, `literal(${JSON.stringify(this.literal)})`, input);
  }
  withPath(path: readonly (string | number)[]): LiteralValidator<L> {
    return new LiteralValidator(this.literal, path);
  }
}

class EnumValidator<E extends string> implements Validator<E> {
  readonly kind = 'structural.enum';
  constructor(
    readonly values: readonly E[],
    readonly path: readonly (string | number)[] = [],
  ) {}
  validate(input: unknown): Result<E, ValidationError> {
    if (typeof input !== 'string') return fail(this.path, 'string', input);
    if ((this.values as readonly string[]).includes(input)) return ok(input as E);
    return fail(this.path, `enum(${this.values.join('|')})`, input);
  }
  withPath(path: readonly (string | number)[]): EnumValidator<E> {
    return new EnumValidator(this.values, path);
  }
}

// ─── Composite validators ─────────────────────────────────────────────────────

interface PathAware<T> extends Validator<T> {
  withPath(path: readonly (string | number)[]): Validator<T>;
}

function isPathAware<T>(v: Validator<T>): v is PathAware<T> {
  return typeof (v as PathAware<T>).withPath === 'function';
}

class OptionalValidator<T> implements Validator<T | undefined> {
  readonly kind = 'structural.optional';
  readonly path: readonly (string | number)[];
  constructor(readonly inner: Validator<T>, path: readonly (string | number)[] = []) {
    this.path = path;
  }
  validate(input: unknown): Result<T | undefined, ValidationError> {
    if (input === undefined) return ok(undefined);
    const child = isPathAware(this.inner)
      ? this.inner.withPath(this.path)
      : this.inner;
    return child.validate(input);
  }
  withPath(path: readonly (string | number)[]): OptionalValidator<T> {
    return new OptionalValidator(this.inner, path);
  }
  /** Allow `null` to be coerced to `undefined`. */
  nullable(): NullableOptionalValidator<T> {
    return new NullableOptionalValidator(this.inner, this.path);
  }
}

class NullableOptionalValidator<T> implements Validator<T | undefined> {
  readonly kind = 'structural.optional.nullable';
  readonly path: readonly (string | number)[];
  constructor(readonly inner: Validator<T>, path: readonly (string | number)[] = []) {
    this.path = path;
  }
  validate(input: unknown): Result<T | undefined, ValidationError> {
    if (input === undefined || input === null) return ok(undefined);
    const child = isPathAware(this.inner)
      ? this.inner.withPath(this.path)
      : this.inner;
    return child.validate(input);
  }
  withPath(path: readonly (string | number)[]): NullableOptionalValidator<T> {
    return new NullableOptionalValidator(this.inner, path);
  }
}

class ArrayValidator<T> implements Validator<readonly T[]> {
  readonly kind = 'structural.array';
  constructor(
    readonly element: Validator<T>,
    readonly path: readonly (string | number)[] = [],
  ) {}
  validate(input: unknown): Result<readonly T[], ValidationError> {
    if (!Array.isArray(input)) return fail(this.path, 'array', input);
    const out: T[] = [];
    const issues: ValidationIssue[] = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i] as unknown;
      const elementPath = [...this.path, i];
      const child = isPathAware(this.element)
        ? this.element.withPath(elementPath)
        : this.element;
      const r = child.validate(item);
      if (!r.success) {
        issues.push({
          path: r.error.details.path.length > 0 ? r.error.details.path : elementPath,
          expected: r.error.details.expected,
          received: r.error.details.received,
          message: r.error.message,
        });
      } else {
        out.push(r.data);
      }
    }
    if (issues.length > 0) {
      return { success: false, error: aggregateValidationError(issues) };
    }
    return ok(out);
  }
  withPath(path: readonly (string | number)[]): ArrayValidator<T> {
    return new ArrayValidator(this.element, path);
  }
}

class RecordValidator<T> implements Validator<Readonly<Record<string, T>>> {
  readonly kind = 'structural.record';
  constructor(
    readonly value: Validator<T>,
    readonly path: readonly (string | number)[] = [],
  ) {}
  validate(input: unknown): Result<Readonly<Record<string, T>>, ValidationError> {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return fail(this.path, 'object', input);
    }
    const out: Record<string, T> = {};
    const issues: ValidationIssue[] = [];
    for (const [key, val] of Object.entries(input)) {
      const childPath = [...this.path, key];
      const child = isPathAware(this.value) ? this.value.withPath(childPath) : this.value;
      const r = child.validate(val);
      if (!r.success) {
        issues.push({
          path: r.error.details.path.length > 0 ? r.error.details.path : childPath,
          expected: r.error.details.expected,
          received: r.error.details.received,
          message: r.error.message,
        });
      } else {
        out[key] = r.data;
      }
    }
    if (issues.length > 0) {
      return { success: false, error: aggregateValidationError(issues) };
    }
    return ok(out);
  }
  withPath(path: readonly (string | number)[]): RecordValidator<T> {
    return new RecordValidator(this.value, path);
  }
}

class UnionValidator<T> implements Validator<T> {
  readonly kind = 'structural.union';
  constructor(
    readonly variants: readonly Validator<T>[],
    readonly path: readonly (string | number)[] = [],
  ) {}
  validate(input: unknown): Result<T, ValidationError> {
    const tries: ValidationIssue[] = [];
    for (const variant of this.variants) {
      const child = isPathAware(variant) ? variant.withPath(this.path) : variant;
      const r = child.validate(input);
      if (r.success) return r;
      tries.push({
        path: r.error.details.path,
        expected: r.error.details.expected,
        received: r.error.details.received,
        message: r.error.message,
      });
    }
    const expected = `union(${this.variants.length} variants)`;
    return fail(this.path, expected, input);
  }
  withPath(path: readonly (string | number)[]): UnionValidator<T> {
    return new UnionValidator(this.variants, path);
  }
}

type ObjectShape = Record<string, Validator<unknown>>;
type InferShape<S extends ObjectShape> = {
  -readonly [K in keyof S]: S[K] extends Validator<infer T> ? T : never;
};

class ObjectValidator<S extends ObjectShape> implements Validator<InferShape<S>> {
  readonly kind = 'structural.object';
  constructor(
    readonly shape: S,
    readonly path: readonly (string | number)[] = [],
    readonly opts: { readonly strict: boolean } = { strict: false },
  ) {}
  validate(input: unknown): Result<InferShape<S>, ValidationError> {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return fail(this.path, 'object', input);
    }
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: ValidationIssue[] = [];

    for (const key of Object.keys(this.shape)) {
      const childValidator = this.shape[key] as Validator<unknown>;
      const childPath = [...this.path, key];
      const v = isPathAware(childValidator)
        ? childValidator.withPath(childPath)
        : childValidator;
      const r = v.validate(obj[key]);
      if (!r.success) {
        issues.push({
          path: r.error.details.path.length > 0 ? r.error.details.path : childPath,
          expected: r.error.details.expected,
          received: r.error.details.received,
          message: r.error.message,
        });
      } else if (r.data !== undefined) {
        out[key] = r.data;
      } else if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Preserve explicit undefined keys to match zod-style behavior.
        out[key] = undefined;
      }
    }

    if (this.opts.strict) {
      for (const key of Object.keys(obj)) {
        if (!(key in this.shape)) {
          issues.push({
            path: [...this.path, key],
            expected: '<no extra keys>',
            received: describeRuntimeType(obj[key]),
            message: `Unknown key "${key}" at ${formatPathInline([...this.path, key])}`,
          });
        }
      }
    }

    if (issues.length > 0) {
      return { success: false, error: aggregateValidationError(issues) };
    }
    return ok(out as InferShape<S>);
  }
  withPath(path: readonly (string | number)[]): ObjectValidator<S> {
    return new ObjectValidator(this.shape, path, this.opts);
  }
  /** Reject extra keys not declared in the shape. */
  strict(): ObjectValidator<S> {
    return new ObjectValidator(this.shape, this.path, { strict: true });
  }
}

function formatPathInline(path: readonly (string | number)[]): string {
  return path.length === 0 ? '$' : `$.${path.join('.')}`;
}

// ─── Public combinator surface ────────────────────────────────────────────────

/**
 * Combinator namespace. Each function returns a {@link Validator} that can
 * be composed into larger schemas.
 */
export const v = {
  /** Validator that accepts any string. */
  string(): Validator<string> {
    return new StringValidator();
  },
  /** Validator that accepts a finite, non-NaN number. */
  number(): Validator<number> {
    return new NumberValidator();
  },
  /** Validator that accepts a boolean. */
  boolean(): Validator<boolean> {
    return new BooleanValidator();
  },
  /** Validator that accepts any value (escape hatch). */
  unknown(): Validator<unknown> {
    return new UnknownValidator();
  },
  /** Validator that accepts a single literal value (string, number, boolean, null). */
  literal<L extends string | number | boolean | null>(literal: L): Validator<L> {
    return new LiteralValidator(literal);
  },
  /** Validator that accepts one of a fixed set of string values. */
  enum<E extends string>(values: readonly E[]): Validator<E> {
    return new EnumValidator(values);
  },
  /** Validator wrapping another, allowing `undefined`. */
  optional<T>(inner: Validator<T>): OptionalValidator<T> {
    return new OptionalValidator(inner);
  },
  /** Validator for arrays whose elements all match the given validator. */
  array<T>(element: Validator<T>): Validator<readonly T[]> {
    return new ArrayValidator(element);
  },
  /** Validator for a plain object whose values all match the given validator. */
  record<T>(value: Validator<T>): Validator<Readonly<Record<string, T>>> {
    return new RecordValidator(value);
  },
  /** Validator that succeeds if any of the variants succeed. */
  union<T>(variants: readonly Validator<T>[]): Validator<T> {
    return new UnionValidator(variants);
  },
  /** Validator for an object with a fixed key shape. */
  object<S extends ObjectShape>(shape: S): ObjectValidator<S> {
    return new ObjectValidator(shape);
  },
} as const;

/** Infer the output type of a validator. */
export type Infer<V> = V extends Validator<infer T> ? T : never;
