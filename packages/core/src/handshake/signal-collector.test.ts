/**
 * @file signal-collector.test.ts
 * @description Unit tests for SignalCollector.
 */

import { describe, it, expect } from 'vitest';
import { SignalCollector } from './signal-collector.js';
import type { SignalCollectorOptions } from './signal-collector.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOptions(overrides: Partial<SignalCollectorOptions> = {}): SignalCollectorOptions {
  return {
    navigator: {
      language: 'fa-IR',
      platform: 'Linux x86_64',
      doNotTrack: null,
    },
    screen: { width: 1440, height: 900 },
    devicePixelRatio: 1,
    matchMedia: (_q: string) => ({ matches: false }),
    createCanvas: () => null, // jsdom — no WebGL
    ...overrides,
  };
}

// ─── SignalCollector.collect() ────────────────────────────────────────────────

describe('SignalCollector.collect()', () => {
  it('should return success with valid browser signals', () => {
    const collector = new SignalCollector(makeOptions());
    const result = collector.collect();
    expect(result.success).toBe(true);
  });

  it('should extract language from navigator.language', () => {
    const collector = new SignalCollector(makeOptions({ navigator: { language: 'fa-IR', platform: '' } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('fa');
    }
  });

  it('should normalize language to lowercase 2-char code', () => {
    const collector = new SignalCollector(makeOptions({ navigator: { language: 'EN-US', platform: '' } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('en');
    }
  });

  it('should detect desktop device class for wide screens', () => {
    const collector = new SignalCollector(makeOptions({ screen: { width: 1920, height: 1080 } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceClass).toBe('desktop');
    }
  });

  it('should detect tablet for 768–1023px width', () => {
    const collector = new SignalCollector(makeOptions({ screen: { width: 800, height: 600 } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceClass).toBe('tablet');
    }
  });

  it('should detect mobile for width < 768', () => {
    const collector = new SignalCollector(makeOptions({ screen: { width: 375, height: 812 } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceClass).toBe('mobile');
    }
  });

  it('should detect unknown device class for zero width', () => {
    const collector = new SignalCollector(makeOptions({ screen: { width: 0, height: 0 } }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceClass).toBe('unknown');
    }
  });

  it('should set dntEnabled=true when doNotTrack is "1"', () => {
    const collector = new SignalCollector(makeOptions({
      navigator: { language: 'en', platform: '', doNotTrack: '1' },
    }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dntEnabled).toBe(true);
    }
  });

  it('should set dntEnabled=false when doNotTrack is null', () => {
    const collector = new SignalCollector(makeOptions({
      navigator: { language: 'en', platform: '', doNotTrack: null },
    }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dntEnabled).toBe(false);
    }
  });

  it('should set gpcEnabled=true when globalPrivacyControl is true', () => {
    const collector = new SignalCollector(makeOptions({
      navigator: { language: 'en', platform: '', globalPrivacyControl: true } as never,
    }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gpcEnabled).toBe(true);
    }
  });

  it('should set prefersReducedMotion=true when matchMedia matches', () => {
    const collector = new SignalCollector(makeOptions({
      matchMedia: (_q: string) => ({ matches: true }),
    }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prefersReducedMotion).toBe(true);
    }
  });

  it('should set webglSupported=false when createCanvas returns null', () => {
    const collector = new SignalCollector(makeOptions({ createCanvas: () => null }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.webglSupported).toBe(false);
    }
  });

  it('should include networkType when provided via navigator', () => {
    const nav = { language: 'en', platform: '', connection: { effectiveType: '4g' } };
    const collector = new SignalCollector(makeOptions({ navigator: nav as never }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.networkType).toBe('4g');
    }
  });

  it('should not include networkType property when connection is absent', () => {
    const collector = new SignalCollector(makeOptions());
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect('networkType' in result.data).toBe(false);
    }
  });

  it('should include platform from navigator', () => {
    const collector = new SignalCollector(makeOptions({
      navigator: { language: 'en', platform: 'Win32' },
    }));
    const result = collector.collect();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe('Win32');
    }
  });
});

// ─── SignalCollector.detectLayer() ───────────────────────────────────────────

describe('SignalCollector.detectLayer()', () => {
  const base = {
    language: 'en', timezone: 'UTC', deviceClass: 'desktop' as const,
    platform: 'Linux', screenWidth: 1440, screenHeight: 900,
    devicePixelRatio: 1, dntEnabled: false, gpcEnabled: false,
    prefersReducedMotion: false, referrer: '',
  };

  it('should return R3F_IMMERSIVE for webgl + 4g + wide screen', () => {
    const layer = SignalCollector.detectLayer({ ...base, webglSupported: true, screenWidth: 1440 });
    expect(layer).toBe('R3F_IMMERSIVE');
  });

  it('should return CSS_3D for webgl + 3g network', () => {
    const layer = SignalCollector.detectLayer({ ...base, webglSupported: true, networkType: '3g' });
    expect(layer).toBe('CSS_3D');
  });

  it('should return CANVAS_2D for no webgl with 4g', () => {
    const layer = SignalCollector.detectLayer({ ...base, webglSupported: false, networkType: '4g' });
    expect(layer).toBe('CANVAS_2D');
  });

  it('should return STATIC_HTML for prefersReducedMotion', () => {
    const layer = SignalCollector.detectLayer({ ...base, webglSupported: true, prefersReducedMotion: true });
    expect(layer).toBe('STATIC_HTML');
  });

  it('should return R3F_IMMERSIVE when networkType is undefined (default = 4g)', () => {
    const { networkType: _nt, ...rest } = { ...base, webglSupported: true };
    const layer = SignalCollector.detectLayer(rest);
    expect(layer).toBe('R3F_IMMERSIVE');
  });
});
