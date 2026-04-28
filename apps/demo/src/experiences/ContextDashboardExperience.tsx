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

import { useMemo } from 'react';
import { ContextProvider, useContextStream } from '@awaf/ui';

export function ContextDashboardExperience(): JSX.Element {
  return (
    <ContextProvider liveSignals>
      <ContextDashboardInner />
    </ContextProvider>
  );
}

function ContextDashboardInner(): JSX.Element {
  const { status, decision, snapshot, events, error } = useContextStream();

  const phaseTimings = useMemo(() => {
    const ends = events.filter(
      (e): e is Extract<typeof e, { type: 'phase:end' }> =>
        e.type === 'phase:end',
    );
    return ends.map((e) => ({ phase: e.phase, durationMs: e.durationMs }));
  }, [events]);

  return (
    <div className="awaf-experience awaf-grid-3">
      <section className="awaf-card" aria-label="Decision">
        <h3 className="awaf-card-heading">Decision</h3>
        <dl className="awaf-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <span className="awaf-pill" data-status={status}>
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
          <p className="awaf-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="awaf-card" aria-label="Signals">
        <h3 className="awaf-card-heading">Reactive signals</h3>
        {snapshot === null ? (
          <p className="awaf-muted-text awaf-empty">Awaiting first signal…</p>
        ) : (
          <ul className="awaf-signal-list">
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
        <p className="awaf-muted-text">
          Try toggling tab visibility or reduced motion in your OS to see
          live updates flow through the stream.
        </p>
      </section>

      <section className="awaf-card" aria-label="Pipeline timeline">
        <h3 className="awaf-card-heading">Pipeline timeline</h3>
        {phaseTimings.length === 0 ? (
          <p className="awaf-muted-text awaf-empty">Pipeline running…</p>
        ) : (
          <ol className="awaf-timeline">
            {phaseTimings.map((t, i) => (
              <li key={`${t.phase}-${i}`}>
                <span className="awaf-timeline-phase">{t.phase}</span>
                <span className="awaf-timeline-duration">
                  {t.durationMs.toFixed(2)} ms
                </span>
              </li>
            ))}
          </ol>
        )}
        <details>
          <summary>Raw event stream ({events.length})</summary>
          <pre className="awaf-pre">
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
