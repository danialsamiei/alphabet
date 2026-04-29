/**
 * @file schema.test.ts
 * @description Tests for `Schema<A>` adapter and combinators.
 */

import { describe, it, expect } from 'vitest';
import { s, fromValidator, refine, transform } from './schema.js';
import { runEffect } from './effect.js';
import { v } from '../contracts/runtime/structural.js';

describe('Schema / primitive parsers', () => {
  it('s.string() accepts strings', () => {
    const r = s.string().parse('hi');
    expect(r.success).toBe(true);
  });

  it('s.string() rejects non-strings with ValidationError', () => {
    const r = s.string().parse(42);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('s.number() rejects NaN', () => {
    const r = s.number().parse(Number.NaN);
    expect(r.success).toBe(false);
  });

  it('s.literal accepts only the literal', () => {
    const lit = s.literal('hello' as const);
    expect(lit.parse('hello').success).toBe(true);
    expect(lit.parse('world').success).toBe(false);
  });

  it('s.enum accepts members only', () => {
    const e = s.enum(['a', 'b', 'c'] as const);
    expect(e.parse('b').success).toBe(true);
    expect(e.parse('z').success).toBe(false);
  });

  it('s.array validates each element', () => {
    const a = s.array(s.number());
    expect(a.parse([1, 2, 3]).success).toBe(true);
    const bad = a.parse([1, 'x', 3]);
    expect(bad.success).toBe(false);
  });

  it('s.optional allows undefined', () => {
    const o = s.optional(s.string());
    expect(o.parse(undefined).success).toBe(true);
    expect(o.parse('hi').success).toBe(true);
    expect(o.parse(123).success).toBe(false);
  });

  it('s.object validates a fixed shape', () => {
    const sch = s.object({ name: s.string(), age: s.number() });
    const r = sch.parse({ name: 'A', age: 30 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe('A');
      expect(r.data.age).toBe(30);
    }
  });
});

describe('Schema / Effect bridge', () => {
  it('decode succeeds as Effect.Success', async () => {
    const exit = await runEffect(s.number().decode(7), undefined);
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value).toBe(7);
  });

  it('decode fails as Effect.Fail with ValidationError', async () => {
    const exit = await runEffect(s.number().decode('nope'), undefined);
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure' && exit.cause._tag === 'Fail') {
      expect(exit.cause.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('Schema / fromValidator + refine + transform', () => {
  it('fromValidator wraps an existing validator', () => {
    const sch = fromValidator(v.string());
    expect(sch.parse('ok').success).toBe(true);
    expect(sch.parse(1).success).toBe(false);
  });

  it('refine adds a guard', () => {
    const positive = refine(s.number(), (n) => n > 0, 'positive number');
    expect(positive.parse(5).success).toBe(true);
    expect(positive.parse(-1).success).toBe(false);
  });

  it('transform decodes downstream', () => {
    const stringToNum = transform(s.string(), (str) => {
      const n = Number(str);
      return Number.isNaN(n) ? { success: false, error: 'not a number' } : { success: true, data: n };
    });
    const ok = stringToNum.parse('42');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe(42);
    expect(stringToNum.parse('xyz').success).toBe(false);
  });
});
