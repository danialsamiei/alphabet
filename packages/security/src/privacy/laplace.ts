/**
 * @module privacy/laplace
 * @description
 * Laplace mechanism — مکانیزم نویز لاپلاس برای ε-DP خالص.
 *
 * Implements the classical Laplace mechanism for *pure* ε-differential
 * privacy:
 *
 *   ```
 *   M(D) = f(D) + Lap(Δf / ε)
 *   ```
 *
 * where `Δf` is the L1 sensitivity of the query and `ε > 0` is the
 * privacy-loss budget. The mechanism guarantees ε-DP for any query that
 * truly has L1 sensitivity ≤ `Δf`. Estimating `Δf` correctly is the
 * caller's responsibility.
 *
 * **Why this is privacy-bold.** Pairing this primitive with the sealed
 * `PrivacyBudgetLedger` makes Alphabet the only privacy-first web SDK
 * that *enforces* its noise schedule in code: a query whose ε-spend
 * would exceed the budget cap is refused with `BUDGET_EXHAUSTED`,
 * rather than silently allowed.
 */

import { type Result, ok, err, type AlphabetError } from '@alphabet/core';
import type { NoiseConfig, NoisedValue } from './types.js';
import { sampleLaplace } from './random.js';

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(config: NoiseConfig): AlphabetError | null {
  if (!Number.isFinite(config.sensitivity) || config.sensitivity < 0) {
    return {
      code: 'INVALID_SENSITIVITY',
      message: 'sensitivity must be a finite, non-negative number.',
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
  if (
    !Number.isFinite(config.params.delta) ||
    config.params.delta < 0 ||
    config.params.delta >= 1
  ) {
    return {
      code: 'INVALID_DELTA',
      message: 'delta must be a finite number in [0, 1).',
      details: { delta: config.params.delta },
    };
  }
  return null;
}

// ─── Mechanism ───────────────────────────────────────────────────────────────

/**
 * اعمال مکانیزم Laplace روی یک مقدار اسکالر.
 * Apply the Laplace mechanism to a scalar query result.
 *
 * @param value — the (true) query result `f(D)`. Must be a finite number.
 * @param config — sensitivity + ε,δ. The Laplace mechanism ignores `δ`,
 *   but it is part of the shared `NoiseConfig` shape and is therefore
 *   still validated for consistency.
 * @returns A noised scalar plus the noise sample, for auditability.
 *
 * @example
 * const r = applyLaplaceMechanism(42, { sensitivity: 1, params: { epsilon: 1.0, delta: 0 } });
 * if (r.success) {
 *   console.log(r.data.value); // ≈ 42 ± O(1)
 * }
 */
export function applyLaplaceMechanism(
  value: number,
  config: NoiseConfig,
): Result<NoisedValue, AlphabetError> {
  if (!Number.isFinite(value)) {
    return err({
      code: 'INVALID_VALUE',
      message: 'Laplace mechanism requires a finite scalar input.',
      details: { value },
    });
  }
  const cfgErr = validateConfig(config);
  if (cfgErr) return err(cfgErr);

  const scale = config.sensitivity / config.params.epsilon;
  if (scale === 0) {
    // Sensitivity is zero — the query does not depend on any individual,
    // so adding noise is unnecessary. We record `noise = 0` and return
    // the original value; callers that pair this with the
    // `PrivacyBudgetLedger` should still record a spend of 0 so the
    // ledger's history reflects every published query.
    return ok({ value, noise: 0, mechanism: 'laplace' });
  }

  const noiseRes = sampleLaplace(scale);
  if (!noiseRes.success) return noiseRes;
  return ok({
    value: value + noiseRes.data,
    noise: noiseRes.data,
    mechanism: 'laplace',
  });
}

/**
 * مقیاس Laplace `b = Δf / ε` را برای پیکربندی داده شده محاسبه می‌کند.
 * Compute the Laplace scale `b = Δf / ε` for a given configuration.
 * Useful for callers that want to display the noise scale to operators
 * or use it for sanity checks before publishing.
 */
export function computeLaplaceScale(config: NoiseConfig): Result<number, AlphabetError> {
  const cfgErr = validateConfig(config);
  if (cfgErr) return err(cfgErr);
  return ok(config.sensitivity / config.params.epsilon);
}
