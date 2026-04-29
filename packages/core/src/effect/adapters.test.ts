/**
 * @file adapters.test.ts
 * @description Tests for the Effect view of SignalCollector / Enrichment / Decision.
 */

import { describe, it, expect } from 'vitest';
import { collectE, enrichE, decideE, handshakeE } from './adapters.js';
import { runEffect } from './effect.js';
import { exitToResult } from './exit.js';

describe('Adapters / collectE', () => {
  it('produces signals with default options', async () => {
    const exit = await runEffect(collectE(), undefined);
    expect(exit._tag).toBe('Success');
    if (exit._tag === 'Success') {
      expect(typeof exit.value.language).toBe('string');
      expect(typeof exit.value.timezone).toBe('string');
    }
  });
});

describe('Adapters / enrichE + decideE', () => {
  it('enrich + decide yields a HandshakeDecision', async () => {
    const collectExit = await runEffect(collectE(), undefined);
    if (collectExit._tag !== 'Success') throw new Error('collect failed');
    const enrichExit = await runEffect(enrichE(collectExit.value), undefined);
    if (enrichExit._tag !== 'Success') throw new Error('enrich failed');
    const decideExit = await runEffect(decideE(enrichExit.value), undefined);
    if (decideExit._tag !== 'Success') throw new Error('decide failed');
    expect(decideExit.value.selectedLayer).toBeDefined();
    expect(decideExit.value.uiConfig.locale).toBeDefined();
  });
});

describe('Adapters / handshakeE end-to-end', () => {
  it('runs the full handshake as a single effect', async () => {
    const exit = await runEffect(handshakeE(), undefined);
    expect(exit._tag).toBe('Success');
    const r = exitToResult(exit);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.selectedLayer).toBeDefined();
    }
  });

  it('passes collector options through', async () => {
    const exit = await runEffect(
      handshakeE({
        collector: {
          navigator: {
            language: 'fa',
            languages: ['fa-IR'],
            userAgent: 'Mozilla/5.0',
          },
        },
      }),
      undefined,
    );
    if (exit._tag !== 'Success') throw new Error('expected success');
    expect(exit.value.uiConfig.locale.startsWith('fa')).toBe(true);
  });
});
