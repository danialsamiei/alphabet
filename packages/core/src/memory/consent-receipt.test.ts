/**
 * @file consent-receipt.test.ts
 * @description Tests for ECDSA P-256 consent receipt mint/verify.
 */

import { describe, it, expect } from 'vitest';
import {
  generateReceiptKeyPair,
  mintConsentReceipt,
  verifyConsentReceipt,
  sha256Hex,
} from './consent-receipt.js';

describe('consent-receipt / sha256Hex', () => {
  it('produces a 64-char lowercase hex digest', async () => {
    const h = await sha256Hex('vst_abc');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same input', async () => {
    const a = await sha256Hex('vst_xyz');
    const b = await sha256Hex('vst_xyz');
    expect(a).toBe(b);
  });

  it('differs for distinct inputs', async () => {
    const a = await sha256Hex('vst_1');
    const b = await sha256Hex('vst_2');
    expect(a).not.toBe(b);
  });
});

describe('consent-receipt / mint+verify round-trip', () => {
  it('mints a token of shape `payload.signature`', async () => {
    const kp = await generateReceiptKeyPair();
    const r = await mintConsentReceipt(
      {
        visitorIdHash: 'a'.repeat(64),
        domain: 'visitor',
        tier: 1,
        policyVersion: '2026-01',
      },
      kp.privateKey,
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.split('.')).toHaveLength(2);
    }
  });

  it('verifies a freshly-minted token', async () => {
    const kp = await generateReceiptKeyPair();
    const minted = await mintConsentReceipt(
      {
        visitorIdHash: 'b'.repeat(64),
        domain: 'site_specific',
        tier: 2,
        policyVersion: '2026-01',
        now: () => 1_700_000_000_000,
      },
      kp.privateKey,
    );
    if (!minted.success) throw new Error('mint failed');
    const verified = await verifyConsentReceipt(minted.data, kp.publicKey);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.data.tier).toBe(2);
      expect(verified.data.domain).toBe('site_specific');
      expect(verified.data.policyVersion).toBe('2026-01');
      expect(verified.data.ts).toBe(1_700_000_000_000);
    }
  });

  it('rejects a token with a tampered payload', async () => {
    const kp = await generateReceiptKeyPair();
    const minted = await mintConsentReceipt(
      {
        visitorIdHash: 'c'.repeat(64),
        domain: 'visitor',
        tier: 1,
        policyVersion: '2026-01',
      },
      kp.privateKey,
    );
    if (!minted.success) throw new Error('mint failed');
    // Replace the payload with a different b64url string of the same shape.
    const [, sig] = minted.data.split('.');
    const tampered = `${'A'.repeat(20)}.${sig}`;
    const verified = await verifyConsentReceipt(tampered, kp.publicKey);
    expect(verified.success).toBe(false);
    if (!verified.success) expect(verified.error.code).toBe('RECEIPT_INVALID');
  });

  it('rejects a malformed token', async () => {
    const kp = await generateReceiptKeyPair();
    const verified = await verifyConsentReceipt('not-a-valid-token', kp.publicKey);
    expect(verified.success).toBe(false);
  });

  it('rejects a token signed by a different key', async () => {
    const a = await generateReceiptKeyPair();
    const b = await generateReceiptKeyPair();
    const minted = await mintConsentReceipt(
      {
        visitorIdHash: 'd'.repeat(64),
        domain: 'visitor',
        tier: 1,
        policyVersion: '2026-01',
      },
      a.privateKey,
    );
    if (!minted.success) throw new Error('mint failed');
    const verified = await verifyConsentReceipt(minted.data, b.publicKey);
    expect(verified.success).toBe(false);
  });
});
