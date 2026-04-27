/**
 * @module logger
 * @description
 * AWAFLogger — سیستم logging چهارسطحی با structured output و JSON sink.
 * AWAFLogger — four-level structured logging with optional JSON sink.
 */
import type { LogLevel } from '../types/base.js';
/**
 * یک رکورد log با فیلدهای structured.
 */
export interface LogEntry {
    /** سطح log */
    readonly level: LogLevel;
    /** پیام اصلی */
    readonly message: string;
    /** context اضافی (بدون PII) */
    readonly context?: Record<string, unknown>;
    /** نام module */
    readonly module?: string;
    /** زمان log (ISO 8601) */
    readonly timestamp: string;
}
/**
 * گزینه‌های راه‌اندازی AWAFLogger.
 */
export interface AWAFLoggerOptions {
    /** حداقل سطح log که نمایش داده می‌شود */
    readonly minLevel: LogLevel;
    /** آیا خروجی JSON باشد (برای production) */
    readonly jsonOutput: boolean;
    /** نام module برای prefix */
    readonly module?: string;
    /** sink سفارشی برای ارسال log به سیستم خارجی */
    readonly sink?: (entry: LogEntry) => void;
}
/**
 * Logger structured چهارسطحی AWAF SDK.
 * No PII should ever be passed to any log method.
 *
 * @example
 * const logger = new AWAFLogger({ minLevel: 'debug', jsonOutput: false, module: 'HandshakeClient' });
 * logger.info('Handshake started', { sessionId: 'sess-abc' });
 * logger.error('Connection failed', { code: 'NETWORK_ERROR' });
 */
export declare class AWAFLogger {
    private readonly opts;
    constructor(options?: Partial<AWAFLoggerOptions>);
    /**
     * ساخت logger با نام module جدید (child logger).
     *
     * @param moduleName - نام module
     * @returns AWAFLogger جدید با module مشخص
     */
    child(moduleName: string): AWAFLogger;
    /**
     * log سطح debug — فقط در محیط development.
     *
     * @param message - پیام
     * @param context - context اضافی
     */
    debug(message: string, context?: Record<string, unknown>): void;
    /**
     * log سطح info — رویدادهای معمول.
     *
     * @param message - پیام
     * @param context - context اضافی
     */
    info(message: string, context?: Record<string, unknown>): void;
    /**
     * log سطح warn — هشدارهای non-critical.
     *
     * @param message - پیام
     * @param context - context اضافی
     */
    warn(message: string, context?: Record<string, unknown>): void;
    /**
     * log سطح error — خطاهای critical.
     *
     * @param message - پیام
     * @param context - context اضافی
     */
    error(message: string, context?: Record<string, unknown>): void;
    /**
     * متد پایه log.
     */
    private log;
}
//# sourceMappingURL=awaf-logger.d.ts.map