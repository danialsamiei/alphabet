/**
 * @module effect/adapters
 * @description
 * Effect-style **adapters** for the existing handshake classes
 * (`SignalCollector`, `EnrichmentPipeline`, `HandshakeDecisionEngine`).
 *
 * **Why adapters and not a rewrite.** Rewriting `SignalCollector` &
 * friends in terms of `Effect` would break every consumer of
 * `@alphabet/core` v1 (api, ui, protocols, security, apps/demo, 200+
 * tests). The classes are also already small, pure, and Result-returning
 * — they're well-suited to a thin Effect view that simply re-expresses
 * their existing return type as `Effect<unknown, AlphabetError, ...>`.
 * Both call sites (legacy + Effect) keep working.
 *
 * @example
 * import { collectE, enrichE, decideE } from '@alphabet/core/effect';
 * import { flatMap, runEffect } from '@alphabet/core/effect';
 *
 * const program = flatMap(collectE(), (signals) =>
 *   flatMap(enrichE(signals), (enriched) =>
 *     decideE(enriched),
 *   ),
 * );
 * const exit = await runEffect(program, undefined);
 */

import type { AlphabetError } from '../types/result.js';
import type { DetectedSignals, EnrichedContext } from '../types/visitor.js';
import type { HandshakeDecision } from '../types/api.js';
import { SignalCollector, type SignalCollectorOptions } from '../handshake/signal-collector.js';
import {
  EnrichmentPipeline,
  type EnrichOptions,
} from '../handshake/enrichment-pipeline.js';
import { HandshakeDecisionEngine } from '../handshake/decision-engine.js';
import {
  type Effect,
  fail,
  succeed,
  sync,
  flatMap,
} from './effect.js';

// ─── collect ─────────────────────────────────────────────────────────────────

/**
 * Effect view of `SignalCollector.collect()`. The collector itself is
 * synchronous and Result-returning, so we lift it via `sync` + a flatMap
 * that re-routes its `Result` into the typed failure channel.
 */
export function collectE(
  options?: SignalCollectorOptions,
): Effect<unknown, AlphabetError, DetectedSignals> {
  return flatMap(
    sync(() => new SignalCollector(options ?? {}).collect()),
    (result) =>
      result.success
        ? succeed<DetectedSignals>(result.data)
        : fail<AlphabetError>(result.error),
  );
}

// ─── enrich ──────────────────────────────────────────────────────────────────

/**
 * Effect view of `EnrichmentPipeline.enrich()`. The pipeline throws on
 * unexpected input today, so we wrap in `sync` (which converts throws to
 * defects) — defects bypass `catchAll` and surface clearly.
 */
export function enrichE(
  signals: DetectedSignals,
  options?: EnrichOptions,
  pipeline?: EnrichmentPipeline,
): Effect<unknown, AlphabetError, EnrichedContext> {
  const p = pipeline ?? new EnrichmentPipeline();
  return sync(() => p.enrich(signals, options));
}

// ─── decide ──────────────────────────────────────────────────────────────────

/**
 * Effect view of `HandshakeDecisionEngine.decide()`. Decision is pure
 * and total — wrap in `sync`.
 */
export function decideE(
  enriched: EnrichedContext,
  engine?: HandshakeDecisionEngine,
): Effect<unknown, AlphabetError, HandshakeDecision> {
  const e = engine ?? new HandshakeDecisionEngine();
  return sync(() => e.decide(enriched));
}

// ─── End-to-end ──────────────────────────────────────────────────────────────

/**
 * Compose the full handshake pipeline as a single effect:
 *   collect → enrich → decide.
 *
 * Equivalent in semantics to `HandshakeOrchestrator.run()` but expressed
 * in the Effect IR so it can be retried, raced, traced, or interrupted
 * by the runtime.
 */
export function handshakeE(options?: {
  readonly collector?: SignalCollectorOptions;
  readonly enrichment?: EnrichOptions;
}): Effect<unknown, AlphabetError, HandshakeDecision> {
  return flatMap(collectE(options?.collector), (signals) =>
    flatMap(enrichE(signals, options?.enrichment), (enriched) => decideE(enriched)),
  );
}
