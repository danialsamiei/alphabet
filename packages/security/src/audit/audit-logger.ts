/**
 * @module audit/audit-logger
 * @description
 * Structured security audit logger — رویدادهای امنیتی را با ساختار ثابت
 * منتشر می‌کند، PII را به‌صورت پیش‌فرض redact می‌کند، و یک sink قابل
 * تعویض می‌پذیرد.
 *
 * The audit logger is intentionally narrow: it exposes one method per
 * documented event category and records a small, well-typed payload.
 * No raw user input, raw prompts, or raw model outputs are persisted —
 * the payload is filtered through `redactPII` (deep) before being
 * forwarded to the sink.
 *
 * **Limitations.** This is an in-process logger. Append-only durability,
 * tamper-evident hashing, and remote shipping are out of scope and must
 * be provided by the host application.
 */

import { redactPIIDeep } from '../pii/redactor.js';
import type { PIIFinding } from '../pii/redactor.js';
import type { ConsentTier, MemoryDomain } from '@alphabet/core';
import type { PromptRiskLevel } from '../prompt-injection/detector.js';

// ─── Event types ─────────────────────────────────────────────────────────────

/** دسته‌های رویداد ممیزی پشتیبانی‌شده. */
export type AuditEventCategory =
  | 'consent_changed'
  | 'privacy_signal_detected'
  | 'memory_write_blocked'
  | 'memory_read_blocked'
  | 'prompt_risk_detected'
  | 'output_rejected'
  | 'policy_version_changed';

/** سطح اهمیت رویداد. */
export type AuditEventSeverity = 'info' | 'warning' | 'critical';

/** بدنه پایه رویداد ممیزی. */
export interface AuditEventBase {
  readonly category: AuditEventCategory;
  readonly severity: AuditEventSeverity;
  /** ISO 8601 timestamp. */
  readonly timestamp: string;
  /**
   * شناسه correlation برای ردیابی یک عملیات کامل — اختیاری.
   * Optional correlation id (e.g., a request id) so consumers can stitch
   * together audit events for one action.
   */
  readonly correlationId?: string;
}

/** Discriminated union of audit events with typed `data` per category. */
export type AuditEvent =
  | (AuditEventBase & {
      readonly category: 'consent_changed';
      readonly data: {
        readonly previousState: 'pending' | 'granted' | 'revoked';
        readonly nextState: 'pending' | 'granted' | 'revoked';
        readonly previousTier: ConsentTier;
        readonly nextTier: ConsentTier;
        readonly reason?: string;
      };
    })
  | (AuditEventBase & {
      readonly category: 'privacy_signal_detected';
      readonly data: {
        readonly dntEnabled: boolean;
        readonly gpcEnabled: boolean;
        readonly downgradedTo: ConsentTier;
      };
    })
  | (AuditEventBase & {
      readonly category: 'memory_write_blocked';
      readonly data: {
        readonly domain: MemoryDomain;
        readonly consentTier: ConsentTier;
        readonly errorCode: string;
        readonly reason: string;
      };
    })
  | (AuditEventBase & {
      readonly category: 'memory_read_blocked';
      readonly data: {
        readonly ownerDomain: MemoryDomain;
        readonly readerDomain: MemoryDomain;
        readonly consentTier: ConsentTier;
        readonly errorCode: string;
        readonly reason: string;
      };
    })
  | (AuditEventBase & {
      readonly category: 'prompt_risk_detected';
      readonly data: {
        readonly level: PromptRiskLevel;
        readonly score: number;
        readonly action: 'allow' | 'flag' | 'review' | 'block';
        readonly patterns: readonly string[];
      };
    })
  | (AuditEventBase & {
      readonly category: 'output_rejected';
      readonly data: {
        readonly kind: 'url' | 'html' | 'other';
        readonly errorCode: string;
        readonly reason: string;
        readonly redacted: string;
      };
    })
  | (AuditEventBase & {
      readonly category: 'policy_version_changed';
      readonly data: {
        readonly previousVersion: string;
        readonly nextVersion: string;
        readonly invalidatedConsents: number;
      };
    });

/** A function that consumes an audit event. */
export type AuditSink = (event: AuditEvent) => void;

/** گزینه‌های logger. */
export interface AuditLoggerOptions {
  /** sink سفارشی — پیش‌فرض sink in-memory. */
  readonly sink?: AuditSink;
  /**
   * If `true` (default), every event payload is passed through
   * `redactPIIDeep` before reaching the sink. Set to `false` only if the
   * caller already runs a stricter DLP pipeline downstream.
   */
  readonly redactPII?: boolean;
  /** Default correlation id attached to every event when none is supplied. */
  readonly defaultCorrelationId?: string;
}

// ─── In-memory sink ──────────────────────────────────────────────────────────

/**
 * sink ساده in-memory برای تست و SDK toolهای کوچک. در production،
 * یک sink مقاوم (append-only, encrypted, off-host) فراهم کنید.
 *
 * Useful for tests and SDK self-checks. **Do not** use as a production
 * audit log — it is bounded only by JS heap and offers no durability.
 */
