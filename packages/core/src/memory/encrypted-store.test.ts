/**
 * @file encrypted-store.test.ts
 */

import { describe, it, expect } from 'vitest';
import { InMemoryStore } from './in-memory-store.js';
import {
  EncryptedMemoryStore,
  generateSessionAesKey,
  deriveAesKeyFromPassphrase,
} from './encrypted-store.js';
import type { MemoryRecord } from './types.js';

function rec(key: string, value: string): MemoryRecord {
  return {
    key,
    value: new TextEncoder().encode(value),
    receipt: 'aaaa.bbbb',
    ts: 1,
    format: 'plain',
  };
}

describe('EncryptedMemoryStore', () => {
  it('encrypts on put, decrypts on get', async () => {
    const inner = new InMemoryStore();
    const key = await generateSessionAesKey();
    const enc = new EncryptedMemoryStore(inner, { key });

    await enc.put(rec('a', 'sensitive payload'));

    // Underlying store sees ciphertext + iv.
    const stored = await inner.get('a');
    expect(stored).toBeDefined();
    if (stored !== undefined) {
      expect(stored.format).toBe('aes-gcm-256');
      expect(stored.iv).toBeDefined();
      // Bytes must NOT equal plaintext.
      expect(new TextDecoder().decode(stored.value)).not.toBe('sensitive payload');
    }

    // Engine view returns plaintext.
    const out = await enc.get('a');
    expect(out).toBeDefined();
    if (out !== undefined) {
      expect(out.format).toBe('plain');
      expect(new TextDecoder().decode(out.value)).toBe('sensitive payload');
    }
  });

  it('decryption fails on tampered ciphertext', async () => {
    const inner = new InMemoryStore();
    const key = await generateSessionAesKey();
    const enc = new EncryptedMemoryStore(inner, { key });

    await enc.put(rec('a', 'hello'));
    const stored = await inner.get('a');
    if (stored === undefined) throw new Error('no record');
    // Flip a byte in the ciphertext.
    const flipped = new Uint8Array(stored.value);
    flipped[0] ^= 0xff;
    await inner.put({ ...stored, value: flipped });

    await expect(enc.get('a')).rejects.toThrow(/decrypt failed/);
  });

  it('list decrypts all records and skips tampered ones', async () => {
    const inner = new InMemoryStore();
    const key = await generateSessionAesKey();
    const enc = new EncryptedMemoryStore(inner, { key });

    await enc.put(rec('p\u00011', 'one'));
    await enc.put(rec('p\u00012', 'two'));
    const out = await enc.list('p\u0001');
    expect(out.length).toBe(2);
  });

  it('PBKDF2-derived key round-trips', async () => {
    const inner = new InMemoryStore();
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const key = await deriveAesKeyFromPassphrase('correct horse battery staple', salt, 1_000);
    const enc = new EncryptedMemoryStore(inner, { key });
    await enc.put(rec('a', 'pbkdf2-protected'));
    const out = await enc.get('a');
    if (out === undefined) throw new Error('lost');
    expect(new TextDecoder().decode(out.value)).toBe('pbkdf2-protected');
  });

  it('passes pre-encrypted records through without re-encrypting', async () => {
    const inner = new InMemoryStore();
    const key = await generateSessionAesKey();
    const enc = new EncryptedMemoryStore(inner, { key });

    const sealed: MemoryRecord = {
      key: 'pass',
      value: new Uint8Array([1, 2, 3]),
      receipt: 'a.b',
      ts: 1,
      format: 'aes-gcm-256',
      iv: new Uint8Array(12),
    };
    await enc.put(sealed);
    const stored = await inner.get('pass');
    expect(stored?.value).toEqual(new Uint8Array([1, 2, 3]));
  });
});
