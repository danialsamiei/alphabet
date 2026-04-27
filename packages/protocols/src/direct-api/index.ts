/**
 * @module @awaf/protocols/direct-api
 * @description
 * Direct API adapter — converts incoming REST-like JSON payloads into
 * normalized `AwafProtocolRequest` objects, validates consent, and
 * produces normalized responses.
 *
 * The adapter is intentionally framework-agnostic: it does not depend on
 * Express, Fastify, Hono or any other HTTP runtime. Consumers wire it
 * into their server of choice by feeding the parsed JSON body and the
 * authoritative consent state.
 */

import { ok, err, type PrivacySignals, type Result } from '@awaf/core';
import {
  protocolError,
  type AwafProtocolError,
} from '../errors/index.js';
import {
  ensureNoPIIInContext,
  validateConsentScope,
} from '../normalizers/index.js';
import type {
  AwafProtocolRequest,
  AwafProtocolResponse,
  AwafToolContext,
  AwafConsentScope,
} from '../contract.js';

// ─── Input Shape ─────────────────────────────────────────────────────────────

/**
 * Raw REST-like request body accepted by the Direct API adapter. This
 * mirrors the AWAF API envelope but accepts `unknown` payloads so that
 * the adapter can be reused across all 16 endpoints.
 */
export interface DirectApiRequestBody<TPayload = unknown> {
  readonly operation: string;
  readonly context: AwafToolContext;
  readonly consent: AwafConsentScope;
  readonly payload: TPayload;
  readonly correlationId?: string;
}

/**
 * Authoritative consent state held by the server. The Direct API adapter
 * always trusts this over the `context.consentTier` claimed by the client.
 */
export interface AuthoritativeConsentState {
  readonly tier: AwafConsentScope['tier'];
  readonly privacy: PrivacySignals;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Direct API adapter. Stateless — instantiate once and reuse.
 */
export class DirectApiAdapter {
  /**
   * Convert a parsed REST body into a normalized `AwafProtocolRequest`.
   * Validates structure, consent scope, and PII-shape of the context.
   */
  normalizeRequest<TPayload>(
    body: DirectApiRequestBody<TPayload>,
    authoritative: AuthoritativeConsentState
  ): Result<AwafProtocolRequest<TPayload>, AwafProtocolError> {
    if (!body || typeof body !== 'object') {
      return err(
        protocolError('INVALID_PROTOCOL_REQUEST', 'Request body must be an object')
      );
    }
    if (typeof body.operation !== 'string' || body.operation.length === 0) {
      return err(
        protocolError('INVALID_PROTOCOL_REQUEST', 'Missing "operation" field')
      );
    }
    if (!body.context || typeof body.context !== 'object') {
      return err(
        protocolError('INVALID_PROTOCOL_REQUEST', 'Missing "context" object')
      );
    }
    if (!body.consent || typeof body.consent !== 'object') {
      return err(
        protocolError('INVALID_PROTOCOL_REQUEST', 'Missing "consent" object')
      );
    }

    // Override the client-claimed tier with the authoritative value.
    const consent: AwafConsentScope = {
      ...body.consent,
      tier: authoritative.tier,
    };

    const consentResult = validateConsentScope(consent, authoritative);
    if (!consentResult.success) return consentResult;

    const sanitizedContext: AwafToolContext = {
      ...body.context,
      consentTier: authoritative.tier,
      privacyRestricted:
        authoritative.privacy.dntEnabled || authoritative.privacy.gpcEnabled,
    };
    const contextResult = ensureNoPIIInContext(sanitizedContext);
    if (!contextResult.success) return contextResult;

    const correlationId =
      typeof body.correlationId === 'string' && body.correlationId.length > 0
        ? body.correlationId
        : `corr-${cryptoRandom()}`;

    return ok({
      protocol: 'API',
      operation: body.operation,
      context: contextResult.data,
      consent: consentResult.data,
      payload: body.payload,
      correlationId,
      receivedAt: new Date().toISOString(),
    });
  }

  /**
   * Build a normalized success response for an already-handled request.
   */
  successResponse<TData>(
    request: Pick<AwafProtocolRequest, 'correlationId' | 'protocol' | 'operation'>,
    data: TData,
    processingTimeMs: number
  ): AwafProtocolResponse<TData> {
    return {
      correlationId: request.correlationId,
      protocol: request.protocol,
      operation: request.operation,
      result: ok(data),
      processingTimeMs,
      respondedAt: new Date().toISOString(),
    };
  }

  /**
   * Build a normalized error response.
   */
  errorResponse<TData = never>(
    request: Pick<AwafProtocolRequest, 'correlationId' | 'protocol' | 'operation'>,
    error: AwafProtocolError,
    processingTimeMs: number
  ): AwafProtocolResponse<TData> {
    return {
      correlationId: request.correlationId,
      protocol: request.protocol,
      operation: request.operation,
      result: err(error),
      processingTimeMs,
      respondedAt: new Date().toISOString(),
    };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function cryptoRandom(): string {
  // Use Web Crypto when available; fall back to Math.random for tests in
  // environments where it is missing. Correlation IDs are not security
  // sensitive — they exist only for tracing.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return Math.random().toString(36).slice(2, 12);
}
