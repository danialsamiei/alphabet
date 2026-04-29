/**
 * @module oracle/heuristic
 * @description
 * `HeuristicOracle` — adapts the existing `CapabilityPredictor` to the
 * `CapabilityOracle` interface. Always available, zero deps.
 */

import type { CapabilityLayer } from '../types/base.js';
import { CapabilityPredictor } from '../handshake/predictor/index.js';
import type { CapabilityOracle, OracleInput, OracleOutput } from './types.js';

export interface HeuristicOracleOptions {
  readonly id?: string;
  /** Pre-built predictor (test injection); else a fresh one is created. */
  readonly predictor?: CapabilityPredictor;
}

export class HeuristicOracle implements CapabilityOracle {
  readonly id: string;
  private readonly predictor: CapabilityPredictor;

  constructor(options: HeuristicOracleOptions = {}) {
    this.id = options.id ?? 'heuristic@v1';
    this.predictor = options.predictor ?? new CapabilityPredictor();
  }

  /**
   * Convert the anonymized features back into a synthetic snapshot
   * (fields we can recover) and observe it. The features are already
   * DP-noised, so the predictor sees a privacy-respecting view.
   */
  async predict(input: OracleInput): Promise<OracleOutput> {
    const layerFromFeature = (i: number): CapabilityLayer | undefined => {
      const v = input.features[i];
      if (v === undefined) return undefined;
      const idx = Math.min(4, Math.max(0, Math.round(v * 4)));
      return (
        ['R3F_IMMERSIVE', 'CSS_3D', 'CANVAS_2D', 'STATIC_HTML', 'TEXT_ONLY'] as const
      )[idx];
    };
    const network = networkFromFeature(input.features[1]);
    const battery = input.features[2];
    const snapshot: import('../handshake/predictor/index.js').PredictorSnapshot = {
      at: Date.now(),
      currentLayer: input.currentLayer,
      prefersReducedMotion: (input.features[3] ?? 0) > 0.5,
      visibilityState: (input.features[4] ?? 1) > 0.5 ? 'visible' : 'hidden',
      ...(network !== undefined ? { networkType: network } : {}),
      ...(battery !== undefined ? { batteryLevel: battery } : {}),
    };
    this.predictor.observe(snapshot);
    const p = this.predictor.predict();
    return {
      predictedLayer: p.predictedLayer ?? layerFromFeature(0) ?? input.currentLayer,
      confidence: p.confidence,
      warnings: p.warnings.map((w) => w.kind),
    };
  }
}

function networkFromFeature(v: number | undefined): string | undefined {
  if (v === undefined) return undefined;
  const idx = Math.min(4, Math.max(0, Math.round(v * 4)));
  return (['slow-2g', '2g', '3g', '4g', '4g'] as const)[idx];
}
