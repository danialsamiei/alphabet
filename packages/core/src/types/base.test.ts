/**
 * @file base.test.ts
 * @description Unit tests for base enums, type constants, and level maps.
 */

import { describe, it, expect } from 'vitest';
import {
  CONSENT_TIER_LEVEL,
  TRUST_TIER_COEFFICIENT,
  CAPABILITY_LAYER_LEVEL,
  TOKEN_TIER_LIMITS,
  LOG_LEVEL_ORDER,
  type ConsentTier,
  type TrustTier,
  type CapabilityLayer,
  type LogLevel,
} from './base.js';

describe('CONSENT_TIER_LEVEL', () => {
  it('should have correct ordering: NO_MEMORY < ANONYMOUS < CONSENTED < ENRICHED', () => {
    const noMemory = CONSENT_TIER_LEVEL['NO_MEMORY'];
    const anonymous = CONSENT_TIER_LEVEL['ANONYMOUS'];
    const consented = CONSENT_TIER_LEVEL['CONSENTED'];
    const enriched = CONSENT_TIER_LEVEL['ENRICHED'];

    expect(noMemory).toBeLessThan(anonymous);
    expect(anonymous).toBeLessThan(consented);
    expect(consented).toBeLessThan(enriched);
  });

  it('should map all ConsentTier values', () => {
    const tiers: ConsentTier[] = ['NO_MEMORY', 'ANONYMOUS', 'CONSENTED', 'ENRICHED'];
    for (const tier of tiers) {
      expect(typeof CONSENT_TIER_LEVEL[tier]).toBe('number');
    }
  });
});

describe('TRUST_TIER_COEFFICIENT', () => {
  it('should have T1 > T2 > T3', () => {
    expect(TRUST_TIER_COEFFICIENT['T1']).toBeGreaterThan(TRUST_TIER_COEFFICIENT['T2']);
    expect(TRUST_TIER_COEFFICIENT['T2']).toBeGreaterThan(TRUST_TIER_COEFFICIENT['T3']);
  });

  it('should have all values between 0 and 1', () => {
    const tiers: TrustTier[] = ['T1', 'T2', 'T3'];
    for (const tier of tiers) {
      const coeff = TRUST_TIER_COEFFICIENT[tier];
      expect(coeff).toBeGreaterThan(0);
      expect(coeff).toBeLessThanOrEqual(1);
    }
  });

  it('should have T1 = 0.95, T2 = 0.75, T3 = 0.40', () => {
    expect(TRUST_TIER_COEFFICIENT['T1']).toBe(0.95);
    expect(TRUST_TIER_COEFFICIENT['T2']).toBe(0.75);
    expect(TRUST_TIER_COEFFICIENT['T3']).toBe(0.40);
  });
});

describe('CAPABILITY_LAYER_LEVEL', () => {
  it('should have R3F_IMMERSIVE as level 1 (best)', () => {
    expect(CAPABILITY_LAYER_LEVEL['R3F_IMMERSIVE']).toBe(1);
  });

  it('should have TEXT_ONLY as level 5 (most degraded)', () => {
    expect(CAPABILITY_LAYER_LEVEL['TEXT_ONLY']).toBe(5);
  });

  it('should have monotonically increasing levels', () => {
    const layers: CapabilityLayer[] = [
      'R3F_IMMERSIVE',
      'CSS_3D',
      'CANVAS_2D',
      'STATIC_HTML',
      'TEXT_ONLY',
    ];
    for (let i = 0; i < layers.length - 1; i++) {
      const current = layers[i];
      const next = layers[i + 1];
      if (current && next) {
        expect(CAPABILITY_LAYER_LEVEL[current]).toBeLessThan(CAPABILITY_LAYER_LEVEL[next]);
      }
    }
  });
});

describe('TOKEN_TIER_LIMITS', () => {
  it('should have ANONYMOUS < CONSENTED < ADMIN', () => {
    expect(TOKEN_TIER_LIMITS['ANONYMOUS']).toBeLessThan(TOKEN_TIER_LIMITS['CONSENTED']);
    expect(TOKEN_TIER_LIMITS['CONSENTED']).toBeLessThan(TOKEN_TIER_LIMITS['ADMIN']);
  });

  it('should have positive limits', () => {
    expect(TOKEN_TIER_LIMITS['ANONYMOUS']).toBeGreaterThan(0);
    expect(TOKEN_TIER_LIMITS['CONSENTED']).toBeGreaterThan(0);
    expect(TOKEN_TIER_LIMITS['ADMIN']).toBeGreaterThan(0);
  });
});

describe('LOG_LEVEL_ORDER', () => {
  it('should have debug < info < warn < error', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    for (let i = 0; i < levels.length - 1; i++) {
      const current = levels[i];
      const next = levels[i + 1];
      if (current && next) {
        expect(LOG_LEVEL_ORDER[current]).toBeLessThan(LOG_LEVEL_ORDER[next]);
      }
    }
  });
});
