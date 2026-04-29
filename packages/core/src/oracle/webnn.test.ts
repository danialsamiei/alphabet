/**
 * @file webnn.test.ts
 */

import { describe, it, expect } from 'vitest';
import { WebNNOracle } from './webnn.js';
import { featurize } from './featurize.js';
import type { OracleModelProvider } from './types.js';
import type { PredictorSnapshot } from '../handshake/predictor/index.js';

const goodSnap: PredictorSnapshot = {
  at: 0,
  currentLayer: 'CSS_3D',
  networkType: '4g',
  batteryLevel: 0.8,
  prefersReducedMotion: false,
  visibilityState: 'visible',
};

async function input(snap = goodSnap) {
  const f = await featurize(snap, { dpEpsilon: 8 });
  return {
    currentLayer: snap.currentLayer ?? 'STATIC_HTML' as const,
    features: f.features,
    cohort: f.cohort,
  };
}

describe('WebNNOracle / availability', () => {
  it('reports unavailable when navigator.ml is missing', () => {
    const o = new WebNNOracle({ navigator: {} });
    expect(o.isAvailable()).toBe(false);
  });

  it('reports unavailable when no model provider was supplied', () => {
    const o = new WebNNOracle({ navigator: { ml: {} } });
    expect(o.isAvailable()).toBe(false);
  });

  it('reports available when both are present', () => {
    const provider: OracleModelProvider = {
      id: 'test',
      infer: async () => new Float32Array([1, 0, 0, 0, 0]),
    };
    const o = new WebNNOracle({ navigator: { ml: {} }, modelProvider: provider });
    expect(o.isAvailable()).toBe(true);
  });
});

describe('WebNNOracle / fallback path', () => {
  it('falls back to heuristic with a "webnn-unavailable" warning when WebNN is absent', async () => {
    const o = new WebNNOracle({ navigator: {} });
    const out = await o.predict(await input());
    expect(out.warnings).toContain('webnn-unavailable');
  });

  it('falls back to heuristic with a "model-failed" warning when inference returns undefined', async () => {
    const provider: OracleModelProvider = {
      id: 'broken',
      infer: async () => undefined,
    };
    const o = new WebNNOracle({ navigator: { ml: {} }, modelProvider: provider });
    const out = await o.predict(await input());
    expect(out.warnings).toContain('model-failed');
  });

  it('falls back when inference throws', async () => {
    const provider: OracleModelProvider = {
      id: 'angry',
      infer: async () => {
        throw new Error('boom');
      },
    };
    const o = new WebNNOracle({ navigator: { ml: {} }, modelProvider: provider });
    const out = await o.predict(await input());
    expect(out.warnings).toContain('model-failed');
  });

  it('falls back when distribution length is wrong', async () => {
    const provider: OracleModelProvider = {
      id: 'wrong-shape',
      infer: async () => new Float32Array([0.5, 0.5]),
    };
    const o = new WebNNOracle({ navigator: { ml: {} }, modelProvider: provider });
    const out = await o.predict(await input());
    expect(out.warnings).toContain('model-failed');
  });
});

describe('WebNNOracle / inference path', () => {
  it('returns argmax layer with normalized confidence on a valid distribution', async () => {
    const provider: OracleModelProvider = {
      id: 'forces-canvas',
      // ['R3F_IMMERSIVE', 'CSS_3D', 'CANVAS_2D', 'STATIC_HTML', 'TEXT_ONLY']
      infer: async () => new Float32Array([0.1, 0.1, 0.7, 0.05, 0.05]),
    };
    const o = new WebNNOracle({ navigator: { ml: {} }, modelProvider: provider });
    const out = await o.predict(await input());
    expect(out.predictedLayer).toBe('CANVAS_2D');
    expect(out.confidence).toBeCloseTo(0.7, 5);
    expect(out.warnings).toEqual([]);
  });
});
