/**
 * @module handshake/stream/context-stream
 * @description
 * Real-time context streaming built on the **platform `ReadableStream`** —
 * no RxJS, no third-party Observables. Emits `ContextStreamEvent` values
 * as the handshake progresses or as fresh signal snapshots are pushed in,
 * with native back-pressure (`highWaterMark`) and `AbortController`
 * cancellation.
 *
 * **Why platform streams.** They are zero-dep, edge-safe, and already give
 * us back-pressure, cancellation, and `for await…of` consumption via a
 * tiny adapter. Consumers who *want* RxJS can convert with
 * `from(stream)` themselves — we don't ship the dep.
 *
 * **Privacy.** Events carry only PII-free derived values (layer, locale,
 * direction, privacy mode flags, durationMs). The full `EnrichedContext`
 * is never emitted on the stream.
 */

import type { CapabilityLayer } from '../../types/base.js';
import type { HandshakeOutcome, HandshakePhase } from '../orchestrator.js';

// ─── Event types ──────────────────────────────────────────────────────────────

/**
 * یک رویداد در stream context. Discriminated union بر اساس `type`.
 *
 * - `phase:start` / `phase:end` — هر فاز handshake.
 * - `decision` — لایهٔ نهایی + locale/direction، PII-free.
 * - `signal-update` — یک snapshot سبک از سیگنال‌های متغیر (network/battery/
 *   reduced-motion) که در طول زمان push می‌شود.
 * - `error` — خطای phase-scoped یا global.
 */
export type ContextStreamEvent =
  | { readonly type: 'phase:start'; readonly phase: HandshakePhase; readonly at: number }
  | {
      readonly type: 'phase:end';
      readonly phase: HandshakePhase;
      readonly durationMs: number;
      readonly at: number;
    }
  | {
      readonly type: 'decision';
      readonly layer: CapabilityLayer;
      readonly locale: string;
      readonly direction: 'ltr' | 'rtl';
      readonly restricted: boolean;
      readonly at: number;
    }
  | {
      readonly type: 'signal-update';
      readonly snapshot: SignalSnapshot;
      readonly at: number;
    }
  | {
      readonly type: 'error';
      readonly phase?: HandshakePhase;
      readonly code: string;
      readonly message: string;
      readonly at: number;
    };

/** Snapshot سبک از سیگنال‌های زنده (PII-free). */
export interface SignalSnapshot {
  readonly networkType?: string;
  readonly prefersReducedMotion?: boolean;
  readonly visibilityState?: 'visible' | 'hidden';
  readonly batteryLevel?: number;
  readonly batteryCharging?: boolean;
}

// ─── Stream factory ───────────────────────────────────────────────────────────

/**
 * Default `highWaterMark` for the context stream. Mirrors the value
 * documented on `ContextStreamOptions.highWaterMark`.
 */
export const DEFAULT_CONTEXT_STREAM_HIGH_WATER_MARK = 16;

/**
 * گزینه‌های `createContextStream`.
 */
export interface ContextStreamOptions {
  /** signal لغو خارجی — وقتی fire شود، stream cancel می‌شود */
  readonly signal?: AbortSignal;
  /**
   * highWaterMark — حداکثر رویدادهای buffer شده قبل از back-pressure.
   * پیش‌فرض `DEFAULT_CONTEXT_STREAM_HIGH_WATER_MARK` (`16`).
   */
  readonly highWaterMark?: number;
  /** ساعت قابل تعویض — پیش‌فرض `Date.now`. */
  readonly now?: () => number;
}

/** کنترل‌گر یک stream — برای push کردن رویدادها از سایر بخش‌ها. */
export interface ContextStreamController {
  /** push یک رویداد به stream. اگر بسته شده باشد، no-op است. */
  push(event: Omit<ContextStreamEvent, 'at'> & { readonly at?: number }): void;
  /** push کامل HandshakeOutcome به‌صورت phase:end + decision. */
  pushOutcome(outcome: HandshakeOutcome): void;
  /** بستن stream به‌صورت موفق (پایان معمولی). */
  close(): void;
  /** لغو stream با خطا. */
  abort(reason?: string): void;
  /** آیا stream بسته یا لغو شده است. */
  readonly closed: boolean;
}

/** خروجی `createContextStream`. */
export interface ContextStreamHandle {
  readonly stream: ReadableStream<ContextStreamEvent>;
  readonly controller: ContextStreamController;
}

