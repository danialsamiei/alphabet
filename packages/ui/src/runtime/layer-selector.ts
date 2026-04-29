/**
 * @module runtime/layer-selector
 * @description
 * Pure layer selector — انتخاب Adaptive Render Layer از روی قابلیت دستگاه،
 * تنظیمات دسترسی‌پذیری، و سیگنال‌های حریم خصوصی.
 *
 * Alphabet concept rename: "UI Degradation" → "Adaptive Render Layers".
 * The 5 enum values (R3F_IMMERSIVE, CSS_3D, CANVAS_2D, STATIC_HTML, TEXT_ONLY)
 * are kept stable across `@alphabet/core` and `@alphabet/ui` for compatibility.
 *
 * **Privacy contract:** DNT/GPC are *not* a reason to drop visual layer.
 * They restrict storage and personalization (handled by consent), not
 * rendering. This module never returns `STATIC_HTML` or `TEXT_ONLY`
 * solely because DNT/GPC is active.
 */

import type { CapabilityLayer } from '@alphabet/core';

/**
 * Alias مدرن‌تر برای CapabilityLayer — مفهوم عمومی SDK.
 * Public alias matching the renamed concept.
 */
export type AdaptiveLayer = CapabilityLayer;

/**
 * زنجیره fallback از بالاترین به پایین‌ترین لایه.
 * Fallback order from richest to most accessible layer.
 */
export const ADAPTIVE_LAYER_FALLBACK_CHAIN: readonly AdaptiveLayer[] = [
  'R3F_IMMERSIVE',
  'CSS_3D',
  'CANVAS_2D',
  'STATIC_HTML',
  'TEXT_ONLY',
] as const;

/**
 * ورودی به selectAdaptiveLayer — کاملاً serializable و قابل تست.
 * Pure input for `selectAdaptiveLayer`. All fields are optional except
 * the explicit `accessibility` block — the selector is conservative when
 * a signal is missing.
 */
export interface AdaptiveLayerInput {
  /** WebGL 2.0 یا fallback به WebGL 1.0 پشتیبانی می‌شود. */
  readonly webglSupported?: boolean;
  /** Canvas 2D در دسترس است. در browser تقریباً همیشه true. */
  readonly canvas2dSupported?: boolean;
  /** آیا کاربر prefers-reduced-motion دارد. */
  readonly prefersReducedMotion?: boolean;
  /** آیا screen reader فعال است یا کاربر text-only را ترجیح می‌دهد. */
  readonly forceTextOnly?: boolean;
  /** عرض viewport — برای cap کردن R3F روی موبایل. */
  readonly viewportWidth?: number;
  /** نوع شبکه از Network Information API. */
  readonly networkType?: 'slow-2g' | '2g' | '3g' | '4g' | string;
  /** آیا runtime در browser است (false → SSR). */
  readonly isBrowser?: boolean;
  /** درخواست explicit کاربر/برنامه برای layer مشخص (override). */
  readonly forceLayer?: AdaptiveLayer;
  /**
   * آیا R3F (یا dependency سنگین immersive) واقعاً قابل بارگذاری است.
   * در صورت true → R3F_IMMERSIVE قابل انتخاب است. در صورت false →
   * زنجیره fallback به CSS_3D می‌رود.
   */
  readonly r3fAvailable?: boolean;
}

/**
 * نتیجه انتخاب لایه — لایه + توضیح شفاف برای TransparencyNotice.
 */
export interface AdaptiveLayerResult {
  /** لایه نهایی انتخاب‌شده. */
  readonly layer: AdaptiveLayer;
  /** کد دلیل machine-readable برای انتخاب این لایه. */
  readonly reasonCode: AdaptiveLayerReasonCode;
  /** متن توضیح خوانا برای انسان (برای TransparencyNotice). */
  readonly reason: string;
  /** زنجیره fallbackهای محاسبه‌شده — اولین مورد همان `layer` است. */
  readonly fallbackChain: readonly AdaptiveLayer[];
}

/**
 * کدهای دلیل قطعی برای انتخاب لایه.
 */
export type AdaptiveLayerReasonCode =
  | 'forced-by-caller'
  | 'forced-text-only'
  | 'reduced-motion'
  | 'ssr-fallback'
  | 'no-canvas'
  | 'no-webgl'
  | 'r3f-unavailable'
  | 'narrow-viewport'
  | 'slow-network'
  | 'capable';

