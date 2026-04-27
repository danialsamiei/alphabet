/**
 * @file memory-integrity-guard.test.ts
 * @description Tests for memory integrity guard — tier checks, admin-only
 * write enforcement, and cross-domain read ACL.
 */

import { describe, it, expect } from 'vitest';
import { MemoryIntegrityGuard } from './memory-integrity-guard.js';

describe('MemoryIntegrityGuard — write tier enforcement', () => {
  const guard = new MemoryIntegrityGuard();

  it('blocks writes at NO_MEMORY tier', () => {
    const r = guard.canWrite({
      domain: 'general',
      consentTier: 'NO_MEMORY',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.code).toBe('MEMORY_WRITE_BLOCKED_NO_CONSENT');
    }
  });

  it('allows general writes at ANONYMOUS tier', () => {
    const r = guard.canWrite({
      domain: 'general',
      consentTier: 'ANONYMOUS',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(true);
  });

  it('blocks visitor-domain writes at ANONYMOUS (requires CONSENTED)', () => {
    const r = guard.canWrite({
      domain: 'visitor',
      consentTier: 'ANONYMOUS',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('MEMORY_WRITE_BLOCKED_TIER');
  });

  it('allows visitor-domain writes at CONSENTED tier', () => {
    const r = guard.canWrite({
      domain: 'visitor',
      consentTier: 'CONSENTED',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(true);
  });
});

describe('MemoryIntegrityGuard — admin-only writes', () => {
  const guard = new MemoryIntegrityGuard();

  it('blocks visitor writes to class_notes', () => {
    const r = guard.canWrite({
      domain: 'class_notes',
      consentTier: 'CONSENTED',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('MEMORY_WRITE_BLOCKED_ROLE');
  });

  it('allows admin writes to class_notes', () => {
    const r = guard.canWrite({
      domain: 'class_notes',
      consentTier: 'CONSENTED',
      actorRole: 'admin',
    });
    expect(r.success).toBe(true);
  });

  it('blocks site writes to tech_pulse', () => {
    const r = guard.canWrite({
      domain: 'tech_pulse',
      consentTier: 'CONSENTED',
      actorRole: 'site',
    });
    expect(r.success).toBe(false);
  });
});

describe('MemoryIntegrityGuard — same-domain reads', () => {
  const guard = new MemoryIntegrityGuard();

  it('allows reading own domain at any non-NO_MEMORY tier', () => {
    const r = guard.canRead({
      ownerDomain: 'visitor',
      readerDomain: 'visitor',
      consentTier: 'CONSENTED',
    });
    expect(r.success).toBe(true);
  });

  it('still allows general → general at NO_MEMORY tier', () => {
    const r = guard.canRead({
      ownerDomain: 'general',
      readerDomain: 'general',
      consentTier: 'NO_MEMORY',
    });
    expect(r.success).toBe(true);
  });
});

describe('MemoryIntegrityGuard — cross-domain reads', () => {
  const guard = new MemoryIntegrityGuard();

  it('allows general → site_specific (general is public-readable)', () => {
    const r = guard.canRead({
      ownerDomain: 'general',
      readerDomain: 'site_specific',
      consentTier: 'ANONYMOUS',
    });
    expect(r.success).toBe(true);
  });

  it('blocks site_specific → visitor (visitor strictly isolated)', () => {
    const r = guard.canRead({
      ownerDomain: 'visitor',
      readerDomain: 'site_specific',
      consentTier: 'CONSENTED',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('MEMORY_READ_BLOCKED_ACL');
  });

  it('allows visitor → site_specific', () => {
    const r = guard.canRead({
      ownerDomain: 'site_specific',
      readerDomain: 'visitor',
      consentTier: 'CONSENTED',
    });
    expect(r.success).toBe(true);
  });

  it('blocks ideas → class_notes (not in ACL)', () => {
    const r = guard.canRead({
      ownerDomain: 'class_notes',
      readerDomain: 'ideas',
      consentTier: 'CONSENTED',
    });
    expect(r.success).toBe(false);
  });

  it('blocks reads beyond general at NO_MEMORY tier', () => {
    const r = guard.canRead({
      ownerDomain: 'site_specific',
      readerDomain: 'general',
      consentTier: 'NO_MEMORY',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('MEMORY_READ_BLOCKED_NO_CONSENT');
  });
});

describe('MemoryIntegrityGuard — custom policy', () => {
  it('honours custom adminOnlyWriteDomains override', () => {
    const guard = new MemoryIntegrityGuard({ adminOnlyWriteDomains: [] });
    const r = guard.canWrite({
      domain: 'class_notes',
      consentTier: 'CONSENTED',
      actorRole: 'visitor',
    });
    expect(r.success).toBe(true);
  });

  it('honours custom read ACL', () => {
    const guard = new MemoryIntegrityGuard({
      readAcl: {
        general: ['general'],
        site_specific: ['general'],
        visitor: ['visitor'],
        class_notes: ['general'],
        ideas: ['general'],
        social: ['general'],
        tech_pulse: ['general'],
      },
    });
    const r = guard.canRead({
      ownerDomain: 'general',
      readerDomain: 'site_specific',
      consentTier: 'ANONYMOUS',
    });
    expect(r.success).toBe(false);
  });
});
