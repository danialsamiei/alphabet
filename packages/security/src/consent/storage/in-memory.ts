/**
 * @module consent/storage/in-memory
 * @description
 * `InMemoryConsentStorage` — adapter پیش‌فرض و SSR-safe.
 *
 * Default in-memory adapter. Holds the snapshot in a single private
 * variable. Suitable for SSR, tests, and any environment where browser
 * storage APIs are unavailable. State is lost on process exit — by
 * design.
 */

import type { ConsentSnapshot } from '../consent-tier-manager.js';
import type { SyncConsentStorageAdapter } from './types.js';

/**
 * adapter درون‌حافظه — snapshot را در RAM نگه می‌دارد.
 * In-memory adapter. State lives only for the current process.
 *
 * @example
 * const storage = new InMemoryConsentStorage();
 * const mgr = new ConsentTierManager({ policyVersion: 'v1', storage });
 */
export class InMemoryConsentStorage implements SyncConsentStorageAdapter {
  private snapshot: ConsentSnapshot | null = null;

  load(): ConsentSnapshot | null {
    return this.snapshot;
  }

  save(snapshot: ConsentSnapshot): void {
    this.snapshot = snapshot;
  }

  clear(): void {
    this.snapshot = null;
  }
}
