/**
 * @file random.test.ts
 * @description Tests for cryptographic random samplers — basic statistical
 * sanity, validation, and graceful failure when Web Crypto is unavailable.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sampleUniformUnitInterval,
  sampleStandardNormal,
  sampleLaplace,
} from './random.js';

describe('sampleUniformUnitInterval', () => {
  it('returns a number in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const r = sampleUniformUnitInterval();
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).toBeGreaterThanOrEqual(0);
        expect(r.data).toBeLessThan(1);
      }
    }
  });

  it('mean of many samples is close to 0.5', () => {
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const r = sampleUniformUnitInterval();
      if (r.success) sum += r.data;
    }
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('returns RANDOM_SOURCE_UNAVAILABLE when Web Crypto is missing', () => {
    const original = (globalThis as { crypto?: unknown }).crypto;
    // @ts-expect-error — deliberately removing for test
    delete (globalThis as { crypto?: unknown }).crypto;
    try {
      const r = sampleUniformUnitInterval();
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe('RANDOM_SOURCE_UNAVAILABLE');
    } finally {
      (globalThis as { crypto?: unknown }).crypto = original;
    }
  });
});

describe('sampleStandardNormal', () => {
  it('returns finite numbers', () => {
    for (let i = 0; i < 1000; i++) {
      const r = sampleStandardNormal();
      expect(r.success).toBe(true);
      if (r.success) expect(Number.isFinite(r.data)).toBe(true);
    }
  });

  it('mean ≈ 0 and stddev ≈ 1 over 5000 samples', () => {
    const n = 5000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const r = sampleStandardNormal();
      if (r.success) {
        sum += r.data;
        sumSq += r.data * r.data;
      }
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const stddev = Math.sqrt(variance);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(stddev).toBeGreaterThan(0.9);
    expect(stddev).toBeLessThan(1.1);
  });
});

describe('sampleLaplace', () => {
  it('rejects non-positive scale', () => {
    expect(sampleLaplace(0).success).toBe(false);
    expect(sampleLaplace(-1).success).toBe(false);
    expect(sampleLaplace(Number.NaN).success).toBe(false);
    expect(sampleLaplace(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it('mean ≈ 0 over 5000 samples with scale = 1', () => {
    const n = 5000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const r = sampleLaplace(1);
      if (r.success) sum += r.data;
    }
    const mean = sum / n;
    // Laplace(0, 1) has stddev √2; mean of 5000 samples standard error ≈ 0.02.
    expect(Math.abs(mean)).toBeLessThan(0.15);
  });

  it('variance ≈ 2·b² (Laplace property) for scale = 1', () => {
    const n = 5000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const r = sampleLaplace(1);
      if (r.success) {
        sum += r.data;
        sumSq += r.data * r.data;
      }
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // Var(Laplace(0,1)) = 2.
    expect(variance).toBeGreaterThan(1.5);
    expect(variance).toBeLessThan(2.5);
  });

  it('uses Web Crypto, never falling back to Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    sampleLaplace(1);
    sampleStandardNormal();
    sampleUniformUnitInterval();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
