/**
 * @module oracle
 * @description
 * **Capability Oracle** — a contract for forecasting which UI capability
 * layer a visitor will tolerate next render, with two reference
 * implementations:
 *
 *   1. `HeuristicOracle` — wraps the existing `CapabilityPredictor`
 *      (EWMA + signal heuristics). This is what `@alphabet/core` ships
 *      with; it is the **honest baseline** — no model, no network calls.
 *
 *   2. `WebNNOracle` — a contract that feature-detects `navigator.ml`
 *      (the WebNN spec entry point) and falls back to the heuristic when
 *      absent. The oracle accepts a caller-supplied `OracleModelProvider`
 *      so we never bundle ONNX runtime weights into `@alphabet/core`.
 *
 * **What this is NOT.** This module does **not** ship a trained model,
 * an ONNX runtime, or WebNN polyfills. Real on-device inference is
 * deferred to the out-of-tree `@alphabet/oracle-model` package (PR-B):
 * shipping a "predictive capability forecaster" without a model would
 * be a stub labelled as production code, which we will not do.
 *
 * **Privacy boundary.** The oracle never receives raw signal objects
 * directly. Inputs are passed through `featurize()` first, which:
 *   - clamps continuous features into bounded ranges,
 *   - cohort-buckets via `cohortBucket(features, k)` (k ≥ 5 by default),
 *   - adds Laplace noise calibrated by `dpEpsilon` (default ε = 1.0).
 *
 * The result is a 5-element `Float32Array` that is safe to feed into a
 * downstream model without ever exposing the visitor.
 */

export type {
  CapabilityOracle,
  OracleInput,
  OracleOutput,
  OracleModelProvider,
  FeaturizeOptions,
} from './types.js';

export { featurize, cohortBucket, FEATURE_DIM } from './featurize.js';
export { HeuristicOracle, type HeuristicOracleOptions } from './heuristic.js';
export { WebNNOracle, type WebNNOracleOptions } from './webnn.js';
