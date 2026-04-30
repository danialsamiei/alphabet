/**
 * @file AlphabetDemo.tsx
 * @description
 * The embeddable public surface of the danial.ai Edition demo.
 *
 * Drop `<AlphabetDemo />` into any React tree on danial.ai (or any other
 * host page) and you get the entire Alphabet showcase: hero, six
 * interactive sections, the Invisible Alef Agent, and the consent banner.
 *
 * The component owns its own AlphabetProvider, LayerProvider, and CSS
 * — it expects the caller to import the styles via:
 *
 * ```ts
 * import '@alphabet/danial-demo/styles';   // or copy the CSS bundle
 * ```
 *
 * **Props are intentionally minimal** so the embed remains stable:
 *  - `defaultTab` — pick the section the user lands on
 *  - `compact`    — hide the toggles fieldset for tighter layouts
 *  - `showHero`   — set to `false` if the host page has its own hero
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlphabetProvider, ConsentBanner, LayerProvider, useLayer } from '@alphabet/ui';
import type { CapabilityLayer } from '@alphabet/ui';
import { ConsentLadderExperience } from './experiences/ConsentLadderExperience.js';
import { ContextDashboardExperience } from './experiences/ContextDashboardExperience.js';
import { LayerSwitcherExperience } from './experiences/LayerSwitcherExperience.js';
import { ProtocolPlaygroundExperience } from './experiences/ProtocolPlaygroundExperience.js';
import { TrustPulseExperience } from './experiences/TrustPulseExperience.js';
import { TelemetryDashboardExperience } from './experiences/TelemetryDashboardExperience.js';
import { pushTelemetry } from './telemetry.js';
import { LivingMemoryExperience } from './experiences/LivingMemoryExperience.js';
import { Hero } from './components/Hero.js';
import { AlefAgent, type AlefSuggestion, type AlefSuggestionAction } from './components/AlefAgent.js';

type LocaleKey = 'en-US' | 'fa-IR' | 'ar-SA';

const LOCALES: ReadonlyArray<{
  key: LocaleKey;
  label: string;
  dir: 'ltr' | 'rtl';
}> = [
  { key: 'en-US', label: 'English (LTR)', dir: 'ltr' },
  { key: 'fa-IR', label: 'فارسی (RTL)', dir: 'rtl' },
  { key: 'ar-SA', label: 'العربية (RTL)', dir: 'rtl' },
];

interface DemoState {
  readonly webglEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly dnt: boolean;
  readonly gpc: boolean;
  readonly locale: LocaleKey;
  readonly viewportSimulated: 'auto' | 'narrow' | 'wide';
  readonly networkType: 'auto' | '4g' | '3g' | '2g' | 'slow-2g';
  readonly theme: 'auto' | 'light' | 'dark';
}

const INITIAL_STATE: DemoState = {
  webglEnabled: true,
  reducedMotion: false,
  dnt: false,
  gpc: false,
  locale: 'en-US',
  viewportSimulated: 'auto',
  networkType: 'auto',
  theme: 'auto',
};

export type AlphabetDemoTab =
  | 'layers'
  | 'consent'
  | 'context'
  | 'trust'
  | 'memory'
  | 'protocols'
  | 'telemetry';

const TABS: ReadonlyArray<{
  readonly id: AlphabetDemoTab;
  readonly label: string;
  readonly description: string;
}> = [
  { id: 'layers',    label: 'Render Layers', description: 'Adaptive Render Layers with manual override.' },
  { id: 'context',   label: 'Context',       description: 'Real-time handshake stream + signal dashboard.' },
  { id: 'consent',   label: 'Consent',       description: 'Interactive consent ladder with live event log.' },
  { id: 'trust',     label: 'Trust Pulse',   description: 'Live privacy score, signals used, memory tier.' },
  { id: 'memory',    label: 'Living Memory', description: 'Six on-device memory domains with consent gating.' },
  { id: 'protocols', label: 'AI Protocols',  description: 'Offline AI protocol playground.' },
  { id: 'telemetry', label: 'Telemetry', description: 'Non-PII aggregate telemetry dashboard.' },
];

export interface AlphabetDemoProps {
  /** Which experience to land on. Defaults to `'layers'`. */
  readonly defaultTab?: AlphabetDemoTab;
  /** When `true`, hide the simulation toggles fieldset for tighter embeds. */
  readonly compact?: boolean;
  /**
   * When `false`, the hero is suppressed — useful if the host page has
   * its own hero and only wants to embed the interactive sections.
   * Defaults to `true`.
   */
  readonly showHero?: boolean;
  /**
   * When `true`, the floating Alef agent FAB is rendered. Defaults to
   * `true`.
   */
  readonly showAgent?: boolean;
}

