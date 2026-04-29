/**
 * @module components/ContextProvider
 * @description
 * `ContextProvider` — runs the Alphabet Context Handshake at mount and
 * exposes a **live event stream** of phase / decision / signal-update /
 * error events to descendants, alongside the resolved decision.
 *
 * Built directly on `@alphabet/core/handshake` (`SignalCollector`,
 * `EnrichmentPipeline`, `HandshakeDecisionEngine`) and the
 * `createContextStream` primitive from `@alphabet/core/handshake/stream`.
 * The full enriched context is *never* placed on the stream — only
 * PII-free derived values, per the privacy contract documented in
 * `context-stream.ts`.
 *
 * SSR-safe: detection runs only inside `useEffect`. During SSR /
 * pre-hydration, `decision` is `null` and `events` is an empty array.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  SignalCollector,
  EnrichmentPipeline,
  HandshakeDecisionEngine,
  stream,
} from '@alphabet/core';
import type {
  HandshakeDecision,
  DetectedSignals,
  EnrichedContext,
  VisitorId,
} from '@alphabet/core';

type ContextStreamEvent = ReturnType<
  typeof stream.createContextStream
>['stream'] extends ReadableStream<infer E>
  ? E
  : never;
type ContextStreamHandle = ReturnType<typeof stream.createContextStream>;
// Local alias — the type is structural, defined in @alphabet/core/handshake/stream.
type SignalSnapshot = Extract<
  ContextStreamEvent,
  { readonly type: 'signal-update' }
>['snapshot'];

const { createContextStream } = stream;
import { isBrowser } from '../runtime/hydration-safe.js';

/** PII-free public state surfaced to context consumers. */
export interface ContextProviderState {
  readonly status: 'idle' | 'running' | 'ready' | 'error';
  readonly decision: HandshakeDecision | null;
  /** Most recent PII-free signal snapshot pushed onto the stream. */
  readonly snapshot: SignalSnapshot | null;
  /** Append-only buffer of stream events (capped, see `eventBufferSize`). */
  readonly events: ReadonlyArray<ContextStreamEvent>;
  readonly error: string | null;
  /** Async iterable over fresh events — useful for `for await` consumers. */
  readonly subscribe: () => AsyncIterable<ContextStreamEvent>;
}

const ContextStreamContext = createContext<ContextProviderState | null>(null);

const PLACEHOLDER_VISITOR: VisitorId = 'v-anonymous-ssr' as VisitorId;
const DEFAULT_EVENT_BUFFER = 64;

export interface ContextProviderProps {
  readonly children: ReactNode;
  /** Override visitor id (otherwise an anonymous placeholder is used). */
  readonly visitorId?: VisitorId;
  /** Override `SignalCollector` constructor options (useful for demos). */
  readonly collectorOverrides?: ConstructorParameters<typeof SignalCollector>[0];
  /** Cap on the in-memory event buffer. Older events are dropped FIFO. */
  readonly eventBufferSize?: number;
  /**
   * If true, additionally emits `signal-update` events when reactive
   * browser signals (network type, prefers-reduced-motion, visibility,
   * battery) change. Off by default to keep the surface deterministic.
   */
  readonly liveSignals?: boolean;
}

/**
 * Provider — wires `SignalCollector` → `EnrichmentPipeline` →
 * `HandshakeDecisionEngine` and exposes the events through a
 * `createContextStream` so descendants can react in real time.
 */
