/**
 * Tests for the QR Handoff adapter — encrypt/decrypt round trips,
 * tampering detection, expiry, and audience binding.
 */

import { describe, it, expect } from 'vitest';
import { QrHandoffAdapter, type QrHandoffPayload } from './index.js';
import { makeConsentScope } from '../normalizers/index.js';

const adapter = new QrHandoffAdapter();

function key(): Uint8Array {
  // Deterministic 256-bit key for tests. Never use in production.
  const k = new Uint8Array(32);
  for (let i = 0; i < k.length; i++) k[i] = i + 1;
  return k;
}

function basePayload(): Omit<QrHandoffPayload, 'expiresAt' | 'nonce'> {
  return {
    sessionId: 'sess-7f3e1c2a',
    visitorId: 'v-abc12345',
    audience: 'alphabet:demo',
    consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
  };
}

describe('QrHandoffAdapter encode/decode', () => {
  it('round-trips a valid payload', async () => {
    const enc = await adapter.encode(basePayload(), key(), { ttlMs: 60_000 });
    expect(enc.success).toBe(true);
    if (!enc.success) return;

    const dec = await adapter.decode(enc.data, key(), {
      expectedAudience: 'alphabet:demo',
    });
    expect(dec.success).toBe(true);
    if (dec.success) {
      expect(dec.data.sessionId).toBe('sess-7f3e1c2a');
      expect(dec.data.audience).toBe('alphabet:demo');
      expect(dec.data.consent.tier).toBe('ANONYMOUS');
      expect(dec.data.nonce.length).toBeGreaterThan(0);
    }
  });

  it('detects tampering with the ciphertext', async () => {
    const enc = await adapter.encode(basePayload(), key());
    expect(enc.success).toBe(true);
    if (!enc.success) return;

    // Decode the envelope, mutate ciphertext byte, re-encode.
    const decoded = JSON.parse(
      new TextDecoder().decode(b64urlDecode(enc.data))
    ) as { v: number; aud: string; iv: string; ct: string };
    const ctBytes = b64urlDecode(decoded.ct);
    const lastIdx = ctBytes.length - 1;
    ctBytes[lastIdx] = ((ctBytes[lastIdx] as number) ^ 0xff) & 0xff;
    decoded.ct = b64urlEncode(ctBytes);
    const tampered = b64urlEncode(
      new TextEncoder().encode(JSON.stringify(decoded))
    );

    const dec = await adapter.decode(tampered, key(), {
      expectedAudience: 'alphabet:demo',
    });
    expect(dec.success).toBe(false);
    if (!dec.success) expect(dec.error.code).toBe('PAYLOAD_TAMPERED');
  });

  it('rejects an expired payload', async () => {
    const fixedNow = Date.parse('2026-01-01T00:00:00Z');
    const enc = await adapter.encode(basePayload(), key(), {
      ttlMs: 1_000,
      now: () => fixedNow,
    });
    expect(enc.success).toBe(true);
    if (!enc.success) return;

    const dec = await adapter.decode(enc.data, key(), {
      expectedAudience: 'alphabet:demo',
      now: () => fixedNow + 60_000, // 1 minute later
    });
    expect(dec.success).toBe(false);
    if (!dec.success) expect(dec.error.code).toBe('PAYLOAD_EXPIRED');
  });

  it('rejects when audience does not match', async () => {
    const enc = await adapter.encode(basePayload(), key());
    expect(enc.success).toBe(true);
    if (!enc.success) return;

    const dec = await adapter.decode(enc.data, key(), {
      expectedAudience: 'alphabet:other',
    });
    expect(dec.success).toBe(false);
    if (!dec.success) expect(dec.error.code).toBe('AUDIENCE_MISMATCH');
  });

  it('rejects when the wrong key is used', async () => {
    const enc = await adapter.encode(basePayload(), key());
    expect(enc.success).toBe(true);
    if (!enc.success) return;

    const wrongKey = new Uint8Array(32);
    for (let i = 0; i < wrongKey.length; i++) wrongKey[i] = 0xaa;
    const dec = await adapter.decode(enc.data, wrongKey, {
      expectedAudience: 'alphabet:demo',
    });
    expect(dec.success).toBe(false);
    if (!dec.success) expect(dec.error.code).toBe('PAYLOAD_TAMPERED');
  });

  it('refuses to encode payloads containing PII', async () => {
    const payload = {
      ...basePayload(),
      sessionId: 'alice@example.com',
    };
    const enc = await adapter.encode(payload, key());
    expect(enc.success).toBe(false);
    if (!enc.success) expect(enc.error.code).toBe('PII_DETECTED');
  });

  it('rejects invalid ttlMs', async () => {
    const enc = await adapter.encode(basePayload(), key(), { ttlMs: -1 });
    expect(enc.success).toBe(false);
    if (!enc.success) expect(enc.error.code).toBe('INVALID_PROTOCOL_PAYLOAD');
  });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(padLen));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
