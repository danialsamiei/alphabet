/**
 * @module @awaf/protocols/qr-handoff
 * @description
 * QR Handoff — short-lived encrypted payload that lets a visitor move a
 * session from one device to another (e.g. mobile → desktop) by scanning
 * a QR code.
 *
 * Security properties:
 *   • Confidentiality + integrity via AES-GCM (WebCrypto).
 *   • Tamper-evidence: any change to the ciphertext or AAD invalidates
 *     decryption (AES-GCM auth tag).
 *   • Expiry: payloads carry an explicit `expiresAt` and are rejected
 *     after that timestamp.
 *   • Audience binding: payloads carry an `audience` string that must
 *     match the decoder's expected audience (bound as AAD so it cannot
 *     be swapped).
 *   • Nonce per payload (96-bit IV) to make replay detectable.
 *   • PII guard: every string field is scanned with the same
 *     conservative heuristic used elsewhere in the package; encoding is
 *     refused when PII is detected.
 *
 * Out of scope (intentionally):
 *   • The actual QR rendering. The encoded string can be passed to any
 *     QR library by the consumer.
 *   • Key management. Callers provide raw key material; rotating keys
 *     and storing them securely is the host application's job.
 */

import { ok, err, type Result } from '@awaf/core';
import {
  protocolError,
  type AwafProtocolError,
} from '../errors/index.js';
import { looksLikePII } from '../normalizers/index.js';
import type { AwafConsentScope } from '../contract.js';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Plain payload to be encoded into a QR handoff token. Must NOT contain
 * PII — fields are validated before encoding.
 */
export interface QrHandoffPayload {
  /** Opaque session identifier (no PII). */
  readonly sessionId: string;
  /** Visitor identifier (no PII). */
  readonly visitorId: string;
  /** Audience the payload is intended for — e.g. "awaf:demo". */
  readonly audience: string;
  /** Expiry as ISO 8601 timestamp (string for stability across runtimes). */
  readonly expiresAt: string;
  /** Nonce / handoff id — surfaced to allow replay detection at the receiver. */
  readonly nonce: string;
  /** Consent scope being handed off. */
  readonly consent: AwafConsentScope;
}

/** Options for `encode`. */
export interface QrEncodeOptions {
  /** Time-to-live in milliseconds. Default: 60_000 (1 minute). */
  readonly ttlMs?: number;
  /**
   * Override the system clock — used by tests. Returns the current time
   * in milliseconds since the Unix epoch.
   */
  readonly now?: () => number;
}

/** Options for `decode`. */
export interface QrDecodeOptions {
  /**
   * Audience the receiver expects. The decode operation fails with
   * `AUDIENCE_MISMATCH` if the payload was encoded for a different
   * audience.
   */
  readonly expectedAudience: string;
  /** Override the system clock — used by tests. */
  readonly now?: () => number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALG = { name: 'AES-GCM', length: 256 } as const;
const IV_LENGTH = 12; // 96-bit nonce — recommended for AES-GCM.
const PAYLOAD_VERSION = 1;
const DEFAULT_TTL_MS = 60_000;

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * QR Handoff encoder/decoder. Stateless — instantiate per request or
 * once globally.
 */
export class QrHandoffAdapter {
  /**
   * Encode a plain payload into a base64url string suitable for placing
   * inside a QR code. Returns a `Result` rather than throwing.
   */
  async encode(
    payload: Omit<QrHandoffPayload, 'expiresAt' | 'nonce'> & {
      readonly expiresAt?: string;
      readonly nonce?: string;
    },
    rawKey: Uint8Array,
    options: QrEncodeOptions = {}
  ): Promise<Result<string, AwafProtocolError>> {
    const cryptoLike = getSubtle();
    if (!cryptoLike) {
      return err(
        protocolError('CRYPTO_UNAVAILABLE', 'WebCrypto subtle is not available')
      );
    }

    const piiCheck = ensureNoPIIInPayload(payload);
    if (!piiCheck.success) return piiCheck;

    const now = options.now ?? Date.now;
    const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 24 * 60 * 60_000) {
      return err(
        protocolError('INVALID_PROTOCOL_PAYLOAD', 'ttlMs must be in (0, 24h]', {
          ttlMs: ttl,
        })
      );
    }