// ─── Internal helpers ─────────────────────────────────────────────────────────

const SLOW_NETWORK_TYPES = new Set(['slow-2g', '2g']);

function buildFallbackChain(start: AdaptiveLayer): readonly AdaptiveLayer[] {
  const idx = ADAPTIVE_LAYER_FALLBACK_CHAIN.indexOf(start);
  if (idx < 0) return ADAPTIVE_LAYER_FALLBACK_CHAIN;
  return ADAPTIVE_LAYER_FALLBACK_CHAIN.slice(idx);
}

function makeResult(
  layer: AdaptiveLayer,
  reasonCode: AdaptiveLayerReasonCode,
  reason: string
): AdaptiveLayerResult {
  return {
    layer,
    reasonCode,
    reason,
    fallbackChain: buildFallbackChain(layer),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pure تابع انتخاب لایه — هیچ side effect ندارد و SSR-safe است.
 * Pure layer-selection function — no side effects, SSR-safe.
 *
 * Order of decisions (highest priority first):
 *   1. `forceLayer` override (caller knows best, e.g. demo toggle).
 *   2. `forceTextOnly` (screen reader preferred / accessibility flag).
 *   3. `prefersReducedMotion` → `STATIC_HTML` (a11y).
 *   4. SSR (`isBrowser === false`) → `STATIC_HTML` so server-rendered
 *      markup never assumes a browser-only layer.
 *   5. No Canvas 2D → `STATIC_HTML`.
 *   6. No WebGL → `CANVAS_2D`.
 *   7. R3F unavailable (dependency missing) → `CSS_3D`.
 *   8. Slow network (`slow-2g` / `2g`) → `CSS_3D`.
 *   9. Narrow viewport (< 768px) → `CSS_3D`.
 *  10. Otherwise → `R3F_IMMERSIVE`.
 *
 * **Note:** DNT and GPC are deliberately not inputs to this function.
 * The render layer is a capability/accessibility decision; privacy
 * signals never force a lower visual layer.
 */
export function selectAdaptiveLayer(input: AdaptiveLayerInput): AdaptiveLayerResult {
  const {
    webglSupported,
    canvas2dSupported = true,
    prefersReducedMotion = false,
    forceTextOnly = false,
    viewportWidth,
    networkType,
    isBrowser: inBrowser = true,
    forceLayer,
    r3fAvailable = true,
  } = input;

  if (forceLayer !== undefined) {
    return makeResult(forceLayer, 'forced-by-caller', `Caller forced layer = ${forceLayer}.`);
  }

  if (forceTextOnly) {
    return makeResult(
      'TEXT_ONLY',
      'forced-text-only',
      'Text-only mode requested (screen-reader / explicit a11y preference).'
    );
  }

  if (prefersReducedMotion) {
    return makeResult(
      'STATIC_HTML',
      'reduced-motion',
      'User prefers reduced motion — falling back to static HTML.'
    );
  }

  if (!inBrowser) {
    return makeResult(
      'STATIC_HTML',
      'ssr-fallback',
      'Rendered on the server — using static HTML for hydration safety.'
    );
  }

  if (!canvas2dSupported) {
    return makeResult(
      'STATIC_HTML',
      'no-canvas',
      'Canvas 2D unavailable — falling back to static HTML.'
    );
  }

  if (webglSupported === false) {
    return makeResult(
      'CANVAS_2D',
      'no-webgl',
      'WebGL unavailable — using Canvas 2D layer.'
    );
  }

  if (!r3fAvailable) {
    return makeResult(
      'CSS_3D',
      'r3f-unavailable',
      'React Three Fiber not available — using CSS 3D layer.'
    );
  }

  if (typeof networkType === 'string' && SLOW_NETWORK_TYPES.has(networkType)) {
    return makeResult(
      'CSS_3D',
      'slow-network',
      `Slow network (${networkType}) — preferring CSS 3D over R3F.`
    );
  }

  if (typeof viewportWidth === 'number' && viewportWidth > 0 && viewportWidth < 768) {
    return makeResult(
      'CSS_3D',
      'narrow-viewport',
      `Viewport ${viewportWidth}px is below 768px — preferring CSS 3D over R3F.`
    );
  }

  return makeResult(
    'R3F_IMMERSIVE',
    'capable',
    'Device is capable — selecting immersive R3F layer.'
  );
}
