/**
 * useAdaptiveLayer — RTL, reduced-motion, DNT/GPC, and override behavior.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdaptiveLayer } from './useAdaptiveLayer.js';

describe('useAdaptiveLayer', () => {
  it('returns R3F_IMMERSIVE for capable simulated device', () => {
    const { result } = renderHook(() =>
      useAdaptiveLayer({
        webglSupportedOverride: true,
        viewportWidthOverride: 1440,
        networkTypeOverride: '4g',
        reducedMotionOverride: false,
      })
    );
    expect(result.current.layer).toBe('R3F_IMMERSIVE');
  });

  it('returns CANVAS_2D when webglSupportedOverride is false', () => {
    const { result } = renderHook(() =>
      useAdaptiveLayer({
        webglSupportedOverride: false,
        reducedMotionOverride: false,
      })
    );
    expect(result.current.layer).toBe('CANVAS_2D');
  });

  it('returns STATIC_HTML when reducedMotionOverride is true', () => {
    const { result } = renderHook(() =>
      useAdaptiveLayer({
        webglSupportedOverride: true,
        reducedMotionOverride: true,
      })
    );
    expect(result.current.layer).toBe('STATIC_HTML');
    expect(result.current.reasonCode).toBe('reduced-motion');
  });

  it('respects forceLayer override', () => {
    const { result } = renderHook(() =>
      useAdaptiveLayer({
        forceLayer: 'TEXT_ONLY',
        webglSupportedOverride: true,
      })
    );
    expect(result.current.layer).toBe('TEXT_ONLY');
  });

  it('default direction is "ltr" when no handshake decision', () => {
    const { result } = renderHook(() =>
      useAdaptiveLayer({ webglSupportedOverride: true })
    );
    expect(result.current.direction).toBe('ltr');
  });
});
