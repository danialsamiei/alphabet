/**
 * @module @alphabet/protocols/v2/pulse
 * @description
 * Technology Pulse v2 — predictive capability forecasting and proactive
 * layer-downgrade hints, layered on top of the existing
 * `CapabilityPredictor` (`@alphabet/core/handshake/predictor`).
 *
 * Goals:
 *   • Translate the predictor's raw warnings + EWMA forecast into
 *     concrete *actions* the UI runtime can take *before* the next
 *     render (e.g. preemptively swap to CSS-3D before a 4g→3g
 *     transition completes).
 *   • Stay heuristic — no ML, no fetch, no telemetry. Mirrors the
 *     existing predictor's privacy posture.
 */

import { predictor as predictorNs } from '@alphabet/core';
import type { CapabilityLayer } from '@alphabet/core';

const { CapabilityPredictor } = predictorNs;

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * One actionable hint emitted by `ProactiveLayerForecaster`. The
 * `urgency` field tells the runtime how aggressively to apply it.
 */
export type LayerForecastHint =
  | {
      readonly kind: 'preemptive-downgrade';
      readonly from: CapabilityLayer;
      readonly to: CapabilityLayer;
      readonly reason: string;
      readonly urgency: 'low' | 'medium' | 'high';
    }
  | {
      readonly kind: 'pause-animation';
      readonly reason: string;
      readonly urgency: 'low' | 'medium' | 'high';
    }
  | {
      readonly kind: 'ethical-downgrade';
      readonly from: CapabilityLayer;
      readonly to: CapabilityLayer;
      readonly reason: 'consent-revoked' | 'jurisdiction-restriction' | 'content-sensitivity';
      readonly urgency: 'medium' | 'high';
    }
  | {
      readonly kind: 'no-change';
      readonly currentLayer?: CapabilityLayer;
      readonly confidence: number;
    };

/**
 * Non-capability signals consumed by `observeEthics()`. None of these
 * fields are required individually — pass whichever the runtime knows
 * about and the forecaster will combine them.
 */
export interface EthicsObservation {
  /**
   * The visitor's consent tier transition. `revoked` means a previously
   * granted tier (≥ ANONYMOUS) has been revoked back to NO_MEMORY and
   * therefore *all* personalization layers must be paused.
   */
  readonly consentTierChange?: 'granted' | 'revoked' | 'downgraded';
  /**
   * Hint that the visitor's jurisdiction restricts richer renderings —
   * for example, an XR/biometric ban or a per-region content rule.
   */
  readonly jurisdictionRisk?: 'none' | 'low' | 'high';
  /**
   * Content moderation flag for the current page or response stream.
   *   • `safe`  — no action.
   *   • `caution` — strip animations.
   *   • `flagged` — drop to STATIC_HTML.
   */
  readonly contentFlag?: 'safe' | 'caution' | 'flagged';
}

/** Options for `ProactiveLayerForecaster`. */
export interface ProactiveLayerForecasterOptions {
  /**
   * Layers ordered from richest to leanest. Used to pick a downgrade
   * target. The default mirrors `LAYER_TRANSITIONS` in `@alphabet/core`.
   */
  readonly layerOrder?: readonly CapabilityLayer[];
  /** Minimum confidence required before emitting a hint (default 0.4). */
  readonly minConfidence?: number;
  /** Forwarded to the underlying predictor. */
  readonly historyLimit?: number;
  readonly ewmaAlpha?: number;
  readonly batteryLowThreshold?: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_LAYER_ORDER: readonly CapabilityLayer[] = [
  'R3F_IMMERSIVE',
  'CSS_3D',
  'CANVAS_2D',
  'STATIC_HTML',
  'TEXT_ONLY',
];

// ─── Forecaster ──────────────────────────────────────────────────────────────

/**
 * Wraps `CapabilityPredictor` and produces actionable
 * `LayerForecastHint` values. Stateful — call `observe()` whenever a
 * capability snapshot is captured, then `forecast()` to consume hints.
 *
 * @example
 * const fc = new ProactiveLayerForecaster();
 * fc.observe({ at: Date.now(), currentLayer: 'R3F_IMMERSIVE', networkType: '4g', batteryLevel: 0.7 });
 * fc.observe({ at: Date.now(), currentLayer: 'R3F_IMMERSIVE', networkType: '3g', batteryLevel: 0.65 });
 * for (const hint of fc.forecast()) {
 *   if (hint.kind === 'preemptive-downgrade') applyLayer(hint.to);
 * }
 */
export class ProactiveLayerForecaster {
  private readonly inner: InstanceType<typeof CapabilityPredictor>;
  private readonly order: readonly CapabilityLayer[];
  private readonly minConfidence: number;
  private ethics: EthicsObservation = {};

