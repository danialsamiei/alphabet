/**
 * @file app/providers.tsx
 * @description
 * AWAF runs in the browser, so the provider must be a Client Component.
 * Wrap your tree once, here, and use AWAF's hooks/components below it.
 */
'use client';

import type { ReactNode } from 'react';
import { AwafProvider } from '@awaf/ui';

export function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
  return <AwafProvider>{children}</AwafProvider>;
}
