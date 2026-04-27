/**
 * Tests for the consent-scope and memory-permission normalizers.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateMemoryPermission,
  ensureNoPIIInContext,
  looksLikePII,
  makeConsentScope,
  validateConsentScope,
} from './index.js';
import type { AwafToolContext } from '../contract.js';

const noPrivacy = { dntEnabled: false, gpcEnabled: false } as const;

describe('makeConsentScope', () => {
  it('defaults to respecting privacy signals and empty operations', () => {
    const scope = makeConsentScope('ANONYMOUS');
    expect(scope.tier).toBe('ANONYMOUS');
    expect(scope.respectsPrivacySignals).toBe(true);
    expect(scope.operations).toEqual([]);
    expect(scope.memoryDomains).toEqual([]);
  });
});

describe('validateConsentScope', () => {
  it('allows read_context at any tier', () => {
    const scope = makeConsentScope('NO_MEMORY', { operations: ['read_context'] });
    const r = validateConsentScope(scope, { tier: 'NO_MEMORY', privacy: noPrivacy });
    expect(r.success).toBe(true);
  });

  it('rejects memory access at NO_MEMORY', () => {
    const scope = makeConsentScope('NO_MEMORY', { operations: ['read_memory'] });
    const r = validateConsentScope(scope, { tier: 'NO_MEMORY', privacy: noPrivacy });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_INSUFFICIENT');
  });

  it('rejects personalization when DNT is active', () => {
    const scope = makeConsentScope('CONSENTED', { operations: ['personalize'] });
    const r = validateConsentScope(scope, {
      tier: 'CONSENTED',
      privacy: { dntEnabled: true, gpcEnabled: false },
    });
    expect(r.success).toBe(false);
  });

  it('rejects callers that do not respect DNT/GPC when signals are active', () => {
    const scope = makeConsentScope('CONSENTED', {
      operations: ['read_memory'],
      respectsPrivacySignals: false,
    });
    const r = validateConsentScope(scope, {
      tier: 'CONSENTED',
      privacy: { dntEnabled: true, gpcEnabled: false },
    });
    expect(r.success).toBe(false);
  });

  it('requires ENRICHED for precise_geo', () => {
    const scope = makeConsentScope('CONSENTED', { operations: ['precise_geo'] });
    const r = validateConsentScope(scope, { tier: 'CONSENTED', privacy: noPrivacy });
    expect(r.success).toBe(false);

    const scope2 = makeConsentScope('ENRICHED', { operations: ['precise_geo'] });
    const r2 = validateConsentScope(scope2, { tier: 'ENRICHED', privacy: noPrivacy });
    expect(r2.success).toBe(true);
  });
});

describe('evaluateMemoryPermission', () => {
  it('denies all when DNT is active', () => {
    const p = evaluateMemoryPermission('general', {
      tier: 'CONSENTED',
      privacy: { dntEnabled: true, gpcEnabled: false },
    });
    expect(p.canRead).toBe(false);
    expect(p.canWrite).toBe(false);
  });

  it('denies all at NO_MEMORY', () => {
    const p = evaluateMemoryPermission('general', { tier: 'NO_MEMORY', privacy: noPrivacy });
    expect(p.canRead).toBe(false);
    expect(p.canWrite).toBe(false);
  });

  it('marks class_notes / tech_pulse as admin-write-only', () => {
    const a = evaluateMemoryPermission('class_notes', { tier: 'CONSENTED', privacy: noPrivacy });
    expect(a.canRead).toBe(true);
    expect(a.canWrite).toBe(false);
    const b = evaluateMemoryPermission('tech_pulse', { tier: 'ENRICHED', privacy: noPrivacy });
    expect(b.canRead).toBe(true);
    expect(b.canWrite).toBe(false);
  });

  it('requires CONSENTED for visitor domain', () => {
    const a = evaluateMemoryPermission('visitor', { tier: 'ANONYMOUS', privacy: noPrivacy });
    expect(a.canRead).toBe(false);
    const b = evaluateMemoryPermission('visitor', { tier: 'CONSENTED', privacy: noPrivacy });
    expect(b.canRead).toBe(true);
    expect(b.canWrite).toBe(true);
  });
});

describe('looksLikePII / ensureNoPIIInContext', () => {
  it('flags emails, phones, IPs', () => {
    expect(looksLikePII('alice@example.com')).toBe(true);
    expect(looksLikePII('+1 (415) 555-0199')).toBe(true);
    expect(looksLikePII('192.168.1.1')).toBe(true);
  });

  it('does not flag opaque ids', () => {
    expect(looksLikePII('v-abc12345')).toBe(false);
    expect(looksLikePII('sess-7f3e1c2a')).toBe(false);
    expect(looksLikePII('en-US')).toBe(false);
  });

  it('rejects context with PII-shaped fields', () => {
    const ctx: AwafToolContext = {
      visitorId: 'v-abc12345',
      sessionId: 'sess-1',
      consentTier: 'ANONYMOUS',
      country: 'US',
      locale: 'alice@example.com',
      privacyRestricted: false,
    };
    const r = ensureNoPIIInContext(ctx);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('PII_DETECTED');
  });
});
