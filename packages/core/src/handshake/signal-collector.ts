/**
 * @module handshake/signal-collector
 * @description
 * SignalCollector — جمع‌آوری سیگنال‌های passive مرورگر بدون PII.
 * Collects passive browser signals: language, timezone, device class,
 * WebGL support, DNT/GPC, network type, reduced-motion, and referrer.
 */

import type { DeviceClass, CapabilityLayer } from '../types/base.js';
import type { DetectedSignals } from '../types/visitor.js';
import { type AlphabetError, type Result, ok, err } from '../types/result.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * گزینه‌های SignalCollector — برای تزریق وابستگی در تست‌ها.
 * Options for SignalCollector — allows dependency injection for testing.
 */
export interface SignalCollectorOptions {
  /** override برای navigator (پیش‌فرض: globalThis.navigator) */
  readonly navigator?: Partial<Navigator> & { globalPrivacyControl?: boolean };
  /** override برای screen (پیش‌فرض: globalThis.screen) */
  readonly screen?: Partial<Screen>;
  /** override برای document (پیش‌فرض: globalThis.document) */
  readonly document?: Partial<Document>;
  /** override برای window.devicePixelRatio (پیش‌فرض: globalThis.devicePixelRatio) */
  readonly devicePixelRatio?: number;
  /** override برای window.matchMedia */
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
  /** override برای canvas factory (برای تست WebGL) */
  readonly createCanvas?: () => HTMLCanvasElement | null;
}

// ─── SignalCollector Class ────────────────────────────────────────────────────

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
export class SignalCollector {
  private readonly opts: SignalCollectorOptions;

  constructor(options: SignalCollectorOptions = {}) {
    this.opts = options;
  }

  /**
   * جمع‌آوری تمام سیگنال‌های passive مرورگر.
   * Collects all passive browser signals.
   *
   * @returns Result<DetectedSignals, AlphabetError>
   *
   * @example
   * const result = new SignalCollector().collect();
   * if (result.success) {
   *   const { language, timezone, deviceClass } = result.data;
   * }
   */
  collect(): Result<DetectedSignals, AlphabetError> {
    try {
      const screenWidth = this.readScreenWidth();
      const screenHeight = this.readScreenHeight();
      const networkType = this.readNetworkType();

      const base = {
        language: this.readLanguage(),
        timezone: this.readTimezone(),
        deviceClass: this.deriveDeviceClass(screenWidth),
        platform: this.readPlatform(),
        screenWidth,
        screenHeight,
        devicePixelRatio: this.readDevicePixelRatio(),
        webglSupported: this.detectWebGL(),
        dntEnabled: this.readDNT(),
        gpcEnabled: this.readGPC(),
        prefersReducedMotion: this.readPrefersReducedMotion(),
        referrer: this.readReferrer(),
      };

      const signals: DetectedSignals = {
        ...base,
        ...(networkType !== undefined ? { networkType } : {}),
      };

      return ok(signals);
    } catch (e) {
      return err({
        code: 'SIGNAL_COLLECTION_FAILED',
        message: 'Failed to collect browser signals',
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  /**
   * تشخیص لایه UI مناسب بر اساس قابلیت‌های مرورگر.
   * Detects the appropriate UI layer based on browser capabilities.
   *
   * @param signals - DetectedSignals از collect()
   * @returns CapabilityLayer
   */
  static detectLayer(signals: DetectedSignals): CapabilityLayer {
    if (signals.prefersReducedMotion) return 'STATIC_HTML';

    if (!signals.webglSupported) return 'CANVAS_2D';

    const net = signals.networkType;
    const is4g = net === '4g' || net === undefined;
    const is3gPlus = net === '3g' || net === '4g' || net === undefined;

    if (is4g && signals.screenWidth >= 768) return 'R3F_IMMERSIVE';
    if (is3gPlus) return 'CSS_3D';
    return 'CANVAS_2D';
  }

  // ─── Private Readers ────────────────────────────────────────────────────────

  private readLanguage(): string {
    const nav = this.opts.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    const lang = nav?.language ?? nav?.['languages']?.[0] ?? 'en';
    // استخراج کد زبان اصلی (e.g., "en-US" → "en", "fa-IR" → "fa")
    return (lang.split('-')[0] ?? 'en').toLowerCase();
  }

  private readTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private readPlatform(): string {
    const nav = this.opts.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    return nav?.platform ?? 'unknown';
  }

  private readScreenWidth(): number {
    const scr = this.opts.screen ?? (typeof screen !== 'undefined' ? screen : undefined);
    return scr?.width ?? 1024;
  }

  private readScreenHeight(): number {
    const scr = this.opts.screen ?? (typeof screen !== 'undefined' ? screen : undefined);
    return scr?.height ?? 768;
  }

  private readDevicePixelRatio(): number {
    if (this.opts.devicePixelRatio !== undefined) return this.opts.devicePixelRatio;
    return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  }

  private detectWebGL(): boolean {
    if (this.opts.createCanvas !== undefined) {
      const canvas = this.opts.createCanvas();
      if (!canvas) return false;
      const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      return ctx !== null;
    }
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      return ctx !== null;
    } catch {
      return false;
    }
  }

  private readDNT(): boolean {
    const nav = this.opts.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    return nav?.doNotTrack === '1';
  }

  private readGPC(): boolean {
    const nav = this.opts.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    // GPC در تایپ Navigator استاندارد وجود ندارد — دسترسی ایمن
    const gpcVal = (nav as { globalPrivacyControl?: unknown } | undefined)?.['globalPrivacyControl'];
    return gpcVal === true;
  }

  private readNetworkType(): string | undefined {
    const nav = this.opts.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    // Network Information API — experimental
    const conn = (nav as { connection?: { effectiveType?: string } } | undefined)?.['connection'];
    return conn?.['effectiveType'];
  }

  private readPrefersReducedMotion(): boolean {
    const matchFn = this.opts.matchMedia ??
      (typeof matchMedia !== 'undefined' ? (q: string) => matchMedia(q) : undefined);
    if (!matchFn) return false;
    try {
      return matchFn('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private readReferrer(): string {
    const doc = this.opts.document ?? (typeof document !== 'undefined' ? document : undefined);
    return doc?.referrer ?? '';
  }

  private deriveDeviceClass(width: number): DeviceClass {
    if (width <= 0) return 'unknown';
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}
