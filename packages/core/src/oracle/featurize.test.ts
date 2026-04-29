/**
 * @file featurize.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  featurize,
  cohortBucket,
  FEATURE_DIM,
  featureLabel,
} from './featurize.js';
import type { PredictorSnapshot } from '../handshake/predictor/index.js';

const baseSnap: PredictorSnapshot = {
  at: 0,
  currentLayer: 'CSS_3D',
  networkType: '4g',
  batteryLevel: 0.7,
  prefersReducedMotion: false,
  visibilityState: 'visible',
};

// Deterministic random source for noise reproducibility.
function detRandomBytes(seed: number): (n: number) => Uint8Array {
  let s = seed >>> 0;
  return (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      s = (s * 1_664_525 + 1_013_904_223) >>> 0;
      out[i] = s & 0xff;
    }
    return out;
  };
}

describe('featurize / shape', () => {
  it('returns a Float32Array of length FEATURE_DIM', async () => {
    const { features } = await featurize(baseSnap, {
      randomBytes: detRandomBytes(1),
    });
    expect(FEATURE_DIM).toBe(5);
    expect(features.length).toBe(FEATURE_DIM);
    for (const v of features) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('returns a non-empty cohort id', async () => {
    const { cohort } = await featurize(baseSnap, {
      randomBytes: detRandomBytes(1),
    });
    expect(cohort).toMatch(/^c_[0-9a-f]+$/);
  });

  it('featureLabel returns the documented order', () => {
    expect(featureLabel(0)).toBe('currentLayerLevel');
    expect(featureLabel(4)).toBe('visibility');
    expect(featureLabel(99)).toBe('f99');
  });
});

describe('featurize / DP noise', () => {
  it('two calls with the same seed produce identical features', async () => {
    const a = await featurize(baseSnap, { randomBytes: detRandomBytes(7) });
    const b = await featurize(baseSnap, { randomBytes: detRandomBytes(7) });
    for (let i = 0; i < FEATURE_DIM; i += 1) {
      expect(a.features[i]).toBeCloseTo(b.features[i] as number, 5);
    }
  });

  it('different seeds shift features (proving noise was added)', async () => {
    const a = await featurize(baseSnap, { randomBytes: detRandomBytes(1) });
    const b = await featurize(baseSnap, { randomBytes: detRandomBytes(2) });
    let diffs = 0;
    for (let i = 0; i < FEATURE_DIM; i += 1) {
      if (Math.abs((a.features[i] as number) - (b.features[i] as number)) > 1e-6) diffs += 1;
    }
    expect(diffs).toBeGreaterThan(0);
  });

  it('larger ε ⇒ smaller average noise across many samples', async () => {
    function magnitude(eps: number): number {
      let total = 0;
      for (let s = 1; s <= 32; s += 1) {
        const rb = detRandomBytes(s);
        // Snapshot with no info → "raw" value is 0.5 for everything.
        // Noise is detectable as the deviation from 0.5.
        const blank: PredictorSnapshot = { at: 0 };
        // Synchronously run featurize (it's async because of digest, but
        // we just await one at a time).
        // Note: this loop is fine for 32 samples in a unit test.
        // We sum first feature only; behaviour is identical across dims.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // (kept as plain await to avoid promise overhead concerns)
        // eslint-disable-next-line no-await-in-loop
        // @ts-ignore — top-level await not allowed inside nested func
        // eslint-disable-next-line no-restricted-syntax
        // (we use Promise.then to avoid await-in-loop lint complaints)
        // simpler: inline await
        // (we are inside an async test, but `magnitude` itself is sync;
        // refactor below.)
        // -------- end lint chatter ----------
        void blank;
        void rb;
        // sentinel: replaced by async impl below
      }
      return total;
    }
    void magnitude;
    async function avgAbsDev(eps: number, samples: number): Promise<number> {
      let total = 0;
      for (let s = 1; s <= samples; s += 1) {
        const blank: PredictorSnapshot = { at: 0 };
        const r = await featurize(blank, {
          dpEpsilon: eps,
          randomBytes: detRandomBytes(s),
        });
        total += Math.abs((r.features[0] as number) - 0.5);
      }
      return total / samples;
    }
    const lo = await avgAbsDev(0.5, 32);
    const hi = await avgAbsDev(8.0, 32);
    // Stronger ε ⇒ smaller noise on average.
    expect(hi).toBeLessThan(lo);
  });
});

describe('cohortBucket / k-anonymity grouping', () => {
  it('quantization buckets two close vectors into the same cohort', async () => {
    const a = new Float32Array([0.21, 0.0, 0.0, 0.0, 0.0]);
    const b = new Float32Array([0.19, 0.0, 0.0, 0.0, 0.0]); // both round to 0.2 at k=5
    const ca = await cohortBucket(a, 5);
    const cb = await cohortBucket(b, 5);
    expect(ca).toBe(cb);
  });

  it('different vectors map to different cohorts', async () => {
    const a = new Float32Array([0.1, 0.0, 0.0, 0.0, 0.0]);
    const b = new Float32Array([0.9, 0.0, 0.0, 0.0, 0.0]);
    const ca = await cohortBucket(a, 5);
    const cb = await cohortBucket(b, 5);
    expect(ca).not.toBe(cb);
  });
});
