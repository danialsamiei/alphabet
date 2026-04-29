/**
 * @module @alphabet/protocols/v2/consent-proof
 * @description
 * Cryptographic Consent Proof — a server-verifiable, signed attestation
 * that a visitor has granted a specific consent tier at a specific
 * time. Built entirely on the WebCrypto API (`globalThis.crypto.subtle`)
 * so it works in browsers, edge runtimes, and Node.js ≥ 20 without
 * any third-party deps.
 *
 * Algorithm:
 *   • ECDSA P-256 (NIST P-256 curve) with SHA-256.
 *   • Ed25519 is intentionally NOT used because it is not yet available
 *     in stable WebCrypto across all targeted runtimes.
 *
 * Token shape (compact JSON, base64url):
 *
 *     <base64url(payloadJson)>.<base64url(signatureBytes)>
 *
 * The payload is a small JSON object covering the audited fields. The
 * signature is over the UTF-8 bytes of the *first* base64url segment
 * (RFC 7515 §3 inspired but deliberately simpler — we are not building
 * a JWS).
 *
 * Threat model:
 *   • Confidentiality: NOT provided. Payload is signed, not encrypted.
 *     Use HTTPS for transport.
 *   • Integrity / authenticity: provided by the signature.
 *   • Replay protection: payload includes `issuedAt` + `expiresAt`;
 *     servers SHOULD also nonce-bind via `audience` if needed.
 */

import { ok, err, type Result } from '@alphabet/core';
import { protocolError, type AlphabetProtocolError } from '../../errors/index.js';
import type { AlphabetConsentScope } from '../../contract.js';

// ─── Public types ────────────────────────────────────────────────────────────

/** Signed payload covered by the consent proof. */
export interface ConsentProofPayload {
  /** Alphabet protocol version — currently 'v2'. */
  readonly v: 'v2';
  /** Visitor identifier (no PII). */
  readonly visitorId: string;
  /** Consent scope claimed at the moment of proof issuance. */
  readonly scope: AlphabetConsentScope;
  /** Audience — verifier must match this exactly. */
  readonly audience: string;
  /** Issuance timestamp (epoch ms). */
  readonly issuedAt: number;
  /** Expiry timestamp (epoch ms). */
  readonly expiresAt: number;
  /** Signing key id, surfaced by the verifier for key rotation. */
  readonly keyId: string;
}

/** Compact serialized form: "<payload>.<signature>". */
export type ConsentProofToken = string;

/** Options accepted by `signConsentProof`. */
export interface SignConsentProofOptions {
  readonly payload: ConsentProofPayload;
  /** ECDSA P-256 private key as a CryptoKey. */
  readonly privateKey: CryptoKey;
}

/** Options accepted by `verifyConsentProof`. */
export interface VerifyConsentProofOptions {
  readonly token: ConsentProofToken;
  /** ECDSA P-256 public key as a CryptoKey. */
  readonly publicKey: CryptoKey;
  /** Audience that the verifier expects. */
  readonly expectedAudience: string;
  /**
   * Time tolerance in milliseconds for clock skew (default 60s).
   */
  readonly clockSkewMs?: number;
  /** Override `Date.now()` (testing). */
  readonly now?: () => number;
}

// ─── base64url ───────────────────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] as number);
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa is not available in this runtime');
  }
  const b64 = globalThis.btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

/**
 * Coerce a `Uint8Array` to a fresh `ArrayBuffer`-backed view so it is
 * accepted by the strict `BufferSource` type used by `SubtleCrypto`.
 */
function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

// ─── Subtle crypto access ────────────────────────────────────────────────────

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error('WebCrypto subtle is not available in this runtime');
  }
  return subtle;
}

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' } as const;

// ─── Key generation ──────────────────────────────────────────────────────────

/**
 * Generate a fresh ECDSA P-256 key pair suitable for consent proofs.
 * Wrap-around helper for tests and bootstrap flows.
 */
export async function generateConsentProofKeyPair(): Promise<CryptoKeyPair> {
  return getSubtle().generateKey(ALGO, true, ['sign', 'verify']);
}

// ─── Sign ────────────────────────────────────────────────────────────────────

/** Sign a consent payload and produce a compact token. */
export async function signConsentProof(
  options: SignConsentProofOptions,
): Promise<Result<ConsentProofToken, AlphabetProtocolError>> {
  let subtle: SubtleCrypto;
  try {
    subtle = getSubtle();
  } catch (e) {
    return err(
      protocolError('CRYPTO_UNAVAILABLE', (e as Error).message ?? 'WebCrypto unavailable'),
    );
  }
  try {
    const payloadJson = JSON.stringify(options.payload);
    const payloadB64 = bytesToBase64Url(utf8(payloadJson));
    const sig = await subtle.sign(SIGN_ALGO, options.privateKey, asBufferSource(utf8(payloadB64)));
    const sigB64 = bytesToBase64Url(new Uint8Array(sig));
    return ok(`${payloadB64}.${sigB64}`);
  } catch (e) {
    return err(
      protocolError('CRYPTO_FAILURE', `Failed to sign consent proof: ${(e as Error).message}`),
    );
  }
}

// ─── Verify ──────────────────────────────────────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Verify a consent proof token and return the validated payload. */
export async function verifyConsentProof(
  options: VerifyConsentProofOptions,
): Promise<Result<ConsentProofPayload, AlphabetProtocolError>> {
  if (!TOKEN_RE.test(options.token)) {
    return err(protocolError('PAYLOAD_TAMPERED', 'Malformed consent proof token'));
  }
  const [payloadB64, sigB64] = options.token.split('.') as [string, string];
  let subtle: SubtleCrypto;
  try {
    subtle = getSubtle();
  } catch (e) {
    return err(
      protocolError('CRYPTO_UNAVAILABLE', (e as Error).message ?? 'WebCrypto unavailable'),
    );
  }
  let valid: boolean;
  try {
    valid = await subtle.verify(
      SIGN_ALGO,
      options.publicKey,
      asBufferSource(base64UrlToBytes(sigB64)),
      asBufferSource(utf8(payloadB64)),
    );
  } catch (e) {
    return err(
      protocolError('CRYPTO_FAILURE', `Verify failed: ${(e as Error).message}`),
    );
  }
  if (!valid) {
    return err(protocolError('PAYLOAD_TAMPERED', 'Signature mismatch'));
  }

  let payload: ConsentProofPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return err(protocolError('PAYLOAD_TAMPERED', 'Payload is not valid JSON'));
  }

  if (payload.audience !== options.expectedAudience) {
    return err(
      protocolError('AUDIENCE_MISMATCH', 'Consent proof audience does not match', {
        expected: options.expectedAudience,
      }),
    );
  }

  const now = (options.now ?? Date.now)();
  const skew = options.clockSkewMs ?? 60_000;
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt + skew < now) {
    return err(protocolError('PAYLOAD_EXPIRED', 'Consent proof has expired'));
  }
  if (typeof payload.issuedAt !== 'number' || payload.issuedAt - skew > now) {
    return err(
      protocolError('PAYLOAD_TAMPERED', 'Consent proof issuedAt is in the future'),
    );
  }

  return ok(payload);
}
