/**
 * @file run-all.ts
 * @description
 * Entry point for `pnpm benchmark`. Runs every AWAF microbenchmark suite
 * sequentially, prints a single combined summary, and sets a non-zero exit
 * code if any declared budget is violated.
 *
 * Pass `--smoke` for a CI-friendly fast pass that runs each task for a
 * handful of iterations (used by the `benchmark smoke check` CI step).
 */

import { runConsentPolicySuite } from './consent-policy.bench.js';
import { runDecisionEngineSuite } from './decision-engine.bench.js';
import { runEnrichmentSuite } from './enrichment.bench.js';
import { runLayerSelectionSuite } from './layer-selection.bench.js';
import { runRouteNormalizationSuite } from './route-normalization.bench.js';
import { runSignalCollectionSuite } from './signal-collection.bench.js';

async function main(): Promise<void> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-console
  console.log('AWAF benchmarks — engineering targets, not guaranteed claims.\n');
  await runSignalCollectionSuite();
  await runEnrichmentSuite();
  await runDecisionEngineSuite();
  await runRouteNormalizationSuite();
  await runConsentPolicySuite();
  await runLayerSelectionSuite();
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`\nDone in ${elapsed}s`);
  if (process.exitCode === 1) {
    // eslint-disable-next-line no-console
    console.error('\n⚠  One or more declared budgets were exceeded. See ❌ rows above.');
  }
}

void main();
