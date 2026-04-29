/**
 * @file experiences/TrustPulseExperience.tsx
 * @description
 * Trust Pulse Dashboard — a live privacy posture for the current visitor.
 *
 * Aggregates real signals from `useAlphabetContext()` (handshake +
 * consent) and the `<LayerProvider>` to render:
 *  - a 0–100 privacy score derived from consent tier, DNT/GPC, and the
 *    selected render layer,
 *  - the count and list of signals actually used in the decision,
 *  - the active memory tier and what is (or isn't) being persisted.
 *
 * The score is purely a function of public state — no telemetry is
 * collected from the user to compute it.
 */

import { useMemo } from 'react';
import { useAlphabetContext } from '@alphabet/ui';

interface TrustPulseProps {
  readonly currentLayer: string;
}

interface PrivacyScoreBreakdown {
  readonly base: number;
  readonly consentBonus: number;
  readonly privacySignalBonus: number;
  readonly layerBonus: number;
  readonly total: number;
}

const LAYER_PRIVACY_WEIGHT: Record<string, number> = {
  TEXT_ONLY: 14,
  STATIC_HTML: 12,
  CANVAS_2D: 10,
  CSS_3D: 8,
  R3F_IMMERSIVE: 6,
};

const TIER_LABELS: Record<string, string> = {
  NO_MEMORY: 'No memory',
  ANONYMOUS: 'Anonymous session',
  CONSENTED: 'Personalized profile',
  ENRICHED: 'Enriched experience',
};

const TIER_PERSISTS: Record<string, string> = {
  NO_MEMORY: 'Nothing — every click is forgotten the moment it ends.',
  ANONYMOUS: 'Locale, direction, and device class — only for this session.',
  CONSENTED: 'Preferences, theme, layer choice — locally on this device.',
  ENRICHED:
    'On-device behavioral patterns. Never leaves the browser, never sold.',
};

export function TrustPulseExperience({
  currentLayer,
}: TrustPulseProps): JSX.Element {
  const ctx = useAlphabetContext();
  if (ctx === null) {
    throw new Error('TrustPulseExperience must be inside an AlphabetProvider');
  }
  const { handshake, consent } = ctx;

  const breakdown = useMemo<PrivacyScoreBreakdown>(() => {
    // Base — the SDK starts at 50/100 because of zero-memory default.
    const base = 50;

    // Consent — opting in *lowers* score (more data persisted) but
    // explicit opt-in is itself privacy-preserving (verified consent
    // proof). Net: NO_MEMORY = +20, ANONYMOUS = +12, CONSENTED = +6,
    // ENRICHED = +0.
    const consentBonus =
      consent.tier === 'NO_MEMORY'
        ? 20
        : consent.tier === 'ANONYMOUS'
          ? 12
          : consent.tier === 'CONSENTED'
            ? 6
            : 0;

    // DNT/GPC bonus — honoring the signal is worth +8 each.
    const dnt = handshake.signals?.dntEnabled === true ? 8 : 0;
    const gpc = handshake.signals?.gpcEnabled === true ? 8 : 0;
    const privacySignalBonus = dnt + gpc;

    // Layer bonus — lower-fi layers leak less device fingerprint surface.
    const layerBonus = LAYER_PRIVACY_WEIGHT[currentLayer] ?? 0;

    const total = Math.max(
      0,
      Math.min(100, base + consentBonus + privacySignalBonus + layerBonus),
    );
    return { base, consentBonus, privacySignalBonus, layerBonus, total };
  }, [consent.tier, handshake.signals, currentLayer]);

  const signalsUsed = useMemo(() => {
    const s = handshake.signals;
    if (s === null) return [] as ReadonlyArray<string>;
    const list: string[] = [];
    list.push(`language = ${s.language}`);
    list.push(`tz = ${s.timezone}`);
    list.push(`device = ${s.deviceClass}`);
    if (typeof s.networkType === 'string')
      list.push(`network = ${s.networkType}`);
    list.push(`viewport ≈ ${s.screenWidth}px`);
    list.push(`webgl = ${s.webglSupported ? 'yes' : 'no'}`);
    list.push(`reduced-motion = ${s.prefersReducedMotion ? 'yes' : 'no'}`);
    if (s.dntEnabled) list.push('DNT honored');
    if (s.gpcEnabled) list.push('GPC honored');
    return list;
  }, [handshake.signals]);

  return (
    <div className="alphabet-experience alf-grid-3">
      {/* Privacy score */}
      <section
        className="alf-card alf-card-glow"
        aria-label="Live privacy score"
      >
        <div className="alf-stat">
          <span className="alf-stat-label">Privacy score</span>
          <span
            className="alf-stat-value"
            aria-live="polite"
            aria-atomic="true"
          >
            {breakdown.total} / 100
          </span>
        </div>
        <div
          className="alf-trust-meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={breakdown.total}
          aria-label="Privacy score"
        >
          <div
            className="alf-trust-meter-fill"
            style={{ width: `${breakdown.total}%` }}
          />
        </div>
        <dl className="alphabet-dl" style={{ fontSize: '0.85rem' }}>
          <div>
            <dt>Zero-memory baseline</dt>
            <dd>+{breakdown.base}</dd>
          </div>
          <div>
            <dt>Consent posture</dt>
            <dd>+{breakdown.consentBonus}</dd>
          </div>
          <div>
            <dt>DNT &amp; GPC honored</dt>
            <dd>+{breakdown.privacySignalBonus}</dd>
          </div>
          <div>
            <dt>Render layer</dt>
            <dd>+{breakdown.layerBonus}</dd>
          </div>
        </dl>
        <p className="alf-muted" style={{ fontSize: '0.82rem' }}>
          Computed locally from your current state — never sent to a server.
        </p>
      </section>

      {/* Signals used */}
      <section
        className="alf-card"
        aria-label="Signals used in the decision"
      >
        <h3 className="alphabet-card-heading">Signals used</h3>
        <p className="alf-muted">
          The handshake examined exactly{' '}
          <strong>{signalsUsed.length}</strong> public browser signal
          {signalsUsed.length === 1 ? '' : 's'} to decide which layer and
          locale to render.
        </p>
        {signalsUsed.length === 0 ? (
          <p className="alf-muted alphabet-empty">
            Awaiting the first signal collection…
          </p>
        ) : (
          <ul className="alphabet-signal-list">
            {signalsUsed.map((entry) => (
              <li key={entry}>
                <span style={{ fontFamily: 'var(--alf-font-mono)' }}>
                  {entry}
                </span>
                <span className="alphabet-pill" data-status="ready">
                  used
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Memory tier */}
      <section className="alf-card" aria-label="Active memory tier">
        <h3 className="alphabet-card-heading">Memory tier</h3>
        <div>
          <span className="alf-pill" data-tier={consent.tier}>
            {TIER_LABELS[consent.tier] ?? consent.tier}
          </span>
        </div>
        <p className="alf-muted">{TIER_PERSISTS[consent.tier] ?? '—'}</p>
        <dl className="alphabet-dl" style={{ fontSize: '0.85rem' }}>
          <div>
            <dt>State</dt>
            <dd>
              <code>{consent.state}</code>
            </dd>
          </div>
          <div>
            <dt>Locked by DNT/GPC</dt>
            <dd>{consent.lockedByPrivacySignal ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>
              <code style={{ fontSize: '0.75rem' }}>
                {consent.updatedAt === '1970-01-01T00:00:00.000Z'
                  ? '—'
                  : consent.updatedAt}
              </code>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
