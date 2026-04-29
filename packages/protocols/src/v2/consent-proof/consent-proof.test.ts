/**
 * @file consent-proof.test.ts
 * @description Tests for cryptographic consent proof sign/verify.
 */

import { describe, it, expect } from 'vitest';
import {
  generateConsentProofKeyPair,
  signConsentProof,
  verifyConsentProof,
  type ConsentProofPayload,
} from './index.js';

const validPayload = (): ConsentProofPayload => ({
  v: 'v2',
  visitorId: 'vst_abc',
  scope: {
    tier: 'CONSENTED',
    operations: [],
    memoryDomains: [],
    respectsPrivacySignals: true,
  },
  audience: 'alphabet:demo',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  keyId: 'k1',
});

describe('consent proof', () => {
  it('signs and verifies a valid token', async () => {
    const { privateKey, publicKey } = await generateConsentProofKeyPair();
    const payload = validPayload();
    const signed = await signConsentProof({ payload, privateKey });
    expect(signed.success).toBe(true);
    if (!signed.success) return;
    const verified = await verifyConsentProof({
      token: signed.data,
      publicKey,
      expectedAudience: 'alphabet:demo',
    });
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.data.visitorId).toBe('vst_abc');
      expect(verified.data.scope.tier).toBe('CONSENTED');
    }
  });

  it('rejects when the audience does not match', async () => {
    const { privateKey, publicKey } = await generateConsentProofKeyPair();
    const signed = await signConsentProof({ payload: validPayload(), privateKey });
    if (!signed.success) throw signed.error;
    const verified = await verifyConsentProof({
      token: signed.data,
      publicKey,
      expectedAudience: 'alphabet:other',
    });
    expect(verified.success).toBe(false);
    if (!verified.success) expect(verified.error.code).toBe('AUDIENCE_MISMATCH');
  });

  it('rejects expired tokens', async () => {
    const { privateKey, publicKey } = await generateConsentProofKeyPair();
    const payload: ConsentProofPayload = {
      ...validPayload(),
      issuedAt: Date.now() - 120_000,
      expiresAt: Date.now() - 60_000,
    };
    const signed = await signConsentProof({ payload, privateKey });
    if (!signed.success) throw signed.error;
    const verified = await verifyConsentProof({
      token: signed.data,
      publicKey,
      expectedAudience: 'alphabet:demo',
      clockSkewMs: 1_000,
    });
    expect(verified.success).toBe(false);
    if (!verified.success) expect(verified.error.code).toBe('PAYLOAD_EXPIRED');
  });

  it('rejects tampered payload', async () => {
    const { privateKey, publicKey } = await generateConsentProofKeyPair();
    const signed = await signConsentProof({ payload: validPayload(), privateKey });
    if (!signed.success) throw signed.error;
    // Flip a character in the payload segment.
    const [head, sig] = signed.data.split('.') as [string, string];
    const flipped = head.slice(0, 5) + (head[5] === 'A' ? 'B' : 'A') + head.slice(6);
    const tampered = `${flipped}.${sig}`;
    const verified = await verifyConsentProof({
      token: tampered,
      publicKey,
      expectedAudience: 'alphabet:demo',
    });
    expect(verified.success).toBe(false);
    if (!verified.success) {
      expect(['PAYLOAD_TAMPERED', 'PAYLOAD_EXPIRED']).toContain(verified.error.code);
    }
  });

  it('rejects malformed token', async () => {
    const { publicKey } = await generateConsentProofKeyPair();
    const verified = await verifyConsentProof({
      token: 'not.a.real.token',
      publicKey,
      expectedAudience: 'alphabet:demo',
    });
    expect(verified.success).toBe(false);
    if (!verified.success) expect(verified.error.code).toBe('PAYLOAD_TAMPERED');
  });

  it('rejects when signature is from a different key', async () => {
    const a = await generateConsentProofKeyPair();
    const b = await generateConsentProofKeyPair();
    const signed = await signConsentProof({ payload: validPayload(), privateKey: a.privateKey });
    if (!signed.success) throw signed.error;
    const verified = await verifyConsentProof({
      token: signed.data,
      publicKey: b.publicKey,
      expectedAudience: 'alphabet:demo',
    });
    expect(verified.success).toBe(false);
    if (!verified.success) expect(verified.error.code).toBe('PAYLOAD_TAMPERED');
  });
});
