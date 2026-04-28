/**
 * Tests for idempotency-key generation and header injection.
 */
import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  isUnsafeMethod,
  withIdempotencyKey,
} from '../../src/transport/idempotency.js';

describe('transport/idempotency', () => {
  it('generateIdempotencyKey returns a valid awaf_-prefixed key', () => {
    const k = generateIdempotencyKey();
    expect(k).toMatch(/^awaf_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('generates collision-resistant keys (no duplicates in 1000 calls)', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) keys.add(generateIdempotencyKey());
    expect(keys.size).toBe(1000);
  });

  it('isUnsafeMethod treats POST/PUT/PATCH/DELETE as unsafe', () => {
    expect(isUnsafeMethod('POST')).toBe(true);
    expect(isUnsafeMethod('put')).toBe(true);
    expect(isUnsafeMethod('PATCH')).toBe(true);
    expect(isUnsafeMethod('Delete')).toBe(true);
  });

  it('isUnsafeMethod treats GET/HEAD/OPTIONS as safe', () => {
    expect(isUnsafeMethod('GET')).toBe(false);
    expect(isUnsafeMethod('HEAD')).toBe(false);
    expect(isUnsafeMethod('OPTIONS')).toBe(false);
    expect(isUnsafeMethod(undefined)).toBe(false);
  });

  it('withIdempotencyKey injects a key for unsafe verbs', () => {
    const headers = withIdempotencyKey({ 'Content-Type': 'application/json' }, 'POST');
    expect(headers.get('Idempotency-Key')).toMatch(/^awaf_/);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('withIdempotencyKey does NOT inject a key for safe verbs', () => {
    const headers = withIdempotencyKey({}, 'GET');
    expect(headers.has('Idempotency-Key')).toBe(false);
  });

  it('withIdempotencyKey preserves a caller-supplied Idempotency-Key', () => {
    const headers = withIdempotencyKey(
      { 'Idempotency-Key': 'caller-supplied' },
      'POST',
    );
    expect(headers.get('Idempotency-Key')).toBe('caller-supplied');
  });

  it('uses the override factory when provided', () => {
    const headers = withIdempotencyKey({}, 'POST', () => 'fixed-test-key');
    expect(headers.get('Idempotency-Key')).toBe('fixed-test-key');
  });
});
