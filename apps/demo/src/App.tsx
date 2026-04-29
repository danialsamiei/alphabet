/**
 * @file App.tsx
 * @description
 * Alphabet Demo — interactive playground showing how the Adaptive Render
 * Layers SDK chooses a layer based on capability, accessibility, and
 * privacy signals.
 *
 * The demo never relies on real device detection; instead it lets the
 * user override every input to `useAdaptiveLayer` so the fallback
 * chain can be observed end-to-end without changing browsers.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AdaptiveSlot,
  AlphabetProvider,
  ConsentBanner,
  TransparencyNotice,
  Canvas2DLayer,
  Css3DLayer,
  StaticHtmlLayer,
  TextOnlyLayer,
  useAdaptiveLayer,
  useAlphabetContext,
  type AdaptiveLayer,
} from '@alphabet/ui';

type LocaleKey = 'en-US' | 'fa-IR' | 'ar-SA';

const LOCALES: ReadonlyArray<{ key: LocaleKey; label: string; dir: 'ltr' | 'rtl' }> = [
  { key: 'en-US', label: 'English (LTR)', dir: 'ltr' },
  { key: 'fa-IR', label: 'فارسی (RTL)', dir: 'rtl' },
  { key: 'ar-SA', label: 'العربية (RTL)', dir: 'rtl' },
];

interface DemoState {
  readonly forceLayer: AdaptiveLayer | 'auto';
  readonly webglEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly dnt: boolean;
  readonly gpc: boolean;
  readonly locale: LocaleKey;
  readonly viewportSimulated: 'auto' | 'narrow' | 'wide';
  readonly networkType: 'auto' | '4g' | '3g' | '2g' | 'slow-2g';
}

const INITIAL_STATE: DemoState = {
  forceLayer: 'auto',
  webglEnabled: true,
  reducedMotion: false,
  dnt: false,
  gpc: false,
  locale: 'en-US',
  viewportSimulated: 'auto',
  networkType: 'auto',
};

export function App(): JSX.Element {
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const localeMeta = LOCALES.find((l) => l.key === state.locale) ?? LOCALES[0]!;

  // Reflect locale + direction on the document so RTL CSS applies.
  useEffect(() => {
    document.documentElement.lang = localeMeta.key;
    document.documentElement.dir = localeMeta.dir;
  }, [localeMeta]);

  return (
    <AlphabetProvider
      consent={{
        privacySignals: { dntEnabled: state.dnt, gpcEnabled: state.gpc },
      }}
    >
      <DemoShell state={state} setState={setState} localeDir={localeMeta.dir} localeKey={localeMeta.key} />
    </AlphabetProvider>
  );
}

interface ShellProps {
  readonly state: DemoState;
  readonly setState: (next: DemoState) => void;
  readonly localeDir: 'ltr' | 'rtl';
  readonly localeKey: LocaleKey;
}

function DemoShell({ state, setState, localeDir, localeKey }: ShellProps): JSX.Element {
  const ctx = useAlphabetContext();
  // AlphabetProvider is always the parent here, so ctx is non-null. Fall back
  // gracefully just in case the demo is restructured in the future.
  if (ctx === null) throw new Error('DemoShell must be wrapped in AlphabetProvider');
  const { consent } = ctx;

  // Compute the effective overrides we hand to AdaptiveSlot / Transparency.
  const layerOptions = useMemo<Parameters<typeof useAdaptiveLayer>[0]>(
    () => ({
      reducedMotionOverride: state.reducedMotion,
      webglSupportedOverride: state.webglEnabled,
      ...(state.forceLayer !== 'auto' ? { forceLayer: state.forceLayer } : {}),
      ...(state.viewportSimulated === 'narrow' ? { viewportWidthOverride: 480 } : {}),
      ...(state.viewportSimulated === 'wide' ? { viewportWidthOverride: 1440 } : {}),
      ...(state.networkType !== 'auto' ? { networkTypeOverride: state.networkType } : {}),
    }),
    [state]
  );

  const liveLayer = useAdaptiveLayer(layerOptions);

  const update = <K extends keyof DemoState>(key: K, value: DemoState[K]): void =>
    setState({ ...state, [key]: value });

  return (
    <div className="alphabet-shell" dir={localeDir} lang={localeKey}>
      <header>
        <h1>Alphabet — Adaptive Render Layers</h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--alphabet-muted)' }}>
          Live demo of <code>@alphabet/ui</code>. Toggle the inputs below to see how the
          layer-selector picks a render layer and explains its choice.
        </p>
        <p style={{ margin: '0.5rem 0 0' }}>
          Current layer: <span className="alphabet-current-layer">{liveLayer.layer}</span>
          {' '}· Reason code:{' '}
          <span className="alphabet-current-layer">{liveLayer.reasonCode}</span>
        </p>
      </header>

      <fieldset className="alphabet-toggles">
        <legend style={{ padding: '0 0.5rem', fontWeight: 600 }}>Simulation toggles</legend>

        <label>
          Force layer
          <select
            value={state.forceLayer}
            onChange={(e) => update('forceLayer', e.target.value as DemoState['forceLayer'])}
          >
            <option value="auto">auto (use selector)</option>
            <option value="R3F_IMMERSIVE">R3F_IMMERSIVE</option>
            <option value="CSS_3D">CSS_3D</option>
            <option value="CANVAS_2D">CANVAS_2D</option>
            <option value="STATIC_HTML">STATIC_HTML</option>
            <option value="TEXT_ONLY">TEXT_ONLY</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.webglEnabled}
            onChange={(e) => update('webglEnabled', e.target.checked)}
          />
          WebGL available
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.reducedMotion}
            onChange={(e) => update('reducedMotion', e.target.checked)}
          />
          Prefer reduced motion
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.dnt}
            onChange={(e) => update('dnt', e.target.checked)}
          />
          DNT (Do Not Track)
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.gpc}
            onChange={(e) => update('gpc', e.target.checked)}
          />
          GPC (Global Privacy Control)
        </label>

        <label>
          Language / direction
          <select
            value={state.locale}
            onChange={(e) => update('locale', e.target.value as LocaleKey)}
          >
            {LOCALES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Simulated viewport
          <select
            value={state.viewportSimulated}
            onChange={(e) =>
              update('viewportSimulated', e.target.value as DemoState['viewportSimulated'])
            }
          >
            <option value="auto">auto</option>
            <option value="narrow">narrow (480px)</option>
            <option value="wide">wide (1440px)</option>
          </select>
        </label>

        <label>
          Network
          <select
            value={state.networkType}
            onChange={(e) =>
              update('networkType', e.target.value as DemoState['networkType'])
            }
          >
            <option value="auto">auto</option>
            <option value="4g">4g</option>
            <option value="3g">3g</option>
            <option value="2g">2g</option>
            <option value="slow-2g">slow-2g</option>
          </select>
        </label>

        <label>
          Consent tier
          <select
            value={consent.tier}
            onChange={(e) => {
              const next = e.target.value as 'NO_MEMORY' | 'ANONYMOUS' | 'CONSENTED' | 'ENRICHED';
              if (next === 'NO_MEMORY') consent.revoke();
              else consent.grant(next, ['personalization']);
            }}
          >
            <option value="NO_MEMORY">NO_MEMORY</option>
            <option value="ANONYMOUS">ANONYMOUS</option>
            <option value="CONSENTED">CONSENTED</option>
            <option value="ENRICHED">ENRICHED</option>
          </select>
        </label>
      </fieldset>

      <TransparencyNotice {...layerOptions} />

      <section aria-label="Adaptive render output" className="alphabet-render-host">
        <AdaptiveSlot
          {...layerOptions}
          r3fFallback={
            <div style={{ padding: '1.5rem' }}>Loading immersive layer…</div>
          }
          r3f={(ctx) => (
            <div
              style={{
                padding: '1.5rem',
                color: '#f8fafc',
                background:
                  'radial-gradient(circle at 30% 20%, #1e1b4b 0%, #020617 100%)',
                minHeight: '20rem',
              }}
              dir={ctx.direction}
            >
              <h2 style={{ margin: 0 }}>R3F Immersive (placeholder)</h2>
              <p>
                In a real app the lazy bundle would mount an <code>@react-three/fiber</code>{' '}
                <code>Canvas</code>. The base bundle does not include R3F.
              </p>
            </div>
          )}
          css3d={(ctx) => (
            <Css3DLayer
              heading="CSS 3D layer"
              description="Hardware-accelerated CSS transforms with no JavaScript animation loop."
              direction={ctx.direction}
              {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
            />
          )}
          canvas2d={(ctx) => (
            <Canvas2DLayer
              heading="Canvas 2D layer"
              description="Lightweight 2D canvas — initialized lazily after mount."
              direction={ctx.direction}
              {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
            />
          )}
          staticHtml={(ctx) => (
            <StaticHtmlLayer
              heading="Static HTML layer"
              description="Semantic HTML with no animation. Preferred when reduced-motion is set."
              direction={ctx.direction}
              {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
            />
          )}
          textOnly={(ctx) => (
            <TextOnlyLayer
              heading="Text-only layer"
              description="ARIA landmarks, skip-link, and minimal styling for screen readers."
              direction={ctx.direction}
              {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
            />
          )}
        />
      </section>

      <p className="alphabet-footer-note">
        DNT / GPC do <strong>not</strong> downgrade the visual layer — they only restrict
        consent and personalization. Verify it by toggling DNT with a high-capability layer
        active.
      </p>

      <ConsentBanner showEnriched onChange={() => undefined} />
    </div>
  );
}
