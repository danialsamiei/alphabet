import { AdaptiveSlot, AwafProvider, ConsentBanner, TransparencyNotice } from '@awaf/ui';

export function App(): JSX.Element {
  return (
    <AwafProvider>
      <main style={{ maxWidth: '40rem', margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Welcome to AWAF</h1>
        <p>
          This page adapts itself to your device and accessibility preferences.
          Privacy signals (DNT/GPC) are honoured automatically.
        </p>

        <AdaptiveSlot
          css3d={() => <p>CSS 3D layer rendered.</p>}
          canvas2d={() => <p>Canvas 2D layer rendered.</p>}
          staticHtml={() => <p>Static HTML layer rendered.</p>}
          textOnly={() => <p>Text-only layer rendered.</p>}
        />

        <TransparencyNotice />
        <ConsentBanner />
      </main>
    </AwafProvider>
  );
}
