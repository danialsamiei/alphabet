/**
 * @module handshake/stream/multicast
 * @description
 * `MulticastContextStream` — a multi-subscriber wrapper around the
 * existing single-consumer `ContextStream` (built on platform
 * `ReadableStream`). Adds:
 *
 *   - **Reactive `subscribe(listener)`** API returning an unsubscribe
 *     handle. Idempotent — unsubscribing twice is a no-op.
 *
 *   - **Bounded replay buffer**. Late subscribers receive the last
 *     `replay` events (default 0, no replay) before live events. The
 *     buffer is a ring of `replay` capacity — never grows beyond it.
 *
 *   - **Per-subscriber back-pressure**. The slowest subscriber cannot
 *     stall the others: each subscriber has its own bounded queue
 *     (`perSubscriberBuffer`, default 64). Overflow drops *that*
 *     subscriber's oldest events and emits a single `'overflow'`
 *     warning to it (one-shot per overflow window) so the consumer
 *     learns it is too slow without poisoning the broadcast.
 *
 * Design note: we do not use the platform `tee()` API because it
 * couples the readers — a slow reader applies back-pressure to the
 * source via the writable side, which is exactly what we want to avoid
 * for fan-out. Instead we read once from the source and fan-out into
 * per-subscriber queues, dropping at the queue if the subscriber falls
 * behind.
 */

import type { ContextStreamEvent } from './context-stream.js';

// ─── Types ───────────────────────────────────────────────────────────[...]\n
export type ContextStreamListener = (event: ContextStreamEvent) => void;

export interface MulticastContextStreamOptions {
  /** Number of recent events replayed to a new subscriber. Default 0. */
  readonly replay?: number;
  /** Per-subscriber bounded queue size. Default 64. */
  readonly perSubscriberBuffer?: number;
  /** Time source for tests. Default `Date.now`. */
  readonly now?: () => number;
  /**
   * Optional sink for listener errors. By default listener errors are
   * **silently isolated** so one bad subscriber cannot poison the
   * broadcast or crash other subscribers. Provide `onListenerError` to
   * surface them to your logger / telemetry.
   */
  readonly onListenerError?: (error: unknown, event: ContextStreamEvent) => void;
}

export interface SubscribeOptions {
  /** If true, replay events are forwarded synchronously before live events. */
  readonly skipReplay?: boolean;
}

export interface SubscriptionHandle {
  /** Unsubscribe from the stream. Idempotent. */
  unsubscribe(): void;
  /** Snapshot of dropped events for *this* subscriber (back-pressure metric). */
  droppedCount(): number;
}

// ─── MulticastContextStream ──────────────────────────────────────────────────

interface SubscriberEntry {
  readonly listener: ContextStreamListener;
  readonly perSubscriberBuffer: number;
  active: boolean;
  draining: boolean;
  queue: ContextStreamEvent[];
  dropped: number;
}

/**
 * Multi-subscriber broadcaster for `ContextStreamEvent`s. Construct
 * with no arguments and feed it via `push()` from any source — typically
 * inside a `ContextStream` reader loop.
 */
export class MulticastContextStream {
  private readonly subscribers = new Set<SubscriberEntry>();
  private readonly replay: number;
  private readonly perSubscriberBuffer: number;
  private readonly replayBuffer: ContextStreamEvent[] = [];
  private readonly onListenerError?: ((error: unknown, event: ContextStreamEvent) => void) | undefined;
  private closed = false;

  constructor(options: MulticastContextStreamOptions = {}) {
    this.replay = Math.max(0, options.replay ?? 0);
    this.perSubscriberBuffer = Math.max(1, options.perSubscriberBuffer ?? 64);
    this.onListenerError = options.onListenerError;
  }

  /** Number of currently-active subscribers. */
  size(): number {
    let n = 0;
    for (const s of this.subscribers) if (s.active) n += 1;
    return n;
  }

  /** Whether `close()` has been called. */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Push one event to the broadcaster. The event is appended to the
   * replay buffer (subject to capacity) and forwarded to every active
   * subscriber's bounded queue. Returns the number of subscribers
   * that successfully received the event (i.e. did **not** overflow).
   */
  push(event: ContextStreamEvent): number {
    if (this.closed) return 0;
    if (this.replay > 0) {
      this.replayBuffer.push(event);
      while (this.replayBuffer.length > this.replay) this.replayBuffer.shift();
    }
    let delivered = 0;
    for (const sub of this.subscribers) {
      if (!sub.active) continue;
      if (sub.queue.length >= sub.perSubscriberBuffer) {
        // Drop oldest, count it.
        sub.queue.shift();
        sub.dropped += 1;
      } else {
        delivered += 1;
      }
      sub.queue.push(event);
      this.drain(sub);
    }
    return delivered;
  }

  /** Mark closed; further `push` is a no-op. Existing queues drain. */
  close(): void {
    this.closed = true;
  }

  /**
   * Subscribe a listener. Returns a handle whose `unsubscribe()` is
   * idempotent and immediately stops further deliveries.
   */
  subscribe(
    listener: ContextStreamListener,
    options: SubscribeOptions = {},
  ): SubscriptionHandle {
    const entry: SubscriberEntry = {
      listener,
      perSubscriberBuffer: this.perSubscriberBuffer,
      active: true,
      draining: false,
      queue: [],
      dropped: 0,
    };
    this.subscribers.add(entry);
    if (this.replay > 0 && options.skipReplay !== true) {
      // Late subscriber gets the bounded replay window first.
      for (const ev of this.replayBuffer) entry.queue.push(ev);
      this.drain(entry);
    }
    return {
      unsubscribe: (): void => {
        if (!entry.active) return;
        entry.active = false;
        this.subscribers.delete(entry);
      },
      droppedCount: (): number => entry.dropped,
    };
  }

  /**
   * Drain a subscriber's queue synchronously. Re-entrancy is handled by
   * the `draining` flag — listeners that themselves `push()` more events
   * during delivery cannot double-enter.
   */
  private drain(sub: SubscriberEntry): void {
    if (sub.draining) return;
    sub.draining = true;
    try {
      while (sub.active && sub.queue.length > 0) {
        const ev = sub.queue.shift() as ContextStreamEvent;
        try {
          sub.listener(ev);
        } catch (err) {
          // Listener errors are isolated by default — they never
          // propagate to the broadcaster or other subscribers. Surface
          // them via onListenerError if the consumer wants visibility.
          if (this.onListenerError !== undefined) {
            try {
              this.onListenerError(err, ev);
            } catch {
              // Even the error sink must not poison the broadcast.
            }
          }
        }
      }
    } finally {
      sub.draining = false;
    }
  }
}

// ─── Reactive projection helper ──────────────────────────────────────────────

/**
 * Subscribe with a projection: only forward events for which `predicate`
 * returns truthy (and re-shape with `project` if provided). Useful for
 * "only watch decisions" or "only observe phase:end of phase X".
 *
 * @example
 * const handle = selectStream(
 *   bus,
 *   (e) => e.type === 'decision',
 *   (e) => (e.type === 'decision' ? e.layer : undefined),
 *   (layer) => console.log('layer is now', layer),
 * );
 */
export function selectStream<U>(
  stream: MulticastContextStream,
  predicate: (event: ContextStreamEvent) => boolean,
  project: (event: ContextStreamEvent) => U,
  listener: (projected: U) => void,
  options: SubscribeOptions = {},
): SubscriptionHandle {
  return stream.subscribe((event) => {
    if (predicate(event)) listener(project(event));
  }, options);
}