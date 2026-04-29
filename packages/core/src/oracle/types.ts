/**
 * @module oracle/types
 */

import type { CapabilityLayer } from '../types/base.js';

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Anonymized feature vector + metadata supplied to an oracle.
 * `features` is always a fixed-size `Float32Array` (length = `FEATURE_DIM`).
 */
export interface OracleInput {
  readonly currentLayer: CapabilityLayer;
  readonly features: Float32Array;
  /** Cohort bucket id — recoverable for analytics, not for re-identification. */
  readonly cohort: string;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

/**
 * Forecast produced by the oracle. `confidence` is in [0, 1]; `warnings`
 * is a free-form set of short strings (e.g. `'battery-low'`, `'webnn-unavailable'`).
 */
export interface OracleOutput {
  readonly predictedLayer: CapabilityLayer;
  readonly confidence: number;
  readonly warnings: readonly string[];
}

// ─── Oracle interface ────────────────────────────────────────────────────────

export interface CapabilityOracle {
  /** Stable identifier (e.g. `'heuristic@v1'`). */
  readonly id: string;
  /** Make a single prediction. Always async (model loading may be lazy). */
  predict(input: OracleInput): Promise<OracleOutput>;
}

// ─── Model provider (consumer-supplied for WebNNOracle) ──────────────────────

/**
 * Caller-supplied loader for an inference model. Returning `undefined`
 * means "not available — fall back to heuristic". The contract is
 * deliberately tiny so consumers can ship ONNX, WebNN graph, TF.js Lite,
 * or any other inference backend without changing the oracle.
 */
export interface OracleModelProvider {
  readonly id: string;
  /**
   * Run inference on the (already anonymized) feature vector. The output
   * is a probability distribution over `CapabilityLayer` values, in the
   * canonical order returned by `CAPABILITY_LAYER_ORDER`.
   */
  infer(features: Float32Array): Promise<Float32Array | undefined>;
}

// ─── Featurization options ───────────────────────────────────────────────────

export interface FeaturizeOptions {
  /** Cohort size lower bound (k-anonymity). Default 5. */
  readonly k?: number;
  /** Differential privacy ε for continuous features. Default 1.0. */
  readonly dpEpsilon?: number;
  /** Override `crypto.getRandomValues` (testing only). */
  readonly randomBytes?: (n: number) => Uint8Array;
}
