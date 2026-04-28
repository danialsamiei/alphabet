/**
 * @file handshake.bench.ts
 * @description
 * Vitest benchmarks for the end-to-end handshake (`collect → enrich → decide`).
 * Run with: `npx vitest bench src/handshake/handshake.bench.ts`.
 *
 * These are *throughput* benches, not latency budgets — the AGENTS.md
 * "<100 ms" target is a wall-clock budget for a single real-world
 * handshake, which is dominated by browser-side I/O we don't model here.
 * What this benchmark *does* verify is that the pure-CPU portion of the
 * pipeline is fast enough that any user-perceived latency comes from the
 * browser, not from us.
 */

import { bench, describe } from 'vitest';
import { HandshakeOrchestrator } from './orchestrator.js';
import { SignalCollector } from './signal-collector.js';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import { HandshakeDecisionEngine } from './decision-engine.js';
import type { DetectedSignals } from '../types/visitor.js';
import { ok } from '../types/result.js';

function fakeSignals(): DetectedSignals {
  return {
    language: 'fa',
    timezone: 'Asia/Tehran',
    deviceClass: 'desktop',
    platform: 'Linux x86_64',
    screenWidth: 1440,
    screenHeight: 900,
    devicePixelRatio: 1,
    webglSupported: true,
    networkType: '4g',
    dntEnabled: false,
    gpcEnabled: false,
    prefersReducedMotion: false,
    referrer: '',
  };
}

const fixedSignals = fakeSignals();

class FixedCollector extends SignalCollector {
  override collect(): ReturnType<SignalCollector['collect']> {
    return ok(fixedSignals);
  }
}

describe('handshake / individual stages', () => {
  const enrichment = new EnrichmentPipeline();
  const engine = new HandshakeDecisionEngine();
  const enriched = enrichment.enrich(fixedSignals);

  bench('SignalCollector.detectLayer', () => {
    SignalCollector.detectLayer(fixedSignals);
  });

  bench('EnrichmentPipeline.enrich', () => {
    enrichment.enrich(fixedSignals);
  });

  bench('HandshakeDecisionEngine.decide', () => {
    engine.decide(enriched);
  });
});

describe('handshake / orchestrator (collect → enrich → decide)', () => {
  const orchestrator = new HandshakeOrchestrator({
    collector: new FixedCollector(),
  });

  bench('HandshakeOrchestrator.run (full pipeline)', () => {
    orchestrator.run();
  });
});
