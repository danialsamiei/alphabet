/**
 * @file signal-collection.bench.ts
 * @description Benchmark `SignalCollector.collect()` — the entry point of the
 * Context Handshake hot path. Runs in a Node-only (no real DOM) environment
 * with injected fakes for `navigator`, `screen`, `document`, and `matchMedia`,
 * which is what `SignalCollector` was designed to support for testability.
 *
 * Engineering target: < 5ms mean per call (browser-like mock environment).
 */

import { Bench } from 'tinybench';
import { SignalCollector } from '@awaf/core';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

const fakeMatchMedia = (query: string): { readonly matches: boolean } => ({
  matches: query.includes('reduced-motion') ? false : false,
});

const baseOptions = {
  navigator: {
    language: 'en-US',
    languages: ['en-US', 'en'],
    platform: 'Linux x86_64',
    doNotTrack: '0',
    globalPrivacyControl: false,
  },
  screen: { width: 1920, height: 1080 },
  document: { referrer: 'https://www.google.com/search' },
  devicePixelRatio: 2,
  matchMedia: fakeMatchMedia,
  createCanvas: () => ({
    getContext: () => null,
  }) as unknown as HTMLCanvasElement,
} as const;

export async function runSignalCollectionSuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  const collectorWebgl = new SignalCollector({
    ...baseOptions,
    createCanvas: () =>
      ({
        getContext: (type: string) => (type === 'webgl' || type === 'webgl2' ? {} : null),
      }) as unknown as HTMLCanvasElement,
  });
  const collectorNoWebgl = new SignalCollector(baseOptions);

  bench.add('SignalCollector.collect (WebGL available)', () => {
    collectorWebgl.collect();
  });

  bench.add('SignalCollector.collect (no WebGL)', () => {
    collectorNoWebgl.collect();
  });

  bench.add('SignalCollector.detectLayer (capable desktop)', () => {
    SignalCollector.detectLayer({
      language: 'en',
      timezone: 'UTC',
      deviceClass: 'desktop',
      platform: 'Linux',
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
      webglSupported: true,
      dntEnabled: false,
      gpcEnabled: false,
      prefersReducedMotion: false,
      referrer: '',
      networkType: '4g',
    });
  });

  const result = await runBench(bench, {
    name: 'signal-collection',
    budgets: {
      'SignalCollector.collect (WebGL available)': { meanMs: 5 },
      'SignalCollector.collect (no WebGL)': { meanMs: 5 },
      'SignalCollector.detectLayer (capable desktop)': { meanMs: 1 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runSignalCollectionSuite();
}
