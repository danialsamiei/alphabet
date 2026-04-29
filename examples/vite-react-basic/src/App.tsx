/**
 * @file App.tsx
 * @description
 * Minimal Alphabet example for Vite + React. Demonstrates:
 *   1. `AlphabetProvider` runs the handshake at the root.
 *   2. `<AdaptiveSlot>` chooses one of the five Adaptive Render Layers
 *      based on capability/accessibility (NOT privacy).
 *   3. `<ConsentBanner>` collects consent; Alphabet respects DNT/GPC.
 *   4. `<TransparencyNotice>` shows *why* the current layer was chosen.
 */
import { AdaptiveSlot, AlphabetProvider, ConsentBanner, TransparencyNotice } from '@alphabet/ui';

export function App(): JSX.Element {
  return (
    <AlphabetProvider>
      <main style={{ maxWidth: '40rem', margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Alphabet — Vite + React basic</h1>
        <p>
          Alphabet chooses a render layer from device capability and accessibility
          signals. DNT/GPC affect <em>storage</em>, not which layer is shown.
        </p>

        <AdaptiveSlot
          r3f={({ direction, locale }) => (
            <section dir={direction} lang={locale ?? undefined}>
              <h2>R3F immersive layer</h2>
              <p>
                On a capable device this is where you'd render a{' '}
                <code>@react-three/fiber</code> <code>&lt;Canvas&gt;</code>.
                The R3F renderer is loaded lazily by Alphabet, so the base
                bundle stays R3F-free.
              </p>
            </section>
          )}
          css3d={({ direction, locale }) => (
            <section dir={direction} lang={locale ?? undefined}>
              <h2>CSS 3D layer</h2>
              <p>This block has subtle CSS 3D affordances.</p>
            </section>
          )}
          canvas2d={({ direction, locale }) => (
            <section dir={direction} lang={locale ?? undefined}>
              <h2>Canvas 2D layer</h2>
              <p>Lower-power devices fall back to a 2D canvas presentation.</p>
            </section>
          )}
          staticHtml={({ direction, locale }) => (
            <section dir={direction} lang={locale ?? undefined}>
              <h2>Static HTML layer</h2>
              <p>Reduced-motion / SSR fallback.</p>
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
          description={
            <span>
              Alphabet can store anonymous session data so we can keep your
              language and layer choice across visits. You can change this
              at any time. We respect Do-Not-Track and Global Privacy Control.
            </span>
          }
          acceptLabel="Accept"
          rejectLabel="Reject"
        />
      </main>
    </AlphabetProvider>
  );
}
