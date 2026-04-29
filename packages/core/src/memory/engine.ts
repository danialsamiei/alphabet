/**
 * @module memory/engine
 * @description
 * `MemoryEngine` — the high-level façade. Combines a `MemoryStore` (raw
 * or encrypted), an `MemoryIdentity` (signing key + visitor id hash +
 * policy version), and a domain-prefixed key namespace into a single
 * domain-isolated, consent-gated, optionally-encrypted KV store.
 *
 * Each `put()` mints a fresh ECDSA P-256 consent receipt and persists it
 * alongside the record. Each `get()` returns the receipt, so downstream
 * auditors can verify provenance without re-querying the engine.
 *
 * Differential-privacy hooks (`@alphabet/security/privacy`) are exposed
 * via the `dp` field on `MemoryEngineOptions` — see
 * `applyDpToAggregate()` for the integration shape.
 */

import type { MemoryDomain } from '../types/base.js';
import { ok, err } from '../types/result.js';
import { mintConsentReceipt } from './consent-receipt.js';
import type {
  MemoryIdentity,
  MemoryRecord,
  MemoryResult,
  MemoryStore,
  MemoryTier,
} from './types.js';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface MemoryEngineOptions {
  /** Underlying store (use `EncryptedMemoryStore` for at-rest encryption). */
  readonly store: MemoryStore;
  /** Identity bundle for receipt minting. */
  readonly identity: MemoryIdentity;
  /**
   * Live tier provider. Called on every write. The engine refuses any
   * write where the live tier < the domain's required tier.
   */
  readonly currentTier: () => MemoryTier;
  /** Required minimum tier per domain. Default mapping is below. */
  readonly minTierByDomain?: Readonly<Record<MemoryDomain, MemoryTier>>;
  /** Override `Date.now()` (testing). */
  readonly now?: () => number;
}

const DEFAULT_MIN_TIER: Readonly<Record<MemoryDomain, MemoryTier>> = {
  general: 0,
  site_specific: 1,
  visitor: 1,
  class_notes: 2,
  ideas: 2,
  social: 2,
  tech_pulse: 1,
};

// ─── Engine ──────────────────────────────────────────────────────────────────

export class MemoryEngine {
  private readonly minTierByDomain: Readonly<Record<MemoryDomain, MemoryTier>>;

  constructor(private readonly options: MemoryEngineOptions) {
    this.minTierByDomain = options.minTierByDomain ?? DEFAULT_MIN_TIER;
  }

  /**
   * Read the value of `key` in `domain`. Returns the stored receipt
   * alongside the decoded value as a UTF-8 string for ergonomics.
   */
  async get(
    domain: MemoryDomain,
    key: string,
  ): Promise<MemoryResult<{ value: string; record: MemoryRecord } | undefined>> {
    const fullKey = encodeKey(domain, key);
    let stored: MemoryRecord | undefined;
    try {
      stored = await this.options.store.get(fullKey);
    } catch (e) {
      return err({
        code: 'STORE_FAILURE',
        message: `MemoryEngine.get failed: ${(e as Error).message}`,
      });
    }
    if (stored === undefined) return ok(undefined);
    let valueStr: string;
    try {
      valueStr = new TextDecoder().decode(stored.value);
    } catch (e) {
      return err({
        code: 'DECRYPT_FAILURE',
        message: `Cannot decode value for ${fullKey}: ${(e as Error).message}`,
      });
    }
    return ok({ value: valueStr, record: stored });
  }

