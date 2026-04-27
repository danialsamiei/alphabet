/**
 * @module handshake/enrichment-pipeline
 * @description
 * EnrichmentPipeline — غنی‌سازی سیگنال‌های passive با geo، referrer، و UTM.
 * Enriches passive signals with **coarse geo (country/timezone/region only
 * by default)**, referrer categorization, and UTM parameter extraction to
 * produce EnrichedContext.
 *
 * **Privacy contract:** the default output of `enrich()` deliberately omits
 * `city`, `coarseLatitude`, and `coarseLongitude`. Those fields are only
 * populated when the caller passes `{ allowPreciseGeo: true }`, which itself
 * must only be set after `canUsePreciseGeo(consentTier, privacySignals)`
 * returns true (i.e. consent tier is ENRICHED and no DNT/GPC signal is set).
 */

import type { CapabilityLayer } from '../types/base.js';
import type { DetectedSignals, GeoContext, VisitorContext, EnrichedContext } from '../types/visitor.js';
import type { VisitorId, SessionId } from '../types/brands.js';
import { createSessionId } from '../types/brands.js';
import { SignalCollector } from './signal-collector.js';

// ─── Timezone → Geo Mapping ───────────────────────────────────────────────────

interface TimezoneGeoEntry {
  readonly country: string;
  readonly region: string;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
}

/** نگاشت timezone IANA به موقعیت جغرافیایی coarse */
const TIMEZONE_GEO_MAP: Readonly<Record<string, TimezoneGeoEntry>> = {
  'Asia/Tehran': { country: 'IR', region: 'Asia', city: 'Tehran', lat: 35.69, lon: 51.39 },
  'Asia/Kabul': { country: 'AF', region: 'Asia', city: 'Kabul', lat: 34.53, lon: 69.17 },
  'Europe/Sofia': { country: 'BG', region: 'Europe', city: 'Sofia', lat: 42.70, lon: 23.32 },
  'Europe/London': { country: 'GB', region: 'Europe', city: 'London', lat: 51.51, lon: -0.13 },
  'Europe/Paris': { country: 'FR', region: 'Europe', city: 'Paris', lat: 48.85, lon: 2.35 },
  'Europe/Berlin': { country: 'DE', region: 'Europe', city: 'Berlin', lat: 52.52, lon: 13.40 },
  'Europe/Rome': { country: 'IT', region: 'Europe', city: 'Rome', lat: 41.90, lon: 12.50 },
  'Europe/Madrid': { country: 'ES', region: 'Europe', city: 'Madrid', lat: 40.42, lon: -3.70 },
  'Europe/Amsterdam': { country: 'NL', region: 'Europe', city: 'Amsterdam', lat: 52.37, lon: 4.90 },
  'Europe/Warsaw': { country: 'PL', region: 'Europe', city: 'Warsaw', lat: 52.23, lon: 21.01 },
  'Europe/Moscow': { country: 'RU', region: 'Europe', city: 'Moscow', lat: 55.75, lon: 37.62 },
  'Asia/Dubai': { country: 'AE', region: 'Asia', city: 'Dubai', lat: 25.20, lon: 55.27 },
  'Asia/Kolkata': { country: 'IN', region: 'Asia', city: 'Mumbai', lat: 19.08, lon: 72.88 },
  'Asia/Dhaka': { country: 'BD', region: 'Asia', city: 'Dhaka', lat: 23.72, lon: 90.41 },
  'Asia/Tokyo': { country: 'JP', region: 'Asia', city: 'Tokyo', lat: 35.68, lon: 139.69 },
  'Asia/Shanghai': { country: 'CN', region: 'Asia', city: 'Shanghai', lat: 31.23, lon: 121.47 },
  'Asia/Seoul': { country: 'KR', region: 'Asia', city: 'Seoul', lat: 37.57, lon: 126.98 },
  'Asia/Singapore': { country: 'SG', region: 'Asia', city: 'Singapore', lat: 1.35, lon: 103.82 },
  'Australia/Sydney': { country: 'AU', region: 'Oceania', city: 'Sydney', lat: -33.87, lon: 151.21 },
  'America/New_York': { country: 'US', region: 'Americas', city: 'New York', lat: 40.71, lon: -74.01 },
  'America/Los_Angeles': { country: 'US', region: 'Americas', city: 'Los Angeles', lat: 34.05, lon: -118.24 },
  'America/Chicago': { country: 'US', region: 'Americas', city: 'Chicago', lat: 41.88, lon: -87.63 },
  'America/Toronto': { country: 'CA', region: 'Americas', city: 'Toronto', lat: 43.65, lon: -79.38 },
  'America/Sao_Paulo': { country: 'BR', region: 'Americas', city: 'São Paulo', lat: -23.55, lon: -46.63 },
  'America/Mexico_City': { country: 'MX', region: 'Americas', city: 'Mexico City', lat: 19.43, lon: -99.13 },
  'Africa/Cairo': { country: 'EG', region: 'Africa', city: 'Cairo', lat: 30.06, lon: 31.25 },
  'Africa/Johannesburg': { country: 'ZA', region: 'Africa', city: 'Johannesburg', lat: -26.20, lon: 28.04 },
  'UTC': { country: 'XX', region: 'Global', city: 'Unknown', lat: 0.00, lon: 0.00 },
} as const;

