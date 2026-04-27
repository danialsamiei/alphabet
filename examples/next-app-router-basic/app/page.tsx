/**
 * @file app/page.tsx
 * @description
 * Home page using AWAF AdaptiveSlot, ConsentBanner, TransparencyNotice.
 * The page itself is a Client Component because AWAF reads browser
 * APIs during the handshake; an alternative is to keep the page as a
 * Server Component and put the AWAF UI inside a child Client Component.
 */
'use client';

import { AdaptiveSlot, ConsentBanner, TransparencyNotice } from '@awaf/ui';

export default function HomePage(): JSX.Element {
  return (
    <main style={{ maxWidth: '40rem', margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>AWAF — Next.js App Router basic</h1>
      <p>
        AWAF picks a render layer from device capability and accessibility
        signals. DNT/GPC affect storage, not which layer is shown.
      </p>

      <AdaptiveSlot
        css3d={({ direction, locale }) => (
          <section dir={direction} lang={locale ?? undefined}>
            <h2>CSS 3D layer</h2>
            <p>Subtle 3D affordances; works without WebGL.</p>
          </section>
        )}
        canvas2d={({ direction, locale }) => (
          <section dir={direction} lang={locale ?? undefined}>
            <h2>Canvas 2D layer</h2>
            <p>Lower-power devices fall back to 2D.</p>
          </section>
        )}
        staticHtml={({ direction, locale }) => (
          <section dir={direction} lang={locale ?? undefined}>
            <h2>Static HTML layer</h2>
            <p>Reduced-motion / SSR fallback. Always rendered on the server.</p>
          </section>
        )}
        textOnly={({ direction, locale }) => (
          <section dir={direction} lang={locale ?? undefined}>
            <h2>Text-only layer</h2>
            <p>Screen-reader optimised, semantic HTML only.</p>
          </section>
        )}
      />

      <TransparencyNotice />
      <ConsentBanner
        title="Cookies & adaptive personalization"
        description="AWAF can store anonymous session data so we can keep your language and layer choice across visits. We respect Do-Not-Track and Global Privacy Control."
      />
    </main>
  );
}
