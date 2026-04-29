/**
 * @module components/AlphabetProvider
 * @description
 * Provider برای اشتراک‌گذاری handshake + consent در درخت React.
 * Alphabet context provider — wires up the handshake and consent hooks
 * once at the root and exposes them via React context to any child
 * `AdaptiveSlot`, `ConsentBanner`, or `TransparencyNotice`.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useAlphabetHandshake,
  type UseAlphabetHandshakeOptions,
  type UseAlphabetHandshakeReturn,
} from '../hooks/useAlphabetHandshake.js';
import {
  useAlphabetConsent,
  type UseAlphabetConsentOptions,
  type UseAlphabetConsentReturn,
} from '../hooks/useAlphabetConsent.js';

/** قرارداد context — handshake + consent در یک object. */
export interface AlphabetContextValue {
  readonly handshake: UseAlphabetHandshakeReturn;
  readonly consent: UseAlphabetConsentReturn;
}

const AlphabetContext = createContext<AlphabetContextValue | null>(null);

export interface AlphabetProviderProps {
  readonly children: ReactNode;
  readonly handshake?: UseAlphabetHandshakeOptions;
  readonly consent?: UseAlphabetConsentOptions;
}

/**
 * Provider اصلی — یک بار در root درخت قرار می‌گیرد.
 *
 * @example
 * <AlphabetProvider>
 *   <AdaptiveSlot ... />
 * </AlphabetProvider>
 */
export function AlphabetProvider({
  children,
  handshake: handshakeOptions,
  consent: consentOptions,
}: AlphabetProviderProps): JSX.Element {
  const handshake = useAlphabetHandshake(handshakeOptions ?? {});
  const consent = useAlphabetConsent({
    ...(consentOptions ?? {}),
    privacySignals: {
      dntEnabled: handshake.signals?.dntEnabled === true,
      gpcEnabled: handshake.signals?.gpcEnabled === true,
    },
  });
  const value = useMemo<AlphabetContextValue>(() => ({ handshake, consent }), [handshake, consent]);
  return <AlphabetContext.Provider value={value}>{children}</AlphabetContext.Provider>;
}

/**
 * Hook دسترسی به AlphabetContext — اگر provider موجود نباشد، `null` برمی‌گرداند
 * تا کامپوننت‌ها بتوانند standalone هم استفاده شوند.
 */
export function useAlphabetContext(): AlphabetContextValue | null {
  return useContext(AlphabetContext);
}
