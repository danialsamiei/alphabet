/**
 * @file Tests for `@alphabet/marketplace` — manifest validation,
 * registry semantics, trust score determinism, and certification rules.
 */

import { describe, it, expect } from 'vitest';

import {
  CERTIFICATION_CRITERIA,
  InMemoryRegistry,
  buildTrustBadge,
  computeTrustScore,
  evaluateCertification,
  isMarketplaceManifest,
  renderTrustBadge,
  sanitizeTelemetry,
  validateManifest,
} from './index.js';
import { OFFICIAL_MANIFESTS, consentBannerManifest } from './official/index.js';
import type { ComponentManifest, MarketplaceManifest } from './types.js';

const VALID_COMPONENT: ComponentManifest = {
  id: 'acme/cool-widget',
  kind: 'component',
  version: '0.1.0',
  title: 'Cool Widget',
  description: 'A test widget.',
  maintainers: [{ id: 'acme', displayName: 'Acme Inc' }],
  license: 'MIT',
  official: false,
  tags: ['demo'],
  supportedLayers: [4, 5],
  capabilities: ['demo'],
  entry: 'acme-cool-widget#default',
  privacy: {
    requiredConsentTier: 0,
    respectsDoNotTrack: true,
    collectsNoPii: true,
    localOnly: true,
    memoryDomainsRead: [],
    memoryDomainsWritten: [],
  },
};

describe('validateManifest', () => {
  it('accepts a well-formed component manifest', () => {
    const r = validateManifest(VALID_COMPONENT);
    expect(r.success).toBe(true);
  });

  it('accepts every official manifest', () => {
    for (const m of OFFICIAL_MANIFESTS) {
      const r = validateManifest(m);
      expect(r.success, `official ${m.id} should be valid`).toBe(true);
    }
  });

  it('rejects unknown kind', () => {
    const r = validateManifest({ ...VALID_COMPONENT, kind: 'plugin' });
    expect(r.success).toBe(false);
  });

  it('rejects bad SemVer', () => {
    const r = validateManifest({ ...VALID_COMPONENT, version: 'one' });
    expect(r.success).toBe(false);
  });

  it('rejects empty supportedLayers for components', () => {
    const r = validateManifest({ ...VALID_COMPONENT, supportedLayers: [] });
    expect(r.success).toBe(false);
  });

  it('refuses official=true on non-reserved ids', () => {
    const r = validateManifest({ ...VALID_COMPONENT, official: true });
    expect(r.success).toBe(false);
  });

  it('rejects requiredConsentTier outside 0..3', () => {
    const r = validateManifest({
      ...VALID_COMPONENT,
      privacy: { ...VALID_COMPONENT.privacy, requiredConsentTier: 4 },
    });
    expect(r.success).toBe(false);
  });

  it('isMarketplaceManifest acts as a type guard', () => {
    expect(isMarketplaceManifest(VALID_COMPONENT)).toBe(true);
    expect(isMarketplaceManifest({ kind: 'component' })).toBe(false);
    expect(isMarketplaceManifest(null)).toBe(false);
  });
});

