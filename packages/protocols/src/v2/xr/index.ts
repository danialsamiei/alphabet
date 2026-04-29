/**
 * @module @alphabet/protocols/v2/xr
 * @description
 * Cross-Reality Orchestrator — additive subpath that layers WebXR
 * (VR/AR) and Spatial Web Layer 0 on top of the existing Alphabet
 * capability ladder. See `./orchestrator.ts` for the entry class.
 */

export type {
  XRRealityMode,
  XRPrivacyPosture,
  XRCapabilitySnapshot,
  XRSpatialAnchor,
  XRDecisionReason,
  XRRealityDecision,
  XRRealityHint,
  XROrchestratorEventName,
  XROrchestratorEventMap,
  XROrchestratorListener,
} from './types.js';

export { probeXrCapabilities } from './capability-probe.js';
export type { ProbeXrCapabilitiesOptions } from './capability-probe.js';

export {
  createInMemorySpatialLayer0Adapter,
} from './spatial-layer0.js';
export type {
  SpatialLayer0Adapter,
  InMemorySpatialLayer0Options,
} from './spatial-layer0.js';

export { CrossRealityOrchestrator } from './orchestrator.js';
export type {
  CrossRealityOrchestratorOptions,
  XRDecideInput,
} from './orchestrator.js';
