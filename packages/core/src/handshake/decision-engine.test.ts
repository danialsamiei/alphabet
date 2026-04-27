/**
 * @file decision-engine.test.ts
 * @description Unit tests for HandshakeDecisionEngine.
 */

import { describe, it, expect } from 'vitest';
import { HandshakeDecisionEngine } from './decision-engine.js';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import type { DetectedSignals, EnrichedContext } from '../types/visitor.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignals(overrides: Partial<DetectedSignals> = {}): DetectedSignals {
  return {
    language: 'fa',
    timezone: 'Asia/Tehran',
    deviceClass: 'desktop',
    platform: 'Linux x86_64',
    screenWidth: 1440,
    screenHeight: 900,
    devicePixelRatio: 1,
    webglSupported: true,
    dntEnabled: false,
    gpcEnabled: false,
    prefersReducedMotion: false,
    referrer: '',
    ...overrides,
  };
}

function makeEnriched(signalOverrides: Partial<DetectedSignals> = {}): EnrichedContext {
  const pipeline = new EnrichmentPipeline();
  return pipeline.enrich(makeSignals(signalOverrides));
}

// ─── HandshakeDecisionEngine.decide() ────────────────────────────────────────

describe('HandshakeDecisionEngine.decide()', () => {
  const engine = new HandshakeDecisionEngine();

  it('should return a valid HandshakeDecision', () => {
    const enriched = makeEnriched();
    const decision = engine.decide(enriched);
    expect(decision).toBeDefined();
    expect(decision.uiConfig).toBeDefined();
    expect(decision.selectedLayer).toBeDefined();
    expect(decision.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should resolve fa-IR locale for fa language + IR country', () => {
    const enriched = makeEnriched({ language: 'fa', timezone: 'Asia/Tehran' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.locale).toBe('fa-IR');
  });

  it('should resolve bg-BG locale for bg language + BG country', () => {
    const enriched = makeEnriched({ language: 'bg', timezone: 'Europe/Sofia' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.locale).toBe('bg-BG');
  });

  it('should resolve en-US locale for en language + US country', () => {
    const enriched = makeEnriched({ language: 'en', timezone: 'America/New_York' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.locale).toBe('en-US');
  });

  it('should fall back to en-US for unknown language+country', () => {
    const enriched = makeEnriched({ language: 'xx', timezone: 'UTC' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.locale).toBe('en-US');
  });

  it('should set direction=rtl for fa language', () => {
    const enriched = makeEnriched({ language: 'fa' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.direction).toBe('rtl');
  });

  it('should set direction=rtl for ar language', () => {
    const enriched = makeEnriched({ language: 'ar', timezone: 'Asia/Dubai' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.direction).toBe('rtl');
  });

  it('should set direction=ltr for en language', () => {
    const enriched = makeEnriched({ language: 'en', timezone: 'America/New_York' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.direction).toBe('ltr');
  });

  it('should set theme=auto', () => {
    const enriched = makeEnriched();
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.theme).toBe('auto');
  });

  it('should set consentRequired=true for EU country (DE)', () => {
    const enriched = makeEnriched({ language: 'de', timezone: 'Europe/Berlin' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.consentRequired).toBe(true);
  });

  it('should set consentRequired=false for non-EU country (IR)', () => {
    const enriched = makeEnriched({ language: 'fa', timezone: 'Asia/Tehran' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.consentRequired).toBe(false);
  });

  it('should set consentRequired=false when DNT is enabled (even for EU)', () => {
    const enriched = makeEnriched({
      language: 'de', timezone: 'Europe/Berlin', dntEnabled: true,
    });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.consentRequired).toBe(false);
  });

  // Privacy contract: DNT/GPC restrict storage/profiling but must NOT
  // downgrade the visual layer. Layer is selected from device capability
  // and accessibility preferences only.
  it('should NOT downgrade selectedLayer when DNT is enabled (capability-driven)', () => {
    const enriched = makeEnriched({ dntEnabled: true });
    const decision = engine.decide(enriched);
    expect(decision.selectedLayer).toBe('R3F_IMMERSIVE');
    expect(decision.privacyMode.restricted).toBe(true);
    expect(decision.privacyMode.dntEnabled).toBe(true);
    expect(decision.privacyMode.memoryAllowed).toBe(false);
    expect(decision.privacyMode.personalizationAllowed).toBe(false);
    expect(decision.privacyMode.preciseGeoAllowed).toBe(false);
    expect(decision.privacyMode.enforcedConsentTier).toBe('NO_MEMORY');
  });

  it('should NOT downgrade selectedLayer when GPC is enabled (capability-driven)', () => {
    const enriched = makeEnriched({ gpcEnabled: true });
    const decision = engine.decide(enriched);
    expect(decision.selectedLayer).toBe('R3F_IMMERSIVE');
    expect(decision.privacyMode.restricted).toBe(true);
    expect(decision.privacyMode.gpcEnabled).toBe(true);
    expect(decision.privacyMode.memoryAllowed).toBe(false);
  });

  it('should expose a non-restricted privacyMode when neither DNT nor GPC is set', () => {
    const enriched = makeEnriched();
    const decision = engine.decide(enriched);
    expect(decision.privacyMode.restricted).toBe(false);
    expect(decision.privacyMode.enforcedConsentTier).toBe('ANONYMOUS');
    expect(decision.privacyMode.memoryAllowed).toBe(true);
  });

  it('reduced motion downgrades selectedLayer regardless of privacy signals', () => {
    const a11y = engine.decide(makeEnriched({ prefersReducedMotion: true }));
    expect(a11y.selectedLayer).toBe('STATIC_HTML');

    // reduced motion + GPC → still STATIC_HTML, but privacy mode is restricted
    const a11yPlusGpc = engine.decide(
      makeEnriched({ prefersReducedMotion: true, gpcEnabled: true })
    );
    expect(a11yPlusGpc.selectedLayer).toBe('STATIC_HTML');
    expect(a11yPlusGpc.privacyMode.restricted).toBe(true);
  });

  it('should set selectedLayer=R3F_IMMERSIVE for webgl+wide screen+no restrictions', () => {
    const enriched = makeEnriched({
      webglSupported: true, screenWidth: 1440, prefersReducedMotion: false,
      dntEnabled: false, gpcEnabled: false,
    });
    const decision = engine.decide(enriched);
    expect(decision.selectedLayer).toBe('R3F_IMMERSIVE');
  });

  it('should set selectedLayer=STATIC_HTML for prefersReducedMotion', () => {
    const enriched = makeEnriched({ prefersReducedMotion: true });
    const decision = engine.decide(enriched);
    expect(decision.selectedLayer).toBe('STATIC_HTML');
  });

  it('should include heroCopy in uiConfig', () => {
    const enriched = makeEnriched({ language: 'fa' });
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.heroCopy.length).toBeGreaterThan(0);
  });

  it('should include CSS variables with --awaf-layer', () => {
    const enriched = makeEnriched();
    const decision = engine.decide(enriched);
    expect(decision.uiConfig.cssVariables).toBeDefined();
    if (decision.uiConfig.cssVariables) {
      expect('--awaf-layer' in decision.uiConfig.cssVariables).toBe(true);
    }
  });

  it('should set RTL font family for fa locale', () => {
    const enriched = makeEnriched({ language: 'fa' });
    const decision = engine.decide(enriched);
    if (decision.uiConfig.cssVariables) {
      expect(decision.uiConfig.cssVariables['--awaf-font-family']).toContain('Vazirmatn');
    }
  });

  it('should set LTR font family for en locale', () => {
    const enriched = makeEnriched({ language: 'en', timezone: 'America/New_York' });
    const decision = engine.decide(enriched);
    if (decision.uiConfig.cssVariables) {
      expect(decision.uiConfig.cssVariables['--awaf-font-family']).toContain('Inter');
    }
  });
});
