/**
 * @file intents.test.ts
 * @description Locks the two intent vocabularies (DomainIntent and
 * SuggestionActionIntent) against accidental drift. The constants are
 * re-used by intent-detection servers and suggestion-chip UIs, so any
 * silent reordering, duplication, or membership change is treated as
 * a public-API regression.
 */

import { describe, it, expect } from 'vitest';
import {
  DOMAIN_INTENTS,
  SUGGESTION_ACTION_INTENTS,
  type DomainIntent,
  type SuggestionActionIntent,
} from './intents.js';

describe('contracts/intents', () => {
  describe('DOMAIN_INTENTS', () => {
    it('exposes exactly the six documented domain intents in declaration order', () => {
      expect([...DOMAIN_INTENTS]).toEqual([
        'technology',
        'collaboration',
        'class_notes',
        'philosophy',
        'personal',
        'explore',
      ]);
    });

    it('contains no duplicates', () => {
      expect(new Set(DOMAIN_INTENTS).size).toBe(DOMAIN_INTENTS.length);
    });

    it('matches the DomainIntent type at compile time', () => {
      // Compile-time check: each constant must be assignable to the union.
      for (const intent of DOMAIN_INTENTS) {
        const typed: DomainIntent = intent;
        expect(typeof typed).toBe('string');
      }
    });
  });

  describe('SUGGESTION_ACTION_INTENTS', () => {
    it('exposes exactly the seven documented action intents in declaration order', () => {
      expect([...SUGGESTION_ACTION_INTENTS]).toEqual([
        'explore',
        'learn',
        'compare',
        'contact',
        'personalize',
        'language',
        'voice',
      ]);
    });

    it('contains no duplicates', () => {
      expect(new Set(SUGGESTION_ACTION_INTENTS).size).toBe(
        SUGGESTION_ACTION_INTENTS.length,
      );
    });

    it('matches the SuggestionActionIntent type at compile time', () => {
      for (const intent of SUGGESTION_ACTION_INTENTS) {
        const typed: SuggestionActionIntent = intent;
        expect(typeof typed).toBe('string');
      }
    });
  });

  describe('cross-vocabulary invariants', () => {
    it('reuses only "explore" between the two vocabularies (documented overlap)', () => {
      const overlap = DOMAIN_INTENTS.filter((d) =>
        (SUGGESTION_ACTION_INTENTS as readonly string[]).includes(d),
      );
      expect(overlap).toEqual(['explore']);
    });
  });
});
