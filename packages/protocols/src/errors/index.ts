/**
 * @module @alphabet/protocols/errors
 * @description
 * Typed protocol errors for Alphabet adapters. Errors are returned via the
 * shared `Result<T, E>` pattern instead of being thrown.
 */

import type { AlphabetError } from '@alphabet/core';

/**
 * Machine-readable error codes for Alphabet protocol adapters.
 * All adapters must use these codes (or extend them) so that callers can
 * branch reliably without parsing free-form messages.
 */
export type AlphabetProtocolErrorCode =
  | 'INVALID_PROTOCOL_REQUEST'
  | 'INVALID_PROTOCOL_PAYLOAD'
  | 'CONSENT_INSUFFICIENT'
  | 'CONSENT_REVOKED'
  | 'MEMORY_PERMISSION_DENIED'
  | 'PII_DETECTED'
  | 'AUDIENCE_MISMATCH'
  | 'PAYLOAD_EXPIRED'
  | 'PAYLOAD_TAMPERED'
  | 'NONCE_INVALID'
  | 'CRYPTO_UNAVAILABLE'
  | 'CRYPTO_FAILURE'
  | 'TOOL_NOT_FOUND'
  | 'TASK_INVALID'
  | 'ADAPTER_NOT_CONFIGURED'
  | 'UNSUPPORTED_PROTOCOL';

/**
 * Typed Alphabet protocol error. Extends the base `AlphabetError` shape so that it
 * remains compatible with the shared `Result<T, AlphabetError>` pattern from
 * `@alphabet/core`.
 */
export interface AlphabetProtocolError extends AlphabetError {
  readonly code: AlphabetProtocolErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Build a typed `AlphabetProtocolError`. The `details` object must not contain
 * PII; callers are expected to redact identifying fields beforehand.
 */
export function protocolError(
  code: AlphabetProtocolErrorCode,
  message: string,
  details?: Record<string, unknown>
): AlphabetProtocolError {
  return details === undefined
    ? { code, message }
    : { code, message, details };
}
