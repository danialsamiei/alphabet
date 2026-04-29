/**
 * @file pulse.test.ts
 * @description Tests for ProactiveLayerForecaster.
 */

import { describe, it, expect } from 'vitest';
import { ProactiveLayerForecaster } from './index.js';

describe('ProactiveLayerForecaster', () => {
  it('returns no-change when confidence is below threshold', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0.95, historyLimit: 4 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', networkType: '4g' });
    const hints = fc.forecast();
    expect(hints[0]?.kind).toBe('no-change');
  });

  it('emits preemptive-downgrade on a network downgrade', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', networkType: '4g', batteryLevel: 0.9 });
    fc.observe({ at: 1000, currentLayer: 'R3F_IMMERSIVE', networkType: '3g', batteryLevel: 0.9 });
    const hints = fc.forecast();
    expect(hints.some((h) => h.kind === 'preemptive-downgrade')).toBe(true);
    const dg = hints.find((h) => h.kind === 'preemptive-downgrade');
    if (dg !== undefined && dg.kind === 'preemptive-downgrade') {
      expect(dg.from).toBe('R3F_IMMERSIVE');
      expect(dg.to).toBe('CSS_3D');
    }
  });

  it('emits pause-animation when reduced motion is preferred', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', prefersReducedMotion: false });
    fc.observe({ at: 1000, currentLayer: 'R3F_IMMERSIVE', prefersReducedMotion: true });
    const hints = fc.forecast();
    expect(hints.some((h) => h.kind === 'pause-animation')).toBe(true);
  });

  it('emits pause-animation when tab goes hidden', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', visibilityState: 'visible' });
    fc.observe({ at: 1000, currentLayer: 'R3F_IMMERSIVE', visibilityState: 'hidden' });
    const hints = fc.forecast();
    const pause = hints.find((h) => h.kind === 'pause-animation');
    expect(pause).toBeDefined();
    if (pause !== undefined && pause.kind === 'pause-animation') {
      expect(pause.urgency).toBe('high');
    }
  });

  it('reset clears history', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', networkType: '4g' });
    fc.observe({ at: 1000, currentLayer: 'R3F_IMMERSIVE', networkType: '3g' });
    fc.reset();
    const hints = fc.forecast();
    // After reset, no warnings -> no-change.
    expect(hints.every((h) => h.kind === 'no-change')).toBe(true);
  });

  // ─── Ethics-aware downgrades ───────────────────────────────────────────────

  it('emits ethical-downgrade on consent revocation, ahead of capability hints', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE', networkType: '4g' });
    fc.observe({ at: 1000, currentLayer: 'R3F_IMMERSIVE', networkType: '3g' });
    fc.observeEthics({ consentTierChange: 'revoked' });
    const hints = fc.forecast();
    expect(hints[0]?.kind).toBe('ethical-downgrade');
    if (hints[0]?.kind === 'ethical-downgrade') {
      expect(hints[0].reason).toBe('consent-revoked');
      expect(hints[0].to).toBe('STATIC_HTML');
      expect(hints[0].urgency).toBe('high');
    }
  });

  it('emits ethical-downgrade on jurisdiction-restriction', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE' });
    fc.observeEthics({ jurisdictionRisk: 'high' });
    const hints = fc.forecast();
    expect(
      hints.some((h) => h.kind === 'ethical-downgrade' && h.reason === 'jurisdiction-restriction'),
    ).toBe(true);
  });

  it('emits ethical-downgrade on flagged content', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE' });
    fc.observeEthics({ contentFlag: 'flagged' });
    const hints = fc.forecast();
    expect(
      hints.some((h) => h.kind === 'ethical-downgrade' && h.reason === 'content-sensitivity'),
    ).toBe(true);
  });

  it('emits pause-animation (not downgrade) for content caution', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE' });
    fc.observeEthics({ contentFlag: 'caution' });
    const hints = fc.forecast();
    expect(hints.some((h) => h.kind === 'pause-animation')).toBe(true);
    expect(hints.some((h) => h.kind === 'ethical-downgrade')).toBe(false);
  });

  it('clears ethics state on reset', () => {
    const fc = new ProactiveLayerForecaster({ minConfidence: 0 });
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE' });
    fc.observeEthics({ consentTierChange: 'revoked' });
    fc.reset();
    fc.observe({ at: 0, currentLayer: 'R3F_IMMERSIVE' });
    const hints = fc.forecast();
    expect(hints.some((h) => h.kind === 'ethical-downgrade')).toBe(false);
  });
});
