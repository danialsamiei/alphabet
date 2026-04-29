/**
 * @file enrichment.bench.ts
 * @description Benchmark `EnrichmentPipeline.enrich()` — geo derivation,
 * referrer categorization, UTM extraction. No network access.
 *
 * Engineering target: < 5ms mean per call.
 */

import { Bench } from 'tinybench';
import { EnrichmentPipeline, type DetectedSignals } from '@alphabet/core';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

const pipeline = new EnrichmentPipeline();

const baseSignals: DetectedSignals = {
  language: 'fa',
  timezone: 'Asia/Tehran',
  deviceClass: 'desktop',
  platform: 'Linux x86_64',
  screenWidth: 1920,
  screenHeight: 1080,
  devicePixelRatio: 2,
  webglSupported: true,
  dntEnabled: false,
  gpcEnabled: false,
  prefersReducedMotion: false,
  referrer: 'https://www.google.com/search?q=alphabet',
  networkType: '4g',
};

const unknownTzSignals: DetectedSignals = {
  ...baseSignals,
  timezone: 'Antarctica/Vostok',
  referrer: '',
};

export async function runEnrichmentSuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  bench.add('EnrichmentPipeline.enrich (default coarse geo)', () => {
    pipeline.enrich(baseSignals);
  });

  bench.add('EnrichmentPipeline.enrich (precise geo allowed)', () => {
    pipeline.enrich(baseSignals, { allowPreciseGeo: true });
  });

  bench.add('EnrichmentPipeline.enrich (timezone fallback)', () => {
    pipeline.enrich(unknownTzSignals);
  });

  bench.add('EnrichmentPipeline.requiresGDPRConsent', () => {
    EnrichmentPipeline.requiresGDPRConsent('DE');
    EnrichmentPipeline.requiresGDPRConsent('US');
  });

  const result = await runBench(bench, {
    name: 'enrichment-pipeline',
    budgets: {
      'EnrichmentPipeline.enrich (default coarse geo)': { meanMs: 5 },
      'EnrichmentPipeline.enrich (precise geo allowed)': { meanMs: 5 },
      'EnrichmentPipeline.enrich (timezone fallback)': { meanMs: 5 },
      'EnrichmentPipeline.requiresGDPRConsent': { meanMs: 1 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runEnrichmentSuite();
}
