/**
 * Layer selector — pure logic tests.
 *
 * Covers:
 *  - happy-path capable layer selection
 *  - explicit caller override
 *  - reduced-motion forces STATIC_HTML
 *  - SSR forces STATIC_HTML (even with WebGL signal)
 *  - missing canvas → STATIC_HTML
 *  - missing webgl → CANVAS_2D
 *  - r3f unavailable → CSS_3D
 *  - slow network → CSS_3D
 *  - narrow viewport → CSS_3D
 *  - DNT / GPC are *not* inputs (cannot force lower visual layer)
 *  - fallback chain semantics
 */

import { describe, it, expect } from 'vitest';
import {
  selectAdaptiveLayer,
  ADAPTIVE_LAYER_FALLBACK_CHAIN,
} from '../runtime/layer-selector.js';

describe('selectAdaptiveLayer', () => {
  it('picks R3F_IMMERSIVE when device is fully capable', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      canvas2dSupported: true,
      isBrowser: true,
      r3fAvailable: true,
      viewportWidth: 1440,
      networkType: '4g',
    });
    expect(result.layer).toBe('R3F_IMMERSIVE');
    expect(result.reasonCode).toBe('capable');
    expect(result.fallbackChain[0]).toBe('R3F_IMMERSIVE');
    expect(result.fallbackChain).toEqual(ADAPTIVE_LAYER_FALLBACK_CHAIN);
  });

  it('honors caller-forced layer above all other signals', () => {
    const result = selectAdaptiveLayer({
      forceLayer: 'TEXT_ONLY',
      webglSupported: true,
      isBrowser: true,
    });
    expect(result.layer).toBe('TEXT_ONLY');
    expect(result.reasonCode).toBe('forced-by-caller');
  });

  it('falls back to STATIC_HTML when prefers-reduced-motion is set', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: true,
      prefersReducedMotion: true,
    });
    expect(result.layer).toBe('STATIC_HTML');
    expect(result.reasonCode).toBe('reduced-motion');
  });

  it('falls back to STATIC_HTML during SSR even with WebGL', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: false,
    });
    expect(result.layer).toBe('STATIC_HTML');
    expect(result.reasonCode).toBe('ssr-fallback');
  });

  it('falls back to STATIC_HTML when canvas2d is unavailable', () => {
    const result = selectAdaptiveLayer({
      canvas2dSupported: false,
      webglSupported: true,
      isBrowser: true,
    });
    expect(result.layer).toBe('STATIC_HTML');
    expect(result.reasonCode).toBe('no-canvas');
  });

  it('falls back to CANVAS_2D when WebGL is unavailable', () => {
    const result = selectAdaptiveLayer({
      webglSupported: false,
      canvas2dSupported: true,
      isBrowser: true,
    });
    expect(result.layer).toBe('CANVAS_2D');
    expect(result.reasonCode).toBe('no-webgl');
  });

  it('falls back to CSS_3D when R3F is not available', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: true,
      r3fAvailable: false,
    });
    expect(result.layer).toBe('CSS_3D');
    expect(result.reasonCode).toBe('r3f-unavailable');
  });

  it.each(['slow-2g', '2g'] as const)(
    'falls back to CSS_3D when network is %s',
    (networkType) => {
      const result = selectAdaptiveLayer({
        webglSupported: true,
        isBrowser: true,
        networkType,
      });
      expect(result.layer).toBe('CSS_3D');
      expect(result.reasonCode).toBe('slow-network');
    }
  );

  it('falls back to CSS_3D for narrow viewports below 768px', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: true,
      viewportWidth: 480,
    });
    expect(result.layer).toBe('CSS_3D');
    expect(result.reasonCode).toBe('narrow-viewport');
  });

  it('does not consider DNT/GPC: capable device with privacy signal still gets R3F', () => {
    // selector signature deliberately doesn't include dnt/gpc; this test
    // documents that contract. Adding privacy signals to the *handshake*
    // affects consent and personalization, but never the visual layer.
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: true,
      viewportWidth: 1280,
      networkType: '4g',
    });
    expect(result.layer).toBe('R3F_IMMERSIVE');
  });

  it('forceTextOnly returns TEXT_ONLY with reasonCode forced-text-only', () => {
    const result = selectAdaptiveLayer({
      forceTextOnly: true,
      webglSupported: true,
      isBrowser: true,
    });
    expect(result.layer).toBe('TEXT_ONLY');
    expect(result.reasonCode).toBe('forced-text-only');
  });

  it('fallbackChain starts at the selected layer and walks down', () => {
    const result = selectAdaptiveLayer({
      webglSupported: true,
      isBrowser: true,
      r3fAvailable: false,
    });
    expect(result.fallbackChain).toEqual(['CSS_3D', 'CANVAS_2D', 'STATIC_HTML', 'TEXT_ONLY']);
  });
});