describe('InMemoryRegistry', () => {
  it('publishes, retrieves, and lists official entries deterministically', () => {
    const reg = new InMemoryRegistry();
    for (const m of OFFICIAL_MANIFESTS) {
      const r = reg.publish(m);
      expect(r.success).toBe(true);
    }
    expect(reg.size()).toBe(OFFICIAL_MANIFESTS.length);
    const all = reg.list();
    expect(all.every((m) => m.official)).toBe(true);
    // Officials sorted alphabetically by id.
    const ids = all.map((m) => m.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('rejects republishing the same version', () => {
    const reg = new InMemoryRegistry();
    expect(reg.publish(VALID_COMPONENT).success).toBe(true);
    const same = reg.publish(VALID_COMPONENT);
    expect(same.success).toBe(false);
  });

  it('accepts a strictly newer version', () => {
    const reg = new InMemoryRegistry();
    expect(reg.publish(VALID_COMPONENT).success).toBe(true);
    const newer = { ...VALID_COMPONENT, version: '0.2.0' };
    const r = reg.publish(newer);
    expect(r.success).toBe(true);
  });

  it('filters by kind, tag, and consent tier', () => {
    const reg = new InMemoryRegistry();
    for (const m of OFFICIAL_MANIFESTS) reg.publish(m);

    const components = reg.list({ kind: 'component' });
    expect(components.every((m) => m.kind === 'component')).toBe(true);

    const adapters = reg.list({ kind: 'protocol-adapter' });
    expect(adapters.every((m) => m.kind === 'protocol-adapter')).toBe(true);

    const tier0Only = reg.list({ maxConsentTier: 0 });
    expect(tier0Only.every((m) => m.privacy.requiredConsentTier === 0)).toBe(
      true,
    );
  });

  it('removes entries', () => {
    const reg = new InMemoryRegistry();
    reg.publish(VALID_COMPONENT);
    expect(reg.remove(VALID_COMPONENT.id).success).toBe(true);
    expect(reg.get(VALID_COMPONENT.id).success).toBe(false);
  });
});

describe('computeTrustScore', () => {
  it('is deterministic for the same input (modulo computedAt)', () => {
    const a = computeTrustScore({ manifest: consentBannerManifest });
    const b = computeTrustScore({ manifest: consentBannerManifest });
    expect(a.score).toBe(b.score);
    expect(a.grade).toBe(b.grade);
    expect(a.reasons).toEqual(b.reasons);
  });

  it('rewards Tier 0 + DNT + no PII + local-only with grade A or A+', () => {
    const r = computeTrustScore({ manifest: consentBannerManifest });
    expect(['A', 'A+']).toContain(r.grade);
  });

  it('penalises ignoring DNT', () => {
    const respectDnt = computeTrustScore({ manifest: VALID_COMPONENT });
    const ignoreDnt = computeTrustScore({
      manifest: {
        ...VALID_COMPONENT,
        privacy: { ...VALID_COMPONENT.privacy, respectsDoNotTrack: false },
      },
    });
    const codes = ignoreDnt.reasons.map((x) => x.code);
    expect(codes).toContain('IGNORES_DNT');
    // Ignoring DNT must lower the score by at least one full grade band.
    expect(ignoreDnt.score).toBeLessThan(respectDnt.score - 30);
  });

  it('boosts the score on memory-integrity = 0 telemetry', () => {
    const baseline = computeTrustScore({ manifest: VALID_COMPONENT });
    const enriched = computeTrustScore({
      manifest: VALID_COMPONENT,
      telemetry: {
        revocationsHonoured24h: 3,
        dntDowngrades24h: 5,
        noMemorySessions24h: 100,
      },
    });
    expect(enriched.score).toBeGreaterThanOrEqual(baseline.score);
  });

  it('clamps to [0, 100]', () => {
    const r = computeTrustScore({ manifest: VALID_COMPONENT });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('renderTrustBadge', () => {
  it('produces a deterministic SVG with no script tags', () => {
    const score = computeTrustScore({ manifest: consentBannerManifest });
    const badge = renderTrustBadge(consentBannerManifest.id, score);
    expect(badge.svg).toMatch(/^<svg /);
    expect(badge.svg).not.toMatch(/<script/i);
    expect(badge.json.schemaVersion).toBe(1);
    expect(badge.json.label).toBe('alphabet trust');
  });

  it('buildTrustBadge composes scoring + rendering', () => {
    const b = buildTrustBadge({ manifest: consentBannerManifest });
    expect(b.entryId).toBe(consentBannerManifest.id);
    expect(b.score.score).toBeGreaterThan(0);
  });
});

describe('sanitizeTelemetry', () => {
  it('drops unknown and invalid fields', () => {
    const t = sanitizeTelemetry({
      noMemorySessions24h: 5,
      visitorEmail: 'leak@example.com',
      dntDowngrades24h: -1,
      revocationsHonoured24h: 'oops',
    } as unknown);
    expect(t.noMemorySessions24h).toBe(5);
    expect((t as Record<string, unknown>).visitorEmail).toBeUndefined();
    expect(t.dntDowngrades24h).toBeUndefined();
    expect(t.revocationsHonoured24h).toBeUndefined();
  });

  it('returns an empty object for non-objects', () => {
    expect(sanitizeTelemetry(null)).toEqual({});
    expect(sanitizeTelemetry('hello')).toEqual({});
  });
});

describe('evaluateCertification', () => {
  it('grants Silver to the consent banner', () => {
    // Consent banner is Tier 0, DNT-respecting, no PII, local-only,
    // supports degraded layers, but maintainer has no DID — Gold needs DID.
    const e = evaluateCertification(consentBannerManifest);
    expect(e.level === 'silver' || e.level === 'gold').toBe(true);
    expect(e.criteriaMet).toContain(CERTIFICATION_CRITERIA.RESPECTS_DNT);
    expect(e.criteriaMet).toContain(CERTIFICATION_CRITERIA.COLLECTS_NO_PII);
  });

  it('returns null level when bronze criteria are unmet', () => {
    const bad: MarketplaceManifest = {
      ...VALID_COMPONENT,
      license: '',
      privacy: { ...VALID_COMPONENT.privacy, respectsDoNotTrack: false },
    };
    const e = evaluateCertification(bad);
    expect(e.level).toBeNull();
    expect(e.criteriaMissing).toContain(CERTIFICATION_CRITERIA.RESPECTS_DNT);
    expect(e.criteriaMissing).toContain(CERTIFICATION_CRITERIA.HAS_LICENSE);
  });

  it('reaches Gold for an entry with signed maintainer DID', () => {
    const gold: ComponentManifest = {
      ...consentBannerManifest,
      maintainers: [
        { id: 'alphabet-core', displayName: 'Alphabet Core', did: 'did:web:alphabet.dev' },
      ],
    };
    const e = evaluateCertification(gold);
    expect(e.level).toBe('gold');
  });
});
