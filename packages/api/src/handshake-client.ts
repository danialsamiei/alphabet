/**
 * @module handshake-client
 * @description
 * HandshakeClient — کلاینت HTTP برای endpoint POST /api/context/handshake.
 * HTTP client for the context handshake endpoint with retry logic and timeout.
 */

import type {
  AWAFRequest,
  AWAFResponse,
  HandshakeRequestPayload,
  HandshakeResult,
} from '@awaf/core';
import {
  type AWAFError,
  type Result,
  ok,
  err,
  createRequestId,
  createSessionId,
} from '@awaf/core';
import type { VisitorId } from '@awaf/core';

// ─── HandshakeClient Options ──────────────────────────────────────────────────

/**
 * گزینه‌های HandshakeClient.
 * Configuration options for HandshakeClient.
 */
export interface HandshakeClientOptions {
  /** آدرس پایه API — مثال: "http://localhost:3000/api" */
  readonly apiBaseUrl: string;
  /** timeout هر درخواست (میلی‌ثانیه) — پیش‌فرض: 5000 */
  readonly timeoutMs?: number;
  /** حداکثر تعداد retry — پیش‌فرض: 2 */
  readonly maxRetries?: number;
  /** visitorId بازدیدکننده */
  readonly visitorId: VisitorId;
}

// ─── HandshakeClient Class ────────────────────────────────────────────────────

/**
 * کلاینت HTTP برای endpoint Context Handshake.
 * HTTP client for the Context Handshake endpoint.
 *
 * Sends passive browser signals to `POST /api/context/handshake` and
 * returns a HandshakeResult with UIConfig, sessionId, and consentGranted.
 *
 * @example
 * const client = new HandshakeClient({
 *   apiBaseUrl: 'http://localhost:3000/api',
 *   visitorId: 'anon-xyz' as VisitorId,
 * });
 * const result = await client.execute(payload);
 * if (result.success) {
 *   const { uiConfig, sessionId } = result.data;
 * }
 */
export class HandshakeClient {
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly visitorId: VisitorId;

  constructor(options: HandshakeClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
    this.visitorId = options.visitorId;
  }

  /**
   * اجرای Context Handshake — ارسال سیگنال‌ها به سرور.
   * Executes the Context Handshake — sends signals to the server.
   *
   * @param payload - سیگنال‌های passive برای ارسال
   * @returns Promise<Result<HandshakeResult, AWAFError>>
   *
   * @example
   * const result = await client.execute(payload);
   * if (result.success) {
   *   applyUIConfig(result.data.uiConfig);
   * }
   */
  async execute(
    payload: HandshakeRequestPayload
  ): Promise<Result<HandshakeResult, AWAFError>> {
    const sessionId = createSessionId();
    const request = this.buildRequest(payload, sessionId);
    const url = `${this.apiBaseUrl}/context/handshake`;

    return this.sendWithRetry(url, JSON.stringify(request), 0);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private buildRequest(
    payload: HandshakeRequestPayload,
    sessionId: ReturnType<typeof createSessionId>
  ): AWAFRequest<HandshakeRequestPayload> {
    return {
      protocol: 'API',
      endpoint: '/api/context/handshake',
      visitorId: this.visitorId,
      sessionId,
      consentTier: 'NO_MEMORY',
      payload,
      timestamp: new Date().toISOString(),
      requestId: createRequestId(),
    };
  }

  private async sendWithRetry(
    url: string,
    body: string,
    attempt: number
  ): Promise<Result<HandshakeResult, AWAFError>> {
    try {
      const response = await this.fetchWithTimeout(url, body);

      if (!response.ok) {
        const isRetryable = response.status >= 500 && attempt < this.maxRetries;
        if (isRetryable) {
          return this.sendWithRetry(url, body, attempt + 1);
        }
        return err({
          code: 'HANDSHAKE_HTTP_ERROR',
          message: `Handshake request failed with HTTP ${response.status}`,
          details: { status: response.status, attempt },
        });
      }

      const json = await response.json() as AWAFResponse<HandshakeResult>;

      // بررسی شکل پاسخ — محافظت در برابر malformed responses
      if (typeof json !== 'object' || json === null || !('success' in json)) {
        return err({
          code: 'HANDSHAKE_INVALID_RESPONSE',
          message: 'Server returned a malformed handshake response',
        });
      }

      if (!json.success || json.data === undefined) {
        return err(
          json.error ?? {
            code: 'HANDSHAKE_INVALID_RESPONSE',
            message: 'Server returned an unsuccessful handshake response',
          }
        );
      }

      return ok(json.data);
    } catch (e) {
      const isRetryable = attempt < this.maxRetries;
      if (isRetryable) {
        return this.sendWithRetry(url, body, attempt + 1);
      }
      return err({
        code: 'HANDSHAKE_NETWORK_ERROR',
        message: 'Network error during handshake',
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  private fetchWithTimeout(url: string, body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  }
}
