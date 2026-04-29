/**
 * @file laplace.test.ts
 * @description Unit tests for the Laplace mechanism — validation, scale
 * computation, and statistical sanity of the noised output.
 */

import { describe, it, expect } from 'vitest';
import { applyLaplaceMechanism, computeLaplaceScale } from './laplace.js';

const ok = (e = 1.0, d = 0) => ({ params: { epsilon: e, delta: d }, sensitivity: 1 });

describe('computeLaplaceScale', () => {
  it('returns Δf / ε', () => {
    const r = computeLaplaceScale({ sensitivity: 2, params: { epsilon: 0.5, delta: 0 } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeCloseTo(4, 10);
  });

  it('rejects ε ≤ 0', () => {
    const r = computeLaplaceScale({ sensitivity: 1, params: { epsilon: 0, delta: 0 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_EPSILON');
  });

  it('rejects negative sensitivity', () => {
    const r = computeLaplaceScale({ sensitivity: -1, params: { epsilon: 1, delta: 0 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_SENSITIVITY');
  });

  it('rejects delta ≥ 1', () => {
    const r = computeLaplaceScale({ sensitivity: 1, params: { epsilon: 1, delta: 1 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_DELTA');
  });
});

describe('applyLaplaceMechanism', () => {
  it('rejects non-finite values', () => {
    expect(applyLaplaceMechanism(Number.NaN, ok()).success).toBe(false);
    expect(applyLaplaceMechanism(Number.POSITIVE_INFINITY, ok()).success).toBe(false);
  });

  it('returns the value unchanged when sensitivity is 0', () => {
    const r = applyLaplaceMechanism(42, { sensitivity: 0, params: { epsilon: 1, delta: 0 } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.value).toBe(42);
      expect(r.data.noise).toBe(0);
      expect(r.data.mechanism).toBe('laplace');
    }
  });

  it('produces noised output centred on the true value (mean over 2000 samples)', () => {
    const truth = 100;
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const r = applyLaplaceMechanism(truth, {
        sensitivity: 1,
        params: { epsilon: 1, delta: 0 },
      });
      if (r.success) sum += r.data.value;
    }
    const mean = sum / n;
    // Lap(0,1) has stddev √2 ≈ 1.41; mean of 2000 samples standard error ≈ 0.03.
    expect(Math.abs(mean - truth)).toBeLessThan(0.2);
  });

  it('noise scale grows as ε shrinks', () => {
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const r = applyLaplaceMechanism(0, {
        sensitivity: 1,
        params: { epsilon: 0.1, delta: 0 },
      });
      if (r.success) samples.push(r.data.noise);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance =
      samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    // For ε=0.1, scale = 10, Var = 2 · 100 = 200.
    expect(variance).toBeGreaterThan(140);
    expect(variance).toBeLessThan(260);
  });
});
