/**
 * @module memory/encrypted-store
 * @description
 * `EncryptedMemoryStore` — a transparent decorator that encrypts values
 * before delegating to an underlying `MemoryStore`, and decrypts on read.
 *
 * Algorithm: **AES-GCM-256** with a fresh 12-byte IV per record (NIST
 * SP 800-38D). The IV is stored alongside the ciphertext as part of the
 * `MemoryRecord`. Authentication tag is appended to the ciphertext by
 * `subtle.encrypt` and verified on `decrypt`; tampered ciphertext returns
 * a `DECRYPT_FAILURE`.
 *
 * Key management is **out of scope** here — the caller supplies an
 * already-derived `CryptoKey`. A typical flow uses
 * `deriveAesKeyFromPassphrase` (also exported from this module) on top
 * of PBKDF2 with a tier-2 stored salt; tier-1 sessions can use a
 * non-extractable per-session key generated via `crypto.subtle.generateKey`.
 *
 * The decorator pattern keeps `InMemoryStore` and `IndexedDBStore` blind
 * to the encryption layer — they see opaque bytes and IVs, nothing more.
 */

import type {
  MemoryEncryption,
  MemoryRecord,
  MemoryStore,
} from './types.js';

const ENCRYPT_ALGO = 'AES-GCM' as const;
const IV_BYTES = 12;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error('WebCrypto subtle is not available in this runtime');
  }
  return subtle;
}

function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function asBufferSource(bytes: Uint8Array): Uint8Array {
  return bytes;
}

// ─── Key derivation ──────────────────────────────────────────────────────────

/**
 * Derive an AES-GCM-256 `CryptoKey` from a passphrase + salt with PBKDF2
 * (SHA-256, 100 000 iterations by default). Returns a non-extractable key.
 *
 * Tier-2 callers should persist `salt` (16 random bytes) per-visitor and
 * re-derive on every session. **Never** persist the passphrase.
 */
export async function deriveAesKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100_000,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    asBufferSource(new TextEncoder().encode(passphrase)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: asBufferSource(salt),
      iterations,
    },
    baseKey,
    { name: ENCRYPT_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Generate a fresh non-extractable AES-GCM-256 key for a session.
 * Tier-1 callers use this; the key vanishes when the session ends.
 */
export async function generateSessionAesKey(): Promise<CryptoKey> {
  return getSubtle().generateKey(
    { name: ENCRYPT_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── EncryptedMemoryStore ────────────────────────────────────────────────────

/**
 * Wrap any `MemoryStore` so values are AES-GCM-256 encrypted at rest.
 * `key` and `receipt` are stored as cleartext — the contract expects
 * receipts to be auditable without the encryption key.
 */
export class EncryptedMemoryStore implements MemoryStore {
  private readonly randomBytes: (n: number) => Uint8Array;

  constructor(
    private readonly inner: MemoryStore,
    private readonly enc: MemoryEncryption,
  ) {
    this.randomBytes = enc.randomBytes ?? defaultRandomBytes;
  }

  async get(key: string): Promise<MemoryRecord | undefined> {
    const stored = await this.inner.get(key);
    if (stored === undefined) return undefined;
    if (stored.format === 'plain') return stored;
    if (stored.iv === undefined) {
      throw new Error('Encrypted record missing IV');
    }
    const subtle = getSubtle();
    let plain: ArrayBuffer;
    try {
      plain = await subtle.decrypt(
        { name: ENCRYPT_ALGO, iv: asBufferSource(stored.iv) },
        this.enc.key,
        asBufferSource(stored.value),
      );
    } catch (e) {
      const err = new Error(
        `EncryptedMemoryStore: decrypt failed for key '${key}': ${(e as Error).message}`,
      );
      (err as Error & { code: string }).code = 'DECRYPT_FAILURE';
      throw err;
    }
    return {
      key: stored.key,
      value: new Uint8Array(plain),
      receipt: stored.receipt,
      ts: stored.ts,
      format: 'plain',
    };
  }

  async put(record: MemoryRecord): Promise<void> {
    if (record.format === 'aes-gcm-256') {
      // Already encrypted by the caller — pass through unchanged.
      return this.inner.put(record);
    }
    const iv = this.randomBytes(IV_BYTES);
    const subtle = getSubtle();
    const cipher = await subtle.encrypt(
      { name: ENCRYPT_ALGO, iv: asBufferSource(iv) },
      this.enc.key,
      asBufferSource(record.value),
    );
    const sealed: MemoryRecord = {
      ...record,
      value: new Uint8Array(cipher),
      format: 'aes-gcm-256',
      iv,
    };
    return this.inner.put(sealed);
  }

  async list(prefix: string): Promise<readonly MemoryRecord[]> {
    const stored = await this.inner.list(prefix);
    const out: MemoryRecord[] = [];
    for (const rec of stored) {
      if (rec.format === 'plain') {
        out.push(rec);
        continue;
      }
      if (rec.iv === undefined) continue;
      try {
        const subtle = getSubtle();
        const plain = await subtle.decrypt(
          { name: ENCRYPT_ALGO, iv: asBufferSource(rec.iv) },
          this.enc.key,
          asBufferSource(rec.value),
        );
        out.push({
          key: rec.key,
          value: new Uint8Array(plain),
          receipt: rec.receipt,
          ts: rec.ts,
          format: 'plain',
        });
      } catch {
        // Skip records we cannot decrypt — this matches the "fail closed"
        // posture of the engine: a tampered record disappears from the
        // view rather than poisoning the rest of the result set.
      }
    }
    return out;
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(key);
  }

  clear(): Promise<void> {
    return this.inner.clear();
  }
}
