/**
 * @module handshake/index
 * @description
 * barrel export برای ماژول Context Handshake.
 * Barrel export for the Context Handshake module.
 */

export { SignalCollector } from './signal-collector.js';
export type { SignalCollectorOptions } from './signal-collector.js';

export { EnrichmentPipeline } from './enrichment-pipeline.js';

export { HandshakeDecisionEngine } from './decision-engine.js';

export { HandshakeOrchestrator } from './orchestrator.js';
export type {
  HandshakeOrchestratorOptions,
  HandshakeRunOptions,
  HandshakeOutcome,
  HandshakePhase,
} from './orchestrator.js';

// ─── Additive subpaths (W2 depth pass) ───────────────────────────────────────
// Pipeline primitives, context streaming, capability prediction, and the
// typed layer-selection state machine are also re-exported as nested
// subpaths from `@awaf/core`. They wrap, never replace, the core handshake
// types above.
export * as pipeline from './pipeline/index.js';
export * as stream from './stream/index.js';
export * as predictor from './predictor/index.js';
export * as stateMachine from './state-machine/index.js';
