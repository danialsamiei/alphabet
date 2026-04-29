/**
 * @module privacy/budget
 * @description
 * PrivacyBudgetLedger — دفتر بودجه ε,δ برای یک فضای پرس‌وجو معین.
 *
 * A sealed, append-only ledger that tracks the cumulative
 * `(ε, δ)`-spend of every published differentially-private query.
 * Each `spend()` call validates the requested mechanism configuration,
 * adds it to the running total under *basic sequential composition*
 *
 *   ```
 *   ε_total = Σᵢ εᵢ      δ_total = Σᵢ δᵢ
 *   ```
 *
 * and refuses if the spend would exceed the configured cap.
 *
 * **Why "sealed".** Once an entry is recorded it cannot be amended or
 * removed. This is the privacy-engineering equivalent of a write-once
 * audit log: a privacy auditor can inspect the ledger and verify that
 * the published-data history is consistent with the operator's
 * promised cap.
 *
 * **Composition note.** Basic composition is conservative — for many
 * realistic workloads, advanced compositions (Rényi-DP, zCDP) yield
 * tighter bounds. Alphabet ships the conservative bound first because
 * it is impossible to *under*-charge the budget by accident, which is
 * the only direction that endangers visitors. Future releases may add
 * a pluggable `Accountant` that this ledger delegates to.
 */

import { type Result, ok, err, type AlphabetError } from '@alphabet/core';
import type { BudgetEntry, BudgetSnapshot, EpsilonDelta, NoiseConfig } from './types.js';

// ─── Options ─────────────────────────────────────────────────────────────────

/**
 * گزینه‌های ساخت `PrivacyBudgetLedger`.
 * Construction options for `PrivacyBudgetLedger`.
 */
