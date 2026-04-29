/**
 * @file engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import { InMemoryStore } from './in-memory-store.js';
import { MemoryEngine, encodeKey, decodeKey } from './engine.js';
import {
  generateReceiptKeyPair,
  sha256Hex,
  verifyConsentReceipt,
} from './consent-receipt.js';
import {
  EncryptedMemoryStore,
  generateSessionAesKey,
} from './encrypted-store.js';
import type { MemoryTier } from './types.js';

async function makeEngine(opts: { tier: MemoryTier; encrypted?: boolean }) {
  const kp = await generateReceiptKeyPair();
  const inner = new InMemoryStore();
  const store = opts.encrypted
    ? new EncryptedMemoryStore(inner, { key: await generateSessionAesKey() })
    : inner;
  const engine = new MemoryEngine({
    store,
    identity: {
      visitorIdHash: await sha256Hex('vst_abc'),
      policyVersion: '2026-01',
      receiptSigningKey: kp.privateKey,
      signingKeyId: 'kid_2026',
    },
    currentTier: () => opts.tier,
  });
  return { engine, inner, publicKey: kp.publicKey };
}

describe('MemoryEngine / consent gating', () => {
  it('rejects writes below the domain minimum tier', async () => {
    const { engine } = await makeEngine({ tier: 0 });
    const r = await engine.put('site_specific', 'theme', 'dark');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_TIER_TOO_LOW');
  });

  it('rejects class_notes writes at tier 1', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    const r = await engine.put('class_notes', 'k', 'v');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_TIER_TOO_LOW');
  });

  it('allows visitor writes at tier 1', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    const r = await engine.put('visitor', 'k', 'v');
    expect(r.success).toBe(true);
  });

  it('allows class_notes writes at tier 2', async () => {
    const { engine } = await makeEngine({ tier: 2 });
    const r = await engine.put('class_notes', 'k', 'v');
    expect(r.success).toBe(true);
  });
});

describe('MemoryEngine / round-trip', () => {
  it('writes and reads back a string value', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    await engine.put('site_specific', 'theme', 'dark');
    const r = await engine.get('site_specific', 'theme');
    if (!r.success) throw new Error(r.error.message);
    expect(r.data).toBeDefined();
    if (r.data !== undefined) expect(r.data.value).toBe('dark');
  });

  it('returns ok(undefined) for missing keys', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    const r = await engine.get('site_specific', 'absent');
    if (!r.success) throw new Error(r.error.message);
    expect(r.data).toBeUndefined();
  });

  it('list returns only records in the queried domain', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    await engine.put('site_specific', 'a', '1');
    await engine.put('site_specific', 'b', '2');
    await engine.put('visitor', 'x', '3');
    const r = await engine.list('site_specific');
    if (!r.success) throw new Error(r.error.message);
    expect(r.data.length).toBe(2);
  });

  it('delete removes a single key', async () => {
    const { engine } = await makeEngine({ tier: 1 });
    await engine.put('site_specific', 'a', '1');
    await engine.delete('site_specific', 'a');
    const r = await engine.get('site_specific', 'a');
    if (!r.success) throw new Error(r.error.message);
    expect(r.data).toBeUndefined();
  });

  it('erase wipes everything (right-to-erasure)', async () => {
    const { engine } = await makeEngine({ tier: 2 });
    await engine.put('site_specific', 'a', '1');
    await engine.put('class_notes', 'b', '2');
    const e = await engine.erase();
    expect(e.success).toBe(true);
    const r = await engine.get('site_specific', 'a');
    if (!r.success) throw new Error(r.error.message);
    expect(r.data).toBeUndefined();
  });
});

describe('MemoryEngine / receipts', () => {
  it('every write produces a verifiable ECDSA P-256 receipt', async () => {
    const { engine, publicKey } = await makeEngine({ tier: 2 });
    const w = await engine.put('site_specific', 'theme', 'dark');
    if (!w.success) throw new Error(w.error.message);
    expect(w.data.receipt.split('.')).toHaveLength(2);
    const verified = await verifyConsentReceipt(w.data.receipt, publicKey);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.data.tier).toBe(2);
      expect(verified.data.domain).toBe('site_specific');
      expect(verified.data.policyVersion).toBe('2026-01');
    }
  });

  it('receipt visitorIdHash is the SHA-256 of the raw visitor id', async () => {
    const { engine, publicKey } = await makeEngine({ tier: 1 });
    const w = await engine.put('visitor', 'k', 'v');
    if (!w.success) throw new Error(w.error.message);
    const verified = await verifyConsentReceipt(w.data.receipt, publicKey);
    if (!verified.success) throw new Error('verify failed');
    expect(verified.data.visitorIdHash).toBe(await sha256Hex('vst_abc'));
  });
});

describe('MemoryEngine / encryption transparent', () => {
  it('persists ciphertext to the inner store but reads plaintext', async () => {
    const { engine, inner } = await makeEngine({ tier: 1, encrypted: true });
    await engine.put('site_specific', 'theme', 'dark');
    const innerRecord = await inner.get(encodeKey('site_specific', 'theme'));
    expect(innerRecord?.format).toBe('aes-gcm-256');
    const r = await engine.get('site_specific', 'theme');
    if (!r.success) throw new Error(r.error.message);
    if (r.data !== undefined) expect(r.data.value).toBe('dark');
  });
});

describe('encodeKey / decodeKey', () => {
  it('round-trips', () => {
    const full = encodeKey('visitor', 'abc:123');
    expect(decodeKey(full)).toEqual({ domain: 'visitor', key: 'abc:123' });
  });

  it('returns undefined for malformed inputs', () => {
    expect(decodeKey('no-separator-here')).toBeUndefined();
  });
});
