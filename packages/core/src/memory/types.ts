/**
 * @module memory/types
 * @description
 * Public types for the **Encrypted Living Memory Engine**. The engine is
 * a domain-isolated, consent-gated, optionally-encrypted key-value store
 * that attaches an ECDSA P-256 **consent receipt** to every write so a
 * later auditor can prove the visitor actually granted the required
 * tier at the moment of write.
 *
 * **Not a zk-SNARK.** A receipt is a signed proof of consent state; it
 * does not hide which visitor wrote (the visitor id hash is part of the
 * payload). Real zero-knowledge consent proofs are out of scope for PR-A
 * and tracked under `@alphabet/zk-consent` (PR-B).
 */

import type { MemoryDomain } from '../types/base.js';
import type { Result, AlphabetError } from '../types/result.js';

// ─── Consent tier (echoed from @alphabet/security to avoid a dep cycle) ──────

/**
 * 0 = NO_MEMORY (Tier 0)   — no persistence
 * 1 = ANONYMOUS (Tier 1)   — session-scoped non-PII
 * 2 = CONSENTED (Tier 2)   — durable cross-session profile
 * 3 = ENRICHED (Tier 3)    — analytics + behavioural memory
 */
export type MemoryTier = 0 | 1 | 2 | 3;

// ─── Consent receipt ─────────────────────────────────────────────────────────

/**
 * Plain payload covered by a consent receipt signature. Hashes are SHA-256
 * hex-encoded so the receipt itself does not contain raw PII.
 */
export interface ConsentReceiptPayload {
  /** Receipt format version — `'v1'` for PR-A. */
  readonly v: 'v1';
  /** SHA-256 of the visitor id, base16 lowercase. Never the raw id. */
  readonly visitorIdHash: string;
  /** Memory domain this receipt authorises. */
  readonly domain: MemoryDomain;
  /** Minimum consent tier asserted at write time. */
  readonly tier: MemoryTier;
  /** Active privacy policy version when the receipt was minted. */
  readonly policyVersion: string;
  /** UTC epoch ms when the receipt was minted. */
  readonly ts: number;
}

/** Compact serialised form: `<base64url(payload)>.<base64url(signature)>`. */
export type ConsentReceiptToken = string;

// ─── Stored record ───────────────────────────────────────────────────────────

/**
 * A record as it lives inside a `MemoryStore`. The store layer is
 * agnostic about whether the value is encrypted: it sees opaque bytes.
 * The engine layer is responsible for encryption.
 */
export interface MemoryRecord {
  /** Logical key (string-encoded; the engine prefixes by domain). */
  readonly key: string;
  /** Opaque payload (utf-8 bytes for plaintext, ciphertext for encrypted). */
  readonly value: Uint8Array;
  /** Associated consent receipt (token). */
  readonly receipt: ConsentReceiptToken;
  /** Mint time (mirrors receipt.ts for indexed scans). */
  readonly ts: number;
  /** Storage format — informs the engine how to decode `value`. */
  readonly format: 'plain' | 'aes-gcm-256';
  /** Per-record IV when `format === 'aes-gcm-256'` (12 bytes). */
  readonly iv?: Uint8Array;
}

// ─── Store interface ─────────────────────────────────────────────────────────

/**
 * Pluggable key-value backend. The engine keys are domain-prefixed so a
 * single underlying store can host multiple domains without leakage as
 * long as it is `get`/`put`/`list`-honest.
 */
export interface MemoryStore {
  get(key: string): Promise<MemoryRecord | undefined>;
  put(record: MemoryRecord): Promise<void>;
  list(prefix: string): Promise<readonly MemoryRecord[]>;
  delete(key: string): Promise<void>;
  /** Wipe **everything** in the store. Used by GDPR right-to-erasure. */
  clear(): Promise<void>;
}

// ─── Engine option types ─────────────────────────────────────────────────────

/** Caller-supplied identity bundle used for receipt minting. */
export interface MemoryIdentity {
  /** Hex-encoded SHA-256 of the visitor id. The engine never sees the raw id. */
  readonly visitorIdHash: string;
  /** Active privacy policy version (echoed onto every receipt). */
  readonly policyVersion: string;
  /** ECDSA P-256 private key for receipt minting. */
  readonly receiptSigningKey: CryptoKey;
  /** Stable identifier for the signing key (e.g. `kid_2026Q2`). */
  readonly signingKeyId: string;
}

/** Encryption material for an `EncryptedMemoryStore`. */
export interface MemoryEncryption {
  /** AES-GCM-256 key (already derived; the engine does not derive). */
  readonly key: CryptoKey;
  /**
   * Source for per-record IVs. Default uses `crypto.getRandomValues`. Override
   * for deterministic tests only.
   */
  readonly randomBytes?: (n: number) => Uint8Array;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export type MemoryErrorCode =
  | 'CONSENT_TIER_TOO_LOW'
  | 'POLICY_VERSION_MISMATCH'
  | 'RECEIPT_INVALID'
  | 'CRYPTO_UNAVAILABLE'
  | 'STORE_FAILURE'
  | 'NOT_FOUND'
  | 'DECRYPT_FAILURE';

/**
 * Helper alias: every memory-engine method returns a `Result` with the
 * shared `AlphabetError` shape, narrowed by `code` to `MemoryErrorCode`.
 */
export type MemoryResult<T> = Result<T, AlphabetError & { code: MemoryErrorCode }>;
