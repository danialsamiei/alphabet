/**
 * @module hooks/useAwafConsent
 * @description
 * Hook برای مدیریت consent بازدیدکننده — ماشین حالت سه‌حالته
 * (pending → granted → revoked) با ذخیره‌سازی SSR-safe در localStorage.
 *
 * Implements the full consent ladder (`NO_MEMORY` → `ANONYMOUS` →
 * `CONSENTED` → `ENRICHED`) defined in `@awaf/core`. Persistence is
 * done lazily on the client only; SSR returns a stable initial state.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ConsentTier, ConsentPurpose } from '@awaf/core';
import { isBrowser } from '../runtime/hydration-safe.js';

/** کلید پیش‌فرض ذخیره‌سازی consent در localStorage. */
export const DEFAULT_CONSENT_STORAGE_KEY = 'awaf:consent:v1';

/** وضعیت ماشین حالت consent. */
export type ConsentState = 'pending' | 'granted' | 'revoked';

/**
 * Snapshot کامل وضعیت consent — قابل serialize برای ذخیره‌سازی.
 */
export interface ConsentSnapshot {
  readonly tier: ConsentTier;
  readonly state: ConsentState;
  readonly purposes: readonly ConsentPurpose[];
  /** زمان آخرین تغییر (ISO 8601). */
  readonly updatedAt: string;
}

/** پارامترهای hook. */
export interface UseAwafConsentOptions {
  /** کلید localStorage — برای ایزوله کردن چند instance روی یک domain. */
  readonly storageKey?: string;
  /** snapshot اولیه — برای SSR یا hydrate از سرور. */
  readonly initial?: ConsentSnapshot;
  /**
   * اگر `true`، DNT/GPC تشخیص داده‌شده consent را به `NO_MEMORY` قفل می‌کند.
   * Default `true` per AWAF privacy contract.
   */
  readonly respectPrivacySignals?: boolean;
  /** سیگنال‌های privacy (اگر `respectPrivacySignals=true`). */
  readonly privacySignals?: { readonly dntEnabled?: boolean; readonly gpcEnabled?: boolean };
}

/** خروجی hook — snapshot + actions. */
export interface UseAwafConsentReturn extends ConsentSnapshot {
  /** اعطای رضایت با tier جدید. */
  readonly grant: (tier: ConsentTier, purposes?: readonly ConsentPurpose[]) => void;
  /** revoke کامل رضایت (به NO_MEMORY/revoked برمی‌گرداند). */
  readonly revoke: () => void;
  /** reset به حالت `pending` (برای تست/توسعه). */
  readonly reset: () => void;
  /** آیا DNT/GPC تنظیمات را قفل کرده‌اند. */
  readonly lockedByPrivacySignal: boolean;
}

const PENDING_SNAPSHOT: ConsentSnapshot = {
  tier: 'NO_MEMORY',
  state: 'pending',
  purposes: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const NO_MEMORY_REVOKED: ConsentSnapshot = {
  tier: 'NO_MEMORY',
  state: 'revoked',
  purposes: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function readStorage(key: string): ConsentSnapshot | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as Partial<ConsentSnapshot>;
    if (
      typeof parsed.tier === 'string' &&
      typeof parsed.state === 'string' &&
      Array.isArray(parsed.purposes) &&
      typeof parsed.updatedAt === 'string'
    ) {
      return {
        tier: parsed.tier as ConsentTier,
        state: parsed.state as ConsentState,
        purposes: parsed.purposes as ConsentPurpose[],
        updatedAt: parsed.updatedAt,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, snapshot: ConsentSnapshot): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // ignore quota / privacy errors
  }
}

/**
 * Hook اصلی consent — SSR-safe.
 *
 * @example
 * const { tier, state, grant, revoke } = useAwafConsent();
 * if (state === 'pending') return <ConsentBanner onAccept={() => grant('CONSENTED')} />;
 */
export function useAwafConsent(options: UseAwafConsentOptions = {}): UseAwafConsentReturn {
  const {
    storageKey = DEFAULT_CONSENT_STORAGE_KEY,
    initial = PENDING_SNAPSHOT,
    respectPrivacySignals = true,
    privacySignals,
  } = options;

  const lockedByPrivacySignal =
    respectPrivacySignals === true &&
    privacySignals !== undefined &&
    (privacySignals.dntEnabled === true || privacySignals.gpcEnabled === true);

  const [snapshot, setSnapshot] = useState<ConsentSnapshot>(() => {
    if (lockedByPrivacySignal) return NO_MEMORY_REVOKED;
    return initial;
  });

  // Hydrate از localStorage فقط روی client و فقط در صورت عدم قفل privacy.
  useEffect(() => {
    if (lockedByPrivacySignal) {
      setSnapshot(NO_MEMORY_REVOKED);
      return;
    }
    const stored = readStorage(storageKey);
    if (stored !== undefined) setSnapshot(stored);
  }, [storageKey, lockedByPrivacySignal]);

  const persist = useCallback(
    (next: ConsentSnapshot) => {
      setSnapshot(next);
      writeStorage(storageKey, next);
    },
    [storageKey]
  );

  const grant = useCallback(
    (tier: ConsentTier, purposes: readonly ConsentPurpose[] = []) => {
      if (lockedByPrivacySignal) return;
      persist({
        tier,
        state: 'granted',
        purposes,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist, lockedByPrivacySignal]
  );

  const revoke = useCallback(() => {
    persist({
      tier: 'NO_MEMORY',
      state: 'revoked',
      purposes: [],
      updatedAt: new Date().toISOString(),
    });
  }, [persist]);

  const reset = useCallback(() => {
    persist({ ...PENDING_SNAPSHOT, updatedAt: new Date().toISOString() });
  }, [persist]);

  return {
    ...snapshot,
    grant,
    revoke,
    reset,
    lockedByPrivacySignal,
  };
}
