/**
 * @module consent/storage/types
 * @description
 * `SyncConsentStorageAdapter` — interface for persisting `ConsentSnapshot`
 * across sessions / pages.
 *
 * The adapter never decides whether persistence is *allowed* — that is
 * the responsibility of `ConsentTierManager`, which only persists when
 * its tier permits it. Adapters are pure I/O.
 */

import type { ConsentSnapshot } from '../consent-tier-manager.js';

/**
 * adapter همزمان ذخیره‌سازی snapshot رضایت.
 * Synchronous storage adapter for `ConsentSnapshot`.
 *
 * `ConsentTierManager` rehydrates state synchronously in its constructor
 * and persists synchronously on each transition, so the canonical
 * adapter contract is sync. Async backends (e.g. IndexedDB) must wrap
 * themselves in an in-memory cache and flush asynchronously, exposing
 * a sync facade to the manager.
 *
 * @example
 * const storage = new InMemoryConsentStorage();
 * storage.save({ state: 'granted', tier: 'CONSENTED', policyVersion: '2025-04-01' });
 * const snap = storage.load();
 */
export interface SyncConsentStorageAdapter {
  /** بارگذاری snapshot ذخیره‌شده — `null` یعنی چیزی ذخیره نیست */
  load(): ConsentSnapshot | null;
  /** ذخیره snapshot جدید */
  save(snapshot: ConsentSnapshot): void;
  /** پاک کردن کامل snapshot ذخیره‌شده */
  clear(): void;
}
