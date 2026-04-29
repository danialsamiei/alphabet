/**
 * @file heuristic.test.ts
 */

import { describe, it, expect } from 'vitest';
import { HeuristicOracle } from './heuristic.js';
import { featurize } from './featurize.js';
import type { PredictorSnapshot } from '../handshake/predictor/index.js';

describe('HeuristicOracle', () => {
  it('has a stable id', () => {
    const o = new HeuristicOracle();
    expect(o.id).toBe('heuristic@v1');
  });

  it('produces a CapabilityLayer prediction', async () => {
    const snap: PredictorSnapshot = {
      at: 0,
      currentLayer: 'CSS_3D',
      networkType: '4g',
      batteryLevel: 0.8,
      prefersReducedMotion: false,
      visibilityState: 'visible',
    };
    const { features, cohort } = await featurize(snap);
    const o = new HeuristicOracle();
    const out = await o.predict({
      currentLayer: 'CSS_3D',
      features,
      cohort,
    });
    expect(out.predictedLayer).toMatch(/^[A-Z_0-9]+$/);
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });

  it('forwards predictor warnings as plain strings', async () => {
    const snap: PredictorSnapshot = {
      at: 0,
      currentLayer: 'R3F_IMMERSIVE',
      networkType: 'slow-2g',
      batteryLevel: 0.05,
      prefersReducedMotion: true,
      visibilityState: 'hidden',
    };
    const { features, cohort } = await featurize(snap, { dpEpsilon: 8 });
    const o = new HeuristicOracle();
    const out = await o.predict({
      currentLayer: 'R3F_IMMERSIVE',
      features,
      cohort,
    });
    expect(Array.isArray(out.warnings)).toBe(true);
    for (const w of out.warnings) expect(typeof w).toBe('string');
  });
});
