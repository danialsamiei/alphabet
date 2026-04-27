/**
 * @module visitor
 * @description
 * مدل‌های داده مربوط به بازدیدکننده در AWAF SDK.
 * Visitor-related data models: VisitorContext, VisitorConsent, VisitorPreference, DetectedSignals.
 */
import type { ConsentTier, ConsentPurpose, MemoryDomain, DeviceClass, CapabilityLayer } from './base.js';
import type { VisitorId, SessionId } from './brands.js';
/**
 * سیگنال‌های passive مرورگر — بدون PII و بدون نیاز به رضایت.
 * Passive browser signals — no PII, no consent required.
 */
export interface DetectedSignals {
    /** زبان اصلی مرورگر (از Accept-Language) — مثال: "fa", "en", "bg" */
    readonly language: string;
    /** منطقه زمانی IANA — مثال: "Asia/Tehran" */
    readonly timezone: string;
    /** دستگاه بازدیدکننده */
    readonly deviceClass: DeviceClass;
    /** platform مرورگر — مثال: "Win32", "Linux x86_64" */
    readonly platform: string;
    /** عرض viewport */
    readonly screenWidth: number;
    /** ارتفاع viewport */
    readonly screenHeight: number;
    /** نسبت pixel density */
    readonly devicePixelRatio: number;
    /** آیا WebGL پشتیبانی می‌شود */
    readonly webglSupported: boolean;
    /** آیا DNT (Do Not Track) فعال است */
    readonly dntEnabled: boolean;
    /** آیا GPC (Global Privacy Control) فعال است */
    readonly gpcEnabled: boolean;
    /** نوع شبکه (از Network Information API) */
    readonly networkType?: string;
    /** آیا کاربر prefers-reduced-motion دارد */
    readonly prefersReducedMotion: boolean;
    /** referrer URL فعلی */
    readonly referrer: string;
}
/**
 * موقعیت جغرافیایی coarse — فقط سطح کشور/شهر، بدون IP.
 * Coarse geographic context — country/city level only, no IP stored.
 */
export interface GeoContext {
    /** کد ISO 3166-1 alpha-2 کشور — مثال: "IR", "BG", "US" */
    readonly country: string;
    /** نام شهر (coarse) */
    readonly city: string;
    /** منطقه زمانی IANA */
    readonly timezone: string;
    /** عرض جغرافیایی coarse (rounded to 2 decimals) */
    readonly coarseLatitude: number;
    /** طول جغرافیایی coarse (rounded to 2 decimals) */
    readonly coarseLongitude: number;
}
/**
 * زمینه کامل بازدیدکننده — خروجی مرحله تشخیص (detect phase).
 * Full visitor context — output of the detect phase.
 *
 * @example
 * const ctx: VisitorContext = {
 *   visitorId: createVisitorId('v-abc12345').data!,
 *   sessionId: createSessionId(),
 *   geo: { country: 'IR', city: 'Tehran', timezone: 'Asia/Tehran', ... },
 *   signals: { language: 'fa', deviceClass: 'desktop', ... },
 *   detectedAt: new Date().toISOString(),
 * };
 */
export interface VisitorContext {
    /** شناسه anonymous بازدیدکننده (rotating) */
    readonly visitorId: VisitorId;
    /** شناسه session — ephemeral */
    readonly sessionId: SessionId;
    /** موقعیت جغرافیایی coarse */
    readonly geo: GeoContext;
    /** سیگنال‌های passive مرورگر */
    readonly signals: DetectedSignals;
    /** لایه UI انتخاب‌شده */
    readonly layer: CapabilityLayer;
    /** زمان تشخیص (ISO 8601) */
    readonly detectedAt: string;
}
/**
 * ماشین حالت رضایت بازدیدکننده.
 * Visitor consent state machine: pending → granted → revoked.
 */
export interface VisitorConsent {
    /** شناسه بازدیدکننده */
    readonly visitorId: VisitorId;
    /** سطح رضایت فعلی */
    readonly consentTier: ConsentTier;
    /** وضعیت ماشین حالت */
    readonly state: 'pending' | 'granted' | 'revoked';
    /** زمان اعطای رضایت (ISO 8601) */
    readonly grantedAt?: string;
    /** اهداف مجاز */
    readonly purposes: ConsentPurpose[];
    /** زمان انقضای رضایت (ISO 8601) */
    readonly expiresAt?: string;
    /** زمان revoke رضایت (ISO 8601) */
    readonly revokedAt?: string;
}
/**
 * ترجیحات صریح (explicit) بازدیدکننده — نیاز به ConsentTier >= CONSENTED.
 * Explicit visitor preferences — requires ConsentTier >= CONSENTED.
 */
export interface VisitorPreference {
    /** شناسه بازدیدکننده */
    readonly visitorId: VisitorId;
    /** زبان ترجیحی — مثال: "fa", "en", "bg" */
    readonly language: string;
    /** موضوعات مورد علاقه */
    readonly topics: string[];
    /** عمق محتوا */
    readonly contentDepth: 'overview' | 'deep' | 'expert';
    /** ترجیح اعلان */
    readonly notificationPrefs: 'none' | 'session' | 'persistent';
    /** تم رابط کاربری */
    readonly theme: 'auto' | 'light' | 'dark';
}
/**
 * زمینه غنی‌شده پس از enrich phase — ترکیب سیگنال‌های passive با geo و referrer.
 * Enriched context after the enrich phase.
 */
export interface EnrichedContext {
    /** زمینه اولیه بازدیدکننده */
    readonly visitor: VisitorContext;
    /** دسته‌بندی referrer */
    readonly referrerCategory?: 'direct' | 'search' | 'social' | 'email' | 'paid' | 'other';
    /** UTM campaign */
    readonly utmCampaign?: string;
    /** UTM source */
    readonly utmSource?: string;
    /** زمان غنی‌سازی (ISO 8601) */
    readonly enrichedAt: string;
}
/**
 * یک رکورد حافظه در Memory Mesh.
 * A memory record in the Memory Mesh.
 */
export interface VisitorMemory {
    /** شناسه حافظه */
    readonly memoryId: string;
    /** شناسه بازدیدکننده */
    readonly visitorId: VisitorId;
    /** دامنه حافظه */
    readonly domain: MemoryDomain;
    /** محتوای حافظه */
    readonly content: string;
    /** vector embedding (768 بُعدی) */
    readonly vectorEmbedding?: number[];
    /** حداقل Tier رضایت لازم */
    readonly consentTierRequired: ConsentTier;
    /** برچسب حریم خصوصی */
    readonly privacyLabel: 'correlation_allowed' | 'isolated' | 'governance_required';
    /** زمان ایجاد (ISO 8601) */
    readonly createdAt: string;
    /** زمان آخرین تغییر (ISO 8601) */
    readonly updatedAt: string;
    /** زمان انقضا (ISO 8601) */
    readonly expiresAt?: string;
}
//# sourceMappingURL=visitor.d.ts.map