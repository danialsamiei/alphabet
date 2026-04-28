/**
 * @module handshake/predictor/capability-predictor
 * @description
 * `CapabilityPredictor` — heuristics + EWMA over recent signal history,
 * used to forecast the *next likely capability layer* and surface early
 * warnings (network downgrade, low battery, reduced-motion likely toggled,
 * tab going hidden). **No ML runtime, no model weights, no fetch.**
 *
 * Why heuristics. Browsers expose first-class events for every capability
 * we care about (`change` on `navigator.connection`, `battery.levelchange`,
 * `prefers-reduced-motion` MediaQueryList, `visibilitychange`). EWMA over
 * a short window of `observe(snapshot)` calls plus tier-ranked thresholds
 * is enough to give consumers actionable hints without shipping a tensor
 * runtime to every visitor.
 *
 * Privacy. The predictor never fetches or stores anything; the entire
 * state is in-memory and bounded by `historyLimit`.
 */

import type { CapabilityLayer } from '../../types/base.js';
import { CAPABILITY_LAYER_LEVEL } from '../../types/base.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** یک snapshot زنده از سیگنال‌های متغیر — همه فیلدها optional. */
export interface PredictorSnapshot {
  readonly at: number; // epoch ms
  readonly currentLayer?: CapabilityLayer;
  readonly networkType?: string;
  readonly prefersReducedMotion?: boolean;
  readonly visibilityState?: 'visible' | 'hidden';
  readonly batteryLevel?: number; // 0..1
  readonly batteryCharging?: boolean;
}

/** پیش‌بینی capability + warningهای استنباط‌شده. */
export interface CapabilityPrediction {
  /** لایهٔ پیشنهادی برای next-render — می‌تواند با current یکی باشد */
  readonly predictedLayer: CapabilityLayer;
  /** اعتماد در [0, 1] — هرچه نمونه بیشتر، بالاتر */
  readonly confidence: number;
  /** هشدارهای استنباط‌شده */
  readonly warnings: readonly PredictorWarning[];
  /** لایهٔ مشاهده‌شدهٔ آخرین snapshot (یا undefined اگر هیچ snapshotای نبود) */
  readonly lastObservedLayer?: CapabilityLayer;
}

/** انواع هشدار. */
export type PredictorWarning =
  | { readonly kind: 'network-downgrade'; readonly from: string; readonly to: string }
  | { readonly kind: 'battery-low'; readonly level: number }
  | { readonly kind: 'battery-draining'; readonly dropPerMinute: number }
  | { readonly kind: 'reduced-motion-likely' }
  | { readonly kind: 'tab-backgrounded' };

/** گزینه‌های `CapabilityPredictor`. */
export interface CapabilityPredictorOptions {
  /** اندازهٔ پنجرهٔ history (پیش‌فرض 16) */
  readonly historyLimit?: number;
  /** ضریب وزن EWMA (پیش‌فرض 0.4) — هر چه بزرگ‌تر، حساسیت بیشتر */
  readonly ewmaAlpha?: number;
  /** آستانهٔ battery-low (پیش‌فرض 0.2) */
  readonly batteryLowThreshold?: number;
}

// ─── Network ranking ──────────────────────────────────────────────────────────

/**
 * رتبهٔ کیفیت شبکه — هر چه بزرگ‌تر، بهتر. مقادیر ناشناخته → 0.
 * @internal exported for tests
 */
export const NETWORK_RANK: Readonly<Record<string, number>> = {
  '4g': 4,
  '3g': 3,
  '2g': 2,
  'slow-2g': 1,
} as const;

/** آیا transition یک downgrade است؟ */
function isNetworkDowngrade(from: string | undefined, to: string | undefined): boolean {
  if (from === undefined || to === undefined || from === to) return false;
  const fr = NETWORK_RANK[from] ?? 0;
  const tr = NETWORK_RANK[to] ?? 0;
  return tr > 0 && fr > tr;
}

// ─── Predictor ────────────────────────────────────────────────────────────────

const DEFAULT_HISTORY = 16;
const DEFAULT_ALPHA = 0.4;
const DEFAULT_BATTERY_LOW = 0.2;

/**
 * Heuristic capability predictor with EWMA over recent observations.
 *
 * @example
 * const pred = new CapabilityPredictor();
 * pred.observe({ at: Date.now(), currentLayer: 'R3F_IMMERSIVE', networkType: '4g', batteryLevel: 0.7 });
 * pred.observe({ at: Date.now(), currentLayer: 'R3F_IMMERSIVE', networkType: '3g', batteryLevel: 0.65 });
 * const p = pred.predict();
 * p.warnings; // [{ kind: 'network-downgrade', from: '4g', to: '3g' }]
 */
export class CapabilityPredictor {
  private readonly history: PredictorSnapshot[] = [];
  private readonly historyLimit: number;
  private readonly alpha: number;
  private readonly batteryLow: number;
  /** EWMA لایه — به‌صورت level عددی [1..5] */
  private ewmaLayerLevel: number | undefined;

  constructor(options: CapabilityPredictorOptions = {}) {
    this.historyLimit = Math.max(2, options.historyLimit ?? DEFAULT_HISTORY);
    this.alpha = clamp(options.ewmaAlpha ?? DEFAULT_ALPHA, 0.05, 0.95);
    this.batteryLow = clamp(options.batteryLowThreshold ?? DEFAULT_BATTERY_LOW, 0, 1);
  }

