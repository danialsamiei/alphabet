/**
 * Tests for the dependency-free structural validator.
 */
import { describe, it, expect } from 'vitest';
import { v, type Infer } from './structural.js';
import {
  formatPath,
  describeRuntimeType,
  validateOrError,
  type ValidationError,
} from './validator.js';

describe('contracts/runtime — primitive validators', () => {
  it('v.string accepts strings', () => {
    expect(v.string().validate('hello')).toEqual({ success: true, data: 'hello' });
  });
  it('v.string rejects non-strings with structured error', () => {
    const r = v.string().validate(42);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.code).toBe('VALIDATION_ERROR');
      expect(r.error.details.expected).toBe('string');
      expect(r.error.details.received).toBe('number');
    }
  });
  it('v.number rejects NaN', () => {
    expect(v.number().validate(NaN).success).toBe(false);
  });
  it('v.boolean accepts true/false only', () => {
    expect(v.boolean().validate(false).success).toBe(true);
    expect(v.boolean().validate('false').success).toBe(false);
    expect(v.boolean().validate(0).success).toBe(false);
  });
  it('v.unknown accepts anything, including undefined', () => {
    expect(v.unknown().validate(undefined).success).toBe(true);
    expect(v.unknown().validate({ x: 1 }).success).toBe(true);
  });
});

describe('contracts/runtime — literal & enum validators', () => {
  it('v.literal narrows', () => {
    const validator = v.literal('grant');
    type T = Infer<typeof validator>;
    const tt: T = 'grant';
    expect(validator.validate(tt).success).toBe(true);
    expect(validator.validate('revoke').success).toBe(false);
  });
  it('v.enum accepts only listed values', () => {
    const tier = v.enum(['NO_MEMORY', 'ANONYMOUS', 'CONSENTED', 'ENRICHED'] as const);
    expect(tier.validate('CONSENTED').success).toBe(true);
    expect(tier.validate('PARTIAL').success).toBe(false);
    expect(tier.validate(0).success).toBe(false);
  });
});

describe('contracts/runtime — object validator', () => {
  const userSchema = v.object({
    id: v.string(),
    age: v.number(),
    nickname: v.optional(v.string()),
  });

  it('accepts a valid object', () => {
    const r = userSchema.validate({ id: 'u1', age: 30 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe('u1');
      expect(r.data.age).toBe(30);
    }
  });

  it('aggregates multiple field errors in one ValidationError', () => {
    const r = userSchema.validate({ id: 99, age: 'thirty' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.details.issues?.length).toBe(2);
      const paths = r.error.details.issues!.map((i) => i.path.join('.'));
      expect(paths).toContain('id');
      expect(paths).toContain('age');
    }
  });

  it('rejects null and arrays as objects', () => {
    expect(userSchema.validate(null).success).toBe(false);
    expect(userSchema.validate([]).success).toBe(false);
  });

  it('treats absent optional fields as success', () => {
    expect(userSchema.validate({ id: 'u1', age: 1 }).success).toBe(true);
  });

  it('strict() rejects extra keys', () => {
    const strict = v.object({ id: v.string() }).strict();
    expect(strict.validate({ id: 'a', extra: 1 }).success).toBe(false);
  });

  it('non-strict (default) ignores extra keys', () => {
    const lax = v.object({ id: v.string() });
    expect(lax.validate({ id: 'a', extra: 1 }).success).toBe(true);
  });
});

describe('contracts/runtime — array, record, union, optional', () => {
  it('v.array validates each element and reports the offending index', () => {
    const r = v.array(v.number()).validate([1, 2, 'three', 4]);
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.details.issues![0]!;
      expect(issue.path).toEqual([2]);
      expect(issue.expected).toBe('number');
    }
  });

  it('v.record validates dictionary values', () => {
    const cssVarsSchema = v.record(v.string());
    expect(cssVarsSchema.validate({ '--bg': '#fff', '--fg': '#000' }).success).toBe(true);
    expect(cssVarsSchema.validate({ '--bg': 1 }).success).toBe(false);
  });

  it('v.union returns the first matching variant', () => {
    const stringOrNumber = v.union<string | number>([v.string(), v.number()]);
    expect(stringOrNumber.validate('a').success).toBe(true);
    expect(stringOrNumber.validate(1).success).toBe(true);
    expect(stringOrNumber.validate(true).success).toBe(false);
  });

  it('v.optional + .nullable() coerces null to undefined', () => {
    const schema = v.optional(v.string()).nullable();
    expect(schema.validate(null)).toEqual({ success: true, data: undefined });
    expect(schema.validate(undefined)).toEqual({ success: true, data: undefined });
    expect(schema.validate('hi').success).toBe(true);
    expect(schema.validate(7).success).toBe(false);
  });
});

describe('contracts/runtime — error helpers', () => {
  it('formatPath formats JSON-path-like strings', () => {
    expect(formatPath([])).toBe('$');
    expect(formatPath(['a', 'b'])).toBe('$.a.b');
    expect(formatPath(['list', 0, 'name'])).toBe('$.list[0].name');
    expect(formatPath(['weird key'])).toBe('$["weird key"]');
  });

  it('describeRuntimeType distinguishes null and array', () => {
    expect(describeRuntimeType(null)).toBe('null');
    expect(describeRuntimeType([])).toBe('array');
    expect(describeRuntimeType('s')).toBe('string');
    expect(describeRuntimeType({})).toBe('object');
  });

  it('validateOrError mirrors validator.validate', () => {
    const r = validateOrError(v.string(), 1);
    expect(r.success).toBe(false);
    if (!r.success) {
      const e: ValidationError = r.error;
      expect(e.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('contracts/runtime — nested deep validation', () => {
  it('reports a nested path for object → array → object failures', () => {
    const schema = v.object({
      users: v.array(
        v.object({ id: v.string(), age: v.number() }),
      ),
    });
    const r = schema.validate({ users: [{ id: 'a', age: 1 }, { id: 'b', age: 'x' }] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.details.issues![0]!;
      expect(issue.path.slice(-2)).toEqual([1, 'age']);
      expect(issue.expected).toBe('number');
    }
  });
});
