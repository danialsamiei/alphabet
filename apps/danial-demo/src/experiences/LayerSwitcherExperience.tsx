/**
 * @file experiences/LayerSwitcherExperience.tsx
 * @description
 * Adaptive Render Layer Switcher.
 *
 * Re-uses the existing demo controls but adds:
 * - A `<LayerProvider>` wrapping the rendered output, so the active
 *   layer is observable through `useLayer()`.
 * - A crossfade transition between layers (honouring
 *   `prefers-reduced-motion` via the design tokens).
 * - Manual override buttons that drive `setOverride` on the provider.
 */

import { useMemo } from 'react';
import {
  AdaptiveSlot,
  Canvas2DLayer,
  Css3DLayer,
  LayerProvider,
  StaticHtmlLayer,
  TextOnlyLayer,
  TransparencyNotice,
  useLayer,
  type AdaptiveLayer,
} from '@alphabet/ui';

const LAYERS: ReadonlyArray<AdaptiveLayer> = [
  'R3F_IMMERSIVE',
  'CSS_3D',
  'CANVAS_2D',
  'STATIC_HTML',
  'TEXT_ONLY',
];

interface LayerSwitcherProps {
  readonly reducedMotion: boolean;
  readonly webglEnabled: boolean;
  readonly viewportSimulated: 'auto' | 'narrow' | 'wide';
  readonly networkType: 'auto' | '4g' | '3g' | '2g' | 'slow-2g';
  readonly localeKey: string;
  readonly localeDir: 'ltr' | 'rtl';
}

export function LayerSwitcherExperience(props: LayerSwitcherProps): JSX.Element {
  const layerOptions = useMemo<Parameters<typeof LayerProvider>[0]>(
    () => ({
      reducedMotionOverride: props.reducedMotion,
      webglSupportedOverride: props.webglEnabled,
      ...(props.viewportSimulated === 'narrow'
        ? { viewportWidthOverride: 480 }
        : {}),
      ...(props.viewportSimulated === 'wide'
        ? { viewportWidthOverride: 1440 }
        : {}),
      ...(props.networkType !== 'auto'
        ? { networkTypeOverride: props.networkType }
        : {}),
      children: null,
    }),
    [props],
  );

  return (
    <LayerProvider {...layerOptions}>
      <LayerSwitcherInner {...props} />
    </LayerProvider>
  );
}

function LayerSwitcherInner(props: LayerSwitcherProps): JSX.Element {
  const { layer, reasonCode, override, setOverride } = useLayer();

  const slotProps = useMemo<Parameters<typeof AdaptiveSlot>[0]>(
    () => ({
      reducedMotionOverride: props.reducedMotion,
      webglSupportedOverride: props.webglEnabled,
      ...(props.viewportSimulated === 'narrow'
        ? { viewportWidthOverride: 480 }
        : {}),
      ...(props.viewportSimulated === 'wide'
        ? { viewportWidthOverride: 1440 }
        : {}),
      ...(props.networkType !== 'auto'
        ? { networkTypeOverride: props.networkType }
        : {}),
      ...(override !== undefined ? { forceLayer: override } : {}),
      r3fFallback: <div style={{ padding: '1.5rem' }}>Loading immersive…</div>,
      r3f: (ctx) => (
        <div
          dir={ctx.direction}
          style={{
            padding: '1.5rem',
            color: '#f8fafc',
            background:
              'radial-gradient(circle at 30% 20%, #1e1b4b 0%, #020617 100%)',
            minHeight: '20rem',
          }}
        >
          <h2 style={{ margin: 0 }}>R3F Immersive (placeholder)</h2>
          <p>
            The lazy bundle would mount an <code>@react-three/fiber</code>{' '}
            <code>Canvas</code> here. The base bundle stays R3F-free.
          </p>
        </div>
      ),
      css3d: (ctx) => (
        <Css3DLayer
          heading="CSS 3D layer"
          description="Hardware-accelerated CSS transforms with no JavaScript animation loop."
          direction={ctx.direction}
          {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
        />
      ),
      canvas2d: (ctx) => (
        <Canvas2DLayer
          heading="Canvas 2D layer"
          description="Lightweight 2D canvas — initialized lazily after mount."
          direction={ctx.direction}
          {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
        />
      ),
      staticHtml: (ctx) => (
        <StaticHtmlLayer
          heading="Static HTML layer"
          description="Semantic HTML with no animation. Preferred when reduced-motion is set."
          direction={ctx.direction}
          {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
        />
      ),
      textOnly: (ctx) => (
        <TextOnlyLayer
          heading="Text-only layer"
          description="ARIA landmarks, skip-link, and minimal styling for screen readers."
          direction={ctx.direction}
          {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
        />
      ),
    }),
    [props, override],
  );

  return (
    <div className="alphabet-experience">
      <p className="alphabet-muted-text" style={{ marginTop: 0 }}>
        Current layer: <span className="alphabet-current-layer">{layer}</span> ·
        Reason: <code>{reasonCode}</code>
        {override !== undefined ? ' (overridden)' : ''}
      </p>

      <div className="alphabet-layer-buttons" role="group" aria-label="Force layer">
        {LAYERS.map((l) => (
          <button
            key={l}
            type="button"
            className="alphabet-pill-btn"
            data-active={override === l ? 'true' : 'false'}
            onClick={() => setOverride(l)}
          >
            {l}
          </button>
        ))}
        <button
          type="button"
          className="alphabet-pill-btn"
          data-active={override === undefined ? 'true' : 'false'}
          onClick={() => setOverride(undefined)}
        >
          auto
        </button>
      </div>

      <TransparencyNotice {...slotProps} />

      <section
        aria-label="Adaptive render output"
        className="alphabet-render-host alphabet-crossfade"
        // Re-key on layer to retrigger the CSS fade animation.
        key={layer + (override ?? '')}
        dir={props.localeDir}
        lang={props.localeKey}
      >
        <AdaptiveSlot {...slotProps} />
      </section>
    </div>
  );
}