  constructor(options: ProactiveLayerForecasterOptions = {}) {
    const innerOpts: ConstructorParameters<typeof CapabilityPredictor>[0] = {
      ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
      ...(options.ewmaAlpha !== undefined ? { ewmaAlpha: options.ewmaAlpha } : {}),
      ...(options.batteryLowThreshold !== undefined
        ? { batteryLowThreshold: options.batteryLowThreshold }
        : {}),
    };
    this.inner = new CapabilityPredictor(innerOpts);
    this.order = options.layerOrder ?? DEFAULT_LAYER_ORDER;
    this.minConfidence = options.minConfidence ?? 0.4;
  }

  /** Forward a snapshot to the inner predictor. */
  observe(
    snapshot: Parameters<InstanceType<typeof CapabilityPredictor>['observe']>[0],
  ): void {
    this.inner.observe(snapshot);
  }

  /**
   * Record non-capability ethics signals. These take priority over
   * capability-driven downgrades — consent revocation and jurisdiction
   * risk are never overridden by "battery is fine, network is good".
   *
   * Pass an empty object to clear the previous ethics state.
   */
  observeEthics(observation: EthicsObservation): void {
    this.ethics = { ...observation };
  }

  /** Reset history and ethics observations. */
  reset(): void {
    this.inner.reset();
    this.ethics = {};
  }

  /**
   * Compute an ordered list of hints for the runtime to apply. The
   * list is stable; callers can apply only the first hint and discard
   * the rest if they prefer one action per tick.
   */
  forecast(): readonly LayerForecastHint[] {
    const p = this.inner.predict();
    const hints: LayerForecastHint[] = [];
    const currentLayer = p.lastObservedLayer ?? p.predictedLayer;

    // Ethics signals are evaluated first — they take precedence over any
    // capability-driven hint. The runtime should apply the highest-urgency
    // ethical hint and then re-evaluate capability hints.
    const ethicalHints = this.collectEthicalHints(currentLayer);
    for (const h of ethicalHints) hints.push(h);

    if (p.confidence < this.minConfidence) {
      if (hints.length === 0) {
        hints.push({
          kind: 'no-change',
          ...(p.lastObservedLayer !== undefined ? { currentLayer: p.lastObservedLayer } : {}),
          confidence: p.confidence,
        });
      }
      return hints;
    }

    for (const w of p.warnings) {
      if (w.kind === 'network-downgrade' || w.kind === 'battery-low') {
        const from = p.lastObservedLayer ?? p.predictedLayer;
        const to = nextLeanerLayer(from, this.order);
        if (to !== undefined && to !== from) {
          hints.push({
            kind: 'preemptive-downgrade',
            from,
            to,
            reason:
              w.kind === 'network-downgrade'
                ? `Network downgrade ${w.from} → ${w.to}`
                : `Battery low (level=${w.level.toFixed(2)})`,
            urgency: w.kind === 'network-downgrade' ? 'medium' : 'high',
          });
        }
      } else if (w.kind === 'reduced-motion-likely' || w.kind === 'tab-backgrounded') {
        hints.push({
          kind: 'pause-animation',
          reason: w.kind === 'reduced-motion-likely' ? 'reduced-motion preferred' : 'tab hidden',
          urgency: w.kind === 'tab-backgrounded' ? 'high' : 'medium',
        });
      } else if (w.kind === 'battery-draining') {
        hints.push({
          kind: 'pause-animation',
          reason: `Battery draining ${(w.dropPerMinute * 100).toFixed(1)}%/min`,
          urgency: 'medium',
        });
      }
    }

    if (hints.length === 0) {
      hints.push({
        kind: 'no-change',
        ...(p.lastObservedLayer !== undefined ? { currentLayer: p.lastObservedLayer } : {}),
        confidence: p.confidence,
      });
    }

    return hints;
  }

  // ─── Ethics ────────────────────────────────────────────────────────────────

  private collectEthicalHints(
    currentLayer: CapabilityLayer | undefined,
  ): LayerForecastHint[] {
    const out: LayerForecastHint[] = [];
    const e = this.ethics;
    const from = currentLayer ?? this.order[0]!;

    if (e.consentTierChange === 'revoked') {
      out.push({
        kind: 'ethical-downgrade',
        from,
        to: 'STATIC_HTML',
        reason: 'consent-revoked',
        urgency: 'high',
      });
    }
    if (e.jurisdictionRisk === 'high') {
      out.push({
        kind: 'ethical-downgrade',
        from,
        to: 'STATIC_HTML',
        reason: 'jurisdiction-restriction',
        urgency: 'high',
      });
    }
    if (e.contentFlag === 'flagged') {
      out.push({
        kind: 'ethical-downgrade',
        from,
        to: 'STATIC_HTML',
        reason: 'content-sensitivity',
        urgency: 'high',
      });
    } else if (e.contentFlag === 'caution') {
      out.push({
        kind: 'pause-animation',
        reason: 'content flagged for caution',
        urgency: 'medium',
      });
    }
    return out;
  }
}

/** Pick the next leaner layer in the configured order, if any. */
function nextLeanerLayer(
  from: CapabilityLayer,
  order: readonly CapabilityLayer[],
): CapabilityLayer | undefined {
  const idx = order.indexOf(from);
  if (idx === -1 || idx === order.length - 1) return undefined;
  return order[idx + 1];
}