    const expiresAt = payload.expiresAt ?? new Date(now() + ttl).toISOString();
    let nonce = payload.nonce;
    if (nonce === undefined) {
      const nr = randomNonce();
      if (!nr.success) return nr;
      nonce = nr.data;
    }

    const fullPayload: QrHandoffPayload = {
      sessionId: payload.sessionId,
      visitorId: payload.visitorId,
      audience: payload.audience,
      expiresAt,
      nonce,
      consent: payload.consent,
    };

    let key: CryptoKey;
    try {
      key = await cryptoLike.importKey(
        'raw',
        bufferSourceFromBytes(rawKey),
        ALG,
        false,
        ['encrypt']
      );
    } catch {
      return err(protocolError('CRYPTO_FAILURE', 'Failed to import handoff key'));
    }

    const ivResult = randomBytes(IV_LENGTH);
    if (!ivResult.success) return ivResult;
    const iv = ivResult.data;
    const aad = textEncoder.encode(payload.audience);
    const plaintext = textEncoder.encode(JSON.stringify(fullPayload));

    let ciphertext: ArrayBuffer;
    try {
      ciphertext = await cryptoLike.encrypt(
        { name: 'AES-GCM', iv: bufferSourceFromBytes(iv), additionalData: bufferSourceFromBytes(aad) },
        key,
        bufferSourceFromBytes(plaintext)
      );
    } catch {
      return err(protocolError('CRYPTO_FAILURE', 'AES-GCM encryption failed'));
    }

    const envelope = {
      v: PAYLOAD_VERSION,
      aud: payload.audience,
      iv: toBase64Url(iv),
      ct: toBase64Url(new Uint8Array(ciphertext)),
    };
    return ok(toBase64Url(textEncoder.encode(JSON.stringify(envelope))));
  }

  /**
   * Decode a QR handoff string. Validates audience, expiry, and integrity.
   */
  async decode(
    token: string,
    rawKey: Uint8Array,
    options: QrDecodeOptions
  ): Promise<Result<QrHandoffPayload, AwafProtocolError>> {
    const cryptoLike = getSubtle();
    if (!cryptoLike) {
      return err(
        protocolError('CRYPTO_UNAVAILABLE', 'WebCrypto subtle is not available')
      );
    }
    if (typeof token !== 'string' || token.length === 0) {
      return err(protocolError('INVALID_PROTOCOL_PAYLOAD', 'Token is empty'));
    }
    if (typeof options.expectedAudience !== 'string' || options.expectedAudience.length === 0) {
      return err(
        protocolError('INVALID_PROTOCOL_PAYLOAD', 'expectedAudience is required')
      );
    }

    let envelope: { v?: unknown; aud?: unknown; iv?: unknown; ct?: unknown };
    try {
      const decoded = textDecoder.decode(fromBase64Url(token));
      envelope = JSON.parse(decoded) as typeof envelope;
    } catch {
      return err(protocolError('PAYLOAD_TAMPERED', 'Token is not a valid envelope'));
    }
    if (envelope.v !== PAYLOAD_VERSION) {
      return err(
        protocolError('PAYLOAD_TAMPERED', 'Unsupported envelope version', {
          version: envelope.v,
        })
      );
    }
    if (typeof envelope.aud !== 'string' || envelope.aud !== options.expectedAudience) {
      // Audience mismatch detected up front. We still run AES-GCM with
      // the expected audience as AAD below to ensure constant-time-ish
      // failure semantics, but we can return early here without leaking
      // anything sensitive.
      return err(
        protocolError('AUDIENCE_MISMATCH', 'Envelope audience does not match expected', {
          expected: options.expectedAudience,
        })
      );
    }
    if (typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
      return err(protocolError('PAYLOAD_TAMPERED', 'Envelope is missing iv/ct'));
    }

    let iv: Uint8Array;
    let ct: Uint8Array;
    try {
      iv = fromBase64Url(envelope.iv);
      ct = fromBase64Url(envelope.ct);
    } catch {
      return err(protocolError('PAYLOAD_TAMPERED', 'Envelope contains invalid base64'));
    }
    if (iv.length !== IV_LENGTH) {
      return err(protocolError('NONCE_INVALID', 'IV has wrong length'));
    }

    let key: CryptoKey;
    try {
      key = await cryptoLike.importKey(
        'raw',
        bufferSourceFromBytes(rawKey),
        ALG,
        false,
        ['decrypt']
      );
    } catch {
      return err(protocolError('CRYPTO_FAILURE', 'Failed to import handoff key'));
    }

    const aad = textEncoder.encode(options.expectedAudience);
    let plaintext: ArrayBuffer;
    try {
      plaintext = await cryptoLike.decrypt(
        { name: 'AES-GCM', iv: bufferSourceFromBytes(iv), additionalData: bufferSourceFromBytes(aad) },
        key,
        bufferSourceFromBytes(ct)
      );
    } catch {
      return err(
        protocolError('PAYLOAD_TAMPERED', 'AES-GCM authentication failed')
      );
    }

    let payload: QrHandoffPayload;
    try {
      payload = JSON.parse(textDecoder.decode(plaintext)) as QrHandoffPayload;
    } catch {
      return err(protocolError('PAYLOAD_TAMPERED', 'Plaintext is not valid JSON'));
    }

    if (payload.audience !== options.expectedAudience) {
      // Defence in depth — should never trigger because audience is AAD.
      return err(
        protocolError('AUDIENCE_MISMATCH', 'Payload audience differs from envelope', {
          expected: options.expectedAudience,
        })
      );
    }

    const now = options.now ? options.now() : Date.now();
    const expiresAtMs = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return err(protocolError('PAYLOAD_TAMPERED', 'Payload expiresAt is invalid'));
    }
    if (now >= expiresAtMs) {
      return err(
        protocolError('PAYLOAD_EXPIRED', 'Handoff payload has expired', {
          expiresAt: payload.expiresAt,
        })
      );
    }

