/**
 * @module handshake/enrichment-pipeline
 * @description
 * EnrichmentPipeline — غنی‌سازی سیگنال‌های passive با geo، referrer، و UTM.
 * Enriches passive signals with coarse geo (from timezone), referrer
 * categorization, and UTM parameter extraction to produce EnrichedContext.
 */
import type { DetectedSignals, EnrichedContext } from '../types/visitor.js';
import type { VisitorId, SessionId } from '../types/brands.js';
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
export declare class EnrichmentPipeline {
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
    enrich(signals: DetectedSignals, options?: {
        readonly sessionId?: SessionId;
        readonly visitorId?: VisitorId;
    }): EnrichedContext;
    /**
     * بررسی اینکه آیا کشور داده‌شده نیاز به رضایت GDPR دارد.
     * Checks whether the given country requires GDPR consent.
     *
     * @param country - کد ISO 3166-1 alpha-2 کشور
     * @returns true اگر کشور در محدوده GDPR/اتحادیه اروپا است
     */
    static requiresGDPRConsent(country: string): boolean;
    private deriveGeo;
    private fallbackGeoFromPrefix;
    private categorizeReferrer;
    private extractUTM;
    private generateAnonymousId;
}
//# sourceMappingURL=enrichment-pipeline.d.ts.map