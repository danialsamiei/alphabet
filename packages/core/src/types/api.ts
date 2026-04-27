/**
 * @module api
 * @description
 * مدل‌های داده API در AWAF SDK — AWAFRequest، AWAFResponse، TokenBudget، ResponseMeta.
 * API data models: AWAFRequest, AWAFResponse, TokenBudget, ResponseMeta.
 */

import type { ConsentTier, ProtocolType, TokenTier, CapabilityLayer } from './base.js';
import type { AWAFError } from './result.js';
import type { VisitorId, SessionId, RequestId } from './brands.js';

// ─── Response Meta ────────────────────────────────────────────────────────────

/**
 * متادیتای پاسخ — اطلاعات rate limit و performance.
 */
export interface ResponseMeta {
  /** زمان پردازش سرور (میلی‌ثانیه) */
  readonly processingTimeMs: number;
  /** زمان باقی‌مانده rate limit (ثانیه) */
  readonly rateLimitResetSec?: number;
  /** تعداد درخواست باقی‌مانده */
  readonly rateLimitRemaining?: number;
  /** زمان پاسخ (ISO 8601) */
  readonly respondedAt: string;
}

// ─── AWAF Request ─────────────────────────────────────────────────────────────

/**
 * درخواست یکپارچه AWAF — کانتینر استاندارد برای تمام پروتکل‌ها.
 * Unified AWAF request — standard container for all protocols.
 *
 * @template T - نوع payload
 *
 * @example
 * const request: AWAFRequest<HandshakePayload> = {
 *   protocol: 'API',
 *   endpoint: '/api/context/handshake',
 *   visitorId: visitorId,
 *   sessionId: sessionId,
 *   consentTier: 'NO_MEMORY',
 *   payload: { language: 'fa', timezone: 'Asia/Tehran' },
 *   timestamp: new Date().toISOString(),
 *   requestId: createRequestId(),
 * };
 */
export interface AWAFRequest<T = unknown> {
  /** پروتکل استفاده‌شده */
  readonly protocol: ProtocolType;
  /** endpoint مقصد */
  readonly endpoint: string;
  /** شناسه بازدیدکننده */
  readonly visitorId: VisitorId;
  /** شناسه session */
  readonly sessionId: SessionId;
  /** سطح رضایت فعلی */
  readonly consentTier: ConsentTier;
  /** payload درخواست */
  readonly payload: T;
  /** زمان درخواست (ISO 8601) */
  readonly timestamp: string;
  /** شناسه یکتا درخواست برای tracing */
  readonly requestId: RequestId;
}

// ─── AWAF Response ────────────────────────────────────────────────────────────

/**
 * پاسخ یکپارچه AWAF — کانتینر استاندارد برای تمام پاسخ‌ها.
 * Unified AWAF response — standard container for all responses.
 *
 * @template T - نوع داده پاسخ
 *
 * @example
 * const response: AWAFResponse<VisitorContext> = {
 *   requestId: reqId,
 *   success: true,
 *   data: visitorContext,
 *   meta: { processingTimeMs: 42, respondedAt: '...' },
 * };
 */
export interface AWAFResponse<T = unknown> {
  /** شناسه درخواست مرتبط */
  readonly requestId: RequestId;
  /** آیا درخواست موفق بود */
  readonly success: boolean;
  /** داده پاسخ (فقط در حالت موفقیت) */
  readonly data?: T;
  /** خطا (فقط در حالت شکست) */
  readonly error?: AWAFError;
  /** متادیتای پاسخ */
  readonly meta: ResponseMeta;
}

// ─── Token Budget ─────────────────────────────────────────────────────────────

/**
 * بودجه توکن LLM — مدیریت مصرف و کنترل هزینه.
 * LLM token budget — manages consumption and cost control.
 */
export interface TokenBudget {
  /** سطح بودجه */
  readonly tier: TokenTier;
  /** حداکثر توکن در هر session */
  readonly maxTokensPerSession: number;
  /** توکن مصرف‌شده در session فعلی */
  readonly tokensUsed: number;
  /** توکن باقی‌مانده */
  readonly tokensRemaining: number;
  /** زمان reset (ISO 8601) */
  readonly resetAt: string;
}

// ─── Handshake Types ──────────────────────────────────────────────────────────

/**
 * payload درخواست Context Handshake.
 */
export interface HandshakeRequestPayload {
  /** زبان مرورگر */
  readonly language: string;
  /** timezone IANA */
  readonly timezone: string;
  /** دستگاه */
  readonly deviceClass: string;
  /** platform مرورگر */
  readonly platform: string;
  /** عرض صفحه */
  readonly screenWidth: number;
  /** ارتفاع صفحه */
  readonly screenHeight: number;
  /** pixel density ratio */
  readonly devicePixelRatio: number;
  /** آیا WebGL دارد */
  readonly webglSupported: boolean;
  /** DNT فعال */
  readonly dntEnabled: boolean;
  /** GPC فعال */
  readonly gpcEnabled: boolean;
  /** نوع شبکه */
  readonly networkType?: string;
  /** referrer */
  readonly referrer: string;
}

/**
 * پیکربندی UI — خروجی HandshakeDecisionEngine.
 */
export interface UIConfig {
  /** locale انتخاب‌شده — مثال: "fa-IR", "en-US" */
  readonly locale: string;
  /** جهت متن */
  readonly direction: 'ltr' | 'rtl';
  /** تم */
  readonly theme: 'light' | 'dark' | 'auto';
  /** متن قهرمان (hero) */
  readonly heroCopy: string;
  /** آیا رضایت لازم است */
  readonly consentRequired: boolean;
  /** اطلاعات اضافی CSS variables */
  readonly cssVariables?: Record<string, string>;
}

/**
 * نتیجه نهایی Context Handshake.
 */
export interface HandshakeResult {
  /** آیا موفق بود */
  readonly success: boolean;
  /** شناسه session */
  readonly sessionId: SessionId;
  /** پیکربندی UI */
  readonly uiConfig: UIConfig | null;
  /** رضایت اعطا شد (null = رد شد یا DNT) */
  readonly consentGranted: boolean | null;
  /** خطا در صورت شکست */
  readonly error?: AWAFError;
}

// ─── Handshake Decision ───────────────────────────────────────────────────────

/**
 * نتیجه تصمیم HandshakeDecisionEngine — خروجی فاز decide.
 * Result of HandshakeDecisionEngine.decide() — output of the decide phase.
 */
export interface HandshakeDecision {
  /** لایه UI انتخاب‌شده بر اساس قابلیت‌های مرورگر */
  readonly selectedLayer: CapabilityLayer;
  /** پیکربندی UI نهایی */
  readonly uiConfig: UIConfig;
  /** زمان تصمیم (ISO 8601) */
  readonly decidedAt: string;
}

// ─── Streaming Config ─────────────────────────────────────────────────────────

/**
 * پیکربندی SSE Streaming.
 */
export interface StreamingConfig {
  /** callback برای هر chunk متن */
  readonly onToken: (token: string) => void;
  /** callback برای پایان stream */
  readonly onComplete: (fullText: string) => void;
  /** callback برای خطا */
  readonly onError: (error: AWAFError) => void;
  /** timeout به میلی‌ثانیه */
  readonly timeoutMs?: number;
}
