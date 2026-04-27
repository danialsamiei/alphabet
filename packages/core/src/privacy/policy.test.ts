/**
 * @file policy.test.ts
 * @description Unit tests for privacy policy helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  canStoreMemory,
  canPersonalize,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
  DEFAULT_K_ANONYMITY_THRESHOLD,
} from './policy.js';

const NO_SIG = { dntEnabled: false, gpcEnabled: false } as const;
const DNT = { dntEnabled: true, gpcEnabled: false } as const;
const GPC = { dntEnabled: false, gpcEnabled: true } as const;

describe('hasPrivacySignal', () => {
  it('returns false when neither DNT nor GPC is set', () => {
    expect(hasPrivacySignal(NO_SIG)).toBe(false);
  });
  it('returns true for DNT', () => {
    expect(hasPrivacySignal(DNT)).toBe(true);
  });
  it('returns true for GPC', () => {
    expect(hasPrivacySignal(GPC)).toBe(true);
  });
});

describe('canStoreMemory', () => {
  it('rejects NO_MEMORY tier', () => {
    expect(canStoreMemory('NO_MEMORY')).toBe(false);
  });
  it('allows ANONYMOUS, CONSENTED and ENRICHED tiers', () => {
    expect(canStoreMemory('ANONYMOUS')).toBe(true);
    expect(canStoreMemory('CONSENTED')).toBe(true);
    expect(canStoreMemory('ENRICHED')).toBe(true);
  });
});

describe('canPersonalize', () => {
  it('rejects all tiers when DNT or GPC is active', () => {
    expect(canPersonalize('ENRICHED', DNT)).toBe(false);
    expect(canPersonalize('ENRICHED', GPC)).toBe(false);
    expect(canPersonalize('CONSENTED', DNT)).toBe(false);
  });
  it('rejects below CONSENTED tier without DNT/GPC', () => {
    expect(canPersonalize('NO_MEMORY', NO_SIG)).toBe(false);
    expect(canPersonalize('ANONYMOUS', NO_SIG)).toBe(false);
  });
  it('allows CONSENTED and ENRICHED without DNT/GPC', () => {
    expect(canPersonalize('CONSENTED', NO_SIG)).toBe(true);
    expect(canPersonalize('ENRICHED', NO_SIG)).toBe(true);
  });
});

describe('canUseAnalytics', () => {
  it('rejects NO_MEMORY tier regardless of cohort size', () => {
    expect(canUseAnalytics('NO_MEMORY', 100)).toBe(false);
  });
  it('rejects when cohort size below k-anonymity threshold', () => {
    expect(canUseAnalytics('ANONYMOUS', DEFAULT_K_ANONYMITY_THRESHOLD - 1)).toBe(false);
  });
  it('allows when cohort size meets default threshold', () => {
    expect(canUseAnalytics('ANONYMOUS', DEFAULT_K_ANONYMITY_THRESHOLD)).toBe(true);
    expect(canUseAnalytics('CONSENTED', 50)).toBe(true);
  });
  it('respects custom threshold', () => {
    expect(canUseAnalytics('ANONYMOUS', 9, 10)).toBe(false);
    expect(canUseAnalytics('ANONYMOUS', 10, 10)).toBe(true);
  });
});

describe('canUsePreciseGeo', () => {
  it('rejects all tiers below ENRICHED', () => {
    expect(canUsePreciseGeo('NO_MEMORY')).toBe(false);
    expect(canUsePreciseGeo('ANONYMOUS')).toBe(false);
    expect(canUsePreciseGeo('CONSENTED')).toBe(false);
  });
  it('allows ENRICHED without DNT/GPC', () => {
    expect(canUsePreciseGeo('ENRICHED', NO_SIG)).toBe(true);
  });
  it('rejects ENRICHED when DNT or GPC is active', () => {
    expect(canUsePreciseGeo('ENRICHED', DNT)).toBe(false);
    expect(canUsePreciseGeo('ENRICHED', GPC)).toBe(false);
  });
});
