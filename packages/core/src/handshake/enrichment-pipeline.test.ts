/**
 * @file enrichment-pipeline.test.ts
 * @description Unit tests for EnrichmentPipeline.
 */

import { describe, it, expect } from 'vitest';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import type { DetectedSignals } from '../types/visitor.js';

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

// ─── EnrichmentPipeline.enrich() ─────────────────────────────────────────────

describe('EnrichmentPipeline.enrich()', () => {
  const pipeline = new EnrichmentPipeline();

  it('should return a valid EnrichedContext', () => {
    const result = pipeline.enrich(makeSignals());
    expect(result).toBeDefined();
    expect(result.visitor).toBeDefined();
    expect(result.enrichedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should derive IR geo from Asia/Tehran timezone', () => {
    const result = pipeline.enrich(makeSignals({ timezone: 'Asia/Tehran' }));
    expect(result.visitor.geo.country).toBe('IR');
    expect(result.visitor.geo.city).toBe('Tehran');
    expect(result.visitor.geo.timezone).toBe('Asia/Tehran');
  });

  it('should derive BG geo from Europe/Sofia timezone', () => {
    const result = pipeline.enrich(makeSignals({ timezone: 'Europe/Sofia' }));
    expect(result.visitor.geo.country).toBe('BG');
    expect(result.visitor.geo.city).toBe('Sofia');
  });

  it('should derive US geo from America/New_York timezone', () => {
    const result = pipeline.enrich(makeSignals({ timezone: 'America/New_York' }));
    expect(result.visitor.geo.country).toBe('US');
    expect(result.visitor.geo.city).toBe('New York');
  });

  it('should produce fallback geo for unknown timezone', () => {
    const result = pipeline.enrich(makeSignals({ timezone: 'Antarctica/Unknown' }));
    expect(result.visitor.geo.country).toBeDefined();
    expect(result.visitor.geo.country.length).toBeGreaterThan(0);
  });

  it('should generate an anonymous visitorId with anon- prefix', () => {
    const result = pipeline.enrich(makeSignals());
    expect(result.visitor.visitorId).toMatch(/^anon-/);
  });

  it('should use provided visitorId if given', () => {
    const id = 'anon-custom-id-12345' as Parameters<typeof pipeline.enrich>[1] extends { visitorId?: infer V } ? V : never;
    const result = pipeline.enrich(makeSignals(), { visitorId: id as never });
    expect(result.visitor.visitorId).toBe(id);
  });

  it('should categorize Google referrer as "search"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: 'https://www.google.com/search?q=awaf' }));
    expect(result.referrerCategory).toBe('search');
  });

  it('should categorize Twitter referrer as "social"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: 'https://twitter.com/home' }));
    expect(result.referrerCategory).toBe('social');
  });

  it('should categorize x.com referrer as "social"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: 'https://x.com/post/123' }));
    expect(result.referrerCategory).toBe('social');
  });

  it('should categorize Bing referrer as "search"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: 'https://www.bing.com/search?q=test' }));
    expect(result.referrerCategory).toBe('search');
  });

  it('should categorize empty referrer as "direct"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: '' }));
    expect(result.referrerCategory).toBe('direct');
  });

  it('should categorize unknown referrer as "other"', () => {
    const result = pipeline.enrich(makeSignals({ referrer: 'https://myblog.example.com/post' }));
    expect(result.referrerCategory).toBe('other');
  });

  it('should set layer to STATIC_HTML for prefersReducedMotion', () => {
    const result = pipeline.enrich(makeSignals({ prefersReducedMotion: true }));
    expect(result.visitor.layer).toBe('STATIC_HTML');
  });

  it('should set layer to CANVAS_2D when webGL is not supported', () => {
    const result = pipeline.enrich(makeSignals({ webglSupported: false, prefersReducedMotion: false }));
    expect(result.visitor.layer).toBe('CANVAS_2D');
  });

  it('should set layer to R3F_IMMERSIVE for webgl + wide screen + no motion', () => {
    const result = pipeline.enrich(makeSignals({
      webglSupported: true,
      prefersReducedMotion: false,
      screenWidth: 1440,
    }));
    expect(result.visitor.layer).toBe('R3F_IMMERSIVE');
  });

  it('should include coarse latitude and longitude', () => {
    const result = pipeline.enrich(makeSignals({ timezone: 'Asia/Tehran' }));
    expect(typeof result.visitor.geo.coarseLatitude).toBe('number');
    expect(typeof result.visitor.geo.coarseLongitude).toBe('number');
  });
});

// ─── EnrichmentPipeline.requiresGDPRConsent() ────────────────────────────────

describe('EnrichmentPipeline.requiresGDPRConsent()', () => {
  it('should return true for EU countries', () => {
    expect(EnrichmentPipeline.requiresGDPRConsent('DE')).toBe(true);
    expect(EnrichmentPipeline.requiresGDPRConsent('FR')).toBe(true);
    expect(EnrichmentPipeline.requiresGDPRConsent('GB')).toBe(true);
    expect(EnrichmentPipeline.requiresGDPRConsent('BG')).toBe(true);
  });

  it('should return false for non-EU countries', () => {
    expect(EnrichmentPipeline.requiresGDPRConsent('IR')).toBe(false);
    expect(EnrichmentPipeline.requiresGDPRConsent('US')).toBe(false);
    expect(EnrichmentPipeline.requiresGDPRConsent('JP')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(EnrichmentPipeline.requiresGDPRConsent('de')).toBe(true);
    expect(EnrichmentPipeline.requiresGDPRConsent('fr')).toBe(true);
  });
});
