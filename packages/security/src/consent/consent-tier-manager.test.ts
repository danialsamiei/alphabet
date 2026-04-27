/**
 * @file consent-tier-manager.test.ts
 * @description Unit tests for ConsentTierManager — state machine, monotonic
 * upgrade rule, DNT/GPC downgrade, and policy version invalidation.
 */

import { describe, it, expect } from 'vitest';
import { ConsentTierManager } from './consent-tier-manager.js';

const POLICY_V1 = '2025-01-01';
const POLICY_V2 = '2025-04-01';

describe('ConsentTierManager — initial state', () => {
  it('starts in pending state with NO_MEMORY tier', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    const snap = mgr.snapshot();
    expect(snap.state).toBe('pending');
    expect(snap.tier).toBe('NO_MEMORY');
    expect(mgr.canStoreMemory()).toBe(false);
    expect(mgr.canPersonalize()).toBe(false);
    expect(mgr.canUseAnalytics(100)).toBe(false);
  });

  it('respects custom initialTier', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1, initialTier: 'ANONYMOUS' });
    expect(mgr.snapshot().tier).toBe('ANONYMOUS');
    expect(mgr.snapshot().state).toBe('pending');
    // pending state still rejects memory even at ANONYMOUS tier
    expect(mgr.canStoreMemory()).toBe(false);
  });
});

describe('ConsentTierManager — grant', () => {
  it('moves to granted state and updates tier', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    const result = mgr.grant('CONSENTED');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe('granted');
      expect(result.data.tier).toBe('CONSENTED');
      expect(result.data.grantedAt).toBeDefined();
    }
    expect(mgr.canStoreMemory()).toBe(true);
    expect(mgr.canPersonalize()).toBe(true);
  });

  it('allows monotonic upgrade ANONYMOUS → CONSENTED → ENRICHED', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    expect(mgr.grant('ANONYMOUS').success).toBe(true);
    expect(mgr.grant('CONSENTED').success).toBe(true);
    expect(mgr.grant('ENRICHED').success).toBe(true);
    expect(mgr.snapshot().tier).toBe('ENRICHED');
  });

  it('rejects downgrade from granted CONSENTED to ANONYMOUS', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    const result = mgr.grant('ANONYMOUS');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONSENT_DOWNGRADE_FORBIDDEN');
    }
    expect(mgr.snapshot().tier).toBe('CONSENTED');
  });

  it('accepts re-grant at the same tier', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    const result = mgr.grant('CONSENTED');
    expect(result.success).toBe(true);
  });
});

describe('ConsentTierManager — revoke', () => {
  it('clears all permissions and moves state to revoked', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('ENRICHED');
    expect(mgr.canStoreMemory()).toBe(true);
    expect(mgr.canPersonalize()).toBe(true);

    const snap = mgr.revoke();
    expect(snap.state).toBe('revoked');
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.revokedAt).toBeDefined();

    expect(mgr.canStoreMemory()).toBe(false);
    expect(mgr.canPersonalize()).toBe(false);
    expect(mgr.canUseAnalytics(1000)).toBe(false);
    expect(mgr.canUsePreciseGeo()).toBe(false);
  });

  it('allows new grant after revoke', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('ENRICHED');
    mgr.revoke();
    const result = mgr.grant('ANONYMOUS');
    expect(result.success).toBe(true);
    expect(mgr.snapshot().tier).toBe('ANONYMOUS');
  });
});

describe('ConsentTierManager — reset', () => {
  it('returns the manager to pending/NO_MEMORY', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('ENRICHED');
    mgr.revoke();
    const snap = mgr.reset();
    expect(snap.state).toBe('pending');
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.grantedAt).toBeUndefined();
    expect(snap.revokedAt).toBeUndefined();
  });
});

describe('ConsentTierManager — downgradeOnPrivacySignal', () => {
  it('drops tier to NO_MEMORY when DNT is set', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('ENRICHED');
    const snap = mgr.downgradeOnPrivacySignal({ dntEnabled: true, gpcEnabled: false });
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.lastReason).toBe('dnt');
    expect(mgr.canStoreMemory()).toBe(false);
    expect(mgr.canPersonalize({ dntEnabled: true, gpcEnabled: false })).toBe(false);
  });

  it('drops tier to NO_MEMORY when GPC is set', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    const snap = mgr.downgradeOnPrivacySignal({ dntEnabled: false, gpcEnabled: true });
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.lastReason).toBe('gpc');
  });

  it('is a no-op when neither DNT nor GPC is set', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    const snap = mgr.downgradeOnPrivacySignal({ dntEnabled: false, gpcEnabled: false });
    expect(snap.tier).toBe('CONSENTED');
  });
});

describe('ConsentTierManager — invalidateOnPolicyChange', () => {
  it('invalidates a granted consent when policy version changes', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    expect(mgr.canStoreMemory()).toBe(true);

    const invalidated = mgr.invalidateOnPolicyChange(POLICY_V2);
    expect(invalidated).toBe(true);

    const snap = mgr.snapshot();
    expect(snap.state).toBe('pending');
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.lastReason).toContain('policy_change');
    expect(mgr.canStoreMemory()).toBe(false);
    expect(mgr.canPersonalize()).toBe(false);
  });

  it('returns false when policy version is unchanged', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    const invalidated = mgr.invalidateOnPolicyChange(POLICY_V1);
    expect(invalidated).toBe(false);
    expect(mgr.snapshot().tier).toBe('CONSENTED');
  });
});

describe('ConsentTierManager — explanation object', () => {
  it('explains every tier with summary and dataProcessed list', () => {
    const all = ConsentTierManager.explainAll();
    expect(all).toHaveLength(4);
    for (const exp of all) {
      expect(exp.summary.length).toBeGreaterThan(0);
      expect(exp.dataProcessed.length).toBeGreaterThan(0);
    }
  });

  it('NO_MEMORY explanation forbids everything', () => {
    const exp = ConsentTierManager.explain('NO_MEMORY');
    expect(exp.memoryAllowed).toBe(false);
    expect(exp.personalizationAllowed).toBe(false);
    expect(exp.preciseGeoAllowed).toBe(false);
  });

  it('ENRICHED explanation allows everything', () => {
    const exp = ConsentTierManager.explain('ENRICHED');
    expect(exp.memoryAllowed).toBe(true);
    expect(exp.personalizationAllowed).toBe(true);
    expect(exp.preciseGeoAllowed).toBe(true);
  });

  it('CONSENTED explanation forbids precise geo but allows personalization', () => {
    const exp = ConsentTierManager.explain('CONSENTED');
    expect(exp.personalizationAllowed).toBe(true);
    expect(exp.preciseGeoAllowed).toBe(false);
  });
});

describe('ConsentTierManager — analytics with k-anonymity', () => {
  it('respects k-anonymity threshold', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('ANONYMOUS');
    expect(mgr.canUseAnalytics(4)).toBe(false);
    expect(mgr.canUseAnalytics(5)).toBe(true);
    expect(mgr.canUseAnalytics(100)).toBe(true);
  });

  it('respects custom threshold', () => {
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    expect(mgr.canUseAnalytics(9, 10)).toBe(false);
    expect(mgr.canUseAnalytics(10, 10)).toBe(true);
  });
});
