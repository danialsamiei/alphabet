/**
 * @file orchestrator.test.ts
 * @description Tests for CrossRealityOrchestrator.
 */

import { describe, it, expect } from 'vitest';
import { CrossRealityOrchestrator } from './orchestrator.js';
import type { XRCapabilitySnapshot } from './types.js';

const baseSnapshot = (overrides: Partial<XRCapabilitySnapshot> = {}): XRCapabilitySnapshot => ({
  webXrAvailable: true,
  immersiveVrSupported: true,
  immersiveArSupported: true,
  poseTrackingSupported: true,
  hitTestSupported: true,
  anchorsSupported: true,
  depthSensingSupported: false,
  handTrackingSupported: false,
  planeDetectionSupported: true,
  domOverlaySupported: true,
  ambientLightSupported: false,
  headsetClass: 'mobile-ar',
  spatialLayer0Available: false,
  prefersReducedMotion: false,
  ...overrides,
});

describe('CrossRealityOrchestrator.decide', () => {
  it('selects webxr-ar at CONSENTED tier on AR-capable device', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(d.mode).toBe('webxr-ar');
    expect(d.privacyPosture).toBe('session-ephemeral');
    expect(d.fallbackLayer).toBe('R3F_IMMERSIVE');
  });

  it('selects spatial-layer-0 when adapter is available + tier is CONSENTED', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot({ spatialLayer0Available: true }),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(d.mode).toBe('spatial-layer-0');
  });

  it('downgrades to fallback when consent tier is too low', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ANONYMOUS',
      privacy: { dntEnabled: false, gpcEnabled: false },
      currentLayer: 'R3F_IMMERSIVE',
    });
    expect(d.mode).toBe('r3f');
    expect(d.reasons).toContain('consent-tier-too-low');
    expect(d.reasons).toContain('fallback-to-capability-layer');
    expect(d.privacyPosture).toBe('on-device-only');
  });

  it('forces flat mode when DNT/GPC is active', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ENRICHED',
      privacy: { dntEnabled: true, gpcEnabled: false },
      currentLayer: 'STATIC_HTML',
    });
    expect(d.mode).toBe('flat');
    expect(d.reasons).toContain('privacy-signal-active');
  });

  it('honours reduced-motion as an XR-blocker', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot({ prefersReducedMotion: true }),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
      currentLayer: 'CSS_3D',
    });
    expect(d.mode).toBe('css-3d');
    expect(d.reasons).toContain('reduced-motion');
  });

  it('respects jurisdictionRestrictsXr override', () => {
    const xr = new CrossRealityOrchestrator({ jurisdictionRestrictsXr: true });
    const d = xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ENRICHED',
      privacy: { dntEnabled: false, gpcEnabled: false },
      currentLayer: 'R3F_IMMERSIVE',
    });
    expect(d.mode).toBe('r3f');
    expect(d.reasons).toContain('jurisdiction-restriction');
  });

  it('only unlocks persistent-with-proof when consentProofVerified is true', () => {
    const noProof = new CrossRealityOrchestrator();
    const d1 = noProof.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ENRICHED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(d1.privacyPosture).toBe('session-ephemeral');

    const verified = new CrossRealityOrchestrator({ consentProofVerified: true });
    const d2 = verified.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ENRICHED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(d2.privacyPosture).toBe('persistent-with-proof');
  });

  it('falls back when WebXR is unavailable', () => {
    const xr = new CrossRealityOrchestrator();
    const d = xr.decide({
      snapshot: baseSnapshot({
        webXrAvailable: false,
        immersiveArSupported: false,
        immersiveVrSupported: false,
      }),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
      currentLayer: 'R3F_IMMERSIVE',
    });
    expect(d.mode).toBe('r3f');
    expect(d.reasons).toContain('no-webxr');
  });
});

describe('CrossRealityOrchestrator events', () => {
  it('emits reality:upgrade on first XR entry', () => {
    const xr = new CrossRealityOrchestrator();
    const events: Array<{ from: string; to: string }> = [];
    xr.on('reality:upgrade', (p) => events.push(p));
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(events.length).toBe(1);
    expect(events[0]?.to).toBe('webxr-ar');
  });

  it('emits reality:downgrade with reasons when leaving XR', () => {
    const xr = new CrossRealityOrchestrator();
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    const events: Array<{ from: string; to: string; reasons: readonly string[] }> = [];
    xr.on('reality:downgrade', (p) => events.push(p));
    xr.decide({
      snapshot: baseSnapshot({ prefersReducedMotion: true }),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
      currentLayer: 'R3F_IMMERSIVE',
    });
    expect(events.length).toBe(1);
    expect(events[0]?.from).toBe('webxr-ar');
    expect(events[0]?.reasons).toContain('reduced-motion');
  });

  it('emits reality:consent-required when tier blocks XR', () => {
    const xr = new CrossRealityOrchestrator();
    const seen: Array<{ forMode: string; minimumTier: string }> = [];
    xr.on('reality:consent-required', (p) => seen.push(p));
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'ANONYMOUS',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(seen.length).toBe(1);
    expect(seen[0]?.minimumTier).toBe('CONSENTED');
  });

  it('unsubscribe stops further deliveries', () => {
    const xr = new CrossRealityOrchestrator();
    const seen: number[] = [];
    const off = xr.on('reality:upgrade', () => seen.push(1));
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    off();
    xr.reset();
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(seen.length).toBe(1);
  });
});

describe('CrossRealityOrchestrator anchors', () => {
  it('refuses anchor attach before any decide()', async () => {
    const xr = new CrossRealityOrchestrator();
    const r = await xr.attachAnchor({
      id: 'a',
      pose: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      scope: 'local',
      requiredTier: 'CONSENTED',
    });
    expect(r.success).toBe(false);
  });

  it('attaches a local anchor after a CONSENTED decision', async () => {
    const xr = new CrossRealityOrchestrator();
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    const r = await xr.attachAnchor({
      id: 'a',
      pose: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      scope: 'local',
      requiredTier: 'CONSENTED',
    });
    expect(r.success).toBe(true);
    expect(xr.listAnchorIds()).toContain('a');
  });

  it('revokes world-scoped anchors when posture downgrades to on-device-only', async () => {
    const xr = new CrossRealityOrchestrator();
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    await xr.attachAnchor({
      id: 'world-1',
      pose: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      scope: 'world',
      requiredTier: 'CONSENTED',
    });
    expect(xr.listAnchorIds()).toContain('world-1');

    const revoked: string[] = [];
    xr.on('reality:anchor-revoked', (p) => revoked.push(p.anchorId));
    // DNT flips on → posture must drop to on-device-only.
    xr.decide({
      snapshot: baseSnapshot(),
      consentTier: 'CONSENTED',
      privacy: { dntEnabled: true, gpcEnabled: false },
      currentLayer: 'R3F_IMMERSIVE',
    });
    // Allow microtasks to settle (revokeIncompatibleAnchors is async).
    await new Promise((r) => setTimeout(r, 0));
    expect(revoked).toContain('world-1');
    expect(xr.listAnchorIds()).not.toContain('world-1');
  });
});
