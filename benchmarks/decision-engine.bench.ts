/**
 * @file decision-engine.bench.ts
 * @description Benchmark `HandshakeDecisionEngine.decide()` — locale resolve,
 * direction resolve, hero copy, privacy mode derivation, CSS variables.
 *
 * Engineering target: < 2ms mean per call.
 */

import { Bench } from 'tinybench';
import {
  EnrichmentPipeline,
  HandshakeDecisionEngine,
  type DetectedSignals,
  type EnrichedContext,
} from '@awaf/core';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

const engine = new HandshakeDecisionEngine();
const pipeline = new EnrichmentPipeline();

const ltrSignals: DetectedSignals = {
  language: 'en',
  timezone: 'America/New_York',
  deviceClass: 'desktop',
  platform: 'MacIntel',
  screenWidth: 1440,
  screenHeight: 900,
  devicePixelRatio: 2,
  webglSupported: true,
  dntEnabled: false,
  gpcEnabled: false,
  prefersReducedMotion: false,
  referrer: '',
  networkType: '4g',
};

const rtlSignals: DetectedSignals = {
  ...ltrSignals,
  language: 'fa',
  timezone: 'Asia/Tehran',
};

const dntSignals: DetectedSignals = {
  ...ltrSignals,
  dntEnabled: true,
};

const ltrCtx: EnrichedContext = pipeline.enrich(ltrSignals);
const rtlCtx: EnrichedContext = pipeline.enrich(rtlSignals);
const dntCtx: EnrichedContext = pipeline.enrich(dntSignals);

export async function runDecisionEngineSuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  bench.add('HandshakeDecisionEngine.decide (LTR/en-US)', () => {
    engine.decide(ltrCtx);
  });

  bench.add('HandshakeDecisionEngine.decide (RTL/fa-IR)', () => {
    engine.decide(rtlCtx);
  });

  bench.add('HandshakeDecisionEngine.decide (DNT active)', () => {
    engine.decide(dntCtx);
  });

  const result = await runBench(bench, {
    name: 'decision-engine',
    budgets: {
      'HandshakeDecisionEngine.decide (LTR/en-US)': { meanMs: 2 },
      'HandshakeDecisionEngine.decide (RTL/fa-IR)': { meanMs: 2 },
      'HandshakeDecisionEngine.decide (DNT active)': { meanMs: 2 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runDecisionEngineSuite();
}
