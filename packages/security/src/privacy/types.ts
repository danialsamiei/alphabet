/**
 * @module privacy/types
 * @description
 * Differential-privacy primitive types — مدل‌های پایه برای ε,δ، حساسیت پرس‌وجو،
 * و مکانیزم‌های نویز.
 *
 * Foundation types for the differential-privacy primitives shipped under
 * `@alphabet/security/privacy`. Kept dependency-free and runtime-agnostic
 * so that browser, edge, and Node consumers share the exact same shapes.
 *
 * **Scope.** These are *building blocks*. The package does not pretend to
 * solve every privacy problem — it gives Alphabet operators the
 * vocabulary and the noise mechanisms needed to *prove*, not just claim,
 * that an aggregate publish does not leak any individual visitor.
 */

// ─── ε,δ pair ────────────────────────────────────────────────────────────────

/**
 * یک پارامتر ε,δ برای تضمین تفاضلی.
 * An (ε, δ)-DP parameter pair.
 *
 * - `epsilon` (≥ 0): the privacy-loss bound. Smaller is more private.
 *   Typical research-grade values are in `[0.1, 1.0]`. Values above `~5`
 *   provide essentially no privacy and are rejected by the budget ledger.
 * - `delta` (∈ `[0, 1)`): the failure probability of the (ε, δ)-DP
 *   guarantee. Must be much smaller than `1/N` where `N` is the cohort
 *   size. Pure ε-DP is the special case `delta === 0`.
 */
export interface EpsilonDelta {
  readonly epsilon: number;
  readonly delta: number;
}

// ─── Noise mechanism configuration ───────────────────────────────────────────

/**
 * پیکربندی مشترک برای مکانیزم‌های نویز.
 * Shared configuration for the noise mechanisms.
 *
 * `sensitivity` is the L1 (Laplace) or L2 (Gaussian) sensitivity of the
 * underlying query — the maximum amount the query result can change when
 * a single visitor is added or removed. Estimating sensitivity correctly
 * is the operator's responsibility; the SDK refuses negative or `NaN`
 * sensitivities.
 */
export interface NoiseConfig {
  /** Query sensitivity (Δf). Must be a finite number ≥ 0. */
  readonly sensitivity: number;
  /** ε,δ parameter pair. */
  readonly params: EpsilonDelta;
}

// ─── Budget ledger ───────────────────────────────────────────────────────────

/**
 * یک ورودی در دفتر بودجه حریم خصوصی.
 * A single line item in the privacy-budget ledger.
 *
 * Entries are append-only. They never expose PII — only the abstract
 * label of the query, the spent (ε, δ), and a millisecond timestamp.
 */
export interface BudgetEntry {
  /** نام انتزاعی پرس‌وجو (e.g. `"daily-pageviews"`). No PII. */
  readonly query: string;
  /** ε spent by this query. */
  readonly epsilon: number;
  /** δ spent by this query. */
  readonly delta: number;
  /** Mechanism used: `'laplace'` | `'gaussian'`. */
  readonly mechanism: 'laplace' | 'gaussian';
  /** UNIX millisecond timestamp at which the spend was recorded. */
  readonly timestampMs: number;
}

/**
 * Snapshot عمومی از دفتر بودجه.
 * Public snapshot of the privacy-budget ledger. Returned by
 * `PrivacyBudgetLedger.snapshot()`. Designed to be safe to log.
 */
export interface BudgetSnapshot {
  readonly cap: EpsilonDelta;
  readonly spent: EpsilonDelta;
  readonly remaining: EpsilonDelta;
  readonly entries: readonly BudgetEntry[];
  readonly exhausted: boolean;
}

// ─── Result helpers ──────────────────────────────────────────────────────────

/**
 * یک خروجی نویزی همراه با نویز افزوده شده — برای رصد و ممیزی.
 * A noised query output, alongside the absolute amount of noise added —
 * exposed for auditing only. Never log the noise alongside the original
 * unnoised value: doing so cancels the privacy guarantee.
 */
export interface NoisedValue {
  readonly value: number;
  /** The signed noise sample that was added. */
  readonly noise: number;
  /** The mechanism that produced this sample. */
  readonly mechanism: 'laplace' | 'gaussian';
}
