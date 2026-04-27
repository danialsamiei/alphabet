/**
 * @module config
 * @description
 * کلاس AWAFConfig — مدیریت پیکربندی SDK از environment variables و defaults.
 * AWAFConfig class — manages SDK configuration from environment variables and defaults.
 */
import type { ConsentTier, LogLevel, CapabilityLayer, TokenTier } from '../types/base.js';
import { type AWAFError, type Result } from '../types/result.js';
/**
 * پیکربندی کامل AWAF SDK.
 */
export interface AWAFConfigOptions {
    /** آدرس پایه API — مثال: "http://localhost:3000/api" */
    readonly apiBaseUrl: string;
    /** timeout درخواست‌ها (میلی‌ثانیه) — پیش‌فرض: 5000 */
    readonly timeoutMs: number;
    /** حداکثر تعداد retry — پیش‌فرض: 3 */
    readonly maxRetries: number;
    /** سطح پیش‌فرض consent — پیش‌فرض: "NO_MEMORY" */
    readonly defaultConsentTier: ConsentTier;
    /** سطح logging — پیش‌فرض: "info" */
    readonly logLevel: LogLevel;
    /** آیا telemetry فعال است — پیش‌فرض: false */
    readonly enableTelemetry: boolean;
    /** سطح token tier — پیش‌فرض: "ANONYMOUS" */
    readonly tokenTier: TokenTier;
    /** کشور پیش‌فرض (ISO 3166-1 alpha-2) — پیش‌فرض: "IR" */
    readonly defaultCountry: string;
    /** زبان پیش‌فرض — پیش‌فرض: "fa" */
    readonly defaultLanguage: string;
    /** اجبار به لایه UI خاص (برای توسعه) */
    readonly forceUILayer?: CapabilityLayer;
}
/** partial برای override پیکربندی — بدون readonly برای ساختن incremental */
export type AWAFConfigOverrides = {
    -readonly [K in keyof AWAFConfigOptions]?: AWAFConfigOptions[K];
};
/**
 * کلاس مدیریت پیکربندی AWAF SDK.
 * Reads from environment variables (AWAF_*) and merges with defaults.
 *
 * @example
 * const config = AWAFConfig.fromEnv();
 * if (!config.success) {
 *   console.error(config.error.message);
 *   process.exit(1);
 * }
 * const { apiBaseUrl, timeoutMs } = config.data.options;
 */
export declare class AWAFConfig {
    private readonly _options;
    private constructor();
    /** دسترسی به تمام options */
    get options(): Readonly<AWAFConfigOptions>;
    /**
     * ساخت AWAFConfig از environment variables.
     * Reads AWAF_* environment variables with fallback to defaults.
     *
     * @param overrides - override دستی options
     * @returns Result<AWAFConfig, AWAFError>
     *
     * @example
     * const result = AWAFConfig.fromEnv({ logLevel: 'debug' });
     */
    static fromEnv(overrides?: AWAFConfigOverrides): Result<AWAFConfig, AWAFError>;
    /**
     * ساخت AWAFConfig از options صریح (بدون خواندن environment).
     *
     * @param options - options کامل
     * @returns Result<AWAFConfig, AWAFError>
     */
    static fromOptions(options: Partial<AWAFConfigOptions>): Result<AWAFConfig, AWAFError>;
    /**
     * خواندن environment variables AWAF_*.
     * Works in both Node.js and browser environments.
     */
    private static readEnv;
    /**
     * اعتبارسنجی options.
     */
    private static validate;
}
//# sourceMappingURL=awaf-config.d.ts.map