/**
 * @module privacy/index
 * @description Barrel export for the privacy policy helpers.
 */

export {
  canStoreMemory,
  canPersonalize,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
  DEFAULT_K_ANONYMITY_THRESHOLD,
} from './policy.js';
export type { PrivacySignals } from './policy.js';
