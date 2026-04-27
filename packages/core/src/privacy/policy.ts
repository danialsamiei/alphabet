/**
 * @module privacy/policy
 * @description
 * Privacy policy helpers — توابع خالص برای بررسی اینکه چه عملیاتی در یک
 * حالت رضایت/حریم خصوصی مشخص مجاز است.
 *
 * Pure helpers that decide whether a given operation (memory storage,
 * personalization, analytics, precise geo) is allowed for a given consent
 * tier and privacy signal. The decision engine, enrichment pipeline, and
 * any downstream consumer must route through these helpers instead of
 * re-implementing the rules locally.
 */

import { type ConsentTier, CONSENT_TIER_LEVEL } from '../types/base.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * حداقل اندازه گروه k-anonymity برای فعال‌سازی analytics aggregative.
 * Minimum cohort size for k-anonymity-gated analytics.
 */
export const DEFAULT_K_ANONYMITY_THRESHOLD = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * سیگنال‌های حریم خصوصی مرورگر — DNT و GPC.
 * Browser-level privacy signals.
 */
export interface PrivacySignals {
  /** آیا DNT (Do Not Track) فعال است */
  readonly dntEnabled: boolean;
  /** آیا GPC (Global Privacy Control) فعال است */
  readonly gpcEnabled: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * بررسی فعال بودن سیگنال‌های privacy.
 * Returns true if any browser privacy signal is active.
 */
export function hasPrivacySignal(signals: PrivacySignals): boolean {
  return signals.dntEnabled || signals.gpcEnabled;
}

/**
 * آیا در این Tier ذخیره حافظه (storage) مجاز است.
 * Whether memory storage is allowed at this consent tier.
 *
 * Tier `NO_MEMORY` always rejects storage. Higher tiers are allowed.
 */
export function canStoreMemory(consentTier: ConsentTier): boolean {
  return CONSENT_TIER_LEVEL[consentTier] >= CONSENT_TIER_LEVEL.ANONYMOUS;
}

/**
 * آیا personalization (شخصی‌سازی محتوا/profiling) مجاز است.
 * Whether personalization/profiling is allowed.
 *
 * Personalization requires:
 *   - consent tier ≥ CONSENTED
 *   - no active DNT/GPC privacy signal
 */
export function canPersonalize(
  consentTier: ConsentTier,
  privacySignals: PrivacySignals
): boolean {
  if (hasPrivacySignal(privacySignals)) return false;
  return CONSENT_TIER_LEVEL[consentTier] >= CONSENT_TIER_LEVEL.CONSENTED;
}

/**
 * آیا analytics aggregative مجاز است.
 * Whether aggregate analytics are allowed.
 *
 * Analytics requires:
 *   - consent tier ≥ ANONYMOUS
 *   - cohort size ≥ k-anonymity threshold (default 5)
 *
 * DNT/GPC always force consent tier to NO_MEMORY at the manager level,
 * which makes this helper correctly return false in that case.
 */
export function canUseAnalytics(
  consentTier: ConsentTier,
  kAnonymity: number,
  threshold: number = DEFAULT_K_ANONYMITY_THRESHOLD
): boolean {
  if (CONSENT_TIER_LEVEL[consentTier] < CONSENT_TIER_LEVEL.ANONYMOUS) return false;
  return kAnonymity >= threshold;
}

/**
 * آیا precise geo (city / lat / lon) مجاز است.
 * Whether precise geo enrichment (city, latitude, longitude) is allowed.
 *
 * Precise geo requires the highest tier `ENRICHED`. Anything below — and
 * any active DNT/GPC signal — strips geo back to country/timezone/region.
 */
export function canUsePreciseGeo(
  consentTier: ConsentTier,
  privacySignals: PrivacySignals = { dntEnabled: false, gpcEnabled: false }
): boolean {
  if (hasPrivacySignal(privacySignals)) return false;
  return CONSENT_TIER_LEVEL[consentTier] >= CONSENT_TIER_LEVEL.ENRICHED;
}
