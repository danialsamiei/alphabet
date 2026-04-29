/**
 * @module handshake/state-machine
 * @description barrel — typed transition table for layer selection.
 */

export {
  LAYER_TRANSITIONS,
  runLayerMachine,
  toLayerInput,
  assertNever,
} from './decision-machine.js';
export type {
  LayerState,
  LayerInput,
  LayerTransition,
  LayerTransitionResult,
} from './decision-machine.js';

export { toMermaid } from './mermaid.js';
