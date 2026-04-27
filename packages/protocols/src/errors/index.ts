/**
 * @module @awaf/protocols/errors
 * @description
 * Typed protocol errors for AWAF adapters. Errors are returned via the
 * shared `Result<T, E>` pattern instead of being thrown.
 */

import type { AWAFError } from '@awaf/core';

/**
 * Machine-readable error codes for AWAF protocol adapters.
 * All adapters must use these codes (or extend them) so that callers can
 * branch reliably without parsing free-form messages.
 */
export type AwafProtocolErrorCode =
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
 * Typed AWAF protocol error. Extends the base `AWAFError` shape so that it
 * remains compatible with the shared `Result<T, AWAFError>` pattern from
 * `@awaf/core`.
 */
export interface AwafProtocolError extends AWAFError {
  readonly code: AwafProtocolErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Build a typed `AwafProtocolError`. The `details` object must not contain
 * PII; callers are expected to redact identifying fields beforehand.
 */
export function protocolError(
  code: AwafProtocolErrorCode,
  message: string,
  details?: Record<string, unknown>
): AwafProtocolError {
  return details === undefined
    ? { code, message }
    : { code, message, details };
}
