/**
 * @file budget.test.ts
 * @description Tests for the sealed PrivacyBudgetLedger — invariants:
 *   - Successful spends are append-only and monotonic.
 *   - Failed spends do not modify the ledger.
 *   - The ledger refuses to exceed its cap on either ε or δ.
 *   - snapshot() and entries() return defensive copies.
 */

import { describe, it, expect } from 'vitest';
import { PrivacyBudgetLedger } from './budget.js';

const cfg = (epsilon: number, delta = 0, sensitivity = 1) => ({
  sensitivity,
  params: { epsilon, delta },
});

describe('PrivacyBudgetLedger — construction', () => {
  it('throws on negative epsilon cap', () => {
    expect(() => new PrivacyBudgetLedger({ cap: { epsilon: -1, delta: 0 } })).toThrow();
  });

  it('throws on delta ≥ 1', () => {
    expect(() => new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 1 } })).toThrow();
  });

  it('accepts a valid cap', () => {
    expect(() => new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 1e-6 } })).not.toThrow();
  });

  it('initial snapshot has zero spend and full remaining', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 1e-6 } });
    const s = l.snapshot();
    expect(s.spent.epsilon).toBe(0);
    expect(s.spent.delta).toBe(0);
    expect(s.remaining.epsilon).toBe(1);
    expect(s.remaining.delta).toBe(1e-6);
    expect(s.entries).toHaveLength(0);
    expect(s.exhausted).toBe(false);
  });
});

describe('PrivacyBudgetLedger — spend()', () => {
  it('records a successful spend and updates totals', () => {
    const l = new PrivacyBudgetLedger({
      cap: { epsilon: 1, delta: 1e-6 },
      now: () => 1700000000000,
    });
    const r = l.spend('q1', 'laplace', cfg(0.3));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.spent.epsilon).toBeCloseTo(0.3, 12);
      expect(r.data.entries).toHaveLength(1);
      expect(r.data.entries[0]?.timestampMs).toBe(1700000000000);
    }
  });

  it('refuses to exceed epsilon cap and does not record entry', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 0.5, delta: 0 } });
    const ok = l.spend('q1', 'laplace', cfg(0.4));
    expect(ok.success).toBe(true);
    const fail = l.spend('q2', 'laplace', cfg(0.2));
    expect(fail.success).toBe(false);
    if (!fail.success) expect(fail.error.code).toBe('BUDGET_EXHAUSTED');
    const s = l.snapshot();
    expect(s.entries).toHaveLength(1);
    expect(s.spent.epsilon).toBeCloseTo(0.4, 12);
  });

  it('refuses to exceed delta cap', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 10, delta: 1e-6 } });
    const fail = l.spend('q1', 'gaussian', cfg(0.1, 2e-6));
    expect(fail.success).toBe(false);
    if (!fail.success) expect(fail.error.code).toBe('BUDGET_EXHAUSTED');
  });

  it('allows successive spends to exactly meet the cap (within ULP)', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    expect(l.spend('a', 'laplace', cfg(0.5)).success).toBe(true);
    expect(l.spend('b', 'laplace', cfg(0.5)).success).toBe(true);
    expect(l.snapshot().exhausted).toBe(true);
  });

  it('rejects empty query label', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    const r = l.spend('', 'laplace', cfg(0.1));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_QUERY_LABEL');
  });

  it('rejects overlong query label (PII guard)', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    const r = l.spend('x'.repeat(257), 'laplace', cfg(0.1));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_QUERY_LABEL');
  });

  it('rejects unknown mechanism', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    const r = l.spend('q', 'exponential' as 'laplace', cfg(0.1));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('UNKNOWN_MECHANISM');
  });

  it('rejects negative epsilon spend', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    const r = l.spend('q', 'laplace', cfg(-0.1));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_EPSILON');
  });

  it('rejects negative sensitivity', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    const r = l.spend('q', 'laplace', cfg(0.1, 0, -1));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_SENSITIVITY');
  });

  it('failed spends are atomic (no totals or entries change)', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 0.5, delta: 0 } });
    l.spend('a', 'laplace', cfg(0.4));
    const before = l.snapshot();
    l.spend('b', 'laplace', cfg(0.5));
    const after = l.snapshot();
    expect(after.spent).toEqual(before.spent);
    expect(after.entries).toHaveLength(before.entries.length);
  });
});

describe('PrivacyBudgetLedger — canSpend()', () => {
  it('returns true when spend would fit', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 1e-6 } });
    expect(l.canSpend({ epsilon: 0.5, delta: 1e-7 })).toBe(true);
  });

  it('returns false when spend would exceed cap', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    expect(l.canSpend({ epsilon: 1.5, delta: 0 })).toBe(false);
  });

  it('returns false for invalid params', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    expect(l.canSpend({ epsilon: -1, delta: 0 })).toBe(false);
    expect(l.canSpend({ epsilon: 0, delta: 1 })).toBe(false);
  });
});

describe('PrivacyBudgetLedger — defensive copies', () => {
  it('mutating the entries array returned by snapshot() does not affect ledger', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    l.spend('a', 'laplace', cfg(0.1));
    const s = l.snapshot();
    expect(() => (s.entries as unknown as unknown[]).push({} as never)).toThrow();
    expect(l.entries()).toHaveLength(1);
  });

  it('entries() returns a frozen copy', () => {
    const l = new PrivacyBudgetLedger({ cap: { epsilon: 1, delta: 0 } });
    l.spend('a', 'laplace', cfg(0.1));
    const e = l.entries();
    expect(Object.isFrozen(e)).toBe(true);
  });
});
