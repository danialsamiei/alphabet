/**
 * @module logger
 * @description
 * AlphabetLogger — سیستم logging چهارسطحی با structured output و JSON sink.
 * AlphabetLogger — four-level structured logging with optional JSON sink.
 */

import type { LogLevel } from '../types/base.js';
import { LOG_LEVEL_ORDER } from '../types/base.js';

// ─── Log Entry ────────────────────────────────────────────────────────────────

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

// ─── Logger Options ───────────────────────────────────────────────────────────

/**
 * گزینه‌های راه‌اندازی AlphabetLogger.
 */
export interface AlphabetLoggerOptions {
  /** حداقل سطح log که نمایش داده می‌شود */
  readonly minLevel: LogLevel;
  /** آیا خروجی JSON باشد (برای production) */
  readonly jsonOutput: boolean;
  /** نام module برای prefix */
  readonly module?: string;
  /** sink سفارشی برای ارسال log به سیستم خارجی */
  readonly sink?: (entry: LogEntry) => void;
}

// ─── AlphabetLogger Class ─────────────────────────────────────────────────────────

/**
 * Logger structured چهارسطحی Alphabet SDK.
 * No PII should ever be passed to any log method.
 *
 * @example
 * const logger = new AlphabetLogger({ minLevel: 'debug', jsonOutput: false, module: 'HandshakeClient' });
 * logger.info('Handshake started', { sessionId: 'sess-abc' });
 * logger.error('Connection failed', { code: 'NETWORK_ERROR' });
 */
export class AlphabetLogger {
  private readonly opts: Readonly<AlphabetLoggerOptions>;

  constructor(options: Partial<AlphabetLoggerOptions> = {}) {
    const frozen: {
      minLevel: LogLevel;
      jsonOutput: boolean;
      module?: string;
      sink?: (entry: LogEntry) => void;
    } = {
      minLevel: options.minLevel ?? 'info',
      jsonOutput: options.jsonOutput ?? false,
    };
    if (options.module !== undefined) frozen.module = options.module;
    if (options.sink !== undefined) frozen.sink = options.sink;
    this.opts = Object.freeze(frozen) as Readonly<AlphabetLoggerOptions>;
  }

  /**
   * ساخت logger با نام module جدید (child logger).
   *
   * @param moduleName - نام module
   * @returns AlphabetLogger جدید با module مشخص
   */
  child(moduleName: string): AlphabetLogger {
    const childOpts: { minLevel: LogLevel; jsonOutput: boolean; module: string; sink?: (entry: LogEntry) => void } = {
      minLevel: this.opts.minLevel,
      jsonOutput: this.opts.jsonOutput,
      module: moduleName,
    };
    if (this.opts.sink !== undefined) childOpts.sink = this.opts.sink;
    return new AlphabetLogger(childOpts);
  }

  /**
   * log سطح debug — فقط در محیط development.
   *
   * @param message - پیام
   * @param context - context اضافی
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * log سطح info — رویدادهای معمول.
   *
   * @param message - پیام
   * @param context - context اضافی
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * log سطح warn — هشدارهای non-critical.
   *
   * @param message - پیام
   * @param context - context اضافی
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * log سطح error — خطاهای critical.
   *
   * @param message - پیام
   * @param context - context اضافی
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * متد پایه log.
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.opts.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context !== undefined ? { context } : {}),
      ...(this.opts.module !== undefined ? { module: this.opts.module } : {}),
    };

    if (this.opts.sink) {
      this.opts.sink(entry);
      return;
    }

    if (this.opts.jsonOutput) {
      console.log(JSON.stringify(entry));
      return;
    }

    const prefix = this.opts.module ? `[${this.opts.module}]` : '[Alphabet]';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const formatted = `${entry.timestamp} ${level.toUpperCase().padEnd(5)} ${prefix} ${message}${contextStr}`;

    switch (level) {
      case 'debug': console.debug(formatted); break;
      case 'info':  console.info(formatted);  break;
      case 'warn':  console.warn(formatted);  break;
      case 'error': console.error(formatted); break;
    }
  }
}
