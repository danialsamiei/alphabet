/**
 * @file k-anonymity.test.ts
 * @description Tests for the k-anonymity gate.
 */

import { describe, it, expect } from 'vitest';
import { kAnonymityGate } from './k-anonymity.js';

describe('kAnonymityGate', () => {
  it('passes when cohortSize ≥ default threshold (5)', () => {
    const r = kAnonymityGate(5);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cohortSize).toBe(5);
      expect(r.data.threshold).toBe(5);
    }
  });

  it('passes for large cohorts', () => {
    const r = kAnonymityGate(1_000);
    expect(r.success).toBe(true);
  });

  it('refuses when cohortSize < threshold', () => {
    const r = kAnonymityGate(3);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('K_ANONYMITY_VIOLATED');
  });

  it('respects custom threshold', () => {
    expect(kAnonymityGate(10, 20).success).toBe(false);
    expect(kAnonymityGate(20, 20).success).toBe(true);
  });

  it('rejects negative cohortSize', () => {
    const r = kAnonymityGate(-1);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_COHORT_SIZE');
  });

  it('rejects non-integer cohortSize', () => {
    const r = kAnonymityGate(3.5);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_COHORT_SIZE');
  });

  it('rejects threshold < 1', () => {
    const r = kAnonymityGate(10, 0);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_K_THRESHOLD');
  });

  it('rejects non-integer threshold', () => {
    const r = kAnonymityGate(10, 2.5);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_K_THRESHOLD');
  });
});