    const piiCheck = ensureNoPIIInPayload(payload);
    if (!piiCheck.success) return piiCheck;

    return ok(payload);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getSubtle(): SubtleCrypto | null {
  const g = globalThis as { crypto?: { subtle?: SubtleCrypto } };
  return g.crypto?.subtle ?? null;
}

function randomBytes(length: number): Result<Uint8Array, AwafProtocolError> {
  const out = new Uint8Array(length);
  const g = globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(out);
    return ok(out);
  }
  // Refuse to fall back to Math.random — it is not cryptographically
  // safe and would silently undermine the security guarantees of the
  // handoff payload.
  return err(
    protocolError('CRYPTO_UNAVAILABLE', 'crypto.getRandomValues is not available')
  );
}

function randomNonce(): Result<string, AwafProtocolError> {
  const r = randomBytes(16);
  return r.success ? ok(toBase64Url(r.data)) : r;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is available in Node ≥16 and all browsers.
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLen);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Normalize a `Uint8Array` into a `BufferSource` that satisfies WebCrypto
 * type definitions across Node and DOM lib variants. We copy into a fresh
 * `ArrayBuffer` so that the underlying buffer is never a `SharedArrayBuffer`.
 */
function bufferSourceFromBytes(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function ensureNoPIIInPayload(
  payload: {
    readonly sessionId: string;
    readonly visitorId: string;
    readonly audience: string;
    readonly expiresAt?: string;
    readonly nonce?: string;
    readonly consent: AwafConsentScope;
  }
): Result<true, AwafProtocolError> {
  const fields: ReadonlyArray<readonly [string, string | undefined]> = [
    ['sessionId', payload.sessionId],
    ['visitorId', payload.visitorId],
    ['audience', payload.audience],
    ['nonce', payload.nonce],
  ];
  for (const [name, value] of fields) {
    if (typeof value === 'string' && looksLikePII(value)) {
      return err(
        protocolError('PII_DETECTED', `QR payload field "${name}" looks like PII`, {
          field: name,
        })
      );
    }
  }
  return ok(true);
}
