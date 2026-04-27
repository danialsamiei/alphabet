/**
 * @module runtime/performance-marks
 * @description
 * Wrapper نازک و SSR-safe برای Performance API.
 * Thin SSR-safe wrapper around the `performance` API for AWAF UI marks.
 *
 * تمام مارک‌ها با prefix `awaf:` ذخیره می‌شوند تا در DevTools
 * به‌راحتی قابل filter باشند.
 */

import { isBrowser } from './hydration-safe.js';

/** پیشوند ثابت برای تمام performance marks AWAF. */
export const AWAF_MARK_PREFIX = 'awaf:';

/**
 * بررسی این‌که Performance API در محیط فعلی در دسترس است.
 */
function hasPerformance(): boolean {
  return isBrowser() && typeof performance !== 'undefined' && typeof performance.mark === 'function';
}

/**
 * یک performance mark با پیشوند AWAF ثبت می‌کند.
 * Creates a performance mark with the AWAF prefix. No-op in SSR or where
 * the Performance API is unavailable.
 *
 * @param name - نام مارک (بدون پیشوند)
 *
 * @example
 * mark('handshake:start');  // ثبت "awaf:handshake:start"
 */
export function mark(name: string): void {
  if (!hasPerformance()) return;
  try {
    performance.mark(`${AWAF_MARK_PREFIX}${name}`);
  } catch {
    // ignore — performance marks باید silent باشند
  }
}

/**
 * فاصله بین دو مارک را اندازه می‌گیرد و مدت زمان (میلی‌ثانیه) را برمی‌گرداند.
 * Measures the duration between two AWAF marks and returns it in
 * milliseconds. Returns `null` in SSR or on failure.
 *
 * @example
 * mark('handshake:start');
 * // ...
 * mark('handshake:end');
 * const ms = measure('handshake', 'handshake:start', 'handshake:end');
 */
export function measure(name: string, startMark: string, endMark: string): number | null {
  if (!hasPerformance() || typeof performance.measure !== 'function') return null;
  try {
    const m = performance.measure(
      `${AWAF_MARK_PREFIX}${name}`,
      `${AWAF_MARK_PREFIX}${startMark}`,
      `${AWAF_MARK_PREFIX}${endMark}`
    );
    return typeof m === 'object' && m !== null && 'duration' in m
      ? (m as PerformanceMeasure).duration
      : null;
  } catch {
    return null;
  }
}

/**
 * تمام مارک‌ها و measureهای AWAF را پاک می‌کند.
 * Clears all AWAF performance marks and measures.
 */
export function clearMarks(): void {
  if (!hasPerformance()) return;
  try {
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }
  } catch {
    // ignore
  }
}
