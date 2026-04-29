/**
 * @module privacy/k-anonymity
 * @description
 * k-Anonymity gate — یک نگهبان ساده پیش از انتشار آمار aggregative.
 *
 * Returns success only if a cohort is at least `k` visitors large.
 * k-anonymity is *not* a substitute for differential privacy — it is a
 * cheap, easy-to-explain, pre-DP gate that filters out queries which
 * are obviously too small to even consider noising.
 *
 * The default threshold matches the rest of the codebase
 * (`DEFAULT_K_ANONYMITY_THRESHOLD === 5`, exported by `@alphabet/core`).
 *
 * **Why both k-anon *and* DP?** k-anonymity blocks the worst-case
 * "cohort of one" before any noise is sampled, saving privacy budget.
 * Differential privacy then provides a *mathematical* guarantee on the
 * remaining cohorts. Together they implement the privacy-engineering
 * principle of *layered defence*.
 */

import {
  type Result,
  ok,
  err,
  type AlphabetError,
  DEFAULT_K_ANONYMITY_THRESHOLD,
} from '@alphabet/core';

/**
 * نتیجه عبور موفق از دروازه k-anonymity.
 * Result returned by `kAnonymityGate` on success — both the cohort size
 * and the threshold that was applied are echoed back so audit logs can
 * record exactly which threshold was in force at decision time.
 */
export interface KAnonymityPass {
  readonly cohortSize: number;
  readonly threshold: number;
}

/**
 * بررسی اینکه یک گروه (cohort) حداقل به اندازه k است.
 * Refuse the query unless the cohort size meets the k-anonymity
 * threshold. Returns a structured `Result` (never throws) so the
 * decision can be plugged directly into the rest of the Alphabet
 * privacy stack.
 *
 * @param cohortSize — the size of the cohort about to be released.
 * @param threshold — minimum cohort size; defaults to
 *   `DEFAULT_K_ANONYMITY_THRESHOLD` (5).
 *
 * @example
 * const gate = kAnonymityGate(visitors.length);
 * if (!gate.success) return reject(gate.error);
 *
 * // Now safe to apply Laplace / Gaussian mechanism on top.
 */
export function kAnonymityGate(
  cohortSize: number,
  threshold: number = DEFAULT_K_ANONYMITY_THRESHOLD,
): Result<KAnonymityPass, AlphabetError> {
  if (!Number.isFinite(cohortSize) || cohortSize < 0 || !Number.isInteger(cohortSize)) {
    return err({
      code: 'INVALID_COHORT_SIZE',
      message: 'cohortSize must be a non-negative integer.',
      details: { cohortSize },
    });
  }
  if (!Number.isFinite(threshold) || threshold < 1 || !Number.isInteger(threshold)) {
    return err({
      code: 'INVALID_K_THRESHOLD',
      message: 'k-anonymity threshold must be a positive integer.',
      details: { threshold },
    });
  }
  if (cohortSize < threshold) {
    return err({
      code: 'K_ANONYMITY_VIOLATED',
      message:
        `Cohort size ${cohortSize} is below the k-anonymity threshold ${threshold}; ` +
        'aggregate publish refused.',
      details: { cohortSize, threshold },
    });
  }
  return ok({ cohortSize, threshold });
}