export function ContextProvider(props: ContextProviderProps): JSX.Element {
  const {
    children,
    visitorId,
    collectorOverrides,
    eventBufferSize = DEFAULT_EVENT_BUFFER,
    liveSignals = false,
  } = props;

  const [status, setStatus] =
    useState<ContextProviderState['status']>('idle');
  const [decision, setDecision] = useState<HandshakeDecision | null>(null);
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [events, setEvents] = useState<ContextStreamEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRef = useRef<ContextStreamHandle | null>(null);
  // `activeStream` is the stream that newer subscribers can `tee()` from
  // for `for await` consumption. We replace it on remount.
  const activeStreamRef = useRef<ReadableStream<ContextStreamEvent> | null>(
    null,
  );

  useEffect(() => {
    if (!isBrowser()) return undefined;

    let cancelled = false;
    const handle = createContextStream();
    handleRef.current = handle;

    // Tee the source stream: one branch fills the React state buffer, the
    // other is held alive for `subscribe()` calls. Without `tee()` only one
    // reader could ever be attached.
    const [internal, external] = handle.stream.tee();
    activeStreamRef.current = external;

    // Background reader → drives React state.
    void (async (): Promise<void> => {
      const reader = internal.getReader();
      try {
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) return;
          if (cancelled) return;
          if (value.type === 'decision') {
            // Already reflected via setDecision in the run() block; here we
            // only mirror it into the events buffer.
          }
          if (value.type === 'signal-update') {
            setSnapshot(value.snapshot);
          }
          setEvents((prev) => {
            const next = prev.length >= eventBufferSize
              ? prev.slice(prev.length - eventBufferSize + 1)
              : prev.slice();
            next.push(value);
            return next;
          });
        }
      } catch {
        /* stream errored — surfaced via 'error' events already */
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    })();

    setStatus('running');
    setError(null);
    setEvents([]);

    // The push parameter type `Omit<ContextStreamEvent, 'at'>` is a
    // non-distributive `Omit` on a discriminated union, which collapses
    // to the intersection of common keys. Wrap with a typed helper so
    // call-sites stay readable.
    const push = (e: ContextStreamEvent): void =>
      (handle.controller.push as (ev: ContextStreamEvent) => void)(e);

    const startedAt = performance.now();
    push({ type: 'phase:start', phase: 'collect', at: performance.now() });

    try {
      const collector = new SignalCollector(collectorOverrides ?? {});
      const collectResult = collector.collect();
      push({
        type: 'phase:end',
        phase: 'collect',
        durationMs: performance.now() - startedAt,
        at: performance.now(),
      });

      if (!collectResult.success) {
        const msg = collectResult.error.message;
        push({
          type: 'error',
          phase: 'collect',
          code: collectResult.error.code,
          message: msg,
          at: performance.now(),
        });
        setError(msg);
        setStatus('error');
        return undefined;
      }

      const enrichStart = performance.now();
      push({ type: 'phase:start', phase: 'enrich', at: enrichStart });
      const pipeline = new EnrichmentPipeline();
      const enriched: EnrichedContext = pipeline.enrich(collectResult.data, {
        visitorId: visitorId ?? PLACEHOLDER_VISITOR,
      });
      push({
        type: 'phase:end',
        phase: 'enrich',
        durationMs: performance.now() - enrichStart,
        at: performance.now(),
      });

      const decideStart = performance.now();
      push({ type: 'phase:start', phase: 'decide', at: decideStart });
      const engine = new HandshakeDecisionEngine();
      const result = engine.decide(enriched);
      push({
        type: 'phase:end',
        phase: 'decide',
        durationMs: performance.now() - decideStart,
        at: performance.now(),
      });
      push({
        type: 'decision',
        layer: result.selectedLayer,
        locale: result.uiConfig.locale,
        direction: result.uiConfig.direction,
        restricted: result.privacyMode.restricted,
        at: performance.now(),
      });

      setDecision(result);
      setStatus('ready');
      // Emit the initial snapshot derived from collected signals.
      const initialSnapshot: SignalSnapshot = pickSnapshot(collectResult.data);
      setSnapshot(initialSnapshot);
      push({
        type: 'signal-update',
        snapshot: initialSnapshot,
        at: performance.now(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push({
        type: 'error',
        code: 'HANDSHAKE_FAILED',
        message: msg,
        at: performance.now(),
      });
      setError(msg);
      setStatus('error');
    }

    // Live signal updates — only when explicitly enabled.
    let detachLive: (() => void) | undefined;
    if (liveSignals) {
      detachLive = attachLiveSignals(handle, setSnapshot);
    }

    return () => {
      cancelled = true;
      detachLive?.();
      handle.controller.close();
    };
    // collectorOverrides is intentionally referentially-stable when consumers
    // pass a memoized object; we still depend on it.
  }, [visitorId, collectorOverrides, eventBufferSize, liveSignals]);

  const subscribe = useMemo<ContextProviderState['subscribe']>(() => {
    return (): AsyncIterable<ContextStreamEvent> => {
      const stream = activeStreamRef.current;
      if (stream === null) {
        // Empty async iterable — safe no-op.
        return {
          async *[Symbol.asyncIterator](): AsyncIterableIterator<
            ContextStreamEvent
          > {
            // empty
          },
        };
      }
      // Tee again so each subscribe() returns its own independent reader.
      const [branch] = stream.tee();
      activeStreamRef.current = stream;
      return asyncIterableFromStream(branch);
    };
  }, []);

  const value = useMemo<ContextProviderState>(
    () => ({ status, decision, snapshot, events, error, subscribe }),
    [status, decision, snapshot, events, error, subscribe],
  );

  return (
    <ContextStreamContext.Provider value={value}>
      {children}
    </ContextStreamContext.Provider>
  );
}

/**
 * Hook to read the live `ContextProvider` state.
 *
 * @throws if used outside `<ContextProvider>`.
 */
export function useContextStream(): ContextProviderState {
  const ctx = useContext(ContextStreamContext);
  if (ctx === null) {
    throw new Error(
      'useContextStream must be used inside a <ContextProvider>',
    );
  }
  return ctx;
}

/** Optional variant — returns `null` outside the provider. */
export function useContextStreamOptional(): ContextProviderState | null {
  return useContext(ContextStreamContext);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickSnapshot(signals: DetectedSignals): SignalSnapshot {
  const out: Mutable<SignalSnapshot> = {};
  if (signals.networkType !== undefined) out.networkType = signals.networkType;
  if (signals.prefersReducedMotion !== undefined) {
    out.prefersReducedMotion = signals.prefersReducedMotion;
  }
  return out;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function attachLiveSignals(
  handle: ContextStreamHandle,
  setSnapshot: (s: SignalSnapshot) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const cleanups: Array<() => void> = [];

  const pushUpdate = (patch: SignalSnapshot): void => {
    (handle.controller.push as (e: ContextStreamEvent) => void)({
      type: 'signal-update',
      snapshot: patch,
      at: Date.now(),
    });
    setSnapshot(patch);
  };

  // prefers-reduced-motion
  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (): void =>
      pushUpdate({ prefersReducedMotion: mql.matches });
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      cleanups.push(() => mql.removeEventListener('change', onChange));
    }
  }

  // visibility
  const onVis = (): void =>
    pushUpdate({
      visibilityState: document.visibilityState === 'hidden' ? 'hidden' : 'visible',
    });
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

  // network
  const conn = (navigator as unknown as {
    connection?: { effectiveType?: string; addEventListener?: (t: string, h: () => void) => void; removeEventListener?: (t: string, h: () => void) => void };
  }).connection;
  if (conn !== undefined && typeof conn.addEventListener === 'function') {
    const onNet = (): void =>
      pushUpdate(
        conn.effectiveType !== undefined
          ? { networkType: conn.effectiveType }
          : {},
      );
    conn.addEventListener('change', onNet);
    cleanups.push(() => conn.removeEventListener?.('change', onNet));
  }

  return () => {
    for (const c of cleanups) {
      try {
        c();
      } catch {
        /* ignore */
      }
    }
  };
}

function asyncIterableFromStream<T>(
  stream: ReadableStream<T>,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      const reader = stream.getReader();
      const iter: AsyncIterableIterator<T> = {
        async next(): Promise<IteratorResult<T>> {
          const { value, done } = await reader.read();
          if (done) return { value: undefined as never, done: true };
          return { value: value as T, done: false };
        },
        async return(): Promise<IteratorResult<T>> {
          await reader.cancel();
          return { value: undefined as never, done: true };
        },
        [Symbol.asyncIterator](): AsyncIterableIterator<T> {
          return iter;
        },
      };
      return iter;
    },
  };
}
