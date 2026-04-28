/**
 * @module handshake/pipeline/trace
 * @description
 * Structured tracing primitives for the handshake pipeline — small, sync,
 * dependency-free. Records nested spans with start/end timestamps and an
 * outcome ('ok' | 'error' | 'cancelled'). No PII is recorded; spans only
 * carry the step name, duration, and an optional `attributes` bag that the
 * caller is expected to keep PII-free.
 *
 * This is *internal* tracing — not OpenTelemetry — but exporters can map
 * the resulting `TraceSnapshot` to OTLP if they wish.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** نتیجهٔ پایان یک span. End-state of a span. */
export type SpanOutcome = 'ok' | 'error' | 'cancelled';

/** ویژگی‌های PII-free که می‌توان به span ضمیمه کرد. */
export type SpanAttributes = Readonly<Record<string, string | number | boolean>>;

/** یک رکورد span پس از پایان. A finished span record. */
export interface SpanRecord {
  readonly name: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly outcome: SpanOutcome;
  readonly attributes: SpanAttributes;
  /** پیام خطا (اگر outcome === 'error') — حاوی PII نیست */
  readonly errorMessage?: string;
  /** فهرست spanهای فرزند به ترتیب پایان */
  readonly children: readonly SpanRecord[];
}

/** snapshot نهایی یک trace — معمولاً یک span ریشه با درخت فرزندان. */
export interface TraceSnapshot {
  readonly root: SpanRecord;
}

/** handle یک span در حال اجرا. */
export interface Span {
  /** افزودن attribute به این span (PII-free responsibility on caller) */
  setAttribute(key: string, value: string | number | boolean): void;
  /** ساخت span فرزند زیر این span */
  child(name: string, attrs?: SpanAttributes): Span;
  /** پایان موفق span */
  end(): void;
  /** پایان با خطا — پیام در record ذخیره می‌شود */
  fail(message: string): void;
  /** پایان به دلیل لغو (AbortSignal) */
  cancel(): void;
}

/** Tracer — کارخانهٔ spanهای ریشه. */
export interface Tracer {
  startSpan(name: string, attrs?: SpanAttributes): Span;
}

// ─── Implementation ───────────────────────────────────────────────────────────

interface MutableSpanState {
  readonly name: string;
  readonly startedAt: number;
  endedAt: number;
  outcome: SpanOutcome;
  attributes: Record<string, string | number | boolean>;
  errorMessage?: string;
  readonly children: SpanRecord[];
  ended: boolean;
}

function freezeSpan(s: MutableSpanState): SpanRecord {
  const base = {
    name: s.name,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMs: Math.max(0, s.endedAt - s.startedAt),
    outcome: s.outcome,
    attributes: Object.freeze({ ...s.attributes }) as SpanAttributes,
    children: Object.freeze([...s.children]) as readonly SpanRecord[],
  };
  return s.errorMessage !== undefined
    ? Object.freeze({ ...base, errorMessage: s.errorMessage })
    : Object.freeze(base);
}

function makeSpan(
  name: string,
  attrs: SpanAttributes | undefined,
  now: () => number,
  onEnd: (record: SpanRecord) => void,
): Span {
  const state: MutableSpanState = {
    name,
    startedAt: now(),
    endedAt: 0,
    outcome: 'ok',
    attributes: { ...(attrs ?? {}) },
    children: [],
    ended: false,
  };

  const finish = (outcome: SpanOutcome, errorMessage?: string): void => {
    if (state.ended) return;
    state.ended = true;
    state.endedAt = now();
    state.outcome = outcome;
    if (errorMessage !== undefined) state.errorMessage = errorMessage;
    onEnd(freezeSpan(state));
  };

  return {
    setAttribute(key, value) {
      if (state.ended) return;
      state.attributes[key] = value;
    },
    child(childName, childAttrs) {
      return makeSpan(childName, childAttrs, now, (record) => {
        state.children.push(record);
      });
    },
    end() {
      finish('ok');
    },
    fail(message) {
      finish('error', message);
    },
    cancel() {
      finish('cancelled');
    },
  };
}

// ─── TraceCollector ───────────────────────────────────────────────────────────

/**
 * یک Tracer ساده که تمام spanهای ریشه را در یک snapshot جمع می‌کند.
 *
 * @example
 * const tracer = new TraceCollector();
 * const root = tracer.startSpan('handshake');
 * const c = root.child('collect');
 * c.end();
 * root.end();
 * const snap = tracer.snapshot();
 */
export class TraceCollector implements Tracer {
  private readonly now: () => number;
  private root: SpanRecord | undefined;

  constructor(options: { readonly now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  startSpan(name: string, attrs?: SpanAttributes): Span {
    return makeSpan(name, attrs, this.now, (record) => {
      this.root = record;
    });
  }

  /** snapshot trace — اگر هنوز span ریشه پایان نیافته باشد undefined */
  snapshot(): TraceSnapshot | undefined {
    return this.root === undefined ? undefined : { root: this.root };
  }
}

/** Tracer no-op — وقتی tracing لازم نیست. */
export const noopTracer: Tracer = {
  startSpan(): Span {
    return {
      setAttribute() {},
      child() {
        return noopTracer.startSpan('');
      },
      end() {},
      fail() {},
      cancel() {},
    };
  },
};
