/**
 * @module memory
 * @description
 * مدل‌های داده مربوط به Technology Pulse، Suggestion، و Intent Session.
 * Data models for Technology Pulse signals, suggestions, and intent sessions.
 */
import type { TrustTier, IntentType } from './base.js';
import type { VisitorId, SessionId } from './brands.js';
/**
 * لینک provenance — یک گره در زنجیره منشأ محتوا (C2PA-style).
 * A node in the content provenance chain (C2PA-style).
 */
export interface ProvenanceLink {
    /** منبع اصلی */
    readonly source: string;
    /** URL یا DOI */
    readonly url: string;
    /** عنوان مقاله/خبر */
    readonly title: string;
    /** سطح اعتماد منبع */
    readonly trustTier: TrustTier;
    /** زمان انتشار (ISO 8601) */
    readonly publishedAt: string;
    /** hash SHA-256 محتوای اصلی */
    readonly contentHash: string;
}
/**
 * سیگنال Technology Pulse — یک رویداد فناوری تأیید‌شده با provenance chain.
 * A verified technology signal with provenance chain.
 *
 * @example
 * const signal: TechnologySignal = {
 *   id: crypto.randomUUID(),
 *   source: 'arXiv',
 *   title: 'Attention Is All You Need',
 *   category: 'AI',
 *   trustTier: 'T1',
 *   provenanceChain: [...],
 *   rawText: '...',
 *   url: 'https://arxiv.org/abs/1706.03762',
 *   publishedAt: '2017-06-12T00:00:00Z',
 *   ingestedAt: new Date().toISOString(),
 * };
 */
export interface TechnologySignal {
    /** شناسه یکتا */
    readonly id: string;
    /** منبع — مثال: "arXiv", "Nature", "Reuters" */
    readonly source: string;
    /** عنوان */
    readonly title: string;
    /** دسته‌بندی — مثال: "AI", "biotech", "energy" */
    readonly category: string;
    /** سطح اعتماد منبع */
    readonly trustTier: TrustTier;
    /** زنجیره provenance */
    readonly provenanceChain: ProvenanceLink[];
    /** متن خام */
    readonly rawText: string;
    /** URL منبع */
    readonly url: string;
    /** زمان انتشار (ISO 8601) */
    readonly publishedAt: string;
    /** زمان ingestion (ISO 8601) */
    readonly ingestedAt: string;
}
/**
 * یک گزینه پیشنهادی پویا برای floating chips.
 * A dynamic suggestion option for floating intent chips.
 */
export interface SuggestionOption {
    /** شناسه یکتا */
    readonly id: string;
    /** برچسب نمایشی */
    readonly label: string;
    /** نوع intent */
    readonly intentType: IntentType;
    /** اطمینان پیشنهاد (0.0–1.0) */
    readonly confidence: number;
    /** آیکون (emoji یا نام آیکون) */
    readonly icon?: string;
    /** نوع اقدام */
    readonly action: 'navigate' | 'interact' | 'consent_prompt';
    /** آیا به رضایت نیاز دارد */
    readonly requiresConsent: boolean;
}
/**
 * یک session با intent مشخص — برای ردیابی رفتار کاربر.
 * An intent-based session for tracking visitor behavior.
 */
export interface IntentSession {
    /** شناسه session intent */
    readonly intentId: string;
    /** شناسه بازدیدکننده */
    readonly visitorId: VisitorId;
    /** شناسه session */
    readonly sessionId: SessionId;
    /** نوع intent */
    readonly intentType: IntentType;
    /** اطمینان intent (0.0–1.0) */
    readonly confidence: number;
    /** زمان شروع (ISO 8601) */
    readonly startedAt: string;
    /** زمان پایان (ISO 8601) */
    readonly endedAt?: string;
    /** صفحات بازدیدشده */
    readonly pagesVisited: string[];
    /** تعداد تعاملات */
    readonly interactions: number;
}
//# sourceMappingURL=memory.d.ts.map