/**
 * @module oracle/webnn
 * @description
 * `WebNNOracle` — a contract that:
 *   - feature-detects `navigator.ml` (the WebNN spec entry point),
 *   - if a `OracleModelProvider` was supplied AND inference returns a
 *     valid distribution, picks the argmax layer with the model's
 *     confidence,
 *   - otherwise falls back to the heuristic oracle.
 *
 * **No model is bundled.** Callers wire their own model via
 * `OracleModelProvider`. This keeps `@alphabet/core` deps-free and
 * weight-free.
 *
 * **Privacy guarantee.** The oracle only ever forwards `input.features`
 * (DP-noised + cohort-bucketed by `featurize()`) to the model — never
 * the raw snapshot. The cohort id may be passed as auxiliary metadata
 * via `auxByCohort` if the consumer wants per-cohort calibration.
 */

import type { CapabilityLayer } from '../types/base.js';
import { HeuristicOracle, type HeuristicOracleOptions } from './heuristic.js';
import type {
  CapabilityOracle,
  OracleInput,
  OracleModelProvider,
  OracleOutput,
} from './types.js';

const LAYER_ORDER: readonly CapabilityLayer[] = [
  'R3F_IMMERSIVE',
  'CSS_3D',
  'CANVAS_2D',
  'STATIC_HTML',
  'TEXT_ONLY',
] as const;

export interface WebNNOracleOptions {
  readonly id?: string;
  /** Optional model provider. If undefined or it returns undefined → fallback. */
  readonly modelProvider?: OracleModelProvider;
  /** Override `globalThis.navigator` (testing). */
  readonly navigator?: { readonly ml?: unknown } & Partial<Navigator>;
  /** Heuristic fallback config. */
  readonly heuristicOptions?: HeuristicOracleOptions;
}

interface NavigatorWithMl {
  readonly ml?: unknown;
}

export class WebNNOracle implements CapabilityOracle {
  readonly id: string;
  private readonly modelProvider: OracleModelProvider | undefined;
  private readonly fallback: HeuristicOracle;
  private readonly nav: NavigatorWithMl | undefined;

  constructor(options: WebNNOracleOptions = {}) {
    this.id = options.id ?? 'webnn@v1';
    this.modelProvider = options.modelProvider;
    this.fallback = new HeuristicOracle(options.heuristicOptions ?? {});
    this.nav = (options.navigator ?? (globalThis.navigator as NavigatorWithMl | undefined));
  }

  /** True iff `navigator.ml` is exposed AND a model provider is registered. */
  isAvailable(): boolean {
    return this.modelProvider !== undefined && this.nav !== undefined && this.nav.ml !== undefined;
  }

  async predict(input: OracleInput): Promise<OracleOutput> {
    if (!this.isAvailable()) {
      const out = await this.fallback.predict(input);
      return {
        predictedLayer: out.predictedLayer,
        confidence: out.confidence,
        warnings: [...out.warnings, 'webnn-unavailable'],
      };
    }
    const provider = this.modelProvider as OracleModelProvider;
    let dist: Float32Array | undefined;
    try {
      dist = await provider.infer(input.features);
    } catch {
      dist = undefined;
    }
    if (dist === undefined || dist.length !== LAYER_ORDER.length) {
      const out = await this.fallback.predict(input);
      return {
        predictedLayer: out.predictedLayer,
        confidence: out.confidence,
        warnings: [...out.warnings, 'model-failed'],
      };
    }
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < dist.length; i += 1) {
      const v = dist[i] as number;
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }
    return {
      predictedLayer: LAYER_ORDER[bestIdx] as CapabilityLayer,
      confidence: clamp01(bestVal),
      warnings: [],
    };
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
