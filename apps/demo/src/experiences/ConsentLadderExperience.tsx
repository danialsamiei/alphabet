/**
 * @file experiences/ConsentLadderExperience.tsx
 * @description
 * Interactive Consent Ladder visualizer with live event log.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ConsentLadder,
  useAwafContext,
  type ConsentLadderProps,
} from '@awaf/ui';
import type { ConsentTier } from '@awaf/core';

interface LogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly tier: ConsentTier;
  readonly state: string;
  readonly note: string;
}

export function ConsentLadderExperience(): JSX.Element {
  const ctx = useAwafContext();
  if (ctx === null) {
    throw new Error('ConsentLadderExperience must be inside an AwafProvider');
  }
  const { consent } = ctx;

  const [log, setLog] = useState<ReadonlyArray<LogEntry>>([]);
  const counter = useRef(0);
  const previous = useRef<{ tier: ConsentTier; state: string }>({
    tier: consent.tier,
    state: consent.state,
  });

  useEffect(() => {
    const prev = previous.current;
    if (prev.tier === consent.tier && prev.state === consent.state) return;
    counter.current += 1;
    const note = describeTransition(prev, {
      tier: consent.tier,
      state: consent.state,
    });
    const entry: LogEntry = {
      id: counter.current,
      timestamp: new Date().toLocaleTimeString(),
      tier: consent.tier,
      state: consent.state,
      note,
    };
    setLog((current) => [entry, ...current].slice(0, 25));
    previous.current = { tier: consent.tier, state: consent.state };
  }, [consent.tier, consent.state]);

  const onChange: NonNullable<ConsentLadderProps['onChange']> = () => {
    /* effect picks up the change — nothing to do here. */
  };

  return (
    <div className="awaf-experience awaf-grid-2">
      <div className="awaf-card">
        <ConsentLadder consent={consent} showReset onChange={onChange} />
      </div>

      <aside className="awaf-card" aria-label="Consent transition log">
        <h3 className="awaf-card-heading">Live event log</h3>
        <p className="awaf-muted-text">
          Every tier change emitted by <code>useAwafConsent</code> appears
          here, newest first.
        </p>
        {log.length === 0 ? (
          <p className="awaf-muted-text awaf-empty">
            No transitions yet — pick a rung to begin.
          </p>
        ) : (
          <ol className="awaf-log">
            {log.map((entry) => (
              <li key={entry.id}>
                <span className="awaf-log-time">{entry.timestamp}</span>
                <span className="awaf-log-tier" data-tier={entry.tier}>
                  {entry.tier}
                </span>
                <span className="awaf-log-note">{entry.note}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function describeTransition(
  prev: { tier: ConsentTier; state: string },
  next: { tier: ConsentTier; state: string },
): string {
  if (prev.state !== 'revoked' && next.state === 'revoked') {
    return 'revoked — all stored memory cleared';
  }
  if (prev.state === 'pending' && next.state === 'granted') {
    return `granted ${next.tier}`;
  }
  if (prev.tier !== next.tier && next.state === 'granted') {
    const order = ['NO_MEMORY', 'ANONYMOUS', 'CONSENTED', 'ENRICHED'] as const;
    const direction =
      order.indexOf(next.tier) > order.indexOf(prev.tier)
        ? 'upgraded'
        : 'downgraded';
    return `${direction} ${prev.tier} → ${next.tier}`;
  }
  if (next.state === 'pending') {
    return 'reset to pending — awaiting fresh choice';
  }
  return `${prev.state} → ${next.state}`;
}
