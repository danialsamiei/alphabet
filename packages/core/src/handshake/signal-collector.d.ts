/**
 * @module handshake/signal-collector
 * @description
 * SignalCollector — جمع‌آوری سیگنال‌های passive مرورگر بدون PII.
 * Collects passive browser signals: language, timezone, device class,
 * WebGL support, DNT/GPC, network type, reduced-motion, and referrer.
 */
import type { CapabilityLayer } from '../types/base.js';
import type { DetectedSignals } from '../types/visitor.js';
import { type AWAFError, type Result } from '../types/result.js';
/**
 * گزینه‌های SignalCollector — برای تزریق وابستگی در تست‌ها.
 * Options for SignalCollector — allows dependency injection for testing.
 */
export interface SignalCollectorOptions {
    /** override برای navigator (پیش‌فرض: globalThis.navigator) */
    readonly navigator?: Partial<Navigator> & {
        globalPrivacyControl?: boolean;
    };
    /** override برای screen (پیش‌فرض: globalThis.screen) */
    readonly screen?: Partial<Screen>;
    /** override برای document (پیش‌فرض: globalThis.document) */
    readonly document?: Partial<Document>;
    /** override برای window.devicePixelRatio (پیش‌فرض: globalThis.devicePixelRatio) */
    readonly devicePixelRatio?: number;
    /** override برای window.matchMedia */
    readonly matchMedia?: (query: string) => {
        readonly matches: boolean;
    };
    /** override برای canvas factory (برای تست WebGL) */
    readonly createCanvas?: () => HTMLCanvasElement | null;
}
/**
 * جمع‌آوری سیگنال‌های passive مرورگر — هیچ PII ذخیره نمی‌شود.
 * Collects passive browser signals — no PII is collected or stored.
 *
 * @example
 * const collector = new SignalCollector();
 * const result = collector.collect();
 * if (result.success) {
 *   console.log(result.data.language);  // "fa"
 *   console.log(result.data.deviceClass); // "desktop"
 * }
 */
export declare class SignalCollector {
    private readonly opts;
    constructor(options?: SignalCollectorOptions);
    /**
     * جمع‌آوری تمام سیگنال‌های passive مرورگر.
     * Collects all passive browser signals.
     *
     * @returns Result<DetectedSignals, AWAFError>
     *
     * @example
     * const result = new SignalCollector().collect();
     * if (result.success) {
     *   const { language, timezone, deviceClass } = result.data;
     * }
     */
    collect(): Result<DetectedSignals, AWAFError>;
    /**
     * تشخیص لایه UI مناسب بر اساس قابلیت‌های مرورگر.
     * Detects the appropriate UI layer based on browser capabilities.
     *
     * @param signals - DetectedSignals از collect()
     * @returns CapabilityLayer
     */
    static detectLayer(signals: DetectedSignals): CapabilityLayer;
    private readLanguage;
    private readTimezone;
    private readPlatform;
    private readScreenWidth;
    private readScreenHeight;
    private readDevicePixelRatio;
    private detectWebGL;
    private readDNT;
    private readGPC;
    private readNetworkType;
    private readPrefersReducedMotion;
    private readReferrer;
    private deriveDeviceClass;
}
//# sourceMappingURL=signal-collector.d.ts.map