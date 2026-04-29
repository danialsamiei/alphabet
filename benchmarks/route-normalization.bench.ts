/**
 * @file route-normalization.bench.ts
 * @description Benchmark `normalizeApiBaseUrl` and `joinRoute` — these are
 * called on every HTTP request issued by `AlphabetClient` and `HandshakeClient`.
 */

import { Bench } from 'tinybench';
import { ALPHABET_ROUTES, joinRoute, normalizeApiBaseUrl } from '@alphabet/core';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

const bareOrigin = 'https://example.com/';
const legacyApi = 'https://example.com/api/';
const canonical = 'https://example.com/api/alphabet/v1/';
const trailingSlashes = 'https://example.com////';
const normalized = normalizeApiBaseUrl(canonical);

export async function runRouteNormalizationSuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  bench.add('normalizeApiBaseUrl (bare origin)', () => {
    normalizeApiBaseUrl(bareOrigin);
  });

  bench.add('normalizeApiBaseUrl (legacy /api)', () => {
    normalizeApiBaseUrl(legacyApi);
  });

  bench.add('normalizeApiBaseUrl (already canonical)', () => {
    normalizeApiBaseUrl(canonical);
  });

  bench.add('normalizeApiBaseUrl (trailing slashes)', () => {
    normalizeApiBaseUrl(trailingSlashes);
  });

  bench.add('joinRoute (contextHandshake)', () => {
    joinRoute(normalized, ALPHABET_ROUTES.contextHandshake);
  });

  const result = await runBench(bench, {
    name: 'route-normalization',
    budgets: {
      'normalizeApiBaseUrl (bare origin)': { meanMs: 0.5 },
      'normalizeApiBaseUrl (legacy /api)': { meanMs: 0.5 },
      'normalizeApiBaseUrl (already canonical)': { meanMs: 0.5 },
      'normalizeApiBaseUrl (trailing slashes)': { meanMs: 0.5 },
      'joinRoute (contextHandshake)': { meanMs: 0.1 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runRouteNormalizationSuite();
}