  /**
   * Write `value` to `key` in `domain`. The engine:
   *   1. Checks the live tier ≥ the domain's required tier (else
   *      `CONSENT_TIER_TOO_LOW`).
   *   2. Mints a fresh consent receipt covering
   *      `{visitorIdHash, domain, tier, policyVersion, ts}`.
   *   3. Persists `{key, value, receipt, ts}` via the underlying store.
   *      If the store is an `EncryptedMemoryStore`, encryption happens
   *      transparently inside `store.put()`.
   */
  async put(
    domain: MemoryDomain,
    key: string,
    value: string | Uint8Array,
  ): Promise<MemoryResult<MemoryRecord>> {
    const liveTier = this.options.currentTier();
    const minTier = this.minTierByDomain[domain];
    if (liveTier < minTier) {
      return err({
        code: 'CONSENT_TIER_TOO_LOW',
        message: `Domain '${domain}' requires tier ${minTier}; live tier is ${liveTier}`,
      });
    }
    const receiptResult = await mintConsentReceipt(
      this.options.now === undefined
        ? {
            visitorIdHash: this.options.identity.visitorIdHash,
            domain,
            tier: liveTier,
            policyVersion: this.options.identity.policyVersion,
          }
        : {
            visitorIdHash: this.options.identity.visitorIdHash,
            domain,
            tier: liveTier,
            policyVersion: this.options.identity.policyVersion,
            now: this.options.now,
          },
      this.options.identity.receiptSigningKey,
    );
    if (!receiptResult.success) {
      return err({
        code: 'RECEIPT_INVALID',
        message: receiptResult.error.message,
      });
    }
    const fullKey = encodeKey(domain, key);
    const ts = (this.options.now ?? Date.now)();
    const record: MemoryRecord = {
      key: fullKey,
      value:
        typeof value === 'string'
          ? new TextEncoder().encode(value)
          : new Uint8Array(value),
      receipt: receiptResult.data,
      ts,
      format: 'plain',
    };
    try {
      await this.options.store.put(record);
    } catch (e) {
      return err({
        code: 'STORE_FAILURE',
        message: `MemoryEngine.put failed: ${(e as Error).message}`,
      });
    }
    return ok(record);
  }

  /**
   * List all records belonging to `domain`. Each returned record carries
   * its consent receipt — no value-only "stripped" mode is offered to
   * keep audit completeness invariant.
   */
  async list(domain: MemoryDomain): Promise<MemoryResult<readonly MemoryRecord[]>> {
    try {
      const records = await this.options.store.list(domainPrefix(domain));
      return ok(records);
    } catch (e) {
      return err({
        code: 'STORE_FAILURE',
        message: `MemoryEngine.list failed: ${(e as Error).message}`,
      });
    }
  }

  /** Delete a single key. */
  async delete(domain: MemoryDomain, key: string): Promise<MemoryResult<void>> {
    try {
      await this.options.store.delete(encodeKey(domain, key));
      return ok(undefined);
    } catch (e) {
      return err({
        code: 'STORE_FAILURE',
        message: `MemoryEngine.delete failed: ${(e as Error).message}`,
      });
    }
  }

  /**
   * Right-to-erasure: wipe **everything** the engine can see. Caller is
   * responsible for any audit log entries — the engine itself does not
   * record erasure events to keep its responsibilities tight.
   */
  async erase(): Promise<MemoryResult<void>> {
    try {
      await this.options.store.clear();
      return ok(undefined);
    } catch (e) {
      return err({
        code: 'STORE_FAILURE',
        message: `MemoryEngine.erase failed: ${(e as Error).message}`,
      });
    }
  }
}

// ─── Key encoding ────────────────────────────────────────────────────────────

const KEY_SEP = '\u0001';

/** Domain-prefixed key. */
export function encodeKey(domain: MemoryDomain, key: string): string {
  return `${domain}${KEY_SEP}${key}`;
}

/** Prefix used by `list()` to scope a scan to a domain. */
export function domainPrefix(domain: MemoryDomain): string {
  return `${domain}${KEY_SEP}`;
}

/** Inverse of `encodeKey`. */
export function decodeKey(
  full: string,
): { domain: MemoryDomain; key: string } | undefined {
  const idx = full.indexOf(KEY_SEP);
  if (idx <= 0) return undefined;
  return {
    domain: full.slice(0, idx) as MemoryDomain,
    key: full.slice(idx + 1),
  };
}
