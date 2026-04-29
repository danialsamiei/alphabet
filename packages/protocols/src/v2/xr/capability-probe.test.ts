/**
 * @file capability-probe.test.ts
 * @description Tests for the WebXR capability probe.
 */

import { describe, it, expect } from 'vitest';
import { probeXrCapabilities } from './capability-probe.js';

describe('probeXrCapabilities', () => {
  it('returns an absent snapshot when no host is available', async () => {
    const r = await probeXrCapabilities({ host: undefined });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.webXrAvailable).toBe(false);
      expect(r.data.immersiveArSupported).toBe(false);
      expect(r.data.headsetClass).toBe('unknown');
      expect(r.data.spatialLayer0Available).toBe(false);
    }
  });

  it('detects WebXR when navigator.xr is present', async () => {
    const host = {
      xr: {
        isSessionSupported: async (mode: string): Promise<boolean> =>
          mode === 'immersive-ar' ? true : mode === 'immersive-vr' ? false : false,
      },
      userAgent: 'Mozilla/5.0 (Linux; Quest 3) AppleWebKit/...',
    };
    const r = await probeXrCapabilities({ host });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.webXrAvailable).toBe(true);
      expect(r.data.immersiveArSupported).toBe(true);
      expect(r.data.immersiveVrSupported).toBe(false);
      expect(r.data.hitTestSupported).toBe(true);
      expect(r.data.planeDetectionSupported).toBe(true);
      expect(r.data.headsetClass).toBe('standalone-vr');
    }
  });

  it('honours prefers-reduced-motion via matchMedia', async () => {
    const host = {
      matchMedia: (q: string) => ({ matches: q.includes('reduce') }),
    };
    const r = await probeXrCapabilities({ host });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prefersReducedMotion).toBe(true);
  });

  it('reports network type when navigator.connection is present', async () => {
    const host = { connection: { effectiveType: '3g' as const } };
    const r = await probeXrCapabilities({ host });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.networkType).toBe('3g');
  });

  it('reads battery level when getBattery exists', async () => {
    const host = {
      getBattery: async (): Promise<{ readonly level?: number }> => ({ level: 0.42 }),
    };
    const r = await probeXrCapabilities({ host });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.batteryLevel).toBeCloseTo(0.42);
  });

  it('isSessionSupported throws are swallowed and return absent caps', async () => {
    const host = {
      xr: {
        isSessionSupported: async () => {
          throw new Error('boom');
        },
      },
    };
    const r = await probeXrCapabilities({ host });
    // Per-call rejections are swallowed by the internal safe wrapper.
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.webXrAvailable).toBe(true);
      expect(r.data.immersiveArSupported).toBe(false);
      expect(r.data.immersiveVrSupported).toBe(false);
    }
  });

  it('forwards spatialLayer0Available hint', async () => {
    const r = await probeXrCapabilities({ spatialLayer0Available: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.spatialLayer0Available).toBe(true);
  });
});
