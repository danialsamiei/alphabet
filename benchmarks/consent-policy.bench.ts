/**
 * @file consent-policy.bench.ts
 * @description Benchmark consent policy helpers — `canStoreMemory`,
 * `canPersonalize`, `canUseAnalytics`, `canUsePreciseGeo`, `hasPrivacySignal`.
 *
 * These run on every memory operation and personalization decision so they
 * must remain effectively O(1).
 */

import { Bench } from 'tinybench';
import {
  canPersonalize,
  canStoreMemory,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
  type PrivacySignals,
} from '@alphabet/core';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

const noSignals: PrivacySignals = { dntEnabled: false, gpcEnabled: false };
const dntSignals: PrivacySignals = { dntEnabled: true, gpcEnabled: false };
const gpcSignals: PrivacySignals = { dntEnabled: false, gpcEnabled: true };

export async function runConsentPolicySuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  bench.add('hasPrivacySignal (none)', () => {
    hasPrivacySignal(noSignals);
  });

  bench.add('hasPrivacySignal (DNT)', () => {
    hasPrivacySignal(dntSignals);
  });

  bench.add('canStoreMemory (CONSENTED)', () => {
    canStoreMemory('CONSENTED');
  });

  bench.add('canStoreMemory (NO_MEMORY)', () => {
    canStoreMemory('NO_MEMORY');
  });

  bench.add('canPersonalize (CONSENTED, no signals)', () => {
    canPersonalize('CONSENTED', noSignals);
  });

  bench.add('canPersonalize (CONSENTED, GPC active)', () => {
    canPersonalize('CONSENTED', gpcSignals);
  });

  bench.add('canUseAnalytics (ANONYMOUS, large cohort)', () => {
    canUseAnalytics('ANONYMOUS', 100);
  });

  bench.add('canUsePreciseGeo (ENRICHED, no signals)', () => {
    canUsePreciseGeo('ENRICHED', noSignals);
  });

  const result = await runBench(bench, {
    name: 'consent-policy',
    budgets: {
      'hasPrivacySignal (none)': { meanMs: 0.05 },
      'hasPrivacySignal (DNT)': { meanMs: 0.05 },
      'canStoreMemory (CONSENTED)': { meanMs: 0.05 },
      'canStoreMemory (NO_MEMORY)': { meanMs: 0.05 },
      'canPersonalize (CONSENTED, no signals)': { meanMs: 0.05 },
      'canPersonalize (CONSENTED, GPC active)': { meanMs: 0.05 },
      'canUseAnalytics (ANONYMOUS, large cohort)': { meanMs: 0.05 },
      'canUsePreciseGeo (ENRICHED, no signals)': { meanMs: 0.05 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runConsentPolicySuite();
}