/**
 * Embeddable Alphabet demo — the flagship public face of the SDK.
 *
 * @example
 * import { AlphabetDemo } from '@alphabet/danial-demo';
 * import '@alphabet/danial-demo/styles';
 *
 * export default function Page() {
 *   return <AlphabetDemo defaultTab="layers" />;
 * }
 */
export function AlphabetDemo(props: AlphabetDemoProps = {}): JSX.Element {
  const { defaultTab = 'layers', compact = false, showHero = true, showAgent = true } = props;
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const localeMeta = LOCALES.find((l) => l.key === state.locale) ?? LOCALES[0]!;

  useEffect(() => {
    document.documentElement.lang = localeMeta.key;
    document.documentElement.dir = localeMeta.dir;
    if (state.theme === 'auto') {
      document.documentElement.removeAttribute('data-alphabet-theme');
    } else {
      document.documentElement.setAttribute('data-alphabet-theme', state.theme);
    }
  }, [localeMeta, state.theme]);

  const layerProviderProps = useMemo(
    () => ({
      reducedMotionOverride: state.reducedMotion,
      webglSupportedOverride: state.webglEnabled,
      ...(state.viewportSimulated === 'narrow'
        ? { viewportWidthOverride: 480 }
        : state.viewportSimulated === 'wide'
          ? { viewportWidthOverride: 1440 }
          : {}),
      ...(state.networkType !== 'auto'
        ? { networkTypeOverride: state.networkType }
        : {}),
      children: null,
    }),
    [state.reducedMotion, state.webglEnabled, state.viewportSimulated, state.networkType],
  );

  return (
    <AlphabetProvider
      consent={{
        privacySignals: { dntEnabled: state.dnt, gpcEnabled: state.gpc },
      }}
    >
      <LayerProvider {...layerProviderProps}>
        <Shell
          state={state}
          setState={setState}
          localeMeta={localeMeta}
          defaultTab={defaultTab}
          compact={compact}
          showHero={showHero}
          showAgent={showAgent}
        />
      </LayerProvider>
    </AlphabetProvider>
  );
}

interface ShellProps {
  readonly state: DemoState;
  readonly setState: (next: DemoState) => void;
  readonly localeMeta: { key: LocaleKey; label: string; dir: 'ltr' | 'rtl' };
  readonly defaultTab: AlphabetDemoTab;
  readonly compact: boolean;
  readonly showHero: boolean;
  readonly showAgent: boolean;
}

