/**
 * @file app/providers.tsx
 * @description
 * Alphabet runs in the browser, so the provider must be a Client Component.
 * Wrap your tree once, here, and use Alphabet's hooks/components below it.
 */
'use client';

import type { ReactNode } from 'react';
import { AlphabetProvider } from '@alphabet/ui';

export function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
  return <AlphabetProvider>{children}</AlphabetProvider>;
}
