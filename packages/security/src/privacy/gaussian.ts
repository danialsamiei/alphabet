/**
 * @module privacy/gaussian
 * @description
 * Gaussian mechanism — مکانیزم نویز نرمال برای (ε, δ)-DP تقریبی.
 *
 * Implements the classical Gaussian mechanism for approximate
 * `(ε, δ)`-DP:
 *
 *   ```
 *   M(D) = f(D) + N(0, σ²)
 *   σ ≥ Δ₂f · √(2 · ln(1.25 / δ)) / ε     for ε ∈ (0, 1]
 *   ```
 *
 * where `Δ₂f` is the **L2** sensitivity of the query (Laplace uses L1).
 * For ε > 1 the simple closed form above is no longer tight; this
 * implementation rejects ε > 1 with `EPSILON_OUT_OF_RANGE` to avoid
 * silently shipping a weaker guarantee than the API name implies.
 * Callers who need ε > 1 should compose multiple ε ≤ 1 queries via the
 * `PrivacyBudgetLedger`.
 *
 * **Why this matters.** The Gaussian mechanism is the foundation for
 * advanced compositions (Rényi-DP, zero-concentrated DP). Shipping a
 * conservative, well-validated baseline today lets future Alphabet
 * releases plug into more advanced accountants without breaking the
 * public API.
 */

import { type Result, ok, err, type AlphabetError } from '@alphabet/core';
import type { NoiseConfig, NoisedValue } from './types.js';
import { sampleStandardNormal } from './random.js';

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(config: NoiseConfig): AlphabetError | null {
  if (!Number.isFinite(config.sensitivity) || config.sensitivity < 0) {
    return {
      code: 'INVALID_SENSITIVITY',
      message: 'sensitivity (L2) must be a finite, non-negative number.',
      details: { sensitivity: config.sensitivity },
    };
  }
  if (!Number.isFinite(config.params.epsilon) || config.params.epsilon <= 0) {
    return {
      code: 'INVALID_EPSILON',
      message: 'epsilon must be a finite, strictly positive number.',
      details: { epsilon: config.params.epsilon },
    };
  }
  if (config.params.epsilon > 1) {
    return {
      code: 'EPSILON_OUT_OF_RANGE',
      message:
        'The classical Gaussian mechanism is only tight for epsilon in (0, 1]. ' +
        'Compose smaller-ε queries via PrivacyBudgetLedger instead.',
      details: { epsilon: config.params.epsilon },
    };
  }
  if (
    !Number.isFinite(config.params.delta) ||
    config.params.delta <= 0 ||
    config.params.delta >= 1
  ) {
    return {
      code: 'INVALID_DELTA',
      message:
        'Gaussian mechanism requires a strictly positive delta in (0, 1). ' +
        'For pure ε-DP use the Laplace mechanism instead.',
      details: { delta: config.params.delta },
    };
  }
  return null;
}

// ─── Mechanism ───────────────────────────────────────────────────────────────

/**
 * انحراف معیار نویز را برای پیکربندی داده شده محاسبه می‌کند.
 * Compute the standard deviation `σ` of the Gaussian noise required to
 * satisfy `(ε, δ)`-DP for a query of L2 sensitivity `Δ₂f`.
 */
export function computeGaussianStdDev(config: NoiseConfig): Result<number, AlphabetError> {
  const cfgErr = validateConfig(config);
  if (cfgErr) return err(cfgErr);
  if (config.sensitivity === 0) return ok(0);
  const sigma =
    (config.sensitivity * Math.sqrt(2 * Math.log(1.25 / config.params.delta))) /
    config.params.epsilon;
  return ok(sigma);
}

/**
 * اعمال مکانیزم Gaussian روی یک مقدار اسکالر.
 * Apply the Gaussian mechanism to a scalar query result.
 *
 * @param value — the (true) query result `f(D)`. Must be a finite number.
 * @param config — L2 sensitivity + (ε, δ).
 *
 * @example
 * const r = applyGaussianMechanism(123, {
 *   sensitivity: 1,
 *   params: { epsilon: 0.5, delta: 1e-6 },
 * });
 * if (r.success) console.log(r.data.value);
 */
export function applyGaussianMechanism(
  value: number,
  config: NoiseConfig,
): Result<NoisedValue, AlphabetError> {
  if (!Number.isFinite(value)) {
    return err({
      code: 'INVALID_VALUE',
      message: 'Gaussian mechanism requires a finite scalar input.',
      details: { value },
    });
  }
  const sigmaRes = computeGaussianStdDev(config);
  if (!sigmaRes.success) return sigmaRes;
  if (sigmaRes.data === 0) {
    return ok({ value, noise: 0, mechanism: 'gaussian' });
  }
  const zRes = sampleStandardNormal();
  if (!zRes.success) return zRes;
  const noise = zRes.data * sigmaRes.data;
  return ok({ value: value + noise, noise, mechanism: 'gaussian' });
}