function Shell({
  state,
  setState,
  localeMeta,
  defaultTab,
  compact,
  showHero,
  showAgent,
}: ShellProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AlphabetDemoTab>(defaultTab);
  const layer = useLayer();
  const tabPanelId = useId();

  useEffect(() => {
    pushTelemetry({ event: 'layer_selected', at: Date.now(), layer: layer.layer, reasonCode: layer.reasonCode, source: 'ui-layer-provider' });
  }, [layer.layer, layer.reasonCode]);

  const update = useCallback(
    <K extends keyof DemoState>(key: K, value: DemoState[K]): void =>
      setState({ ...state, [key]: value }),
    [setState, state],
  );

  const jumpToDemo = useCallback((): void => {
    const el = document.getElementById('alphabet-demo-experience');
    if (el !== null) {
      el.scrollIntoView({
        behavior: state.reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      el.focus({ preventScroll: true });
    }
  }, [state.reducedMotion]);

  // Suggestions are derived from the current state. The Alef agent
  // never reads private state — only what's visible in the UI already.
  const suggestions = useMemo<ReadonlyArray<AlefSuggestion>>(() => {
    const list: AlefSuggestion[] = [];
    if (layer.layer === 'R3F_IMMERSIVE' && state.networkType === '2g') {
      list.push({
        id: 'switch-canvas',
        title: 'Save battery on a slow network?',
        body: 'I can drop to Canvas 2D — same content, much lighter.',
        actions: [
          {
            label: 'Switch to Canvas 2D',
            primary: true,
            action: { kind: 'switch-layer', to: 'CANVAS_2D' },
          },
          { label: 'Stay immersive', action: { kind: 'dismiss' } },
        ],
      });
    }
    if (state.reducedMotion && layer.layer !== 'STATIC_HTML' && layer.layer !== 'TEXT_ONLY') {
      list.push({
        id: 'simplify-motion',
        title: 'Reduced motion is on',
        body: 'I can switch to a still, semantic layout that respects your preference.',
        actions: [
          {
            label: 'Switch to Static HTML',
            primary: true,
            action: { kind: 'switch-layer', to: 'STATIC_HTML' },
          },
          { label: 'Keep this layer', action: { kind: 'dismiss' } },
        ],
      });
    }
    if (state.dnt || state.gpc) {
      list.push({
        id: 'privacy-pulse',
        title: 'Privacy signals honored',
        body: 'You have DNT or GPC on. Your Trust Pulse score reflects that.',
        actions: [
          {
            label: 'See Trust Pulse',
            primary: true,
            action: { kind: 'jump-to-tab', tab: 'trust' },
          },
        ],
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'tour',
        title: 'Take the 30-second tour?',
        body: 'I can walk you through Layers → Consent → Trust Pulse.',
        actions: [
          {
            label: 'Start tour',
            primary: true,
            action: { kind: 'jump-to-tab', tab: 'layers' },
          },
          { label: 'Skip', action: { kind: 'dismiss' } },
        ],
      });
    }
    return list;
  }, [layer.layer, state.dnt, state.gpc, state.networkType, state.reducedMotion]);

  const handleAlefAction = useCallback(
    (action: AlefSuggestionAction): void => {
      if (action.kind === 'switch-layer') {
        layer.setOverride(action.to as CapabilityLayer);
      } else if (action.kind === 'jump-to-tab') {
        const known = TABS.find((t) => t.id === action.tab);
        if (known !== undefined) {
          setActiveTab(known.id);
          jumpToDemo();
        }
      }
    },
    [jumpToDemo, layer],
  );

  return (
    <div className="alf-app" dir={localeMeta.dir} lang={localeMeta.key}>
      <a className="alf-skip-link" href="#alphabet-demo-experience">
        Skip to demo experiences
      </a>

      {showHero ? (
        <Hero
          reducedMotion={state.reducedMotion}
          webglEnabled={state.webglEnabled}
          onJumpToDemo={jumpToDemo}
          localeKey={localeMeta.key}
        />
      ) : null}

      <main className="alphabet-shell" id="alphabet-demo-experience" tabIndex={-1}>
        {compact ? null : (
          <fieldset className="alf-toggles">
            <legend>Simulation toggles</legend>

            <label className="alf-toggle-row">
              <input
                type="checkbox"
                checked={state.webglEnabled}
                onChange={(e) => update('webglEnabled', e.target.checked)}
              />
              WebGL available
            </label>

            <label className="alf-toggle-row">
              <input
                type="checkbox"
                checked={state.reducedMotion}
                onChange={(e) => update('reducedMotion', e.target.checked)}
              />
              Reduced motion
            </label>

            <label className="alf-toggle-row">
              <input
                type="checkbox"
                checked={state.dnt}
                onChange={(e) => update('dnt', e.target.checked)}
              />
              DNT
            </label>

            <label className="alf-toggle-row">
              <input
                type="checkbox"
                checked={state.gpc}
                onChange={(e) => update('gpc', e.target.checked)}
              />
              GPC
            </label>

            <label>
              Language
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
              Theme
              <select
                value={state.theme}
                onChange={(e) =>
                  update('theme', e.target.value as DemoState['theme'])
                }
              >
                <option value="auto">auto</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>

            <label>
              Viewport
              <select
                value={state.viewportSimulated}
                onChange={(e) =>
                  update(
                    'viewportSimulated',
                    e.target.value as DemoState['viewportSimulated'],
                  )
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
                  update(
                    'networkType',
                    e.target.value as DemoState['networkType'],
                  )
                }
              >
                <option value="auto">auto</option>
                <option value="4g">4g</option>
                <option value="3g">3g</option>
                <option value="2g">2g</option>
                <option value="slow-2g">slow-2g</option>
              </select>
            </label>
          </fieldset>
        )}

        <section className="alf-section" aria-labelledby="alf-section-title">
          <header className="alf-section-head">
            <span className="alf-section-eyebrow">Showcase</span>
            <h2 className="alf-section-title" id="alf-section-title">
              Six interactive proofs of Alphabet
            </h2>
            <p className="alf-section-lead">
              Every section runs against the real <code>@alphabet/core</code>,{' '}
              <code>@alphabet/ui</code>, <code>@alphabet/api</code>, and{' '}
              <code>@alphabet/protocols</code> packages — no mock screenshots,
              no hand-waving. Resize the window, toggle DNT, change consent
              tiers, and watch the system adapt in real time.
            </p>
          </header>

          <div
            className="alf-tablist"
            role="tablist"
            aria-label="Demo experiences"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`alphabet-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`${tabPanelId}-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`${tabPanelId}-${activeTab}`}
            aria-labelledby={`alphabet-tab-${activeTab}`}
            className="alf-tabpanel"
            tabIndex={0}
          >
            {activeTab === 'layers' ? (
              <LayerSwitcherExperience
                reducedMotion={state.reducedMotion}
                webglEnabled={state.webglEnabled}
                viewportSimulated={state.viewportSimulated}
                networkType={state.networkType}
                localeKey={localeMeta.key}
                localeDir={localeMeta.dir}
              />
            ) : null}
            {activeTab === 'consent' ? <ConsentLadderExperience /> : null}
            {activeTab === 'context' ? <ContextDashboardExperience /> : null}
            {activeTab === 'trust' ? (
              <TrustPulseExperience currentLayer={layer.layer} />
            ) : null}
            {activeTab === 'memory' ? <LivingMemoryExperience /> : null}
            {activeTab === 'protocols' ? <ProtocolPlaygroundExperience /> : null}
            {activeTab === 'telemetry' ? <TelemetryDashboardExperience /> : null}
          </div>
        </section>

        <footer className="alf-footer">
          <p style={{ margin: 0 }}>
            DNT / GPC do <strong>not</strong> downgrade the visual layer —
            they only restrict consent and personalization. Verify it by
            toggling DNT with a high-capability layer active.
          </p>
          <p style={{ margin: 0 }}>
            Alphabet 1.0 (danial.ai Edition) · Built by{' '}
            <a href="https://danial.ai" rel="noopener noreferrer" target="_blank">
              Danial Samiei
            </a>{' '}
            · Part of the{' '}
            <a href="https://alef.ba" rel="noopener noreferrer" target="_blank">
              Alefba International AI R&amp;D Program
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/danialsamiei/alphabet"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </p>
        </footer>
      </main>

      {showAgent ? (
        <AlefAgent
          suggestions={suggestions}
          onAction={handleAlefAction}
          localeKey={localeMeta.key}
        />
      ) : null}

      <ConsentBanner showEnriched onChange={() => undefined} />
    </div>
  );
}
