/**
 * @module base
 * @description
 * Enumها، type aliasها، و typeهای پایه AWAF SDK.
 * Base enums, type aliases, and foundational types for AWAF SDK.
 */

// ─── Consent Tier ─────────────────────────────────────────────────────────────

/**
 * نردبان Consent — ۴ سطح حافظه و شخصی‌سازی.
 *
 * - NO_MEMORY: هیچ داده‌ای ذخیره نمی‌شود (Tier 0)
 * - ANONYMOUS: session-only، بدون ID کاربر (Tier 1)
 * - CONSENTED: cross-session با رضایت صریح (Tier 2)
 * - ENRICHED: vector embedding و یادگیری رفتاری (Tier 3)
 */
export type ConsentTier = 'NO_MEMORY' | 'ANONYMOUS' | 'CONSENTED' | 'ENRICHED';

/** مقادیر عددی هر Tier برای مقایسه */
export const CONSENT_TIER_LEVEL: Record<ConsentTier, number> = {
  NO_MEMORY: 0,
  ANONYMOUS: 1,
  CONSENTED: 2,
  ENRICHED: 3,
} as const;

// ─── Trust Tier ───────────────────────────────────────────────────────────────

/**
 * سطح اعتماد منابع در Technology Pulse.
 *
 * - T1: منابع peer-reviewed / نهادی (arXiv, Nature, IEEE)
 * - T2: روزنامه‌نگاری معتبر (MIT TR, Wired, TechCrunch)
 * - T3: شبکه اجتماعی / aggregation (Twitter, Reddit)
 */
export type TrustTier = 'T1' | 'T2' | 'T3';

/** ضریب اعتماد پایه برای هر Tier */
export const TRUST_TIER_COEFFICIENT: Record<TrustTier, number> = {
  T1: 0.95,
  T2: 0.75,
  T3: 0.40,
} as const;

// ─── Memory Domain ────────────────────────────────────────────────────────────

/**
 * دامنه‌های حافظه در Memory Mesh — ۷ دامنه معنایی با isolation مستقل.
 */
export type MemoryDomain =
  | 'general'
  | 'site_specific'
  | 'visitor'
  | 'class_notes'
  | 'ideas'
  | 'social'
  | 'tech_pulse';

// ─── Intent Type ──────────────────────────────────────────────────────────────

/**
 * نوع نیت بازدیدکننده — ۶ دسته اصلی.
 *
 * - technology: علاقه به فناوری و نوآوری
 * - collaboration: تمایل به همکاری یا استخدام
 * - class_notes: دسترسی به محتوای آموزشی
 * - philosophy: کاوش فلسفی و فکری
 * - personal: ارتباط شخصی با صاحب سایت
 * - explore: کاوش بی‌هدف
 *
 * @deprecated Use `DomainIntent` from `@awaf/core` (re-exported from
 * `./contracts/intents.js`) for high-level visitor purpose and
 * `SuggestionActionIntent` for UI/action chip intents. `IntentType`
 * historically conflated the two; it is kept as a structural alias for
 * `DomainIntent` to avoid breaking existing imports and will be removed
 * in a future major release.
 */
export type IntentType =
  | 'technology'
  | 'collaboration'
  | 'class_notes'
  | 'philosophy'
  | 'personal'
  | 'explore';

// ─── UI Layer ─────────────────────────────────────────────────────────────────

/**
 * لایه‌های UI Degradation — ۵ لایه از immersive تا text-only.
 *
 * - R3F_IMMERSIVE: React Three Fiber + WebGL 2.0 (Layer 1)
 * - CSS_3D: CSS transforms + perspective (Layer 2)
 * - CANVAS_2D: Canvas 2D particle systems (Layer 3)
 * - STATIC_HTML: Semantic HTML + CSS Grid (Layer 4)
 * - TEXT_ONLY: ARIA landmarks + screen reader (Layer 5)
 */
export type CapabilityLayer =
  | 'R3F_IMMERSIVE'
  | 'CSS_3D'
  | 'CANVAS_2D'
  | 'STATIC_HTML'
  | 'TEXT_ONLY';

/** ترتیب عددی هر Layer برای مقایسه (کمتر = بهتر) */
export const CAPABILITY_LAYER_LEVEL: Record<CapabilityLayer, number> = {
  R3F_IMMERSIVE: 1,
  CSS_3D: 2,
  CANVAS_2D: 3,
  STATIC_HTML: 4,
  TEXT_ONLY: 5,
} as const;

// ─── Protocol Type ────────────────────────────────────────────────────────────

/**
 * پروتکل‌های ارتباطی AWAF — ۴ پروتکل استاندارد.
 */
export type ProtocolType = 'MCP' | 'A2A' | 'QR' | 'API';

// ─── Token Tier ───────────────────────────────────────────────────────────────

/**
 * سطح بودجه توکن برای LLM interactions.
 */
export type TokenTier = 'ANONYMOUS' | 'CONSENTED' | 'ADMIN';

/** حداکثر توکن هر tier در هر session */
export const TOKEN_TIER_LIMITS: Record<TokenTier, number> = {
  ANONYMOUS: 500,
  CONSENTED: 2000,
  ADMIN: 10000,
} as const;

// ─── Consent Purpose ─────────────────────────────────────────────────────────

/**
 * اهداف مجاز رضایت — کاربر برای هر هدف رضایت جداگانه می‌دهد.
 */
export type ConsentPurpose = 'personalization' | 'behavioral_learning' | 'notification';

// ─── Log Level ────────────────────────────────────────────────────────────────

/**
 * سطوح logging در AWAFLogger.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** ترتیب عددی سطوح log */
export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

// ─── Device Class ─────────────────────────────────────────────────────────────

/**
 * دسته‌بندی دستگاه بازدیدکننده.
 */
export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';

// ─── Handshake State ──────────────────────────────────────────────────────────

/**
 * وضعیت‌های ماشین حالت Context Handshake.
 */
export type HandshakeState =
  | 'idle'
  | 'detect'
  | 'enrich'
  | 'decide'
  | 'display'
  | 'consent'
  | 'morph'
  | 'runtime'
  | 'error';
