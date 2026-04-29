/**
 * @file gaussian.test.ts
 * @description Unit tests for the Gaussian (ε,δ)-DP mechanism.
 */

import { describe, it, expect } from 'vitest';
import { applyGaussianMechanism, computeGaussianStdDev } from './gaussian.js';

describe('computeGaussianStdDev', () => {
  it('returns the closed-form σ', () => {
    const cfg = { sensitivity: 1, params: { epsilon: 0.5, delta: 1e-6 } };
    const r = computeGaussianStdDev(cfg);
    expect(r.success).toBe(true);
    if (r.success) {
      const expected = (1 * Math.sqrt(2 * Math.log(1.25 / 1e-6))) / 0.5;
      expect(r.data).toBeCloseTo(expected, 10);
    }
  });

  it('returns 0 when sensitivity is 0', () => {
    const r = computeGaussianStdDev({
      sensitivity: 0,
      params: { epsilon: 0.5, delta: 1e-6 },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(0);
  });

  it('rejects ε > 1 (out of tight range)', () => {
    const r = computeGaussianStdDev({
      sensitivity: 1,
      params: { epsilon: 1.5, delta: 1e-6 },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('EPSILON_OUT_OF_RANGE');
  });

  it('rejects δ = 0 (Gaussian needs δ > 0)', () => {
    const r = computeGaussianStdDev({ sensitivity: 1, params: { epsilon: 0.5, delta: 0 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_DELTA');
  });

  it('rejects ε ≤ 0', () => {
    const r = computeGaussianStdDev({ sensitivity: 1, params: { epsilon: 0, delta: 1e-6 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_EPSILON');
  });

  it('rejects negative sensitivity', () => {
    const r = computeGaussianStdDev({ sensitivity: -1, params: { epsilon: 0.5, delta: 1e-6 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_SENSITIVITY');
  });
});

describe('applyGaussianMechanism', () => {
  it('rejects non-finite values', () => {
    const cfg = { sensitivity: 1, params: { epsilon: 0.5, delta: 1e-6 } };
    expect(applyGaussianMechanism(Number.NaN, cfg).success).toBe(false);
  });

  it('returns the value unchanged when sensitivity is 0', () => {
    const r = applyGaussianMechanism(7, { sensitivity: 0, params: { epsilon: 0.5, delta: 1e-6 } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.value).toBe(7);
      expect(r.data.noise).toBe(0);
      expect(r.data.mechanism).toBe('gaussian');
    }
  });

  it('produces noised output centred on truth (mean over 2000 samples)', () => {
    const truth = 50;
    const cfg = { sensitivity: 1, params: { epsilon: 0.5, delta: 1e-6 } };
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const r = applyGaussianMechanism(truth, cfg);
      if (r.success) sum += r.data.value;
    }
    const mean = sum / n;
    // σ ≈ 9.96; mean of 2000 samples standard error ≈ σ / √n ≈ 0.22.
    expect(Math.abs(mean - truth)).toBeLessThan(2);
  });

  it('empirical stddev matches the closed-form σ', () => {
    const cfg = { sensitivity: 1, params: { epsilon: 0.5, delta: 1e-6 } };
    const sigmaRes = computeGaussianStdDev(cfg);
    expect(sigmaRes.success).toBe(true);
    if (!sigmaRes.success) return;
    const sigma = sigmaRes.data;

    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = applyGaussianMechanism(0, cfg);
      if (r.success) samples.push(r.data.noise);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const empSigma = Math.sqrt(
      samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length,
    );
    // ±15 % is generous for 2000 samples.
    expect(empSigma).toBeGreaterThan(sigma * 0.85);
    expect(empSigma).toBeLessThan(sigma * 1.15);
  });
});
