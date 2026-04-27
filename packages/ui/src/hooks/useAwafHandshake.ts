/**
 * @module hooks/useAwafHandshake
 * @description
 * Hook برای اجرای یا مصرف نتیجه Context Handshake.
 *
 * Two modes:
 *  - "consume": pass a pre-computed `HandshakeDecision` (typical for SSR
 *    or when the server runs the handshake). The hook simply exposes it.
 *  - "auto": no decision passed → run `SignalCollector` +
 *    `EnrichmentPipeline` + `HandshakeDecisionEngine` locally on the
 *    client after mount. Stays SSR-safe.
 */

import { useEffect, useState } from 'react';
import {
  SignalCollector,
  EnrichmentPipeline,
  HandshakeDecisionEngine,
} from '@awaf/core';
import type {
  HandshakeDecision,
  DetectedSignals,
  EnrichedContext,
  VisitorId,
} from '@awaf/core';
import { isBrowser } from '../runtime/hydration-safe.js';
import { mark } from '../runtime/performance-marks.js';

/** وضعیت handshake. */
export type HandshakeStatus = 'idle' | 'running' | 'ready' | 'error';

/** خروجی hook. */
export interface UseAwafHandshakeReturn {
  readonly status: HandshakeStatus;
  readonly decision: HandshakeDecision | null;
  readonly signals: DetectedSignals | null;
  readonly enriched: EnrichedContext | null;
  readonly error: string | null;
  /** اجرای دوباره handshake (مثلاً پس از تغییر toggleهای دمو). */
  readonly refresh: () => void;
}

/** ورودی hook. */
export interface UseAwafHandshakeOptions {
  /**
   * snapshot از پیش محاسبه‌شده — اگر مقدار داشت، hook همان را
   * منتشر می‌کند و هیچ detection محلی انجام نمی‌دهد.
   */
  readonly decision?: HandshakeDecision;
  /** visitor id موجود (در غیر این صورت یک placeholder تولید می‌شود). */
  readonly visitorId?: VisitorId;
  /**
   * Override برای SignalCollector — مفید در دمو/تست برای شبیه‌سازی
   * WebGL unavailable، reduced-motion، DNT/GPC، و غیره.
   */
  readonly collectorOverrides?: ConstructorParameters<typeof SignalCollector>[0];
  /** اگر `true`، حتی روی client به‌صورت خودکار اجرا نشود. */
  readonly skipAutoRun?: boolean;
}

const PLACEHOLDER_VISITOR: VisitorId = 'v-anonymous-ssr' as VisitorId;

/**
 * Hook اصلی.
 *
 * @example
 * // Auto mode
 * const { decision, status } = useAwafHandshake();
 *
 * @example
 * // Consume mode (SSR-safe: server runs handshake, client hydrates).
 * const { decision } = useAwafHandshake({ decision: serverDecision });
 */
export function useAwafHandshake(
  options: UseAwafHandshakeOptions = {}
): UseAwafHandshakeReturn {
  const { decision: external, visitorId, collectorOverrides, skipAutoRun = false } = options;

  const [decision, setDecision] = useState<HandshakeDecision | null>(external ?? null);
  const [signals, setSignals] = useState<DetectedSignals | null>(null);
  const [enriched, setEnriched] = useState<EnrichedContext | null>(null);
  const [status, setStatus] = useState<HandshakeStatus>(external ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (external) {
      setDecision(external);
      setStatus('ready');
      return;
    }
    if (skipAutoRun || !isBrowser()) return;

    let cancelled = false;
    setStatus('running');
    setError(null);

    try {
      mark('handshake:start');
      const collector = new SignalCollector(collectorOverrides ?? {});
      const collectResult = collector.collect();
      if (!collectResult.success) {
        if (!cancelled) {
          setError(collectResult.error.message);
          setStatus('error');
        }
        return;
      }
      const collected = collectResult.data;
      const pipeline = new EnrichmentPipeline();
      const enrichedCtx = pipeline.enrich(collected, {
        visitorId: visitorId ?? PLACEHOLDER_VISITOR,
      });
      const engine = new HandshakeDecisionEngine();
      const result = engine.decide(enrichedCtx);
      mark('handshake:end');

      if (!cancelled) {
        setSignals(collected);
        setEnriched(enrichedCtx);
        setDecision(result);
        setStatus('ready');
      }
    } catch (e) {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }

    return () => {
      cancelled = true;
    };
  }, [external, skipAutoRun, visitorId, collectorOverrides, tick]);

  return {
    status,
    decision,
    signals,
    enriched,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
