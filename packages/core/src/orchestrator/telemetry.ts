/**
 * @module orchestrator/telemetry
 * @description Standard telemetry event contracts for orchestration surfaces.
 */

import type { CapabilityLayer, ConsentTier } from '../types/base.js';
import type { HandshakePhase } from '../handshake/orchestrator.js';

export const ORCHESTRATOR_TELEMETRY_EVENTS = {
  LAYER_SELECTED: 'layer_selected',
  CONSENT_TRANSITION: 'consent_transition',
  HANDSHAKE_PHASE_TIMING: 'handshake_phase_timing',
} as const;

export type OrchestratorTelemetryEventName =
  (typeof ORCHESTRATOR_TELEMETRY_EVENTS)[keyof typeof ORCHESTRATOR_TELEMETRY_EVENTS];

export interface LayerSelectedEvent {
  readonly event: typeof ORCHESTRATOR_TELEMETRY_EVENTS.LAYER_SELECTED;
  readonly at: number;
  readonly layer: CapabilityLayer;
  readonly reasonCode: string;
  readonly source: 'adaptive-render' | 'ui-layer-provider';
}

export interface ConsentTransitionEvent {
  readonly event: typeof ORCHESTRATOR_TELEMETRY_EVENTS.CONSENT_TRANSITION;
  readonly at: number;
  readonly fromTier: ConsentTier;
  readonly toTier: ConsentTier;
  readonly fromState: string;
  readonly toState: string;
  readonly source: 'consent-ladder' | 'ui-consent-hook';
}

export interface HandshakePhaseTimingEvent {
  readonly event: typeof ORCHESTRATOR_TELEMETRY_EVENTS.HANDSHAKE_PHASE_TIMING;
  readonly at: number;
  readonly phase: HandshakePhase;
  readonly durationMs: number;
  readonly source: 'handshake-orchestrator' | 'context-stream';
}

export type OrchestratorTelemetryEvent =
  | LayerSelectedEvent
  | ConsentTransitionEvent
  | HandshakePhaseTimingEvent;
