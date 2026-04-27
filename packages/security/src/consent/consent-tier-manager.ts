/**
 * @module consent/consent-tier-manager
 * @description
 * ConsentTierManager — ماشین حالت رضایت با enforcement کامل کد.
 *
 * State machine for visitor consent that enforces the privacy contract by
 * code, not just by documentation. Provides a transparent explanation
 * object that lists exactly what data may be processed at each tier.
 *
 * **States:** `pending` → `granted` → `revoked` (with `reset` returning to
 * `pending`).
 *
 * **Tiers:** `NO_MEMORY` < `ANONYMOUS` < `CONSENTED` < `ENRICHED`.
 *
 * **Monotonic upgrade rule:** within a `granted` state, the tier can only
 * move upwards. Downgrades require an explicit privacy signal
 * (`downgradeOnPrivacySignal`), an explicit `revoke`, or a `reset`.
 *
 * **Policy versioning:** when a privacy policy is updated, calling
 * `invalidateOnPolicyChange(newVersion)` invalidates any granted consent
 * that was given against an older version (state → `pending`, tier →
 * `NO_MEMORY`).
 */

import {
  type ConsentTier,
  type Result,
  type AWAFError,
  type PrivacySignals,
  CONSENT_TIER_LEVEL,
  ok,
  err,
  canPersonalize,
  canStoreMemory,
  canUseAnalytics,
  canUsePreciseGeo,
} from '@awaf/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/** وضعیت ماشین حالت رضایت */
export type ConsentManagerState = 'pending' | 'granted' | 'revoked';

/**
 * توضیح transparent از قابلیت‌های هر Tier — برای نمایش به کاربر.
 * Transparent explanation of what each tier permits — designed to be shown
 * directly in a consent UI.
 */
export interface ConsentTierExplanation {
  readonly tier: ConsentTier;
  /** خلاصه قابل نمایش به کاربر */
  readonly summary: string;
  /** آیا حافظه مجاز است */
  readonly memoryAllowed: boolean;
  /** آیا personalization مجاز است (با فرض نبود DNT/GPC) */
  readonly personalizationAllowed: boolean;
  /** آیا analytics aggregative مجاز است */
  readonly analyticsAllowed: boolean;
  /** آیا precise geo مجاز است */
  readonly preciseGeoAllowed: boolean;
  /** فهرست داده‌هایی که در این tier پردازش می‌شوند */
  readonly dataProcessed: readonly string[];
}

/**
 * snapshot کامل از وضعیت Consent Manager.
 * Full snapshot of the consent manager state.
 */
export interface ConsentSnapshot {
  readonly state: ConsentManagerState;
  readonly tier: ConsentTier;
  readonly policyVersion: string;
  readonly grantedAt?: string;
  readonly revokedAt?: string;
  readonly downgradedAt?: string;
  readonly lastReason?: string;
}

/** گزینه‌های ساخت `ConsentTierManager` */
export interface ConsentTierManagerOptions {
  /** نسخه policy کنونی — بعد از تغییر، رضایت‌های قدیمی invalidate می‌شوند */
  readonly policyVersion: string;
  /** Tier اولیه — پیش‌فرض NO_MEMORY */
  readonly initialTier?: ConsentTier;
}

// ─── Tier Explanations ────────────────────────────────────────────────────────

const NO_PRIVACY_SIGNAL: PrivacySignals = { dntEnabled: false, gpcEnabled: false };

