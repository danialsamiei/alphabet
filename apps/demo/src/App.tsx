/**
 * @file App.tsx
 * @description
 * Alphabet demo shell — tabbed experience hosting four sub-experiences:
 *  1. Layer Switcher (existing immersive demo, polished + crossfade)
 *  2. Consent Ladder visualizer
 *  3. Real-time Context Dashboard
 *  4. AI Protocol Playground (offline mock server)
 *
 * Shared state (locale, simulated viewport, network, consent signals)
 * lives at the shell level so the tabs stay synchronised.
 */

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { AlphabetProvider, ConsentBanner } from '@alphabet/ui';
import { ConsentLadderExperience } from './experiences/ConsentLadderExperience.js';
import { ContextDashboardExperience } from './experiences/ContextDashboardExperience.js';
import { LayerSwitcherExperience } from './experiences/LayerSwitcherExperience.js';
import { ProtocolPlaygroundExperience } from './experiences/ProtocolPlaygroundExperience.js';

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

type TabId = 'layers' | 'consent' | 'context' | 'protocols';

const TABS: ReadonlyArray<{ id: TabId; label: string; description: string }> = [
  {
    id: 'layers',
    label: 'Layers',
    description: 'Adaptive render layers with manual override.',
  },
  {
    id: 'consent',
    label: 'Consent',
    description: 'Interactive consent ladder with live event log.',
  },
  {
    id: 'context',
    label: 'Context',
    description: 'Real-time handshake stream + signal dashboard.',
  },
  {
    id: 'protocols',
    label: 'Protocols',
    description: 'Offline AI protocol playground.',
  },
];

export function App(): JSX.Element {
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const localeMeta = LOCALES.find((l) => l.key === state.locale) ?? LOCALES[0]!;

  // Reflect locale + direction + theme on the document.
  useEffect(() => {
    document.documentElement.lang = localeMeta.key;
    document.documentElement.dir = localeMeta.dir;
    if (state.theme === 'auto') {
      document.documentElement.removeAttribute('data-alphabet-theme');
    } else {
      document.documentElement.setAttribute('data-alphabet-theme', state.theme);
    }
  }, [localeMeta, state.theme]);

  return (
    <AlphabetProvider
      consent={{
        privacySignals: { dntEnabled: state.dnt, gpcEnabled: state.gpc },
      }}
    >
      <DemoShell
        state={state}
        setState={setState}
        localeDir={localeMeta.dir}
        localeKey={localeMeta.key}
      />
    </AlphabetProvider>
  );
}

interface ShellProps {
  readonly state: DemoState;
  readonly setState: (next: DemoState) => void;
  readonly localeDir: 'ltr' | 'rtl';
  readonly localeKey: LocaleKey;
}

function DemoShell({
  state,
  setState,
  localeDir,
  localeKey,
}: ShellProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('layers');
  const headerStyle = useMemo<CSSProperties>(
    () => ({ display: 'grid', gap: '0.4rem' }),
    [],
  );

  const update = <K extends keyof DemoState>(
    key: K,
    value: DemoState[K],
  ): void => setState({ ...state, [key]: value });

  const tabPanelId = useId();

  return (
    <div className="alphabet-shell" dir={localeDir} lang={localeKey}>
      <header style={headerStyle}>
        <h1>Alphabet — The Alphabet of Your Web</h1>
        <p style={{ margin: 0, color: 'var(--alphabet-muted)' }}>
          Live demo of <code>@alphabet/ui</code>, <code>@alphabet/core</code>, and{' '}
          <code>@alphabet/api</code>'s offline mock server.
        </p>
      </header>

      <fieldset className="alphabet-toggles">
        <legend style={{ padding: '0 0.5rem', fontWeight: 600 }}>
          Simulation toggles
        </legend>

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
          Simulated viewport
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
      </fieldset>

      <div className="alphabet-tablist" role="tablist" aria-label="Demo experiences">
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
        className="alphabet-tabpanel"
        tabIndex={0}
      >
        {activeTab === 'layers' ? (
          <LayerSwitcherExperience
            reducedMotion={state.reducedMotion}
            webglEnabled={state.webglEnabled}
            viewportSimulated={state.viewportSimulated}
            networkType={state.networkType}
            localeKey={localeKey}
            localeDir={localeDir}
          />
        ) : null}
        {activeTab === 'consent' ? <ConsentLadderExperience /> : null}
        {activeTab === 'context' ? <ContextDashboardExperience /> : null}
        {activeTab === 'protocols' ? <ProtocolPlaygroundExperience /> : null}
      </div>

      <p className="alphabet-footer-note">
        DNT / GPC do <strong>not</strong> downgrade the visual layer — they
        only restrict consent and personalization. Verify it by toggling DNT
        with a high-capability layer active.
      </p>

      <ConsentBanner showEnriched onChange={() => undefined} />
    </div>
  );
}
