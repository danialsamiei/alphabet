/**
 * @module handshake/orchestrator
 * @description
 * HandshakeOrchestrator — اجرای end-to-end فازهای Context Handshake.
 *
 * Runs the full Context Handshake pipeline as a single call:
 *   1. **collect** — `SignalCollector.collect()` for passive browser signals.
 *   2. **enrich**  — `EnrichmentPipeline.enrich()` for coarse geo + referrer.
 *   3. **decide**  — `HandshakeDecisionEngine.decide()` for UI config + layer.
 *
 * The orchestrator is dependency-injection friendly (collector / pipeline /
 * engine can all be replaced for tests) and never throws — every failure
 * path is reported via `Result<HandshakeOutcome, AWAFError>`.
 *
 * **Privacy contract.** The orchestrator forwards `allowPreciseGeo` to the
 * enrichment pipeline only when the caller has *already* verified consent.
 * It never decides on consent itself; that is `ConsentTierManager`'s job.
 *
 * **Events.** When an `AWAFEventEmitter` is supplied, the orchestrator emits
 * `handshake:complete` on success and `handshake:error` on failure with the
 * failing phase name. No payload contains PII.
 */

import type { AWAFEventEmitter } from '../events/awaf-events.js';
import type { DetectedSignals, EnrichedContext } from '../types/visitor.js';
import type { HandshakeDecision } from '../types/api.js';
import type { VisitorId, SessionId } from '../types/brands.js';
import { type AWAFError, type Result, ok, err } from '../types/result.js';
import { SignalCollector, type SignalCollectorOptions } from './signal-collector.js';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import { HandshakeDecisionEngine } from './decision-engine.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * فاز جاری handshake — برای گزارش خطا.
 * The phase that produced an error, used in `handshake:error` events and
 * `AWAFError.details.phase`.
 */
export type HandshakePhase = 'collect' | 'enrich' | 'decide';

/**
 * خروجی کامل اجرای handshake — هر سه آرتیفکت میانی + تصمیم نهایی.
 * Full output of a successful handshake run.
 */
export interface HandshakeOutcome {
  /** سیگنال‌های جمع‌آوری‌شده در فاز collect */
  readonly signals: DetectedSignals;
  /** زمینه غنی‌شده در فاز enrich */
  readonly enriched: EnrichedContext;
  /** تصمیم نهایی UI و layer در فاز decide */
  readonly decision: HandshakeDecision;
  /** زمان اجرا (میلی‌ثانیه) — صرفاً برای telemetry در سمت مصرف‌کننده */
  readonly durationMs: number;
}

/**
 * گزینه‌های اجرای `HandshakeOrchestrator.run()`.
 * Options for `HandshakeOrchestrator.run()`.
 */
export interface HandshakeRunOptions {
  /** override برای SignalCollector (مفید برای SSR / تست) */
  readonly collectorOptions?: SignalCollectorOptions;
  /** visitor id موجود — اگر داده نشود، یک anonymous id ساخته می‌شود */
  readonly visitorId?: VisitorId;
  /** session id موجود — اگر داده نشود، یکی ساخته می‌شود */
  readonly sessionId?: SessionId;
  /**
   * اجازه precise geo. **هرگز** بدون تأیید
   * `canUsePreciseGeo(consentTier, privacySignals)` true نباشد.
   * Allow precise-geo enrichment. Callers MUST verify consent first.
   */
  readonly allowPreciseGeo?: boolean;
}