const TIER_EXPLANATIONS: Readonly<Record<ConsentTier, ConsentTierExplanation>> = {
  NO_MEMORY: {
    tier: 'NO_MEMORY',
    summary: 'No memory. Nothing about you is stored, profiled, or tracked.',
    memoryAllowed: canStoreMemory('NO_MEMORY'),
    personalizationAllowed: canPersonalize('NO_MEMORY', NO_PRIVACY_SIGNAL),
    analyticsAllowed: canUseAnalytics('NO_MEMORY', Number.POSITIVE_INFINITY),
    preciseGeoAllowed: canUsePreciseGeo('NO_MEMORY', NO_PRIVACY_SIGNAL),
    dataProcessed: [
      'Browser language (used in-memory only for current request)',
      'IANA timezone (used in-memory only)',
      'Country derived from timezone (used in-memory only)',
      'Region group derived from timezone (used in-memory only)',
    ],
  },
  ANONYMOUS: {
    tier: 'ANONYMOUS',
    summary: 'Anonymous session-only memory. Cleared when the tab closes.',
    memoryAllowed: canStoreMemory('ANONYMOUS'),
    personalizationAllowed: canPersonalize('ANONYMOUS', NO_PRIVACY_SIGNAL),
    analyticsAllowed: canUseAnalytics('ANONYMOUS', Number.POSITIVE_INFINITY),
    preciseGeoAllowed: canUsePreciseGeo('ANONYMOUS', NO_PRIVACY_SIGNAL),
    dataProcessed: [
      'Everything in NO_MEMORY',
      'Ephemeral session id (cleared on tab close)',
      'Aggregate, k-anonymous analytics (cohort size ≥ k)',
    ],
  },
  CONSENTED: {
    tier: 'CONSENTED',
    summary: 'Cross-session preferences and personalization with explicit opt-in.',
    memoryAllowed: canStoreMemory('CONSENTED'),
    personalizationAllowed: canPersonalize('CONSENTED', NO_PRIVACY_SIGNAL),
    analyticsAllowed: canUseAnalytics('CONSENTED', Number.POSITIVE_INFINITY),
    preciseGeoAllowed: canUsePreciseGeo('CONSENTED', NO_PRIVACY_SIGNAL),
    dataProcessed: [
      'Everything in ANONYMOUS',
      'Stable visitor id (rotating, no cookies, no fingerprinting)',
      'Explicit preferences: theme, locale, content depth',
      'Personalized chip suggestions',
    ],
  },
  ENRICHED: {
    tier: 'ENRICHED',
    summary: 'Behavioral learning, vector embeddings, and precise geo.',
    memoryAllowed: canStoreMemory('ENRICHED'),
    personalizationAllowed: canPersonalize('ENRICHED', NO_PRIVACY_SIGNAL),
    analyticsAllowed: canUseAnalytics('ENRICHED', Number.POSITIVE_INFINITY),
    preciseGeoAllowed: canUsePreciseGeo('ENRICHED', NO_PRIVACY_SIGNAL),
    dataProcessed: [
      'Everything in CONSENTED',
      'Vector embeddings of interests for retrieval',
      'Behavioral learning signals (within consented purposes)',
      'Precise geo (city, coarse latitude, coarse longitude)',
    ],
  },
} as const;

// ─── ConsentTierManager Class ─────────────────────────────────────────────────

/**
 * مدیر ماشین حالت رضایت — enforcer رفتار حافظه و personalization.
 * The consent state machine enforcer.
 *
 * @example
 * const mgr = new ConsentTierManager({ policyVersion: '2025-04-01' });
 * mgr.grant('CONSENTED');
 * mgr.canStoreMemory();          // true
 * mgr.downgradeOnPrivacySignal({ dntEnabled: true, gpcEnabled: false });
 * mgr.snapshot().tier;           // 'NO_MEMORY'
 */
export class ConsentTierManager {
  private state: ConsentManagerState = 'pending';
  private tier: ConsentTier;
  private readonly policyVersion: string;
  private grantedAt: string | undefined;
  private revokedAt: string | undefined;
  private downgradedAt: string | undefined;
  private lastReason: string | undefined;

  constructor(options: ConsentTierManagerOptions) {
    this.policyVersion = options.policyVersion;
    this.tier = options.initialTier ?? 'NO_MEMORY';
  }

  // ─── State transitions ────────────────────────────────────────────────────

  /**
   * اعطای رضایت با Tier مشخص.
   * Grants consent at the requested tier. Honours the monotonic upgrade
   * rule when in `granted` state — the tier can only move upwards. To
   * intentionally lower the tier, call `revoke()` first or use
   * `downgradeOnPrivacySignal()`.
   *
   * @returns Result with the new snapshot, or an `AWAFError` on violation.
   */
  grant(tier: ConsentTier): Result<ConsentSnapshot, AWAFError> {
    if (this.state === 'granted' && CONSENT_TIER_LEVEL[tier] < CONSENT_TIER_LEVEL[this.tier]) {
      return err({
        code: 'CONSENT_DOWNGRADE_FORBIDDEN',
        message: `Cannot downgrade consent from ${this.tier} to ${tier} without explicit revoke or privacy signal`,
        details: { current: this.tier, requested: tier },
      });
    }
    this.state = 'granted';
    this.tier = tier;
    this.grantedAt = new Date().toISOString();
    this.revokedAt = undefined;
    this.downgradedAt = undefined;
    this.lastReason = 'grant';
    return ok(this.snapshot());
  }

  /**
   * Revoke رضایت — حالت به `revoked` و tier به `NO_MEMORY` می‌رود.
   * Revokes consent. State → `revoked`, tier → `NO_MEMORY`. Stored data
   * MUST be cleared by the caller (this manager only handles state).
   */
  revoke(): ConsentSnapshot {
    this.state = 'revoked';
    this.tier = 'NO_MEMORY';
    this.revokedAt = new Date().toISOString();
    this.lastReason = 'revoke';
    return this.snapshot();
  }