  /** افزودن یک snapshot به history. */
  observe(snapshot: PredictorSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    if (snapshot.currentLayer !== undefined) {
      const lvl = CAPABILITY_LAYER_LEVEL[snapshot.currentLayer];
      this.ewmaLayerLevel =
        this.ewmaLayerLevel === undefined
          ? lvl
          : this.alpha * lvl + (1 - this.alpha) * this.ewmaLayerLevel;
    }
  }

  /** پاک کردن history و state. */
  reset(): void {
    this.history.length = 0;
    this.ewmaLayerLevel = undefined;
  }

  /** پیش‌بینی فعلی. */
  predict(): CapabilityPrediction {
    const last = this.history[this.history.length - 1];
    const lastObservedLayer = last?.currentLayer;
    const warnings: PredictorWarning[] = [];

    // ── network downgrade ──────────────────────────────────────────────────
    const networkSeq = this.history.map((s) => s.networkType).filter((t): t is string => typeof t === 'string');
    if (networkSeq.length >= 2) {
      const from = networkSeq[networkSeq.length - 2];
      const to = networkSeq[networkSeq.length - 1];
      if (isNetworkDowngrade(from, to)) {
        warnings.push({ kind: 'network-downgrade', from: from as string, to: to as string });
      }
    }

    // ── battery low / draining ──────────────────────────────────────────────
    if (last?.batteryLevel !== undefined && last.batteryLevel <= this.batteryLow && last.batteryCharging !== true) {
      warnings.push({ kind: 'battery-low', level: last.batteryLevel });
    }
    const drainRate = this.computeBatteryDrainPerMinute();
    if (drainRate !== undefined && drainRate > 0.05) {
      warnings.push({ kind: 'battery-draining', dropPerMinute: drainRate });
    }

    // ── reduced-motion likely (any recent obs) ─────────────────────────────
    if (this.history.some((s) => s.prefersReducedMotion === true)) {
      warnings.push({ kind: 'reduced-motion-likely' });
    }

    // ── tab backgrounded ────────────────────────────────────────────────────
    if (last?.visibilityState === 'hidden') {
      warnings.push({ kind: 'tab-backgrounded' });
    }

    // ── predicted layer: nudge ewma by warnings ────────────────────────────
    const baseLevel = this.ewmaLayerLevel ?? (last?.currentLayer !== undefined
      ? CAPABILITY_LAYER_LEVEL[last.currentLayer]
      : CAPABILITY_LAYER_LEVEL['STATIC_HTML']);
    const adjustment = this.adjustmentForWarnings(warnings);
    const predictedLevel = clamp(Math.round(baseLevel + adjustment), 1, 5);
    const predictedLayer = levelToLayer(predictedLevel);
    const confidence = clamp(this.history.length / this.historyLimit, 0, 1);

    return lastObservedLayer !== undefined
      ? { predictedLayer, confidence, warnings: Object.freeze(warnings), lastObservedLayer }
      : { predictedLayer, confidence, warnings: Object.freeze(warnings) };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** نرخ افت باتری بر حسب درصد در دقیقه — undefined اگر داده کافی نباشد. */
  private computeBatteryDrainPerMinute(): number | undefined {
    const battSeq = this.history
      .filter((s): s is PredictorSnapshot & { batteryLevel: number } => typeof s.batteryLevel === 'number')
      .filter((s) => s.batteryCharging !== true);
    if (battSeq.length < 2) return undefined;
    // length >= 2 — non-null asserted via local type-narrowed const.
    const first = battSeq[0] as PredictorSnapshot & { batteryLevel: number };
    const last = battSeq[battSeq.length - 1] as PredictorSnapshot & { batteryLevel: number };
    const dtMs = last.at - first.at;
    if (dtMs <= 0) return undefined;
    const dropPerMinute = ((first.batteryLevel - last.batteryLevel) / dtMs) * 60_000;
    return dropPerMinute > 0 ? dropPerMinute : 0;
  }

  /** نگاشت warningها به جابجایی level (مثبت = degrade به لایهٔ پایین‌تر). */
  private adjustmentForWarnings(warnings: readonly PredictorWarning[]): number {
    let adj = 0;
    for (const w of warnings) {
      switch (w.kind) {
        case 'network-downgrade': adj += 1; break;
        case 'battery-low': adj += 1; break;
        case 'battery-draining': adj += 0.5; break;
        case 'reduced-motion-likely': adj += 1; break;
        case 'tab-backgrounded': /* no layer change while hidden */ break;
      }
    }
    return adj;
  }
}

// ─── small utils ──────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Precomputed reverse of `CAPABILITY_LAYER_LEVEL` for O(1) lookup. */
const LEVEL_TO_LAYER: ReadonlyMap<number, CapabilityLayer> = new Map(
  (Object.entries(CAPABILITY_LAYER_LEVEL) as Array<[CapabilityLayer, number]>).map(
    ([layer, level]) => [level, layer],
  ),
);

function levelToLayer(level: number): CapabilityLayer {
  return LEVEL_TO_LAYER.get(level) ?? 'STATIC_HTML';
}
