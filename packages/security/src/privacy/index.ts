/**
 * @module @alphabet/security/privacy
 * @description
 * Differential-privacy primitives for Alphabet — additive subpath.
 *
 * `@alphabet/security/privacy` ships:
 *  - **Cryptographic randomness** — `sampleUniformUnitInterval`,
 *    `sampleStandardNormal`, `sampleLaplace` (Web Crypto only;
 *    `Math.random` is intentionally not used).
 *  - **Laplace mechanism** for pure ε-DP queries (counts, sums, means).
 *  - **Gaussian mechanism** for `(ε, δ)`-DP queries with ε ∈ (0, 1].
 *  - **k-anonymity gate** as a pre-DP cohort-size check.
 *  - **`PrivacyBudgetLedger`** — sealed, append-only, monotonic
 *    `(ε, δ)` accountant under basic sequential composition.
 *
 * **What this is not.** This subpath is *primitives*. Higher-level
 * publish flows ("daily anonymous-pageview report", "Tier-3 vector
 * recall") will be wired in later weeks of the bold roadmap and will
 * import from here.
 *
 * **Backward compatibility.** This subpath is purely additive. It is
 * exported only via `@alphabet/security/privacy`; the package root
 * `@alphabet/security` is unchanged.
 */

export type {
  EpsilonDelta,
  NoiseConfig,
  NoisedValue,
  BudgetEntry,
  BudgetSnapshot,
} from './types.js';

export {
  sampleUniformUnitInterval,
  sampleStandardNormal,
  sampleLaplace,
} from './random.js';

export { applyLaplaceMechanism, computeLaplaceScale } from './laplace.js';
export { applyGaussianMechanism, computeGaussianStdDev } from './gaussian.js';
export { kAnonymityGate } from './k-anonymity.js';
export type { KAnonymityPass } from './k-anonymity.js';
export { PrivacyBudgetLedger } from './budget.js';
export type { PrivacyBudgetLedgerOptions } from './budget.js';
