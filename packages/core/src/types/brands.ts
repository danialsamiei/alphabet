/**
 * @module brands
 * @description
 * Brand Types برای جلوگیری از اشتباه گذاشتن شناسه‌های همشکل در AWAF SDK.
 * Branded Types prevent type confusion (e.g., mixing VisitorId with SessionId).
 */

import { type AWAFError, err, ok, type Result } from './result.js';

// ─── پایه Brand ───────────────────────────────────────────────────────────────

declare const __brand: unique symbol;

/** نوع کمکی برای ساخت Brand Types */
type Brand<B> = { readonly [__brand]: B };

/**
 * نوع Branded<T, B> — ترکیب T با یک brand برای type safety.
 *
 * @template T - نوع پایه (معمولاً string)
 * @template B - رشته برند منحصربه‌فرد
 */
export type Branded<T, B> = T & Brand<B>;

// ─── Brand Types اصلی AWAF ────────────────────────────────────────────────────

/** شناسه بازدیدکننده — با prefix `v-` یا `anon-` */
export type VisitorId = Branded<string, 'VisitorId'>;

/** شناسه session — با prefix `sess-` */
export type SessionId = Branded<string, 'SessionId'>;

/** شناسه حافظه — با prefix `mem-` */
export type MemoryId = Branded<string, 'MemoryId'>;

/** شناسه درخواست — با prefix `req-` */
export type RequestId = Branded<string, 'RequestId'>;

/** توکن رضایت — با prefix `ct-` */
export type ConsentToken = Branded<string, 'ConsentToken'>;

/** شناسه تأیید — با prefix `cfm-` */
export type ConfirmationId = Branded<string, 'ConfirmationId'>;

/** شناسه audit log — با prefix `aud-` */
export type AuditLogId = Branded<string, 'AuditLogId'>;

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * ساخت VisitorId با validation.
 *
 * @param raw - رشته خام
 * @returns Result<VisitorId, AWAFError>
 *
 * @example
 * const result = createVisitorId('v-abc12345');
 * if (result.success) console.log(result.data); // VisitorId
 */
export function createVisitorId(raw: string): Result<VisitorId, AWAFError> {
  if (!raw || raw.length < 8) {
    return err({ code: 'INVALID_VISITOR_ID', message: 'Visitor ID must be at least 8 characters' });
  }
  return ok(raw as VisitorId);
}

/**
 * ساخت SessionId جدید.
 *
 * @returns SessionId با prefix `sess-`
 *
 * @example
 * const sessionId = createSessionId();
 */
export function createSessionId(): SessionId {
  return `sess-${crypto.randomUUID()}` as SessionId;
}

/**
 * ساخت MemoryId جدید.
 *
 * @returns MemoryId با prefix `mem-`
 *
 * @example
 * const memId = createMemoryId();
 */
export function createMemoryId(): MemoryId {
  return `mem-${crypto.randomUUID()}` as MemoryId;
}

/**
 * ساخت RequestId جدید.
 *
 * @returns RequestId با prefix `req-`
 *
 * @example
 * const reqId = createRequestId();
 */
export function createRequestId(): RequestId {
  return `req-${crypto.randomUUID()}` as RequestId;
}

/**
 * تولید ConsentToken جدید.
 *
 * @returns ConsentToken با prefix `ct-`
 *
 * @example
 * const token = generateConsentToken();
 */
export function generateConsentToken(): ConsentToken {
  return `ct-${crypto.randomUUID()}` as ConsentToken;
}

/**
 * تولید ConfirmationId جدید.
 *
 * @returns ConfirmationId با prefix `cfm-`
 *
 * @example
 * const cfmId = generateConfirmationId();
 */
export function generateConfirmationId(): ConfirmationId {
  return `cfm-${crypto.randomUUID()}` as ConfirmationId;
}

/**
 * ساخت AuditLogId جدید.
 *
 * @returns AuditLogId با prefix `aud-`
 *
 * @example
 * const audId = createAuditLogId();
 */
export function createAuditLogId(): AuditLogId {
  return `aud-${crypto.randomUUID()}` as AuditLogId;
}
