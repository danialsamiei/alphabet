/**
 * @module memory/consent-receipt
 * @description
 * **ECDSA P-256 consent receipts** for the Encrypted Living Memory
 * Engine. A receipt is a signed attestation
 *
 *     `<base64url(payload)>.<base64url(signature)>`
 *
 * over a JSON payload covering `{visitorIdHash, domain, tier,
 * policyVersion, ts, v}`. Built directly on `globalThis.crypto.subtle`
 * (no third-party deps) so it works in browsers, Node ≥ 20, and edge
 * runtimes.
 *
 * **Why ECDSA P-256, not Ed25519.** Ed25519 in WebCrypto is gated behind
 * flags in several mainstream runtimes; P-256 is universally available
 * with the same security level for this use case (signed receipts, not
 * key-exchange).
 *
 * **What this is NOT.** It is **not** a zk-SNARK. The receipt reveals
 * `(visitorIdHash, domain, tier, ts)` to the verifier — that's the
 * point. Real zero-knowledge consent proofs are deferred to the
 * out-of-tree `@alphabet/zk-consent` package (PR-B): they would require
 * a circom circuit, trusted-setup ceremony, and a Groth16 verifier, none
 * of which can be honestly produced in a single PR.
 */

import type { MemoryDomain } from '../types/base.js';
import { ok, err, type Result, type AlphabetError } from '../types/result.js';
import type {
  ConsentReceiptPayload,
  ConsentReceiptToken,
  MemoryTier,
} from './types.js';

// ─── base64url helpers (mirrors @alphabet/protocols/v2/consent-proof) ────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] as number);
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa is not available in this runtime');
  }
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  if (typeof globalThis.atob !== 'function') {
    throw new Error('atob is not available in this runtime');
  }
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  // Some runtimes (jsdom + Node webcrypto realm mismatch) reject foreign-realm
  // ArrayBuffers. Returning the Uint8Array itself is a valid `BufferSource`
  // and works in every WebCrypto-compatible runtime we target. The cast is
  // needed because TS strict + lib.dom narrows BufferSource to
  // `ArrayBufferView<ArrayBuffer>` whereas Uint8Array's underlying buffer is
  // typed as `ArrayBufferLike`.
  return bytes as unknown as BufferSource;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error('WebCrypto subtle is not available in this runtime');
  }
  return subtle;
}

const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' } as const;

// ─── Key generation ──────────────────────────────────────────────────────────

/** Generate a fresh ECDSA P-256 key pair for receipt minting. */
export async function generateReceiptKeyPair(): Promise<CryptoKeyPair> {
  return getSubtle().generateKey(KEY_ALGO, true, ['sign', 'verify']);
}

// ─── Mint ────────────────────────────────────────────────────────────────────

/** Inputs used to build a receipt payload. Caller controls the tier. */
export interface MintReceiptInput {
  readonly visitorIdHash: string;
  readonly domain: MemoryDomain;
  readonly tier: MemoryTier;
  readonly policyVersion: string;
  readonly now?: () => number;
}

/** Sign and serialize a receipt. */
export async function mintConsentReceipt(
  input: MintReceiptInput,
  privateKey: CryptoKey,
): Promise<Result<ConsentReceiptToken, AlphabetError>> {
  let subtle: SubtleCrypto;
  try {
    subtle = getSubtle();
  } catch (e) {
    return err({
      code: 'CRYPTO_UNAVAILABLE',
      message: (e as Error).message ?? 'WebCrypto unavailable',
    });
  }
  const payload: ConsentReceiptPayload = {
    v: 'v1',
    visitorIdHash: input.visitorIdHash,
    domain: input.domain,
    tier: input.tier,
    policyVersion: input.policyVersion,
    ts: (input.now ?? Date.now)(),
  };
  try {
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = bytesToBase64Url(utf8(payloadJson));
    const sig = await subtle.sign(SIGN_ALGO, privateKey, asBufferSource(utf8(payloadB64)));
    return ok(`${payloadB64}.${bytesToBase64Url(new Uint8Array(sig))}`);
  } catch (e) {
    return err({
      code: 'RECEIPT_INVALID',
      message: `Failed to sign consent receipt: ${(e as Error).message}`,
    });
  }
}

// ─── Verify ──────────────────────────────────────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Verify a receipt and recover its payload. */
export async function verifyConsentReceipt(
  token: ConsentReceiptToken,
  publicKey: CryptoKey,
): Promise<Result<ConsentReceiptPayload, AlphabetError>> {
  if (!TOKEN_RE.test(token)) {
    return err({ code: 'RECEIPT_INVALID', message: 'Malformed receipt token' });
  }
  const [payloadB64, sigB64] = token.split('.') as [string, string];
  let subtle: SubtleCrypto;
  try {
    subtle = getSubtle();
  } catch (e) {
    return err({
      code: 'CRYPTO_UNAVAILABLE',
      message: (e as Error).message ?? 'WebCrypto unavailable',
    });
  }
  let valid: boolean;
  try {
    valid = await subtle.verify(
      SIGN_ALGO,
      publicKey,
      asBufferSource(base64UrlToBytes(sigB64)),
      asBufferSource(utf8(payloadB64)),
    );
  } catch (e) {
    return err({
      code: 'RECEIPT_INVALID',
      message: `verify failed: ${(e as Error).message}`,
    });
  }
  if (!valid) {
    return err({ code: 'RECEIPT_INVALID', message: 'Signature mismatch' });
  }
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadB64)),
    ) as ConsentReceiptPayload;
    return ok(payload);
  } catch {
    return err({ code: 'RECEIPT_INVALID', message: 'Payload is not valid JSON' });
  }
}

// ─── Hashing utility (visitor id → visitorIdHash) ────────────────────────────

/**
 * Convenience: hex-encoded SHA-256 of an arbitrary string. Use this once
 * to convert a raw visitor id into the `visitorIdHash` carried by every
 * receipt. The engine itself never accepts the raw id.
 */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtle();
  const buf = await subtle.digest('SHA-256', asBufferSource(utf8(input)));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return out;
}
