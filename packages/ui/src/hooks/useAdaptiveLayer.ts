/**
 * @module hooks/useAdaptiveLayer
 * @description
 * Hook اصلی انتخاب Adaptive Render Layer — ترکیب handshake + reactive
 * media queries (prefers-reduced-motion) + override caller.
 */

import { useMemo } from 'react';
import type { CapabilityLayer } from '@awaf/core';
import {
  selectAdaptiveLayer,
  type AdaptiveLayerInput,
  type AdaptiveLayerResult,
} from '../runtime/layer-selector.js';
import { isBrowser, useMediaQuery } from '../runtime/hydration-safe.js';
import { useAwafHandshake, type UseAwafHandshakeReturn } from './useAwafHandshake.js';

/** ورودی اختیاری برای override کردن inputهای layer-selector. */
export interface UseAdaptiveLayerOptions {
  /** override نتیجه handshake (consume mode). */
  readonly handshake?: UseAwafHandshakeReturn;
  /** Override برای `forceLayer` — برنامه می‌تواند یک layer را اجبار کند. */
  readonly forceLayer?: CapabilityLayer;
  /** Override برای `forceTextOnly` (مثلاً detection screen reader). */
  readonly forceTextOnly?: boolean;
  /** آیا R3F runtime در دسترس است. پیش‌فرض `true`. */
  readonly r3fAvailable?: boolean;
  /** Override صریح برای WebGL availability — مفید در تست/دمو. */
  readonly webglSupportedOverride?: boolean;
  /** Override صریح برای viewport width. */
  readonly viewportWidthOverride?: number;
  /** Override صریح برای network type. */
  readonly networkTypeOverride?: string;
  /** Override صریح برای reduced motion. */
  readonly reducedMotionOverride?: boolean;
}

/** خروجی — لایه انتخاب‌شده + جزئیات. */
export interface UseAdaptiveLayerReturn extends AdaptiveLayerResult {
  /** آیا تشخیص هنوز در حال اجرا است. */
  readonly isPending: boolean;
  /** جهت — از handshake decision استخراج می‌شود. */
  readonly direction: 'ltr' | 'rtl';
  /** locale جاری (در صورت موجود). */
  readonly locale: string | null;
  /** آیا DNT/GPC فعال است (جهت اطلاع‌رسانی، نه برای انتخاب لایه). */
  readonly privacySignalActive: boolean;
}

/**
 * Hook اصلی انتخاب لایه — SSR-safe.
 *
 * @example
 * const { layer, reason, direction } = useAdaptiveLayer();
 */
export function useAdaptiveLayer(options: UseAdaptiveLayerOptions = {}): UseAdaptiveLayerReturn {
  const {
    handshake: external,
    forceLayer,
    forceTextOnly,
    r3fAvailable = true,
    webglSupportedOverride,
    viewportWidthOverride,
    networkTypeOverride,
    reducedMotionOverride,
  } = options;

  // اگر handshake خارجی پاس داده شده، از آن استفاده می‌کنیم؛ در غیر این
  // صورت hook خودش handshake را اجرا می‌کند. توجه: hooks همیشه باید در
  // top level فراخوانی شوند، پس useAwafHandshake همیشه call می‌شود اما
  // وقتی external موجود است، حالت skip را روشن می‌کنیم.
  const internal = useAwafHandshake({ skipAutoRun: external !== undefined });
  const handshake = external ?? internal;

  const reactiveReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  const reducedMotion = reducedMotionOverride ?? reactiveReducedMotion;

  const result = useMemo<AdaptiveLayerResult>(() => {
    const signals = handshake.signals;
    const webgl =
      webglSupportedOverride !== undefined
        ? webglSupportedOverride
        : signals?.webglSupported;
    const viewport =
      viewportWidthOverride !== undefined
        ? viewportWidthOverride
        : signals?.screenWidth;
    const network =
      networkTypeOverride !== undefined ? networkTypeOverride : signals?.networkType;
    const input: AdaptiveLayerInput = {
      isBrowser: isBrowser(),
      r3fAvailable,
      prefersReducedMotion: reducedMotion,
      ...(forceLayer !== undefined ? { forceLayer } : {}),
      ...(forceTextOnly !== undefined ? { forceTextOnly } : {}),
      ...(webgl !== undefined ? { webglSupported: webgl } : {}),
      ...(viewport !== undefined ? { viewportWidth: viewport } : {}),
      ...(network !== undefined ? { networkType: network } : {}),
    };
    return selectAdaptiveLayer(input);
  }, [
    handshake.signals,
    r3fAvailable,
    reducedMotion,
    forceLayer,
    forceTextOnly,
    webglSupportedOverride,
    viewportWidthOverride,
    networkTypeOverride,
  ]);

  const direction: 'ltr' | 'rtl' = handshake.decision?.uiConfig.direction ?? 'ltr';
  const locale = handshake.decision?.uiConfig.locale ?? null;
  const privacySignalActive = handshake.decision?.privacyMode.restricted === true;

  return {
    ...result,
    isPending: handshake.status === 'running' || handshake.status === 'idle',
    direction,
    locale,
    privacySignalActive,
  };
}
