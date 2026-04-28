/**
 * @file capability-predictor.test.ts
 */

import { describe, it, expect } from 'vitest';
import { CapabilityPredictor, NETWORK_RANK } from './capability-predictor.js';

describe('NETWORK_RANK', () => {
  it('orders 4g > 3g > 2g > slow-2g', () => {
    expect(NETWORK_RANK['4g']).toBeGreaterThan(NETWORK_RANK['3g'] ?? 0);
    expect(NETWORK_RANK['3g']).toBeGreaterThan(NETWORK_RANK['2g'] ?? 0);
    expect(NETWORK_RANK['2g']).toBeGreaterThan(NETWORK_RANK['slow-2g'] ?? 0);
  });
});

describe('CapabilityPredictor', () => {
  it('returns STATIC_HTML and 0 confidence with no observations', () => {
    const p = new CapabilityPredictor();
    const r = p.predict();
    expect(r.predictedLayer).toBe('STATIC_HTML');
    expect(r.confidence).toBe(0);
    expect(r.warnings).toEqual([]);
    expect(r.lastObservedLayer).toBeUndefined();
  });

  it('confidence grows with history up to 1', () => {
    const p = new CapabilityPredictor({ historyLimit: 4 });
    p.observe({ at: 1, currentLayer: 'R3F_IMMERSIVE' });
    p.observe({ at: 2, currentLayer: 'R3F_IMMERSIVE' });
    expect(p.predict().confidence).toBe(0.5);
    p.observe({ at: 3, currentLayer: 'R3F_IMMERSIVE' });
    p.observe({ at: 4, currentLayer: 'R3F_IMMERSIVE' });
    expect(p.predict().confidence).toBe(1);
  });

  it('history is bounded by historyLimit (FIFO)', () => {
    const p = new CapabilityPredictor({ historyLimit: 3 });
    for (let i = 0; i < 10; i++) p.observe({ at: i });
    expect(p.predict().confidence).toBe(1);
  });

  it('detects network downgrade warning', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, currentLayer: 'R3F_IMMERSIVE', networkType: '4g' });
    p.observe({ at: 2, currentLayer: 'R3F_IMMERSIVE', networkType: '3g' });
    const r = p.predict();
    const w = r.warnings.find((x) => x.kind === 'network-downgrade');
    expect(w).toEqual({ kind: 'network-downgrade', from: '4g', to: '3g' });
  });

  it('does not warn on network upgrade', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, networkType: '3g' });
    p.observe({ at: 2, networkType: '4g' });
    const r = p.predict();
    expect(r.warnings.find((x) => x.kind === 'network-downgrade')).toBeUndefined();
  });

  it('emits battery-low only when not charging and below threshold', () => {
    const p1 = new CapabilityPredictor();
    p1.observe({ at: 1, batteryLevel: 0.1, batteryCharging: false });
    expect(p1.predict().warnings.some((w) => w.kind === 'battery-low')).toBe(true);

    const p2 = new CapabilityPredictor();
    p2.observe({ at: 1, batteryLevel: 0.1, batteryCharging: true });
    expect(p2.predict().warnings.some((w) => w.kind === 'battery-low')).toBe(false);

    const p3 = new CapabilityPredictor();
    p3.observe({ at: 1, batteryLevel: 0.5, batteryCharging: false });
    expect(p3.predict().warnings.some((w) => w.kind === 'battery-low')).toBe(false);
  });

  it('detects battery-draining when discharge rate > 5%/min', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 0, batteryLevel: 0.9, batteryCharging: false });
    p.observe({ at: 60_000, batteryLevel: 0.7, batteryCharging: false }); // 20%/min drop
    const w = p.predict().warnings.find((x) => x.kind === 'battery-draining');
    expect(w).toBeDefined();
    if (w?.kind === 'battery-draining') expect(w.dropPerMinute).toBeCloseTo(0.2, 5);
  });

  it('flags reduced-motion-likely once observed', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, prefersReducedMotion: true });
    expect(p.predict().warnings.some((w) => w.kind === 'reduced-motion-likely')).toBe(true);
  });

  it('flags tab-backgrounded for the latest snapshot', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, visibilityState: 'visible' });
    expect(p.predict().warnings.some((w) => w.kind === 'tab-backgrounded')).toBe(false);
    p.observe({ at: 2, visibilityState: 'hidden' });
    expect(p.predict().warnings.some((w) => w.kind === 'tab-backgrounded')).toBe(true);
  });

  it('predicts a degraded layer when warnings stack', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, currentLayer: 'R3F_IMMERSIVE', networkType: '4g', batteryLevel: 0.9 });
    p.observe({
      at: 2,
      currentLayer: 'R3F_IMMERSIVE',
      networkType: '3g',
      batteryLevel: 0.1,
      batteryCharging: false,
      prefersReducedMotion: true,
    });
    const r = p.predict();
    expect(r.lastObservedLayer).toBe('R3F_IMMERSIVE');
    // base ≈ R3F_IMMERSIVE (1) + warnings sum (3+) ⇒ clamped to TEXT_ONLY (5) or near it
    expect(['CSS_3D', 'CANVAS_2D', 'STATIC_HTML', 'TEXT_ONLY']).toContain(r.predictedLayer);
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('reset() clears history and EWMA state', () => {
    const p = new CapabilityPredictor();
    p.observe({ at: 1, currentLayer: 'R3F_IMMERSIVE' });
    p.reset();
    expect(p.predict().confidence).toBe(0);
    expect(p.predict().lastObservedLayer).toBeUndefined();
  });
});
