/**
 * @module consent/storage
 * @description Barrel export for consent storage adapters.
 */

export type { SyncConsentStorageAdapter } from './types.js';
export { InMemoryConsentStorage } from './in-memory.js';
export {
  WebStorageConsentStorage,
  DEFAULT_CONSENT_STORAGE_KEY,
} from './web-storage.js';
export type { WebStorageConsentStorageOptions } from './web-storage.js';
