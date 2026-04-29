/**
 * @module config
 * @description
 * کلاس AlphabetConfig — مدیریت پیکربندی SDK از environment variables و defaults.
 * AlphabetConfig class — manages SDK configuration from environment variables and defaults.
 */

import type { ConsentTier, LogLevel, CapabilityLayer, TokenTier } from '../types/base.js';
import { type AlphabetError, type Result, ok, err } from '../types/result.js';

// ─── Config Interface ─────────────────────────────────────────────────────────

/**
 * پیکربندی کامل Alphabet SDK.
 */
export interface AlphabetConfigOptions {
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
export type AlphabetConfigOverrides = {
  -readonly [K in keyof AlphabetConfigOptions]?: AlphabetConfigOptions[K];
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: AlphabetConfigOptions = {
  apiBaseUrl: 'http://localhost:3000/api',
  timeoutMs: 5000,
  maxRetries: 3,
  defaultConsentTier: 'NO_MEMORY',
  logLevel: 'info',
  enableTelemetry: false,
  tokenTier: 'ANONYMOUS',
  defaultCountry: 'IR',
  defaultLanguage: 'fa',
} as const;

// ─── AlphabetConfig Class ─────────────────────────────────────────────────────────

/**
 * کلاس مدیریت پیکربندی Alphabet SDK.
 * Reads from environment variables (Alphabet_*) and merges with defaults.
 *
 * @example
 * const config = AlphabetConfig.fromEnv();
 * if (!config.success) {
 *   console.error(config.error.message);
 *   process.exit(1);
 * }
 * const { apiBaseUrl, timeoutMs } = config.data.options;
 */
export class AlphabetConfig {
  private readonly _options: Readonly<AlphabetConfigOptions>;

  private constructor(options: AlphabetConfigOptions) {
    this._options = Object.freeze({ ...options });
  }

  /** دسترسی به تمام options */
  get options(): Readonly<AlphabetConfigOptions> {
    return this._options;
  }

  /**
   * ساخت AlphabetConfig از environment variables.
   * Reads Alphabet_* environment variables with fallback to defaults.
   *
   * @param overrides - override دستی options
   * @returns Result<AlphabetConfig, AlphabetError>
   *
   * @example
   * const result = AlphabetConfig.fromEnv({ logLevel: 'debug' });
   */
  static fromEnv(overrides?: AlphabetConfigOverrides): Result<AlphabetConfig, AlphabetError> {
    const env = AlphabetConfig.readEnv();
    const merged: AlphabetConfigOptions = {
      ...DEFAULTS,
      ...env,
      ...overrides,
    };

    const validationResult = AlphabetConfig.validate(merged);
    if (!validationResult.success) {
      return validationResult;
    }

    return ok(new AlphabetConfig(merged));
  }

  /**
   * ساخت AlphabetConfig از options صریح (بدون خواندن environment).
   *
   * @param options - options کامل
   * @returns Result<AlphabetConfig, AlphabetError>
   */
  static fromOptions(options: Partial<AlphabetConfigOptions>): Result<AlphabetConfig, AlphabetError> {
    const merged: AlphabetConfigOptions = {
      ...DEFAULTS,
      ...options,
    };

    const validationResult = AlphabetConfig.validate(merged);
    if (!validationResult.success) {
      return validationResult;
    }

    return ok(new AlphabetConfig(merged));
  }

  /**
   * خواندن environment variables Alphabet_*.
   * Works in both Node.js and browser environments.
   */
  private static readEnv(): AlphabetConfigOverrides {
    // در browser environment، process.env ممکن است وجود نداشته باشد
    const getEnv = (key: string): string | undefined => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = (globalThis as any)['process']?.['env'] as Record<string, string | undefined> | undefined;
        return env?.[key];
      } catch {
        return undefined;
      }
    };

    const overrides: AlphabetConfigOverrides = {};

    const apiBaseUrl = getEnv('ALPHABET_API_BASE_URL');
    if (apiBaseUrl) overrides['apiBaseUrl'] = apiBaseUrl;

    const timeoutMs = getEnv('ALPHABET_TIMEOUT_MS');
    if (timeoutMs) overrides['timeoutMs'] = parseInt(timeoutMs, 10);

    const maxRetries = getEnv('ALPHABET_MAX_RETRIES');
    if (maxRetries) overrides['maxRetries'] = parseInt(maxRetries, 10);

    const defaultConsentTier = getEnv('ALPHABET_DEFAULT_CONSENT_TIER');
    if (defaultConsentTier) {
      overrides['defaultConsentTier'] = defaultConsentTier as ConsentTier;
    }

    const logLevel = getEnv('ALPHABET_LOG_LEVEL');
    if (logLevel) overrides['logLevel'] = logLevel as LogLevel;

    const enableTelemetry = getEnv('ALPHABET_ENABLE_TELEMETRY');
    if (enableTelemetry) overrides['enableTelemetry'] = enableTelemetry === 'true';

    const tokenTier = getEnv('ALPHABET_TOKEN_TIER');
    if (tokenTier) overrides['tokenTier'] = tokenTier as TokenTier;

    const defaultCountry = getEnv('ALPHABET_DEFAULT_COUNTRY');
    if (defaultCountry) overrides['defaultCountry'] = defaultCountry;

    const defaultLanguage = getEnv('ALPHABET_DEFAULT_LANGUAGE');
    if (defaultLanguage) overrides['defaultLanguage'] = defaultLanguage;

    const forceUILayer = getEnv('ALPHABET_FORCE_UI_LAYER');
    if (forceUILayer) overrides['forceUILayer'] = forceUILayer as CapabilityLayer;

    return overrides;
  }

  /**
   * اعتبارسنجی options.
   */
  private static validate(options: AlphabetConfigOptions): Result<true, AlphabetError> {
    if (!options.apiBaseUrl || typeof options.apiBaseUrl !== 'string') {
      return err({ code: 'INVALID_API_BASE_URL', message: 'apiBaseUrl must be a non-empty string' });
    }

    if (!options.apiBaseUrl.startsWith('http://') && !options.apiBaseUrl.startsWith('https://')) {
      return err({ code: 'INVALID_API_BASE_URL', message: 'apiBaseUrl must start with http:// or https://' });
    }

    if (typeof options.timeoutMs !== 'number' || options.timeoutMs <= 0) {
      return err({ code: 'INVALID_TIMEOUT', message: 'timeoutMs must be a positive number' });
    }

    if (typeof options.maxRetries !== 'number' || options.maxRetries < 0) {
      return err({ code: 'INVALID_MAX_RETRIES', message: 'maxRetries must be a non-negative number' });
    }

    const validConsentTiers: ConsentTier[] = ['NO_MEMORY', 'ANONYMOUS', 'CONSENTED', 'ENRICHED'];
    if (!validConsentTiers.includes(options.defaultConsentTier)) {
      return err({ code: 'INVALID_CONSENT_TIER', message: `defaultConsentTier must be one of: ${validConsentTiers.join(', ')}` });
    }

    const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(options.logLevel)) {
      return err({ code: 'INVALID_LOG_LEVEL', message: `logLevel must be one of: ${validLogLevels.join(', ')}` });
    }

    return ok(true as const);
  }
}
