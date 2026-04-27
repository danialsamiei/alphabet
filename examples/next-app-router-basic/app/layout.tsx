/**
 * @file app/layout.tsx
 * @description Root Next.js App Router layout. Mounts the AWAF provider.
 */
import type { ReactNode } from 'react';
import { Providers } from './providers.js';

export const metadata = {
  title: 'AWAF — Next.js App Router basic',
  description: 'Adaptive Web-Aware Framework demo on Next.js App Router.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