export class InMemoryAuditSink {
  private readonly bufferLimit: number;
  private events: AuditEvent[] = [];

  constructor(options: { readonly bufferLimit?: number } = {}) {
    this.bufferLimit = options.bufferLimit ?? 1000;
  }

  /** پیاده‌سازی AuditSink — bind شده به instance. */
  readonly write: AuditSink = (event) => {
    this.events.push(event);
    if (this.events.length > this.bufferLimit) {
      this.events = this.events.slice(this.events.length - this.bufferLimit);
    }
  };

  /** snapshot از eventهای ضبط شده. */
  snapshot(): readonly AuditEvent[] {
    return [...this.events];
  }

  /** پاک کردن buffer — برای تست. */
  clear(): void {
    this.events = [];
  }

  /** فیلتر کردن eventها بر اساس category. */
  byCategory(category: AuditEventCategory): readonly AuditEvent[] {
    return this.events.filter((e) => e.category === category);
  }
}

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * AlphabetAuditLogger — facade ثابت روی sink با redaction PII پیش‌فرض.
 *
 * @example
 * const sink = new InMemoryAuditSink();
 * const logger = new AlphabetAuditLogger({ sink: sink.write });
 * logger.consentChanged({ previousState: 'pending', nextState: 'granted', ... });
 * sink.snapshot()[0].category === 'consent_changed';
 */
export class AlphabetAuditLogger {
  private readonly sink: AuditSink;
  private readonly redact: boolean;
  private readonly defaultCorrelationId: string | undefined;

  constructor(options: AuditLoggerOptions = {}) {
    this.sink = options.sink ?? (() => undefined);
    this.redact = options.redactPII ?? true;
    this.defaultCorrelationId = options.defaultCorrelationId;
  }

  // ─── Category-specific helpers ─────────────────────────────────────────────

  consentChanged(
    data: Extract<AuditEvent, { category: 'consent_changed' }>['data'],
    correlationId?: string
  ): void {
    this.emit('consent_changed', 'info', data, correlationId);
  }

  privacySignalDetected(
    data: Extract<AuditEvent, { category: 'privacy_signal_detected' }>['data'],
    correlationId?: string
  ): void {
    this.emit('privacy_signal_detected', 'info', data, correlationId);
  }

  memoryWriteBlocked(
    data: Extract<AuditEvent, { category: 'memory_write_blocked' }>['data'],
    correlationId?: string
  ): void {
    this.emit('memory_write_blocked', 'warning', data, correlationId);
  }

  memoryReadBlocked(
    data: Extract<AuditEvent, { category: 'memory_read_blocked' }>['data'],
    correlationId?: string
  ): void {
    this.emit('memory_read_blocked', 'warning', data, correlationId);
  }

  promptRiskDetected(
    data: Extract<AuditEvent, { category: 'prompt_risk_detected' }>['data'],
    correlationId?: string
  ): void {
    const severity: AuditEventSeverity =
      data.level === 'high' ? 'critical' : data.level === 'medium' ? 'warning' : 'info';
    this.emit('prompt_risk_detected', severity, data, correlationId);
  }

  outputRejected(
    data: Extract<AuditEvent, { category: 'output_rejected' }>['data'],
    correlationId?: string
  ): void {
    this.emit('output_rejected', 'warning', data, correlationId);
  }

  policyVersionChanged(
    data: Extract<AuditEvent, { category: 'policy_version_changed' }>['data'],
    correlationId?: string
  ): void {
    this.emit('policy_version_changed', 'info', data, correlationId);
  }

  // ─── Internal emission ────────────────────────────────────────────────────

  private emit<C extends AuditEventCategory>(
    category: C,
    severity: AuditEventSeverity,
    data: Extract<AuditEvent, { category: C }>['data'],
    correlationId: string | undefined
  ): void {
    // `redactPIIDeep` works structurally (it walks any object graph and
    // replaces string leaves) but cannot preserve TS's discriminated-union
    // type parameter `C`. The double cast through `unknown` documents that
    // we are widening then narrowing back to the same shape, with the
    // string fields redacted in place. The runtime structure is identical
    // — we are only restoring the static type.
    const cleaned = this.redact
      ? (redactPIIDeep(data as unknown as Record<string, unknown>).value as unknown as Extract<
          AuditEvent,
          { category: C }
        >['data'])
      : data;
    const event = {
      category,
      severity,
      timestamp: new Date().toISOString(),
      data: cleaned,
      ...(correlationId !== undefined
        ? { correlationId }
        : this.defaultCorrelationId !== undefined
          ? { correlationId: this.defaultCorrelationId }
          : {}),
    } as AuditEvent;

    try {
      this.sink(event);
    } catch {
      // A failing sink must not break the host application.
    }
  }
}

/** نوع خروجی deepFindings برای caller — همان interface PII findings. */
export type AuditPIIFinding = PIIFinding;
