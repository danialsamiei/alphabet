/**
 * @module runtime/hydration-safe
 * @description
 * SSR-safe helpers برای دسترسی ایمن به browser globals در React 18.
 * SSR-safe helpers for accessing browser globals in React 18.
 *
 * تمام helpers این فایل قبل از دسترسی به window/document/navigator
 * بررسی می‌کنند که runtime در browser است یا server.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * بررسی این‌که آیا runtime فعلی browser است.
 * Returns true if running in a browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Hook برای تشخیص hydration — در render اولیه (SSR یا قبل از hydration)
 * `false` برمی‌گرداند، پس از mount اولین بار `true` می‌شود.
 *
 * Avoids hydration mismatches by always returning `false` during the
 * initial server render and the first client render, then flipping to
 * `true` in a `useEffect` so any client-only branch only runs after
 * React has finished hydrating.
 */
export function useIsClient(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Subscriber type برای useMediaQuery داخلی.
 */
type MediaQueryStore = {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => boolean;
  getServerSnapshot: () => boolean;
};

/**
 * یک store ایجاد می‌کند که قابل استفاده توسط useSyncExternalStore باشد.
 * Creates a store for matchMedia that is SSR-safe.
 */
function createMediaQueryStore(query: string, ssrFallback: boolean): MediaQueryStore {
  return {
    subscribe: (cb) => {
      if (!isBrowser() || typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      const handler = (): void => cb();
      // Safari < 14 از addEventListener پشتیبانی نمی‌کند — fallback به addListener.
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      }
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    },
    getSnapshot: () => {
      if (!isBrowser() || typeof window.matchMedia !== 'function') return ssrFallback;
      try {
        return window.matchMedia(query).matches;
      } catch {
        return ssrFallback;
      }
    },
    getServerSnapshot: () => ssrFallback,
  };
}

/**
 * Hook برای reactive subscribe به یک media query — SSR-safe.
 * SSR-safe reactive media query hook. Returns `ssrFallback` during SSR
 * and the live `matches` value on the client.
 *
 * @example
 * const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string, ssrFallback = false): boolean {
  const store = createMediaQueryStore(query, ssrFallback);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/**
 * نسخه ایمن `window` — `undefined` در محیط server.
 */
export function safeWindow(): Window | undefined {
  return isBrowser() ? window : undefined;
}

/**
 * نسخه ایمن `document` — `undefined` در محیط server.
 */
export function safeDocument(): Document | undefined {
  return isBrowser() ? document : undefined;
}

/**
 * نسخه ایمن `navigator` — `undefined` در محیط server.
 */
export function safeNavigator(): Navigator | undefined {
  return typeof navigator !== 'undefined' ? navigator : undefined;
}
