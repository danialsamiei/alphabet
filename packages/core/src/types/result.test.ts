/**
 * @file result.test.ts
 * @description Unit tests for Result<T,E> pattern helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  mapResult,
  flatMapResult,
  getOrDefault,
  isOk,
  isErr,
  type AWAFError,
  type Result,
} from './result.js';

describe('ok()', () => {
  it('should return a successful Result', () => {
    const result = ok(42);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });

  it('should work with string data', () => {
    const result = ok('hello');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('should work with object data', () => {
    const data = { id: '1', name: 'test' };
    const result = ok(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(data);
    }
  });
});

describe('err()', () => {
  it('should return a failed Result', () => {
    const error: AWAFError = { code: 'TEST_ERROR', message: 'Test error' };
    const result = err(error);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toEqual(error);
    }
  });

  it('should include optional details', () => {
    const error: AWAFError = {
      code: 'TEST_ERROR',
      message: 'Test',
      details: { key: 'value' },
    };
    const result = err(error);
    if (!result.success) {
      expect(result.error.details).toEqual({ key: 'value' });
    }
  });
});

describe('mapResult()', () => {
  it('should transform data when Result is successful', () => {
    const result = ok(5);
    const mapped = mapResult(result, (n) => n * 2);
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data).toBe(10);
    }
  });

  it('should pass through error when Result is failed', () => {
    const error: AWAFError = { code: 'ERR', message: 'Error' };
    const result: Result<number> = err(error);
    const mapped = mapResult(result, (n) => n * 2);
    expect(mapped.success).toBe(false);
    if (!mapped.success) {
      expect(mapped.error).toEqual(error);
    }
  });
});

describe('flatMapResult()', () => {
  it('should chain successful Results', () => {
    const initial = ok(10);
    const chained = flatMapResult(initial, (n) => {
      if (n > 5) return ok(n.toString());
      return err({ code: 'TOO_SMALL', message: 'Too small' });
    });
    expect(chained.success).toBe(true);
    if (chained.success) {
      expect(chained.data).toBe('10');
    }
  });

  it('should short-circuit on failure', () => {
    const error: AWAFError = { code: 'ERR', message: 'Error' };
    const initial: Result<number> = err(error);
    const chained = flatMapResult(initial, (n) => ok(n * 2));
    expect(chained.success).toBe(false);
    if (!chained.success) {
      expect(chained.error).toEqual(error);
    }
  });

  it('should propagate error from chained function', () => {
    const initial = ok(3);
    const chained = flatMapResult(initial, (n) => {
      if (n < 5) return err({ code: 'TOO_SMALL', message: 'Too small' });
      return ok(n * 2);
    });
    expect(chained.success).toBe(false);
    if (!chained.success) {
      expect(chained.error.code).toBe('TOO_SMALL');
    }
  });
});

describe('getOrDefault()', () => {
  it('should return data on success', () => {
    const result = ok('real-value');
    expect(getOrDefault(result, 'default')).toBe('real-value');
  });

  it('should return default on failure', () => {
    const result: Result<string> = err({ code: 'ERR', message: 'Error' });
    expect(getOrDefault(result, 'default')).toBe('default');
  });
});

describe('isOk()', () => {
  it('should return true for successful Result', () => {
    expect(isOk(ok(1))).toBe(true);
  });

  it('should return false for failed Result', () => {
    expect(isOk(err({ code: 'E', message: 'e' }))).toBe(false);
  });
});

describe('isErr()', () => {
  it('should return true for failed Result', () => {
    expect(isErr(err({ code: 'E', message: 'e' }))).toBe(true);
  });

  it('should return false for successful Result', () => {
    expect(isErr(ok(1))).toBe(false);
  });
});
