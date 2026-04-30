/**
 * @module orchestrator
 * @description
 * Hand-rolled, **XState-v5-compatible** state-machine interpreter for
 * `@alphabet/core`, plus two ready-made machines:
 *
 *   - `consentLadderMachine` — `pending → granted(tier) → revoked`.
 *   - `adaptiveRenderMachine` — `detecting → resolving → ready →
 *     degrading → restoring` over `CapabilityLayer`.
 *
 * Both export Mermaid `stateDiagram-v2` via `toMermaid(machine)`.
 *
 * The interpreter is ~300 LOC, dependency-free, and uses an authoring
 * shape that matches XState v5 closely enough that migrating to the
 * upstream `xstate` package later is mechanical. We deliberately do not
 * add `xstate@^5` as a runtime dep — the dependency-free posture of
 * `@alphabet/core` is contractual.
 */

export {
  createMachine,
  interpret,
  toMermaid,
  type AnyEvent,
  type GuardFn,
  type ActionFn,
  type TransitionDef,
  type StateDef,
  type MachineDefinition,
  type Machine,
  type Snapshot,
  type Actor,
  type InterpretOptions,
} from './machine.js';

export {
  consentLadderMachine,
  type ConsentLadderContext,
  type ConsentLadderEvent,
} from './consent-ladder.js';

export {
  adaptiveRenderMachine,
  type AdaptiveRenderContext,
  type AdaptiveRenderEvent,
} from './adaptive-render.js';

export {
  ORCHESTRATOR_TELEMETRY_EVENTS,
  type OrchestratorTelemetryEventName,
  type OrchestratorTelemetryEvent,
  type LayerSelectedEvent,
  type ConsentTransitionEvent,
  type HandshakePhaseTimingEvent,
} from './telemetry.js';