/** کشورهای اتحادیه اروپا که نیاز به رضایت GDPR دارند */
const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB',
]);

// ─── Referrer Patterns ────────────────────────────────────────────────────────

const SEARCH_ENGINE_PATTERNS = [
  'google.', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'yandex.', 'baidu.com', 'naver.com', 'ask.com',
];
const SOCIAL_PATTERNS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'linkedin.com', 't.me', 'telegram.org', 'reddit.com',
  'tiktok.com', 'youtube.com',
];

// ─── EnrichmentPipeline Options ───────────────────────────────────────────────

/**
 * گزینه‌های فراخوانی `EnrichmentPipeline.enrich()`.
 * Options for `EnrichmentPipeline.enrich()`.
 */
export interface EnrichOptions {
  /** شناسه session — اگر داده نشود، یکی ساخته می‌شود */
  readonly sessionId?: SessionId;
  /** شناسه visitor — اگر داده نشود، یک anonymous id ساخته می‌شود */
  readonly visitorId?: VisitorId;
  /**
   * فعال‌سازی صریح precise geo (city + coarse lat/lon).
   * Explicitly enable precise geo enrichment (city + coarse lat/lon).
   *
   * **Default: `false`.** Callers must only set this to `true` after
   * verifying with `canUsePreciseGeo(consentTier, privacySignals)` that
   * the visitor has granted explicit consent and no DNT/GPC signal is
   * active. Without this flag, geo output contains only `country`,
   * `timezone`, and `region`.
   */
  readonly allowPreciseGeo?: boolean;
}

// ─── EnrichmentPipeline Class ─────────────────────────────────────────────────

/**
 * غنی‌سازی سیگنال‌های passive با geo، referrer، و UTM.
 * Enriches passive signals with coarse geo, referrer categorization, and
 * UTM extraction.
 *
 * @example
 * // Default Tier 0 / anonymous mode — country/timezone/region only.
 * const enriched = new EnrichmentPipeline().enrich(signals);
 * console.log(enriched.visitor.geo.country);    // "IR"
 * console.log(enriched.visitor.geo.region);     // "Asia"
 * console.log(enriched.visitor.geo.city);       // undefined
 *
 * @example
 * // Precise geo — only after explicit consent + no DNT/GPC.
 * const enriched = pipeline.enrich(signals, { allowPreciseGeo: true });
 * console.log(enriched.visitor.geo.city);       // "Tehran"
 */
export class EnrichmentPipeline {
  /**
   * غنی‌سازی سیگنال‌های passive با اطلاعات اضافی.
   * Enriches passive signals with geo, referrer, and UTM information.
   *
   * @param signals - DetectedSignals از SignalCollector.collect()
   * @param options - گزینه‌های اختیاری شامل visitorId/sessionId/allowPreciseGeo
   * @returns EnrichedContext
   */
  enrich(signals: DetectedSignals, options?: EnrichOptions): EnrichedContext {
    const allowPreciseGeo = options?.allowPreciseGeo === true;
    const geo = this.deriveGeo(signals.timezone, allowPreciseGeo);
    const layer: CapabilityLayer = SignalCollector.detectLayer(signals);
    const sessionId: SessionId = options?.sessionId ?? createSessionId();
    const visitorId: VisitorId = options?.visitorId ?? this.generateAnonymousId();

    const visitor: VisitorContext = {
      visitorId,
      sessionId,
      geo,
      signals,
      layer,
      detectedAt: new Date().toISOString(),
    };

    const referrerCategory = this.categorizeReferrer(signals.referrer);
    const utmParams = this.extractUTM();

    const enriched: EnrichedContext = {
      visitor,
      enrichedAt: new Date().toISOString(),
      ...(referrerCategory !== undefined ? { referrerCategory } : {}),
      ...(utmParams.campaign !== undefined ? { utmCampaign: utmParams.campaign } : {}),
      ...(utmParams.source !== undefined ? { utmSource: utmParams.source } : {}),
    };

    return enriched;
  }

