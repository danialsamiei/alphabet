/**
 * @module handshake/enrichment-pipeline
 * @description
 * EnrichmentPipeline — غنی‌سازی سیگنال‌های passive با geo، referrer، و UTM.
 * Enriches passive signals with coarse geo (from timezone), referrer
 * categorization, and UTM parameter extraction to produce EnrichedContext.
 */

import type { CapabilityLayer } from '../types/base.js';
import type { DetectedSignals, GeoContext, VisitorContext, EnrichedContext } from '../types/visitor.js';
import type { VisitorId, SessionId } from '../types/brands.js';
import { createSessionId } from '../types/brands.js';
import { SignalCollector } from './signal-collector.js';

// ─── Timezone → Geo Mapping ───────────────────────────────────────────────────

/** نگاشت timezone IANA به موقعیت جغرافیایی coarse */
const TIMEZONE_GEO_MAP: Readonly<Record<string, { country: string; city: string; lat: number; lon: number }>> = {
  'Asia/Tehran': { country: 'IR', city: 'Tehran', lat: 35.69, lon: 51.39 },
  'Asia/Kabul': { country: 'AF', city: 'Kabul', lat: 34.53, lon: 69.17 },
  'Europe/Sofia': { country: 'BG', city: 'Sofia', lat: 42.70, lon: 23.32 },
  'Europe/London': { country: 'GB', city: 'London', lat: 51.51, lon: -0.13 },
  'Europe/Paris': { country: 'FR', city: 'Paris', lat: 48.85, lon: 2.35 },
  'Europe/Berlin': { country: 'DE', city: 'Berlin', lat: 52.52, lon: 13.40 },
  'Europe/Rome': { country: 'IT', city: 'Rome', lat: 41.90, lon: 12.50 },
  'Europe/Madrid': { country: 'ES', city: 'Madrid', lat: 40.42, lon: -3.70 },
  'Europe/Amsterdam': { country: 'NL', city: 'Amsterdam', lat: 52.37, lon: 4.90 },
  'Europe/Warsaw': { country: 'PL', city: 'Warsaw', lat: 52.23, lon: 21.01 },
  'Europe/Moscow': { country: 'RU', city: 'Moscow', lat: 55.75, lon: 37.62 },
  'Asia/Dubai': { country: 'AE', city: 'Dubai', lat: 25.20, lon: 55.27 },
  'Asia/Kolkata': { country: 'IN', city: 'Mumbai', lat: 19.08, lon: 72.88 },
  'Asia/Dhaka': { country: 'BD', city: 'Dhaka', lat: 23.72, lon: 90.41 },
  'Asia/Tokyo': { country: 'JP', city: 'Tokyo', lat: 35.68, lon: 139.69 },
  'Asia/Shanghai': { country: 'CN', city: 'Shanghai', lat: 31.23, lon: 121.47 },
  'Asia/Seoul': { country: 'KR', city: 'Seoul', lat: 37.57, lon: 126.98 },
  'Asia/Singapore': { country: 'SG', city: 'Singapore', lat: 1.35, lon: 103.82 },
  'Australia/Sydney': { country: 'AU', city: 'Sydney', lat: -33.87, lon: 151.21 },
  'America/New_York': { country: 'US', city: 'New York', lat: 40.71, lon: -74.01 },
  'America/Los_Angeles': { country: 'US', city: 'Los Angeles', lat: 34.05, lon: -118.24 },
  'America/Chicago': { country: 'US', city: 'Chicago', lat: 41.88, lon: -87.63 },
  'America/Toronto': { country: 'CA', city: 'Toronto', lat: 43.65, lon: -79.38 },
  'America/Sao_Paulo': { country: 'BR', city: 'São Paulo', lat: -23.55, lon: -46.63 },
  'America/Mexico_City': { country: 'MX', city: 'Mexico City', lat: 19.43, lon: -99.13 },
  'Africa/Cairo': { country: 'EG', city: 'Cairo', lat: 30.06, lon: 31.25 },
  'Africa/Johannesburg': { country: 'ZA', city: 'Johannesburg', lat: -26.20, lon: 28.04 },
  'UTC': { country: 'XX', city: 'Unknown', lat: 0.00, lon: 0.00 },
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

// ─── EnrichmentPipeline Class ─────────────────────────────────────────────────

/**
 * غنی‌سازی سیگنال‌های passive با geo، referrer، و UTM.
 * Enriches passive signals with coarse geo (from timezone), referrer
 * categorization, and UTM extraction.
 *
 * @example
 * const pipeline = new EnrichmentPipeline();
 * const enriched = pipeline.enrich(signals, {
 *   visitorId: 'anon-abc' as VisitorId,
 *   sessionId: createSessionId(),
 * });
 * console.log(enriched.visitor.geo.country); // "IR"
 * console.log(enriched.referrerCategory);    // "search"
 */
export class EnrichmentPipeline {
  /**
   * غنی‌سازی سیگنال‌های passive با اطلاعات اضافی.
   * Enriches passive signals with geo, referrer, and UTM information.
   *
   * @param signals - DetectedSignals از SignalCollector.collect()
   * @param options - شناسه‌های visitor و session (اختیاری)
   * @returns EnrichedContext
   *
   * @example
   * const enriched = pipeline.enrich(signals);
   * console.log(enriched.visitor.geo.country); // "US"
   */
  enrich(
    signals: DetectedSignals,
    options?: { readonly sessionId?: SessionId; readonly visitorId?: VisitorId }
  ): EnrichedContext {
    const geo = this.deriveGeo(signals.timezone);
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

  private deriveGeo(timezone: string): GeoContext {
    const entry = TIMEZONE_GEO_MAP[timezone];
    if (entry !== undefined) {
      return {
        country: entry.country,
        city: entry.city,
        timezone,
        coarseLatitude: entry.lat,
        coarseLongitude: entry.lon,
      };
    }

    // fallback: حدس از پیشوند timezone
    const prefix = timezone.split('/')[0] ?? '';
    const fallback = this.fallbackGeoFromPrefix(prefix, timezone);
    return fallback;
  }

  private fallbackGeoFromPrefix(prefix: string, timezone: string): GeoContext {
    const mapping: Record<string, { country: string; city: string }> = {
      Europe: { country: 'EU', city: 'Unknown' },
      America: { country: 'US', city: 'Unknown' },
      Asia: { country: 'AS', city: 'Unknown' },
      Africa: { country: 'AF', city: 'Unknown' },
      Australia: { country: 'AU', city: 'Unknown' },
      Pacific: { country: 'PF', city: 'Unknown' },
    };
    const entry = mapping[prefix];
    return {
      country: entry?.country ?? 'XX',
      city: entry?.city ?? 'Unknown',
      timezone,
      coarseLatitude: 0,
      coarseLongitude: 0,
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
    const id = `anon-${crypto.randomUUID()}`;
    return id as VisitorId;
  }
}
