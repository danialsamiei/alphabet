/**
 * @file orchestrator.test.ts
 * @description Unit tests for HandshakeOrchestrator — end-to-end pipeline,
 * dependency injection, error propagation per phase, and event emission.
 */

import { describe, it, expect, vi } from 'vitest';
import { HandshakeOrchestrator } from './orchestrator.js';
import { SignalCollector } from './signal-collector.js';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import { HandshakeDecisionEngine } from './decision-engine.js';
import { AlphabetEventEmitter } from '../events/alphabet-events.js';
import { createSessionId } from '../types/brands.js';
import type { VisitorId } from '../types/brands.js';
import type { DetectedSignals } from '../types/visitor.js';
import { err, ok, type Result, type AlphabetError } from '../types/result.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignals(overrides: Partial<DetectedSignals> = {}): DetectedSignals {
  return {
    language: 'fa',
    timezone: 'Asia/Tehran',
    deviceClass: 'desktop',
    platform: 'Linux x86_64',
    screenWidth: 1440,
    screenHeight: 900,
    devicePixelRatio: 1,
    webglSupported: true,
    dntEnabled: false,
    gpcEnabled: false,
    prefersReducedMotion: false,
    referrer: '',
    ...overrides,
  };
}

/**
 * Returns a SignalCollector whose `collect()` is mocked to return the
 * given Result. Achieved without subclassing by stubbing the prototype
 * method on a fresh instance.
 */
function stubCollector(
  result: Result<DetectedSignals, AlphabetError>
): SignalCollector {
  const collector = new SignalCollector();
  vi.spyOn(collector, 'collect').mockReturnValue(result);
  return collector;
}

// ─── HandshakeOrchestrator.run() ────────────────────────────────────────────

describe('HandshakeOrchestrator.run() — happy path', () => {
  it('returns full outcome with signals + enriched + decision', () => {
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
    });
    const result = orchestrator.run();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.signals.language).toBe('fa');
    expect(result.data.enriched.visitor.geo.country).toBe('IR');
    expect(result.data.decision.uiConfig.locale).toBe('fa-IR');
    expect(result.data.decision.uiConfig.direction).toBe('rtl');
    expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('honours injected visitorId and sessionId', () => {
    const visitorId = 'v-test-1234' as VisitorId;
    const sessionId = createSessionId();
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
    });
    const result = orchestrator.run({ visitorId, sessionId });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.enriched.visitor.visitorId).toBe(visitorId);
    expect(result.data.enriched.visitor.sessionId).toBe(sessionId);
  });

  it('forwards allowPreciseGeo only when explicitly enabled', () => {
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
    });
    const off = orchestrator.run();
    const on = orchestrator.run({ allowPreciseGeo: true });
    expect(off.success && off.data.enriched.visitor.geo.city).toBeUndefined();
    expect(on.success && on.data.enriched.visitor.geo.city).toBe('Tehran');
  });

  it('uses per-call collectorOptions over injected default collector', () => {
    // Default collector returns fa, override returns en via navigator stub.
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals({ language: 'fa' }))),
    });
    const result = orchestrator.run({
      collectorOptions: {
        navigator: { language: 'en-US' },
        screen: { width: 1440, height: 900 },
        matchMedia: () => ({ matches: false }),
        document: { referrer: '' },
        createCanvas: () => null, // forces webgl=false
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.signals.language).toBe('en');
    expect(result.data.signals.webglSupported).toBe(false);
  });
});

describe('HandshakeOrchestrator.run() — privacy mode', () => {
  it('reports DNT/GPC restriction without forcing layer to STATIC_HTML', () => {
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals({ dntEnabled: true }))),
    });
    const result = orchestrator.run();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.decision.privacyMode.restricted).toBe(true);
    expect(result.data.decision.privacyMode.memoryAllowed).toBe(false);
    // Render layer must NOT be downgraded by DNT/GPC.
    expect(result.data.decision.selectedLayer).toBe('R3F_IMMERSIVE');
  });

  it('downgrades layer to STATIC_HTML for prefers-reduced-motion', () => {
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals({ prefersReducedMotion: true }))),
    });
    const result = orchestrator.run();
    expect(result.success && result.data.decision.selectedLayer).toBe('STATIC_HTML');
  });
});

describe('HandshakeOrchestrator.run() — error propagation', () => {
  it('reports collect-phase failure with phase=collect in details', () => {
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(
        err({ code: 'SIGNAL_COLLECTION_FAILED', message: 'navigator missing' })
      ),
    });
    const result = orchestrator.run();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('SIGNAL_COLLECTION_FAILED');
    expect(result.error.details?.['phase']).toBe('collect');
  });

  it('reports enrich-phase failure when pipeline throws', () => {
    const pipeline = new EnrichmentPipeline();
    vi.spyOn(pipeline, 'enrich').mockImplementation(() => {
      throw new Error('boom-enrich');
    });
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
      pipeline,
    });
    const result = orchestrator.run();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('ENRICHMENT_FAILED');
    expect(result.error.details?.['phase']).toBe('enrich');
    expect(JSON.stringify(result.error.details)).toContain('boom-enrich');
  });

  it('reports decide-phase failure when engine throws', () => {
    const engine = new HandshakeDecisionEngine();
    vi.spyOn(engine, 'decide').mockImplementation(() => {
      throw new Error('boom-decide');
    });
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
      engine,
    });
    const result = orchestrator.run();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('DECISION_FAILED');
    expect(result.error.details?.['phase']).toBe('decide');
  });
});

describe('HandshakeOrchestrator.run() — event emission', () => {
  it('emits handshake:complete with sessionId + layer on success', () => {
    const events = new AlphabetEventEmitter();
    const seen: Array<{ sessionId: string; layer: string }> = [];
    events.on('handshake:complete', (p) => {
      seen.push({ sessionId: p.sessionId, layer: p.layer });
    });
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
      events,
    });
    const result = orchestrator.run();
    expect(result.success).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.layer).toBe('R3F_IMMERSIVE');
    expect(seen[0]?.sessionId).toMatch(/^sess-/);
  });

  it('emits handshake:error with phase + code on failure', () => {
    const events = new AlphabetEventEmitter();
    const seen: Array<{ phase: string; code: string }> = [];
    events.on('handshake:error', (p) => {
      seen.push({ phase: p.phase, code: p.code });
    });
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(
        err({ code: 'SIGNAL_COLLECTION_FAILED', message: 'no nav' })
      ),
      events,
    });
    orchestrator.run();
    expect(seen).toEqual([{ phase: 'collect', code: 'SIGNAL_COLLECTION_FAILED' }]);
  });

  it('does not emit handshake:complete when a phase fails', () => {
    const events = new AlphabetEventEmitter();
    const onComplete = vi.fn();
    events.on('handshake:complete', onComplete);
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(
        err({ code: 'SIGNAL_COLLECTION_FAILED', message: 'x' })
      ),
      events,
    });
    orchestrator.run();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('HandshakeOrchestrator — durationMs', () => {
  it('measures elapsed time using the injected clock', () => {
    let t = 1000;
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
      now: () => {
        const v = t;
        t += 17; // +17ms per call → start=1000, end=1017
        return v;
      },
    });
    const result = orchestrator.run();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.durationMs).toBe(17);
  });

  it('clamps negative deltas (clock skew) to 0', () => {
    const calls = [2000, 1000];
    const orchestrator = new HandshakeOrchestrator({
      collector: stubCollector(ok(makeSignals())),
      now: () => calls.shift() ?? 0,
    });
    const result = orchestrator.run();
    expect(result.success && result.data.durationMs).toBe(0);
  });
});
