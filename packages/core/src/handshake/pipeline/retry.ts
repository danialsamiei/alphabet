/**
 * @module handshake/pipeline/retry
 * @description
 * Retry policy with **decorrelated jitter** (Marc Brooker / AWS architecture
 * blog), shaped for `Step<I, O>`. Pure, dependency-free, edge-safe.
 *
 * The decorrelated-jitter algorithm avoids thundering-herd retries that
 * plain exponential backoff produces:
 *
 *   sleep_n = min(cap, randomBetween(base, sleep_{n-1} * 3))
 *
 * Cancellation is honored at every wait via `AbortSignal`. If the signal
 * fires mid-wait the retry loop returns a `RETRY_ABORTED` AWAFError.
 */

import { type AWAFError, type Result, err, ok } from '../../types/result.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** گزینه‌های withRetry — همه عددها بر حسب میلی‌ثانیه. */
export interface RetryOptions {
  /** بیشینهٔ تعداد تلاش‌های اضافه (پس از تلاش اولیه) — پیش‌فرض 3 */
  readonly maxAttempts?: number;
  /** کف انتظار بین تلاش‌ها (ms) — پیش‌فرض 50 */
  readonly baseDelayMs?: number;
  /** سقف انتظار بین تلاش‌ها (ms) — پیش‌فرض 5000 */
  readonly maxDelayMs?: number;
  /** signal اختیاری برای لغو سریع */
  readonly signal?: AbortSignal;
  /** RNG قابل تعویض (برای deterministic tests) — پیش‌فرض Math.random */
  readonly random?: () => number;
  /** تابع sleep قابل تعویض (ms) — پیش‌فرض setTimeout */
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /**
   * گزارش‌گر تلاش‌ها — برای tracing. PII-free responsibility on caller.
   * Called *after* each completed attempt (success or failure) and *before*
   * the next sleep.
   */
  readonly onAttempt?: (info: AttemptInfo) => void;
  /**
   * تشخیص اینکه آیا یک خطا قابل retry است. پیش‌فرض: همه خطاها retryable.
   * Caller can short-circuit on permanent errors (e.g. validation).
   */
  readonly isRetryable?: (error: AWAFError) => boolean;
}

/** اطلاعات یک تلاش پایان‌یافته. */
export interface AttemptInfo {
  readonly attempt: number; // 1-based
  readonly outcome: 'ok' | 'error';
  readonly errorCode?: string;
  readonly nextDelayMs?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 50;
const DEFAULT_MAX_DELAY_MS = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** اگر signal لغو شده باشد، AbortError مناسب می‌سازد. */
function abortError(): AWAFError {
  return {
    code: 'RETRY_ABORTED',
    message: 'Retry loop aborted via AbortSignal',
  };
}

/** sleep پیش‌فرض که AbortSignal را respect می‌کند. */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * گام بعدی sleep را با الگوریتم decorrelated jitter محاسبه می‌کند.
 *
 *   next = min(cap, randomInRange(base, prev * 3))
 *
 * Reference: AWS Architecture Blog — "Exponential Backoff And Jitter".
 *
 * @param previousMs - delay محاسبه‌شده در attempt قبلی (ms). برای attempt
 *   اول مقدار `baseMs` به‌عنوان seed مناسب است.
 * @param baseMs - حداقل delay و کف random span (ms). معمولاً ≥ 50ms.
 * @param capMs - سقف delay (ms) — هیچ‌گاه بیش از این برنمی‌گردد.
 * @param random - مولد عدد تصادفی در `[0, 1)` (مثلاً `Math.random`). در
 *   تست‌ها قابل تزریق است تا خروجی deterministic شود.
 * @returns delay پیشنهادی برای attempt بعدی، در `[baseMs, capMs]`.
 *
 * @internal exported for tests.
 */
export function decorrelatedJitter(
  previousMs: number,
  baseMs: number,
  capMs: number,
  random: () => number,
): number {
  const lo = baseMs;
  const hi = Math.max(baseMs, previousMs * 3);
  const span = hi - lo;
  const draw = lo + random() * span;
  return Math.min(capMs, Math.max(baseMs, draw));
}

// ─── withRetry ────────────────────────────────────────────────────────────────

/**
 * یک تابع async که `Result<T, AWAFError>` برمی‌گرداند را با سیاست retry
 * decorrelated-jitter اجرا می‌کند.
 *
 * @example
 * const result = await withRetry(
 *   () => fetchSomething(),
 *   { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 2000 }
 * );
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<Result<T, AWAFError>>,
  options: RetryOptions = {},
): Promise<Result<T, AWAFError>> {
  const max = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const base = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const cap = Math.max(base, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const isRetryable = options.isRetryable ?? ((): boolean => true);

  let lastError: AWAFError = {
    code: 'RETRY_NO_ATTEMPTS',
    message: 'No attempts were made',
  };
  let previousDelay = base;

  for (let attempt = 1; attempt <= max; attempt++) {
    if (options.signal?.aborted === true) return err(abortError());

    const result = await fn(options.signal);
    if (result.success) {
      options.onAttempt?.({ attempt, outcome: 'ok' });
      return result;
    }

    lastError = result.error;
    const isLast = attempt === max;
    const retryable = isRetryable(lastError);

    if (!retryable || isLast) {
      options.onAttempt?.({
        attempt,
        outcome: 'error',
        errorCode: lastError.code,
      });
      return result;
    }

    const nextDelay = decorrelatedJitter(previousDelay, base, cap, random);
    previousDelay = nextDelay;
    options.onAttempt?.({
      attempt,
      outcome: 'error',
      errorCode: lastError.code,
      nextDelayMs: nextDelay,
    });

    try {
      await sleep(nextDelay, options.signal);
    } catch {
      return err(abortError());
    }
  }

  return err(lastError);
}

/** برای کمک به consumer-ها — یک Result.ok بسازد بدون import مستقیم */
export const retryOk = ok;