/** گزینه‌های ساخت `HandshakeOrchestrator`. */
export interface HandshakeOrchestratorOptions {
  /** override SignalCollector — برای DI و تست */
  readonly collector?: SignalCollector;
  /** override EnrichmentPipeline — برای DI و تست */
  readonly pipeline?: EnrichmentPipeline;
  /** override HandshakeDecisionEngine — برای DI و تست */
  readonly engine?: HandshakeDecisionEngine;
  /** event emitter برای انتشار `handshake:complete` / `handshake:error` */
  readonly events?: AWAFEventEmitter;
  /** ساعت قابل تعویض (برای deterministic tests) — پیش‌فرض `Date.now` */
  readonly now?: () => number;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * هماهنگ‌کننده end-to-end Context Handshake.
 * End-to-end orchestrator for the Context Handshake pipeline.
 *
 * @example
 * const orchestrator = new HandshakeOrchestrator();
 * const result = orchestrator.run();
 * if (result.success) {
 *   const { decision, signals, enriched } = result.data;
 *   applyUI(decision.uiConfig);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 *
 * @example
 * // With event emitter (e.g. wired into the AWAF event hub):
 * const events = new AWAFEventEmitter();
 * events.on('handshake:complete', (p) => track('handshake.ok', p));
 * events.on('handshake:error', (p) => track('handshake.fail', p));
 * new HandshakeOrchestrator({ events }).run();
 */
export class HandshakeOrchestrator {
  private readonly pipeline: EnrichmentPipeline;
  private readonly engine: HandshakeDecisionEngine;
  private readonly events: AWAFEventEmitter | undefined;
  private readonly defaultCollector: SignalCollector | undefined;
  private readonly now: () => number;

  constructor(options: HandshakeOrchestratorOptions = {}) {
    this.pipeline = options.pipeline ?? new EnrichmentPipeline();
    this.engine = options.engine ?? new HandshakeDecisionEngine();
    this.events = options.events;
    this.defaultCollector = options.collector;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * اجرای کامل پایپلاین handshake.
   * Runs the full pipeline. Never throws — failures are returned as
   * `Result.err` with `details.phase` set to the failing phase.
   *
   * @param options - گزینه‌های اجرا
   * @returns Result<HandshakeOutcome, AWAFError>
   */
  run(options: HandshakeRunOptions = {}): Result<HandshakeOutcome, AWAFError> {
    const startedAt = this.now();

    // ─── Phase 1: collect ────────────────────────────────────────────────
    const collector = this.resolveCollector(options.collectorOptions);
    const collectResult = collector.collect();
    if (!collectResult.success) {
      return this.fail('collect', collectResult.error);
    }
    const signals = collectResult.data;

    // ─── Phase 2: enrich ─────────────────────────────────────────────────
    let enriched: EnrichedContext;
    try {
      enriched = this.pipeline.enrich(signals, {
        ...(options.visitorId !== undefined ? { visitorId: options.visitorId } : {}),
        ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        ...(options.allowPreciseGeo === true ? { allowPreciseGeo: true } : {}),
      });
    } catch (e) {
      return this.fail('enrich', {
        code: 'ENRICHMENT_FAILED',
        message: 'Enrichment pipeline threw an unexpected error',
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }

    // ─── Phase 3: decide ─────────────────────────────────────────────────
    let decision: HandshakeDecision;
    try {
      decision = this.engine.decide(enriched);
    } catch (e) {
      return this.fail('decide', {
        code: 'DECISION_FAILED',
        message: 'Decision engine threw an unexpected error',
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }

    const durationMs = Math.max(0, this.now() - startedAt);

    this.events?.emit('handshake:complete', {
      sessionId: enriched.visitor.sessionId,
      layer: decision.selectedLayer,
    });

    return ok({ signals, enriched, decision, durationMs });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private resolveCollector(overrides?: SignalCollectorOptions): SignalCollector {
    // Per-call collectorOptions take precedence; otherwise reuse the
    // injected default collector; otherwise build a fresh one.
    if (overrides !== undefined) return new SignalCollector(overrides);
    if (this.defaultCollector !== undefined) return this.defaultCollector;
    return new SignalCollector();
  }

  private fail(
    phase: HandshakePhase,
    cause: AWAFError
  ): Result<HandshakeOutcome, AWAFError> {
    const details: Record<string, unknown> = { phase };
    if (cause.details !== undefined) details['cause'] = cause.details;
    const error: AWAFError = {
      code: cause.code,
      message: cause.message,
      details,
    };
    this.events?.emit('handshake:error', {
      phase,
      code: error.code,
      message: error.message,
    });
    return err(error);
  }
}