  /**
   * Reset به حالت اولیه `pending` با tier `NO_MEMORY`.
   * Resets the manager to its initial pristine state. Useful after a
   * complete data erasure (GDPR Article 17).
   */
  reset(): ConsentSnapshot {
    this.state = 'pending';
    this.tier = 'NO_MEMORY';
    this.grantedAt = undefined;
    this.revokedAt = undefined;
    this.downgradedAt = undefined;
    this.lastReason = 'reset';
    return this.snapshot();
  }

  /**
   * Downgrade خودکار در پاسخ به DNT/GPC.
   * Auto-downgrade in response to a privacy signal (DNT/GPC). Tier drops
   * to `NO_MEMORY` regardless of current grant. State stays `granted` if
   * it was granted, but with the lowest tier — this preserves the audit
   * trail that the user originally chose to engage.
   */
  downgradeOnPrivacySignal(signals: PrivacySignals): ConsentSnapshot {
    if (!signals.dntEnabled && !signals.gpcEnabled) {
      return this.snapshot();
    }
    this.tier = 'NO_MEMORY';
    this.downgradedAt = new Date().toISOString();
    this.lastReason = signals.gpcEnabled ? 'gpc' : 'dnt';
    return this.snapshot();
  }

  /**
   * Invalidate رضایت بعد از تغییر نسخه policy.
   * Invalidates a previously-granted consent if it was issued against an
   * older policy version. After invalidation the visitor must re-consent.
   *
   * @param newPolicyVersion - نسخه جدید policy
   * @returns true اگر invalidate انجام شد، false اگر نیازی نبود
   */
  invalidateOnPolicyChange(newPolicyVersion: string): boolean {
    if (newPolicyVersion === this.policyVersion) return false;
    this.state = 'pending';
    this.tier = 'NO_MEMORY';
    this.grantedAt = undefined;
    this.lastReason = `policy_change:${this.policyVersion}->${newPolicyVersion}`;
    return true;
  }

  // ─── Permission predicates ────────────────────────────────────────────────

  /** آیا در حالت کنونی ذخیره حافظه مجاز است */
  canStoreMemory(): boolean {
    return this.state === 'granted' && canStoreMemory(this.tier);
  }

  /** آیا در حالت کنونی personalization مجاز است */
  canPersonalize(privacySignals: PrivacySignals = NO_PRIVACY_SIGNAL): boolean {
    return this.state === 'granted' && canPersonalize(this.tier, privacySignals);
  }

  /** آیا در حالت کنونی analytics مجاز است (با cohort size مشخص) */
  canUseAnalytics(kAnonymity: number, threshold?: number): boolean {
    if (this.state !== 'granted') return false;
    return canUseAnalytics(this.tier, kAnonymity, threshold);
  }

  /** آیا در حالت کنونی precise geo مجاز است */
  canUsePreciseGeo(privacySignals: PrivacySignals = NO_PRIVACY_SIGNAL): boolean {
    return this.state === 'granted' && canUsePreciseGeo(this.tier, privacySignals);
  }

  // ─── Inspection ───────────────────────────────────────────────────────────

  /** snapshot کامل از وضعیت کنونی */
  snapshot(): ConsentSnapshot {
    return {
      state: this.state,
      tier: this.tier,
      policyVersion: this.policyVersion,
      ...(this.grantedAt !== undefined ? { grantedAt: this.grantedAt } : {}),
      ...(this.revokedAt !== undefined ? { revokedAt: this.revokedAt } : {}),
      ...(this.downgradedAt !== undefined ? { downgradedAt: this.downgradedAt } : {}),
      ...(this.lastReason !== undefined ? { lastReason: this.lastReason } : {}),
    };
  }

  /**
   * توضیح transparent از یک Tier — برای نمایش در UI رضایت.
   * Returns the transparent explanation for a tier.
   */
  static explain(tier: ConsentTier): ConsentTierExplanation {
    return TIER_EXPLANATIONS[tier];
  }

  /** فهرست همه توضیحات tierها — برای رندر کل ladder در UI */
  static explainAll(): readonly ConsentTierExplanation[] {
    return [
      TIER_EXPLANATIONS.NO_MEMORY,
      TIER_EXPLANATIONS.ANONYMOUS,
      TIER_EXPLANATIONS.CONSENTED,
      TIER_EXPLANATIONS.ENRICHED,
    ];
  }
}
