/**
 * @module components/LayerProvider
 * @description
 * `LayerProvider` — runs `useAdaptiveLayer` once at the root of the tree
 * and exposes the resolved layer + manual override channel via React
 * context, so deep descendants can read/force the layer without
 * re-running detection.
 *
 * This is a **thin wrapper** around the existing `useAdaptiveLayer` hook
 * (which is the canonical layer-selection primitive). It does not replace
 * that hook; rather it dedupes the work and adds an imperative override
 * channel useful for demos, Storybook, and per-route forcing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CapabilityLayer } from '@alphabet/core';
import {
  useAdaptiveLayer,
  type UseAdaptiveLayerOptions,
  type UseAdaptiveLayerReturn,
} from '../hooks/useAdaptiveLayer.js';

/** Public shape of the LayerProvider context. */
export interface LayerContextValue extends UseAdaptiveLayerReturn {
  /** Currently active manual override (undefined = follow auto-detection). */
  readonly override: CapabilityLayer | undefined;
  /** Set or clear a manual override. Pass `undefined` to clear. */
  readonly setOverride: (next: CapabilityLayer | undefined) => void;
}

const LayerContext = createContext<LayerContextValue | null>(null);

export interface LayerProviderProps extends UseAdaptiveLayerOptions {
  readonly children: ReactNode;
  /** Initial manual override (rare — usually leave undefined). */
  readonly initialOverride?: CapabilityLayer;
}

/**
 * Provider that runs adaptive-layer detection once and shares the result.
 *
 * @example
 * <LayerProvider>
 *   <Header />
 *   <Main />
 * </LayerProvider>
 */
export function LayerProvider(props: LayerProviderProps): JSX.Element {
  const { children, initialOverride, ...layerOptions } = props;

  const [override, setOverride] = useState<CapabilityLayer | undefined>(
    initialOverride,
  );

  // Caller-provided forceLayer wins over override; otherwise override applies.
  const merged: UseAdaptiveLayerOptions = useMemo(
    () => ({
      ...layerOptions,
      ...(layerOptions.forceLayer !== undefined
        ? { forceLayer: layerOptions.forceLayer }
        : override !== undefined
          ? { forceLayer: override }
          : {}),
    }),
    [layerOptions, override],
  );

  const layer = useAdaptiveLayer(merged);

  const setOverrideStable = useCallback(
    (next: CapabilityLayer | undefined): void => {
      setOverride(next);
    },
    [],
  );

  const value = useMemo<LayerContextValue>(
    () => ({ ...layer, override, setOverride: setOverrideStable }),
    [layer, override, setOverrideStable],
  );

  return <LayerContext.Provider value={value}>{children}</LayerContext.Provider>;
}

/**
 * Hook to read the LayerProvider context.
 *
 * @throws if called outside a `LayerProvider`.
 */
export function useLayer(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (ctx === null) {
    throw new Error('useLayer must be used inside a <LayerProvider>');
  }
  return ctx;
}

/**
 * Optional variant — returns `null` outside a `LayerProvider` instead of
 * throwing. Useful for components that want to be usable both inside and
 * outside a provider.
 */
export function useLayerOptional(): LayerContextValue | null {
  return useContext(LayerContext);
}
