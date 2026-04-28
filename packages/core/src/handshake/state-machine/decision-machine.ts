/**
 * @module handshake/state-machine/decision-machine
 * @description
 * Layer-selection state machine expressed as a **typed transition table**
 * (data, not XState). Same algorithm as `SignalCollector.detectLayer`,
 * but exposed as inspectable rule data so we can:
 *
 *   1. Render it as a Mermaid diagram for the docs (`toMermaid()`).
 *   2. Use TypeScript's `never`-based exhaustiveness check at compile
 *      time over `LayerState`.
 *   3. Snapshot-test the transition table in CI to catch silent rule
 *      drift between code and docs.
 *
 * This wraps, not replaces, `HandshakeDecisionEngine`. The legacy engine
 * stays the canonical runtime path; the state machine is an additional
 * artifact for tooling and verification.
 */

import type { CapabilityLayer } from '../../types/base.js';
import type { DetectedSignals } from '../../types/visitor.js';

// ─── States & input ──────────────────────────────────────────────────────────

/**
 * حالات state machine — مساوی با `CapabilityLayer` به‌علاوهٔ یک حالت ورودی
 * مجازی `START`. هر transition یک رشته از rule-name و یک hard target است.
 */
export type LayerState = 'START' | CapabilityLayer;

/** ورودی ساده‌شدهٔ تصمیم — projection از DetectedSignals که فقط فیلدهای مورد
 * استفادهٔ rules را شامل می‌شود. */
export interface LayerInput {
  readonly prefersReducedMotion: boolean;
  readonly webglSupported: boolean;
  readonly screenWidth: number;
  /** networkType: undefined ⇒ "تشخیص داده نشده، فرض 4g" — همان رفتار engine. */
  readonly networkType: string | undefined;
}

/** projection امن از DetectedSignals به LayerInput. */
export function toLayerInput(signals: DetectedSignals): LayerInput {
  return {
    prefersReducedMotion: signals.prefersReducedMotion,
    webglSupported: signals.webglSupported,
    screenWidth: signals.screenWidth,
    networkType: signals.networkType,
  };
}

// ─── Transition table ─────────────────────────────────────────────────────────

/**
 * یک قانون transition. `guard` تابعی است که روی `LayerInput` خوانده می‌شود.
 * از قانون اول که match کند استفاده می‌شود؛ `target` لایهٔ خروجی است.
 *
 * **Order matters** — همان priority order دیاگرام Card 1 در AGENTS.md.
 */
export interface LayerTransition {
  readonly id: string;
  /** نام قابل خواندن برای انسان — در دیاگرام به‌عنوان label لبه نمایش داده می‌شود. */
  readonly label: string;
  readonly from: LayerState;
  readonly to: CapabilityLayer;
  readonly guard: (input: LayerInput) => boolean;
}

/**
 * جدول transition برای فاز decide. این **همان منطق** `detectLayer` در
 * `SignalCollector` است که به فرم data بازنویسی شده — اگر هر کدام تغییر
 * کند، snapshot test باید بشکند تا یادآوری شود هر دو هم‌زمان به‌روزرسانی شوند.
 */
export const LAYER_TRANSITIONS: readonly LayerTransition[] = [
  {
    id: 'rm-to-static',
    label: 'prefers-reduced-motion',
    from: 'START',
    to: 'STATIC_HTML',
    guard: (i) => i.prefersReducedMotion,
  },
  {
    id: 'no-webgl-to-canvas',
    label: '!webgl',
    from: 'START',
    to: 'CANVAS_2D',
    guard: (i) => !i.prefersReducedMotion && !i.webglSupported,
  },
  {
    id: 'webgl-4g-wide-to-r3f',
    label: 'webgl ∧ net∈{4g,?} ∧ vw≥768',
    from: 'START',
    to: 'R3F_IMMERSIVE',
    guard: (i) =>
      !i.prefersReducedMotion &&
      i.webglSupported &&
      isFourG(i.networkType) &&
      i.screenWidth >= 768,
  },
  {
    id: 'webgl-3gplus-to-css3d',
    label: 'webgl ∧ net≥3g',
    from: 'START',
    to: 'CSS_3D',
    guard: (i) =>
      !i.prefersReducedMotion && i.webglSupported && isThreeGPlus(i.networkType),
  },
  {
    id: 'webgl-fallback-to-canvas',
    label: 'webgl (fallback)',
    from: 'START',
    to: 'CANVAS_2D',
    // catch-all برای webgl-supported با شبکهٔ ضعیف‌تر
    guard: (i) => !i.prefersReducedMotion && i.webglSupported,
  },
] as const;

function isFourG(net: string | undefined): boolean {
  return net === '4g' || net === undefined;
}
function isThreeGPlus(net: string | undefined): boolean {
  return net === '3g' || net === '4g' || net === undefined;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/** نتیجهٔ یک transition انجام‌شده — برای trace و خروجی به consumers. */
export interface LayerTransitionResult {
  readonly state: CapabilityLayer;
  readonly transition: LayerTransition;
}

/**
 * اجرای state machine — اولین rule که match کند. اگر هیچ rule match نکند
 * (مثلاً `webglSupported = false` و `prefersReducedMotion = false` که با
 * rule دوم گرفته می‌شود — یعنی دست‌نیافتنی است)، `STATIC_HTML` به‌عنوان
 * fallback ایمن برمی‌گردد.
 *
 * تابع کاملاً deterministic و pure است.
 */
export function runLayerMachine(input: LayerInput): LayerTransitionResult {
  for (const t of LAYER_TRANSITIONS) {
    if (t.from === 'START' && t.guard(input)) {
      return { state: t.to, transition: t };
    }
  }
  // unreachable داده شده که rule-set ما کاتالوگ را پوشش می‌دهد، اما fallback
  // ایمن.
  const fallback: LayerTransition = {
    id: 'fallback',
    label: 'fallback',
    from: 'START',
    to: 'STATIC_HTML',
    guard: () => true,
  };
  return { state: 'STATIC_HTML', transition: fallback };
}

// ─── Exhaustiveness check ─────────────────────────────────────────────────────

/**
 * یک helper برای exhaustiveness check در زمان compile روی `LayerState`.
 * اگر یک عضو جدید به `CapabilityLayer` اضافه شود ولی این switch به‌روزرسانی
 * نشود، TypeScript خطا می‌دهد.
 *
 * @example
 * function describe(s: LayerState): string {
 *   switch (s) {
 *     case 'START': return 'start';
 *     case 'R3F_IMMERSIVE': return 'r3f';
 *     case 'CSS_3D': return 'css';
 *     case 'CANVAS_2D': return 'canvas';
 *     case 'STATIC_HTML': return 'static';
 *     case 'TEXT_ONLY': return 'text';
 *     default: return assertNever(s);
 *   }
 * }
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled LayerState: ${String(x)}`);
}
