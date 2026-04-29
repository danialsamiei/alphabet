/**
 * @file experiences/ContextDashboardExperience.tsx
 * @description
 * Real-time Context Handshake dashboard.
 *
 * Wraps the inner content in a `<ContextProvider>` (which runs the
 * collect → enrich → decide pipeline once at mount) and renders a
 * timeline of stream events, signal cards for the current snapshot,
 * and the resolved decision with its reason code.
 */

import { useEffect, useMemo, useRef } from 'react';
import { ContextProvider, useContextStream } from '@alphabet/ui';
import { pushTelemetry } from '../telemetry.js';

export function ContextDashboardExperience(): JSX.Element {
  return (
    <ContextProvider liveSignals>
      <ContextDashboardInner />
    </ContextProvider>
  );
}

function ContextDashboardInner(): JSX.Element {
  const { status, decision, snapshot, events, error } = useContextStream();

  const sentCount = useRef(0);

  const phaseTimings = useMemo(() => {
    const ends = events.filter(
      (e): e is Extract<typeof e, { type: 'phase:end' }> =>
        e.type === 'phase:end',
    );
    return ends.map((e) => ({ phase: e.phase, durationMs: e.durationMs }));
  }, [events]);

  useEffect(() => {
    const unseen = phaseTimings.slice(sentCount.current);
    unseen.forEach((p) => {
      pushTelemetry({ event: 'handshake_phase_timing', at: Date.now(), phase: p.phase, durationMs: p.durationMs, source: 'context-stream' });
    });
    sentCount.current = phaseTimings.length;
  }, [phaseTimings]);

  return (
    <div className="alphabet-experience alphabet-grid-3">
      <section className="alphabet-card" aria-label="Decision">
        <h3 className="alphabet-card-heading">Decision</h3>
        <dl className="alphabet-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <span className="alphabet-pill" data-status={status}>
                {status}
              </span>
            </dd>
          </div>
          <div>
            <dt>Layer</dt>
            <dd>
              <code>{decision === null ? '—' : decision.selectedLayer}</code>
            </dd>
          </div>
          <div>
            <dt>Decided at</dt>
            <dd>
              <code>{decision === null ? '—' : decision.decidedAt}</code>
            </dd>
          </div>
          <div>
            <dt>Locale</dt>
            <dd>
              {decision === null
                ? '—'
                : `${decision.uiConfig.locale} (${decision.uiConfig.direction})`}
            </dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>
              {decision === null
                ? '—'
                : decision.privacyMode.restricted
                  ? 'restricted'
                  : 'open'}
            </dd>
          </div>
        </dl>
        {error !== null ? (
          <p className="alphabet-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="alphabet-card" aria-label="Signals">
        <h3 className="alphabet-card-heading">Reactive signals</h3>
        {snapshot === null ? (
          <p className="alphabet-muted-text alphabet-empty">Awaiting first signal…</p>
        ) : (
          <ul className="alphabet-signal-list">
            {snapshot.networkType !== undefined ? (
              <li>
                <span>Network</span>
                <code>{snapshot.networkType}</code>
              </li>
            ) : null}
            {snapshot.prefersReducedMotion !== undefined ? (
              <li>
                <span>Reduced motion</span>
                <code>{String(snapshot.prefersReducedMotion)}</code>
              </li>
            ) : null}
            {snapshot.visibilityState !== undefined ? (
              <li>
                <span>Visibility</span>
                <code>{snapshot.visibilityState}</code>
              </li>
            ) : null}
          </ul>
        )}
        <p className="alphabet-muted-text">
          Try toggling tab visibility or reduced motion in your OS to see
          live updates flow through the stream.
        </p>
      </section>

      <section className="alphabet-card" aria-label="Pipeline timeline">
        <h3 className="alphabet-card-heading">Pipeline timeline</h3>
        {phaseTimings.length === 0 ? (
          <p className="alphabet-muted-text alphabet-empty">Pipeline running…</p>
        ) : (
          <ol className="alphabet-timeline">
            {phaseTimings.map((t, i) => (
              <li key={`${t.phase}-${i}`}>
                <span className="alphabet-timeline-phase">{t.phase}</span>
                <span className="alphabet-timeline-duration">
                  {t.durationMs.toFixed(2)} ms
                </span>
              </li>
            ))}
          </ol>
        )}
        <details>
          <summary>Raw event stream ({events.length})</summary>
          <pre className="alphabet-pre">
            {events
              .slice(-12)
              .map(
                (e) =>
                  `[${e.type}]${'phase' in e ? ' ' + e.phase : ''}${'layer' in e ? ' ' + e.layer : ''}${'durationMs' in e ? ' ' + e.durationMs.toFixed(2) + 'ms' : ''}`,
              )
              .join('\n')}
          </pre>
        </details>
      </section>
    </div>
  );
}