  /**
   * بررسی اینکه آیا کشور داده‌شده نیاز به رضایت GDPR دارد.
   * Checks whether the given country requires GDPR consent.
   *
   * @param country - کد ISO 3166-1 alpha-2 کشور
   * @returns true اگر کشور در محدوده GDPR/اتحادیه اروپا است
   */
  static requiresGDPRConsent(country: string): boolean {
    return EU_COUNTRIES.has(country.toUpperCase());
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private deriveGeo(timezone: string, allowPreciseGeo: boolean): GeoContext {
    const entry = TIMEZONE_GEO_MAP[timezone];
    if (entry !== undefined) {
      const base: GeoContext = {
        country: entry.country,
        timezone,
        region: entry.region,
      };
      if (!allowPreciseGeo) return base;
      return {
        ...base,
        city: entry.city,
        coarseLatitude: entry.lat,
        coarseLongitude: entry.lon,
      };
    }

    // fallback: حدس از پیشوند timezone
    const prefix = timezone.split('/')[0] ?? '';
    return this.fallbackGeoFromPrefix(prefix, timezone);
  }

  private fallbackGeoFromPrefix(prefix: string, timezone: string): GeoContext {
    const mapping: Record<string, { country: string; region: string }> = {
      Europe: { country: 'EU', region: 'Europe' },
      America: { country: 'US', region: 'Americas' },
      Asia: { country: 'AS', region: 'Asia' },
      Africa: { country: 'AF', region: 'Africa' },
      Australia: { country: 'AU', region: 'Oceania' },
      Pacific: { country: 'PF', region: 'Oceania' },
    };
    const entry = mapping[prefix];
    return {
      country: entry?.country ?? 'XX',
      timezone,
      region: entry?.region ?? 'Global',
    };
  }

  private categorizeReferrer(
    referrer: string
  ): EnrichedContext['referrerCategory'] {
    if (!referrer || referrer === '') return 'direct';

    try {
      const url = new URL(referrer);
      const host = url.hostname.toLowerCase();

      // بررسی موتورهای جستجو
      if (SEARCH_ENGINE_PATTERNS.some((p) => host.includes(p))) return 'search';
      // بررسی شبکه‌های اجتماعی
      if (SOCIAL_PATTERNS.some((p) => host.includes(p))) return 'social';
      // بررسی UTM medium برای email و paid
      const medium = url.searchParams.get('utm_medium')?.toLowerCase();
      if (medium === 'email') return 'email';
      if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') return 'paid';

      return 'other';
    } catch {
      return 'direct';
    }
  }

  private extractUTM(): { campaign?: string; source?: string } {
    try {
      if (typeof location === 'undefined') return {};
      const params = new URLSearchParams(location.search);
      const result: { campaign?: string; source?: string } = {};
      const campaign = params.get('utm_campaign');
      const source = params.get('utm_source');
      if (campaign !== null) result.campaign = campaign;
      if (source !== null) result.source = source;
      return result;
    } catch {
      return {};
    }
  }

  private generateAnonymousId(): VisitorId {
    // crypto.randomUUID() ایمن است اما در non-HTTPS نیاز به fallback دارد
    let uuid: string;
    try {
      uuid = crypto.randomUUID();
    } catch {
      // fallback برای non-secure contexts — با Uint8Array و hex encoding
      const bytes = new Uint8Array(16);
      const rng = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? (b: Uint8Array) => crypto.getRandomValues(b)
        : (b: Uint8Array) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); };
      rng(bytes);
      uuid = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    const id = `anon-${uuid}`;
    return id as VisitorId;
  }
}
