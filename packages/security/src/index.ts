/**
 * @module @awaf/security
 * @description
 * پکیج Security — defense in depth، ۸ دسته تهدید، NIST AI 100-1.
 * Security package — defense in depth, 8 threat categories, NIST AI 100-1.
 */

export type { AWAFError } from '@awaf/core';

// ─── Consent ─────────────────────────────────────────────────────────────────
export { ConsentTierManager } from './consent/consent-tier-manager.js';
export type {
  ConsentManagerState,
  ConsentTierExplanation,
  ConsentSnapshot,
  ConsentTierManagerOptions,
} from './consent/consent-tier-manager.js';
