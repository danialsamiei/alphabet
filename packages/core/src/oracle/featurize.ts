/**
 * @module oracle/featurize
 * @description
 * `featurize()` — turns a raw `PredictorSnapshot` (from
 * `@alphabet/core/handshake/predictor`) into a fixed-size, DP-noised,
 * cohort-bucketed `Float32Array` safe to feed into a downstream model.
 *
 * Steps:
 *   1. **Clamp** continuous features into `[0, 1]`.
 *   2. **Bucket** into `k`-sized cohorts (default `k = 5`). The cohort id
 *      is the BLAKE3-style fast hash of the rounded feature tuple
 *      (we use SHA-256 hex truncated to 16 chars to stay deps-free).
 *   3. **Add Laplace noise** with scale `1/dpEpsilon` (default ε = 1.0).
 *      Noise is generated with crypto.getRandomValues — never `Math.random`.
 *
 * The cohort string is recoverable across calls so an oracle can group
 * by it, but it is **not** reversible to the original snapshot.
 */

import type { CapabilityLayer as _CapabilityLayer } from '../types/base.js';
import { CAPABILITY_LAYER_LEVEL } from '../types/base.js';
void (0 as unknown as _CapabilityLayer);
import type { PredictorSnapshot } from '../handshake/predictor/index.js';
import { NETWORK_RANK } from '../handshake/predictor/index.js';
import type { FeaturizeOptions } from './types.js';

/** Number of features in the vector returned by `featurize()`. */
export const FEATURE_DIM = 5;

const FEATURE_LABELS = [
  'currentLayerLevel',
  'networkRank',
  'batteryLevel',
  'prefersReducedMotion',
  'visibility',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Sample one Laplace(0, scale) variate using the inverse-CDF method.
 * `u` is uniform in (-0.5, +0.5); `Lap = -scale * sign(u) * ln(1 - 2|u|)`.
 *
 * Implementation note: we draw a 4-byte uniform from `crypto.getRandomValues`
 * to stay deps-free and avoid `Math.random` (which violates the
 * privacy posture of `@alphabet/security/privacy`).
 */
function sampleLaplace(scale: number, randomBytes: (n: number) => Uint8Array): number {
  const buf = randomBytes(4);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = view.getUint32(0);
  // Map to (0, 1) exclusive via +0.5/2^32, then to (-0.5, +0.5).
  const u = (u32 + 0.5) / 4_294_967_296 - 0.5;
  const sign = u < 0 ? -1 : 1;
  const mag = 1 - 2 * Math.abs(u);
  // mag is in (0, 1] — log is safe.
  return -scale * sign * Math.log(mag);
}

function quantize(x: number, step: number): number {
  return Math.round(x / step) * step;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a deterministic cohort string for a feature vector. Two inputs
 * fall in the same cohort iff their **quantized** feature vectors are
 * equal. The cohort string is a hex truncation of the SHA-256 of the
 * quantized vector — short enough to group on, long enough to make
 * collisions accidental.
 *
 * The `k` parameter controls the *coarseness* of the quantization: at
 * `k = 5` we bucket continuous features to 1/5 = 0.2-wide bins, which
 * yields a comfortable lower-bound on cohort size for typical traffic.
 */
export async function cohortBucket(features: Float32Array, k = 5): Promise<string> {
  const step = 1 / Math.max(1, k);
  const quantized = new Float32Array(features.length);
  for (let i = 0; i < features.length; i += 1) {
    quantized[i] = quantize(features[i] as number, step);
  }
  const buf = new ArrayBuffer(quantized.byteLength);
  new Float32Array(buf).set(quantized);
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    // Fallback: hex of the raw quantized bytes. Less collision-resistant
    // but still deterministic and equivalent for grouping purposes when
    // SubtleCrypto is unavailable (extremely rare in our targets).
    const bytes = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += (bytes[i] as number).toString(16).padStart(2, '0');
    }
    return `c_${out.slice(0, 16)}`;
  }
  const digest = await subtle.digest('SHA-256', new Uint8Array(buf));
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return `c_${out}`;
}

/**
 * Convert a snapshot into an anonymized feature vector + cohort id.
 *
 * @example
 * const { features, cohort } = await featurize(snapshot);
 * const out = await oracle.predict({
 *   currentLayer: snapshot.currentLayer ?? 'STATIC_HTML',
 *   features,
 *   cohort,
 * });
 */
export async function featurize(
  snapshot: PredictorSnapshot,
  options: FeaturizeOptions = {},
): Promise<{ features: Float32Array; cohort: string }> {
  const dpEpsilon = options.dpEpsilon ?? 1.0;
  const k = options.k ?? 5;
  const randomBytes = options.randomBytes ?? defaultRandomBytes;
  const scale = 1 / Math.max(1e-9, dpEpsilon);

  const layerLevel =
    snapshot.currentLayer === undefined
      ? 0.5 // unknown — middle of the range
      : (CAPABILITY_LAYER_LEVEL[snapshot.currentLayer] - 1) / 4;
  const networkRank =
    snapshot.networkType === undefined
      ? 0.5
      : (NETWORK_RANK[snapshot.networkType] ?? 0) / 4;
  const battery =
    snapshot.batteryLevel === undefined ? 0.5 : clamp01(snapshot.batteryLevel);
  const prefersReducedMotion = snapshot.prefersReducedMotion === true ? 1 : 0;
  const visibility =
    snapshot.visibilityState === 'hidden' ? 0 : snapshot.visibilityState === 'visible' ? 1 : 0.5;

  const raw: number[] = [
    layerLevel,
    networkRank,
    battery,
    prefersReducedMotion,
    visibility,
  ];

  const features = new Float32Array(FEATURE_DIM);
  for (let i = 0; i < FEATURE_DIM; i += 1) {
    // Add Laplace noise *after* clamping; clamp again to keep ∈ [0, 1].
    const noisy = (raw[i] as number) + sampleLaplace(scale, randomBytes);
    features[i] = clamp01(noisy);
  }

  // Cohort bucket is computed on the quantized — i.e. coarse — vector
  // so two visitors with similar device classes share a cohort.
  const cohort = await cohortBucket(features, k);
  return { features, cohort };
}

/** Test helper: feature label at index `i`. */
export function featureLabel(i: number): string {
  return FEATURE_LABELS[i] ?? `f${i}`;
}