export interface PrivacyBudgetLedgerOptions {
  /**
   * Hard cap on total `(ε, δ)` spend for this ledger. Both components
   * must be finite, non-negative, and `delta < 1`.
   */
  readonly cap: EpsilonDelta;
  /**
   * Optional clock — useful in tests. Defaults to `Date.now`.
   */
  readonly now?: () => number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateCap(cap: EpsilonDelta): AlphabetError | null {
  if (!Number.isFinite(cap.epsilon) || cap.epsilon < 0) {
    return {
      code: 'INVALID_BUDGET_CAP',
      message: 'Budget cap epsilon must be a finite, non-negative number.',
      details: { epsilon: cap.epsilon },
    };
  }
  if (!Number.isFinite(cap.delta) || cap.delta < 0 || cap.delta >= 1) {
    return {
      code: 'INVALID_BUDGET_CAP',
      message: 'Budget cap delta must be a finite number in [0, 1).',
      details: { delta: cap.delta },
    };
  }
  return null;
}

function validateSpendShape(
  query: string,
  mechanism: 'laplace' | 'gaussian',
  params: EpsilonDelta,
): AlphabetError | null {
  if (typeof query !== 'string' || query.length === 0) {
    return {
      code: 'INVALID_QUERY_LABEL',
      message: 'query label must be a non-empty string.',
    };
  }
  if (query.length > 256) {
    return {
      code: 'INVALID_QUERY_LABEL',
      message: 'query label must be ≤ 256 characters to avoid PII leakage.',
      details: { length: query.length },
    };
  }
  if (mechanism !== 'laplace' && mechanism !== 'gaussian') {
    return {
      code: 'UNKNOWN_MECHANISM',
      message: 'mechanism must be either "laplace" or "gaussian".',
      details: { mechanism },
    };
  }
  if (!Number.isFinite(params.epsilon) || params.epsilon < 0) {
    return {
      code: 'INVALID_EPSILON',
      message: 'spend epsilon must be a finite, non-negative number.',
      details: { epsilon: params.epsilon },
    };
  }
  if (!Number.isFinite(params.delta) || params.delta < 0 || params.delta >= 1) {
    return {
      code: 'INVALID_DELTA',
      message: 'spend delta must be a finite number in [0, 1).',
      details: { delta: params.delta },
    };
  }
  return null;
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

/**
 * یک دفتر بودجه ε,δ — تنها API شما برای spend کردن بودجه.
 * The privacy-budget ledger. *The* enforcement point for ε,δ-DP spend
 * across an Alphabet deployment.
 *
 * **Mutation rules.**
 *  - `spend(...)` is the *only* operation that can append an entry.
 *    A failed spend (invalid params, would exceed cap) does *not*
 *    record an entry — the cap itself is the audit boundary.
 *  - `entries()` returns a frozen, defensive copy. Callers cannot
 *    mutate the ledger by mutating the returned array.
 *  - The ledger has **no `reset()`** by design. A new policy period
 *    requires a brand-new ledger instance with a fresh cap.
 *
 * @example
 * const ledger = new PrivacyBudgetLedger({ cap: { epsilon: 1.0, delta: 1e-6 } });
 *
 * const r = ledger.spend('daily-pageviews', 'laplace', {
 *   sensitivity: 1,
 *   params: { epsilon: 0.1, delta: 0 },
 * });
 * if (!r.success) refuseToPublish(r.error);
 */
export class PrivacyBudgetLedger {
  readonly #cap: EpsilonDelta;
  readonly #entries: BudgetEntry[] = [];
  readonly #now: () => number;
  #spentEpsilon = 0;
  #spentDelta = 0;

  constructor(options: PrivacyBudgetLedgerOptions) {
    const capErr = validateCap(options.cap);
    if (capErr) {
      // Constructor is one of the rare places where throwing is the
      // right call: the ledger cannot exist with an invalid cap, and
      // every `spend()` would otherwise fail in the same way.
      const e = new Error(capErr.message);
      (e as Error & { code?: string }).code = capErr.code;
      throw e;
    }
    this.#cap = options.cap;
    this.#now = options.now ?? Date.now;
  }

  /**
   * تلاش برای ثبت یک spend — اگر از cap عبور کند، شکست برمی‌گردد.
   * Try to record a spend. Returns the new running totals on success;
   * returns `BUDGET_EXHAUSTED` on failure without modifying the ledger.
   */
  spend(
    query: string,
    mechanism: 'laplace' | 'gaussian',
    config: NoiseConfig,
  ): Result<BudgetSnapshot, AlphabetError> {
    const shapeErr = validateSpendShape(query, mechanism, config.params);
    if (shapeErr) return err(shapeErr);

    if (!Number.isFinite(config.sensitivity) || config.sensitivity < 0) {
      return err({
        code: 'INVALID_SENSITIVITY',
        message: 'sensitivity must be a finite, non-negative number.',
        details: { sensitivity: config.sensitivity },
      });
    }

    const nextEpsilon = this.#spentEpsilon + config.params.epsilon;
    const nextDelta = this.#spentDelta + config.params.delta;

    // Allow a tiny floating-point tolerance so successive spends that
    // *exactly* sum to the cap are not rejected by ULP noise.
    const ulpTolerance = 1e-12;
    if (nextEpsilon > this.#cap.epsilon + ulpTolerance) {
      return err({
        code: 'BUDGET_EXHAUSTED',
        message: 'Privacy budget would exceed cap on epsilon.',
        details: {
          requested: { epsilon: config.params.epsilon, delta: config.params.delta },
          spent: { epsilon: this.#spentEpsilon, delta: this.#spentDelta },
          cap: this.#cap,
        },
      });
    }
    if (nextDelta > this.#cap.delta + ulpTolerance) {
      return err({
        code: 'BUDGET_EXHAUSTED',
        message: 'Privacy budget would exceed cap on delta.',
        details: {
          requested: { epsilon: config.params.epsilon, delta: config.params.delta },
          spent: { epsilon: this.#spentEpsilon, delta: this.#spentDelta },
          cap: this.#cap,
        },
      });
    }

    const entry: BudgetEntry = Object.freeze({
      query,
      epsilon: config.params.epsilon,
      delta: config.params.delta,
      mechanism,
      timestampMs: this.#now(),
    });
    this.#entries.push(entry);
    this.#spentEpsilon = nextEpsilon;
    this.#spentDelta = nextDelta;
    return ok(this.snapshot());
  }

  /**
   * مقدار فعلی spent + remaining + entries را برمی‌گرداند.
   * Snapshot of the ledger. Safe to log: no PII is ever recorded.
   */
  snapshot(): BudgetSnapshot {
    const remainingEpsilon = Math.max(0, this.#cap.epsilon - this.#spentEpsilon);
    const remainingDelta = Math.max(0, this.#cap.delta - this.#spentDelta);
    return Object.freeze({
      cap: this.#cap,
      spent: { epsilon: this.#spentEpsilon, delta: this.#spentDelta },
      remaining: { epsilon: remainingEpsilon, delta: remainingDelta },
      entries: Object.freeze([...this.#entries]),
      exhausted: remainingEpsilon === 0 && remainingDelta === 0,
    });
  }

  /**
   * فهرست محافظت‌شده از ورودی‌ها.
   * Defensive copy of the entry list.
   */
  entries(): readonly BudgetEntry[] {
    return Object.freeze([...this.#entries]);
  }

  /**
   * بررسی بدون مصرف اینکه یک spend امکان‌پذیر است.
   * Read-only check: would this spend succeed without modifying the
   * ledger? Useful for UI affordances ("you can run this query") and
   * for batch planners.
   */
  canSpend(params: EpsilonDelta): boolean {
    if (!Number.isFinite(params.epsilon) || params.epsilon < 0) return false;
    if (!Number.isFinite(params.delta) || params.delta < 0 || params.delta >= 1) {
      return false;
    }
    const ulpTolerance = 1e-12;
    return (
      this.#spentEpsilon + params.epsilon <= this.#cap.epsilon + ulpTolerance &&
      this.#spentDelta + params.delta <= this.#cap.delta + ulpTolerance
    );
  }
}
