/**
 * @file src/components/AwafIsland.tsx
 * @description
 * The single React island that hosts AWAF for an Astro page. Keeping
 * AWAF inside one island means `useAwafHandshake` runs exactly once.
 */
import { AdaptiveSlot, AwafProvider, ConsentBanner, TransparencyNotice } from '@awaf/ui';

export default function AwafIsland(): JSX.Element {
  return (
    <AwafProvider>
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
            <p>Reduced-motion / SSR fallback. Always emitted by Astro at build time.</p>
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
    </AwafProvider>
  );
}
