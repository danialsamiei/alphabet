/**
 * @module components/AwafProvider
 * @description
 * Provider برای اشتراک‌گذاری handshake + consent در درخت React.
 * AWAF context provider — wires up the handshake and consent hooks
 * once at the root and exposes them via React context to any child
 * `AdaptiveSlot`, `ConsentBanner`, or `TransparencyNotice`.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useAwafHandshake,
  type UseAwafHandshakeOptions,
  type UseAwafHandshakeReturn,
} from '../hooks/useAwafHandshake.js';
import {
  useAwafConsent,
  type UseAwafConsentOptions,
  type UseAwafConsentReturn,
} from '../hooks/useAwafConsent.js';

/** قرارداد context — handshake + consent در یک object. */
export interface AwafContextValue {
  readonly handshake: UseAwafHandshakeReturn;
  readonly consent: UseAwafConsentReturn;
}

const AwafContext = createContext<AwafContextValue | null>(null);

export interface AwafProviderProps {
  readonly children: ReactNode;
  readonly handshake?: UseAwafHandshakeOptions;
  readonly consent?: UseAwafConsentOptions;
}

/**
 * Provider اصلی — یک بار در root درخت قرار می‌گیرد.
 *
 * @example
 * <AwafProvider>
 *   <AdaptiveSlot ... />
 * </AwafProvider>
 */
export function AwafProvider({
  children,
  handshake: handshakeOptions,
  consent: consentOptions,
}: AwafProviderProps): JSX.Element {
  const handshake = useAwafHandshake(handshakeOptions ?? {});
  const consent = useAwafConsent({
    ...(consentOptions ?? {}),
    privacySignals: {
      dntEnabled: handshake.signals?.dntEnabled === true,
      gpcEnabled: handshake.signals?.gpcEnabled === true,
    },
  });
  const value = useMemo<AwafContextValue>(() => ({ handshake, consent }), [handshake, consent]);
  return <AwafContext.Provider value={value}>{children}</AwafContext.Provider>;
}

/**
 * Hook دسترسی به AwafContext — اگر provider موجود نباشد، `null` برمی‌گرداند
 * تا کامپوننت‌ها بتوانند standalone هم استفاده شوند.
 */
export function useAwafContext(): AwafContextValue | null {
  return useContext(AwafContext);
}
