/**
 * @file layer-selection.bench.ts
 * @description Benchmark `selectAdaptiveLayer` — pure decision function used
 * by `useAdaptiveLayer` and `AdaptiveSlot` on every render.
 */

import { Bench } from 'tinybench';
import { selectAdaptiveLayer } from '@awaf/ui/runtime';
import { benchOptions, isSmokeRun, printSuite, runBench } from './helpers.js';

export async function runLayerSelectionSuite(): Promise<void> {
  const smoke = isSmokeRun();
  const bench = new Bench(benchOptions(smoke));

  bench.add('selectAdaptiveLayer (capable desktop, R3F)', () => {
    selectAdaptiveLayer({
      webglSupported: true,
      canvas2dSupported: true,
      prefersReducedMotion: false,
      viewportWidth: 1920,
      networkType: '4g',
      isBrowser: true,
      r3fAvailable: true,
    });
  });

  bench.add('selectAdaptiveLayer (narrow viewport → CSS3D)', () => {
    selectAdaptiveLayer({
      webglSupported: true,
      canvas2dSupported: true,
      viewportWidth: 360,
      networkType: '4g',
      isBrowser: true,
      r3fAvailable: true,
    });
  });

  bench.add('selectAdaptiveLayer (no WebGL → Canvas2D)', () => {
    selectAdaptiveLayer({
      webglSupported: false,
      canvas2dSupported: true,
      viewportWidth: 1024,
      networkType: '4g',
      isBrowser: true,
    });
  });

  bench.add('selectAdaptiveLayer (reduced motion → STATIC_HTML)', () => {
    selectAdaptiveLayer({
      webglSupported: true,
      canvas2dSupported: true,
      prefersReducedMotion: true,
      isBrowser: true,
    });
  });

  bench.add('selectAdaptiveLayer (SSR → STATIC_HTML)', () => {
    selectAdaptiveLayer({ isBrowser: false });
  });

  const result = await runBench(bench, {
    name: 'layer-selection',
    budgets: {
      'selectAdaptiveLayer (capable desktop, R3F)': { meanMs: 0.1 },
      'selectAdaptiveLayer (narrow viewport → CSS3D)': { meanMs: 0.1 },
      'selectAdaptiveLayer (no WebGL → Canvas2D)': { meanMs: 0.1 },
      'selectAdaptiveLayer (reduced motion → STATIC_HTML)': { meanMs: 0.1 },
      'selectAdaptiveLayer (SSR → STATIC_HTML)': { meanMs: 0.1 },
    },
  });
  printSuite(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runLayerSelectionSuite();
}
