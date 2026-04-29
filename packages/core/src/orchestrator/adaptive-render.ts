/**
 * @module orchestrator/adaptive-render
 * @description
 * `adaptiveRenderMachine` — orchestrates the live capability layer:
 * `detecting → resolving → ready → degrading → restoring`.
 *
 * - `detecting` — initial probe of `DetectedSignals` is in flight.
 * - `resolving` — signals collected, decision engine running.
 * - `ready` — a layer is committed; UI is rendering.
 * - `degrading` — a runtime warning (battery low, network downgrade,
 *   `prefers-reduced-motion` toggled, tab backgrounded) was observed
 *   and we are about to hand off to a lower tier.
 * - `restoring` — conditions improved; we are returning toward the
 *   previously-committed (or higher) layer.
 *
 * The machine carries the *current* and *target* `CapabilityLayer` in
 * its context. Layer ordering is encoded via `CAPABILITY_LAYER_LEVEL`
 * — lower number = higher tier.
 */

import type { CapabilityLayer } from '../types/base.js';
import { CAPABILITY_LAYER_LEVEL } from '../types/base.js';
import { createMachine, type Machine } from './machine.js';

export interface AdaptiveRenderContext {
  readonly current: CapabilityLayer;
  readonly target: CapabilityLayer;
  readonly lastWarning?: string;
  readonly transitionsCount: number;
}

export type AdaptiveRenderEvent =
  | { type: 'DETECTED' }
  | { type: 'RESOLVED'; layer: CapabilityLayer }
  | { type: 'WARNING'; kind: string; suggested: CapabilityLayer }
  | { type: 'DEGRADE_DONE' }
  | { type: 'RESTORE'; suggested: CapabilityLayer }
  | { type: 'RESTORE_DONE' };

const initialContext: AdaptiveRenderContext = {
  current: 'STATIC_HTML',
  target: 'STATIC_HTML',
  transitionsCount: 0,
};

export const adaptiveRenderMachine: Machine<AdaptiveRenderContext, AdaptiveRenderEvent> =
  createMachine<AdaptiveRenderContext, AdaptiveRenderEvent>({
    id: 'adaptiveRender',
    initial: 'detecting',
    context: initialContext,
    states: {
      detecting: {
        on: {
          DETECTED: { target: 'resolving' },
        },
      },
      resolving: {
        on: {
          RESOLVED: { target: 'ready', actions: ['commitLayer'] },
        },
      },
      ready: {
        on: {
          WARNING: { target: 'degrading', guard: 'isLowerTier', actions: ['recordWarning'] },
          RESTORE: { target: 'restoring', guard: 'isHigherTier', actions: ['recordRestore'] },
        },
      },
      degrading: {
        on: {
          DEGRADE_DONE: { target: 'ready', actions: ['commitTarget'] },
        },
      },
      restoring: {
        on: {
          RESTORE_DONE: { target: 'ready', actions: ['commitTarget'] },
        },
      },
    },
    guards: {
      isLowerTier: (ctx, ev) =>
        ev.type === 'WARNING' &&
        CAPABILITY_LAYER_LEVEL[ev.suggested] > CAPABILITY_LAYER_LEVEL[ctx.current],
      isHigherTier: (ctx, ev) =>
        ev.type === 'RESTORE' &&
        CAPABILITY_LAYER_LEVEL[ev.suggested] < CAPABILITY_LAYER_LEVEL[ctx.current],
    },
    actions: {
      commitLayer: (_ctx, ev) =>
        ev.type === 'RESOLVED' ? { current: ev.layer, target: ev.layer } : {},
      recordWarning: (_ctx, ev) =>
        ev.type === 'WARNING' ? { target: ev.suggested, lastWarning: ev.kind } : {},
      recordRestore: (_ctx, ev) =>
        ev.type === 'RESTORE' ? { target: ev.suggested } : {},
      commitTarget: (ctx) => ({
        current: ctx.target,
        transitionsCount: ctx.transitionsCount + 1,
      }),
    },
  });