/**
 * یک ContextStream می‌سازد. مصرف‌کننده می‌تواند با `for await (const e of
 * toAsyncIterable(handle.stream))` رویدادها را consume کند یا با
 * `handle.stream.getReader()` به‌صورت دستی.
 *
 * @example
 * const { stream, controller } = createContextStream({ signal });
 * controller.push({ type: 'phase:start', phase: 'collect' });
 * controller.pushOutcome(outcome);
 * controller.close();
 * for await (const event of toAsyncIterable(stream)) {
 *   console.log(event);
 * }
 */
export function createContextStream(
  options: ContextStreamOptions = {},
): ContextStreamHandle {
  const now = options.now ?? ((): number => Date.now());
  const highWaterMark = Math.max(
    1,
    options.highWaterMark ?? DEFAULT_CONTEXT_STREAM_HIGH_WATER_MARK,
  );

  let internalController: ReadableStreamDefaultController<ContextStreamEvent> | undefined;
  let closed = false;

  const onAbort = (): void => {
    if (closed) return;
    closed = true;
    try {
      internalController?.error(new Error('Stream aborted'));
    } catch {
      /* already errored */
    }
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const stream = new ReadableStream<ContextStreamEvent>(
    {
      start(c): void {
        internalController = c;
        if (options.signal?.aborted === true) {
          closed = true;
          c.error(new Error('Stream aborted'));
        }
      },
      cancel(): void {
        closed = true;
        options.signal?.removeEventListener('abort', onAbort);
      },
    },
    {
      // پلتفرم خود back-pressure را با highWaterMark + size مدیریت می‌کند.
      highWaterMark,
      size: () => 1,
    },
  );

  const controller: ContextStreamController = {
    get closed(): boolean {
      return closed;
    },
    push(event): void {
      if (closed || internalController === undefined) return;
      const at = event.at ?? now();
      try {
        internalController.enqueue({ ...event, at } as ContextStreamEvent);
      } catch {
        closed = true;
      }
    },
    pushOutcome(outcome): void {
      const phaseEvent = {
        type: 'phase:end' as const,
        phase: 'decide' as const,
        durationMs: outcome.durationMs,
      };
      this.push(phaseEvent);
      const decisionEvent = {
        type: 'decision' as const,
        layer: outcome.decision.selectedLayer,
        locale: outcome.decision.uiConfig.locale,
        direction: outcome.decision.uiConfig.direction,
        restricted: outcome.decision.privacyMode.restricted,
      };
      this.push(decisionEvent);
    },
    close(): void {
      if (closed) return;
      closed = true;
      options.signal?.removeEventListener('abort', onAbort);
      try {
        internalController?.close();
      } catch {
        /* already closed */
      }
    },
    abort(reason): void {
      if (closed) return;
      closed = true;
      options.signal?.removeEventListener('abort', onAbort);
      try {
        internalController?.error(new Error(reason ?? 'aborted'));
      } catch {
        /* already errored */
      }
    },
  };

  return { stream, controller };
}

// ─── Async iterable adapter ──────────────────────────────────────────────────

/**
 * ReadableStream را به AsyncIterable تبدیل می‌کند تا با `for await…of` قابل
 * مصرف باشد. اگر env بومی این را پشتیبانی کند (Node 18+, modern browsers)
 * مستقیم به همان polyfill می‌چسبد؛ در غیر این صورت یک پیاده‌سازی سبک
 * استفاده می‌کنیم که `getReader()` را تا پایان iterate می‌کند.
 */
export function toAsyncIterable<T>(
  stream: ReadableStream<T>,
): AsyncIterable<T> {
  type AnyStream = ReadableStream<T> & {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<T>;
  };
  const native = (stream as AnyStream)[Symbol.asyncIterator];
  if (typeof native === 'function') {
    return {
      [Symbol.asyncIterator]: native.bind(stream),
    };
  }

  return {
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      const reader = stream.getReader();
      const iterator: AsyncIterableIterator<T> = {
        async next(): Promise<IteratorResult<T>> {
          const { value, done } = await reader.read();
          if (done) return { value: undefined, done: true };
          return { value: value as T, done: false };
        },
        async return(): Promise<IteratorResult<T>> {
          await reader.cancel();
          return { value: undefined, done: true };
        },
        [Symbol.asyncIterator](): AsyncIterableIterator<T> {
          return iterator;
        },
      };
      return iterator;
    },
  };
}
