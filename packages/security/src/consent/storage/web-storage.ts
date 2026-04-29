/**
 * @module consent/storage/web-storage
 * @description
 * `WebStorageConsentStorage` — adapter پشتیبان‌گیری روی `Storage` (DOM).
 *
 * Adapter that wraps a DOM `Storage` instance (`localStorage`,
 * `sessionStorage`, or any other compatible implementation). Designed
 * to be **fail-safe**: every I/O failure (private browsing mode,
 * disabled cookies, quota exceeded, blocked by user agent, malformed
 * JSON, schema drift) degrades silently to the in-memory fallback so
 * the consent manager can keep running.
 */

import type { ConsentSnapshot, ConsentManagerState } from '../consent-tier-manager.js';
import type { ConsentTier } from '@alphabet/core';
import type { SyncConsentStorageAdapter } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** کلید پیش‌فرض ذخیره‌سازی در `Storage` */
export const DEFAULT_CONSENT_STORAGE_KEY = 'alphabet:consent:v1';

/**
 * کلید پیش‌فرض قدیمی — صرفاً برای مهاجرت یک‌باره از نسخه‌ی پیش از rename خوانده می‌شود.
 * Legacy default key kept only for one-shot read migration from the
 * pre-rename `awaf:` namespace. Never written.
 */
const LEGACY_CONSENT_STORAGE_KEY = 'awaf:consent:v1';

/** نسخه schema snapshot — برای migrate در آینده */
const SCHEMA_VERSION = 1 as const;

// ─── Wire format ──────────────────────────────────────────────────────────────

interface PersistedSnapshot {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly state: ConsentManagerState;
  readonly tier: ConsentTier;
  readonly policyVersion: string;
  readonly grantedAt?: string;
  readonly revokedAt?: string;
  readonly downgradedAt?: string;
  readonly lastReason?: string;
}

const VALID_STATES: ReadonlySet<ConsentManagerState> = new Set([
  'pending',
  'granted',
  'revoked',
]);
const VALID_TIERS: ReadonlySet<ConsentTier> = new Set([
  'NO_MEMORY',
  'ANONYMOUS',
  'CONSENTED',
  'ENRICHED',
]);

// ─── Options ─────────────────────────────────────────────────────────────────

/** گزینه‌های ساخت `WebStorageConsentStorage` */
export interface WebStorageConsentStorageOptions {
  /** کلید storage — پیش‌فرض `alphabet:consent:v1` */
  readonly key?: string;
  /**
   * Storage مرجع — اگر داده نشود، تلاش می‌شود `localStorage` گرفته شود.
   * Reference Storage. If omitted, `globalThis.localStorage` is used
   * when available; otherwise the adapter operates as a no-op (load
   * returns null, save/clear silently succeed).
   */
  readonly storage?: Storage | undefined;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * adapter ذخیره snapshot رضایت روی DOM `Storage`.
 * Persists `ConsentSnapshot` to a DOM `Storage` (typically
 * `localStorage` or `sessionStorage`). All I/O is best-effort.
 *
 * @example
 * const storage = new WebStorageConsentStorage({
 *   storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
 * });
 * const mgr = new ConsentTierManager({ policyVersion: 'v1', storage });
 *
 * @example
 * // Session-scoped persistence:
 * new WebStorageConsentStorage({ storage: sessionStorage, key: 'alphabet:consent' });
 */
export class WebStorageConsentStorage implements SyncConsentStorageAdapter {
  private readonly key: string;
  private readonly storage: Storage | null;

  constructor(options: WebStorageConsentStorageOptions = {}) {
    this.key = options.key ?? DEFAULT_CONSENT_STORAGE_KEY;
    this.storage = resolveStorage(options.storage);
  }

  load(): ConsentSnapshot | null {
    if (this.storage === null) return null;
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return null;
    }
    // One-shot legacy migration: if the canonical key is empty but the
    // pre-rename `awaf:consent:v1` key has a snapshot, read it through
    // so callers upgrading from the old build keep their consent state.
    // The next save() will persist under the canonical key automatically.
    if ((raw === null || raw === '') && this.key === DEFAULT_CONSENT_STORAGE_KEY) {
      try {
        raw = this.storage.getItem(LEGACY_CONSENT_STORAGE_KEY);
      } catch {
        return null;
      }
    }
    if (raw === null || raw === '') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // corrupted entry — purge so the next save starts clean
      this.safeRemove();
      return null;
    }

    const snapshot = decodePersisted(parsed);
    if (snapshot === null) {
      this.safeRemove();
      return null;
    }
    return snapshot;
  }

  save(snapshot: ConsentSnapshot): void {
    if (this.storage === null) return;
    const payload: PersistedSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      state: snapshot.state,
      tier: snapshot.tier,
      policyVersion: snapshot.policyVersion,
      ...(snapshot.grantedAt !== undefined ? { grantedAt: snapshot.grantedAt } : {}),
      ...(snapshot.revokedAt !== undefined ? { revokedAt: snapshot.revokedAt } : {}),
      ...(snapshot.downgradedAt !== undefined ? { downgradedAt: snapshot.downgradedAt } : {}),
      ...(snapshot.lastReason !== undefined ? { lastReason: snapshot.lastReason } : {}),
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
    } catch {
      // QuotaExceeded / SecurityError / private mode — drop silently.
    }
  }

  clear(): void {
    this.safeRemove();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private safeRemove(): void {
    if (this.storage === null) return;
    try {
      this.storage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStorage(explicit: Storage | undefined): Storage | null {
  if (explicit !== undefined) return explicit;
  // Probe globalThis.localStorage without throwing when absent / blocked.
  try {
    const g = globalThis as { localStorage?: Storage };
    if (g.localStorage !== undefined) return g.localStorage;
  } catch {
    // SecurityError in some browsers when cookies are blocked
  }
  return null;
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Cheap ISO 8601 sanity check — full RFC parsing is overkill here.
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function decodePersisted(value: unknown): ConsentSnapshot | null {
  if (value === null || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;

  // Future schema versions will be migrated here. For now require ===.
  if (v['schemaVersion'] !== SCHEMA_VERSION) return null;

  const state = v['state'];
  const tier = v['tier'];
  const policyVersion = v['policyVersion'];
  if (typeof state !== 'string' || !VALID_STATES.has(state as ConsentManagerState)) return null;
  if (typeof tier !== 'string' || !VALID_TIERS.has(tier as ConsentTier)) return null;
  if (typeof policyVersion !== 'string' || policyVersion === '') return null;

  const snapshot: ConsentSnapshot = {
    state: state as ConsentManagerState,
    tier: tier as ConsentTier,
    policyVersion,
    ...(isValidISODate(v['grantedAt']) ? { grantedAt: v['grantedAt'] } : {}),
    ...(isValidISODate(v['revokedAt']) ? { revokedAt: v['revokedAt'] } : {}),
    ...(isValidISODate(v['downgradedAt']) ? { downgradedAt: v['downgradedAt'] } : {}),
    ...(typeof v['lastReason'] === 'string' ? { lastReason: v['lastReason'] } : {}),
  };
  return snapshot;
}
