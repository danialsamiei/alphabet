/**
 * @module memory
 * @description
 * **Encrypted Living Memory Engine** — domain-isolated, consent-gated,
 * optionally-AES-GCM-256-encrypted KV memory with ECDSA P-256 consent
 * receipts attached to every write.
 *
 * Honesty notes
 *  - Consent proofs are **ECDSA P-256 signed receipts**, not zk-SNARKs.
 *    Real Groth16 proofs are deferred to `@alphabet/zk-consent` (PR-B):
 *    they require a circom circuit + trusted-setup ceremony.
 *  - Encryption uses WebCrypto AES-GCM-256 with per-record IVs. Key
 *    management is delegated to the caller; PBKDF2 (Tier-2) and
 *    `generateKey` (Tier-1) helpers are provided.
 *
 * @example
 * import {
 *   InMemoryStore,
 *   MemoryEngine,
 *   generateReceiptKeyPair,
 *   sha256Hex,
 * } from '@alphabet/core/memory';
 *
 * const kp = await generateReceiptKeyPair();
 * const store = new InMemoryStore();
 * const engine = new MemoryEngine({
 *   store,
 *   identity: {
 *     visitorIdHash: await sha256Hex('vst_abc'),
 *     policyVersion: '2025-01',
 *     receiptSigningKey: kp.privateKey,
 *     signingKeyId: 'kid_2025_01',
 *   },
 *   currentTier: () => 1,
 * });
 *
 * await engine.put('site_specific', 'theme', 'dark');
 * const out = await engine.get('site_specific', 'theme');
 * if (out.success && out.data) console.log(out.data.value); // 'dark'
 */

export type {
  MemoryStore,
  MemoryRecord,
  MemoryTier,
  MemoryIdentity,
  MemoryEncryption,
  MemoryErrorCode,
  MemoryResult,
  ConsentReceiptPayload,
  ConsentReceiptToken,
} from './types.js';

export { InMemoryStore } from './in-memory-store.js';
export { IndexedDBStore, type IndexedDBStoreOptions } from './indexeddb-store.js';
export {
  EncryptedMemoryStore,
  deriveAesKeyFromPassphrase,
  generateSessionAesKey,
} from './encrypted-store.js';
export {
  generateReceiptKeyPair,
  mintConsentReceipt,
  verifyConsentReceipt,
  sha256Hex,
  type MintReceiptInput,
} from './consent-receipt.js';
export {
  MemoryEngine,
  encodeKey,
  decodeKey,
  domainPrefix,
  type MemoryEngineOptions,
} from './engine.js';
