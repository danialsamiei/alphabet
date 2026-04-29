/**
 * @file experiences/LivingMemoryExperience.tsx
 * @description
 * Living Memory Engine — visualizes Alphabet's six memory domains and how
 * each is gated by the consent ladder.
 *
 * The experience is on-device by design: every entry is held in React
 * state, never persisted unless the user grants ≥ ANONYMOUS, and never
 * leaves the browser. Domains that aren't accessible at the current
 * tier are visibly locked.
 */

import { useMemo, useState } from 'react';
import { useAlphabetContext } from '@alphabet/ui';
import type { ConsentTier } from '@alphabet/core';

type MemoryDomain =
  | 'general'
  | 'site_specific'
  | 'visitor'
  | 'class_notes'
  | 'ideas'
  | 'tech_pulse';

interface DomainSpec {
  readonly id: MemoryDomain;
  readonly label: string;
  readonly description: string;
  readonly minTier: ConsentTier;
}

const TIER_ORDER: ReadonlyArray<ConsentTier> = [
  'NO_MEMORY',
  'ANONYMOUS',
  'CONSENTED',
  'ENRICHED',
];

const DOMAINS: ReadonlyArray<DomainSpec> = [
  {
    id: 'general',
    label: 'general',
    description: 'Public, cross-visitor facts. No personal data.',
    minTier: 'NO_MEMORY',
  },
  {
    id: 'site_specific',
    label: 'site_specific',
    description: 'Settings scoped to this domain only.',
    minTier: 'ANONYMOUS',
  },
  {
    id: 'visitor',
    label: 'visitor',
    description: 'Your individual preferences, isolated from other domains.',
    minTier: 'ANONYMOUS',
  },
  {
    id: 'tech_pulse',
    label: 'tech_pulse',
    description: 'Technology Pulse signals you’ve interacted with.',
    minTier: 'ANONYMOUS',
  },
  {
    id: 'ideas',
    label: 'ideas',
    description: 'Notes and ideas captured locally.',
    minTier: 'CONSENTED',
  },
  {
    id: 'class_notes',
    label: 'class_notes',
    description: 'Educational notes, read-only from general.',
    minTier: 'CONSENTED',
  },
];

interface MemoryEntry {
  readonly id: number;
  readonly domain: MemoryDomain;
  readonly key: string;
  readonly value: string;
  readonly tier: ConsentTier;
  readonly timestamp: number;
}

function tierAllows(current: ConsentTier, min: ConsentTier): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(min);
}

export function LivingMemoryExperience(): JSX.Element {
  const ctx = useAlphabetContext();
  if (ctx === null) {
    throw new Error(
      'LivingMemoryExperience must be inside an AlphabetProvider',
    );
  }
  const { consent } = ctx;

  const [entries, setEntries] = useState<ReadonlyArray<MemoryEntry>>([]);
  const [counter, setCounter] = useState(0);
  const [selectedDomain, setSelectedDomain] = useState<MemoryDomain>('general');
  const [draftKey, setDraftKey] = useState('preferred_theme');
  const [draftValue, setDraftValue] = useState('dark');

  const visibleEntries = useMemo(
    () => entries.filter((e) => tierAllows(consent.tier, getMinTier(e.domain))),
    [entries, consent.tier],
  );

  const ingest = (): void => {
    const spec = DOMAINS.find((d) => d.id === selectedDomain);
    if (spec === undefined) return;
    if (!tierAllows(consent.tier, spec.minTier)) return;
    const next: MemoryEntry = {
      id: counter + 1,
      domain: selectedDomain,
      key: draftKey.trim() || 'unnamed',
      value: draftValue.trim() || '',
      tier: consent.tier,
      timestamp: Date.now(),
    };
    setEntries((current) => [next, ...current].slice(0, 30));
    setCounter((c) => c + 1);
  };

  const purge = (): void => setEntries([]);

  return (
    <div className="alphabet-experience alf-grid-2">
      <section className="alf-card" aria-label="Memory domains">
        <h3 className="alphabet-card-heading">Six memory domains · live access</h3>
        <p className="alf-muted">
          Each domain is gated by a minimum consent tier. Domains that
          your current tier doesn't unlock are visibly locked — no silent
          writes are ever attempted.
        </p>
        <div className="alf-memory-grid" role="list">
          {DOMAINS.map((d) => {
            const allowed = tierAllows(consent.tier, d.minTier);
            return (
              <div
                key={d.id}
                role="listitem"
                className="alf-memory-cell"
                data-active={
                  allowed && d.id === selectedDomain ? 'true' : 'false'
                }
                style={
                  allowed
                    ? {
                        cursor: 'pointer',
                        opacity: 1,
                      }
                    : { opacity: 0.5 }
                }
                onClick={() => {
                  if (allowed) setSelectedDomain(d.id);
                }}
                onKeyDown={(e) => {
                  if (allowed && (e.key === 'Enter' || e.key === ' ')) {
                    // preventDefault stops space-bar from scrolling the page
                    // when the cell is focused — a real a11y bug otherwise.
                    e.preventDefault();
                    setSelectedDomain(d.id);
                  }
                }}
                tabIndex={allowed ? 0 : -1}
                aria-disabled={!allowed}
              >
                <span className="alf-memory-cell-domain">{d.label}</span>
                <span className="alf-memory-cell-meta">
                  min tier · {d.minTier}
                </span>
                <span
                  className={
                    allowed
                      ? 'alf-memory-cell-meta'
                      : 'alf-memory-cell-locked'
                  }
                >
                  {allowed ? d.description : '🔒 unlock with consent'}
                </span>
              </div>
            );
          })}
        </div>

        <fieldset
          style={{
            display: 'grid',
            gap: '0.5rem',
            border: '1px solid var(--alf-border)',
            borderRadius: 'var(--alf-radius-md)',
            padding: '0.85rem',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 0.4rem',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--alf-muted)',
            }}
          >
            Ingest entry
          </legend>
          <label className="alphabet-field">
            <span>Domain</span>
            <select
              value={selectedDomain}
              onChange={(e) =>
                setSelectedDomain(e.target.value as MemoryDomain)
              }
            >
              {DOMAINS.map((d) => (
                <option
                  key={d.id}
                  value={d.id}
                  disabled={!tierAllows(consent.tier, d.minTier)}
                >
                  {d.label} {tierAllows(consent.tier, d.minTier) ? '' : '🔒'}
                </option>
              ))}
            </select>
          </label>
          <div
            style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}
          >
            <label className="alphabet-field">
              <span>Key</span>
              <input
                type="text"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                style={{
                  font: 'inherit',
                  color: 'var(--alf-fg)',
                  background: 'var(--alf-bg-2)',
                  border: '1px solid var(--alf-border)',
                  borderRadius: 'var(--alf-radius-sm)',
                  padding: '0.5rem 0.6rem',
                }}
              />
            </label>
            <label className="alphabet-field">
              <span>Value</span>
              <input
                type="text"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                style={{
                  font: 'inherit',
                  color: 'var(--alf-fg)',
                  background: 'var(--alf-bg-2)',
                  border: '1px solid var(--alf-border)',
                  borderRadius: 'var(--alf-radius-sm)',
                  padding: '0.5rem 0.6rem',
                }}
              />
            </label>
          </div>
          <div className="alphabet-button-row">
            <button
              type="button"
              className="alphabet-primary-btn"
              onClick={ingest}
              disabled={
                !tierAllows(
                  consent.tier,
                  DOMAINS.find((d) => d.id === selectedDomain)?.minTier ??
                    'NO_MEMORY',
                )
              }
            >
              Ingest
            </button>
            <button
              type="button"
              className="alphabet-pill-btn"
              onClick={purge}
            >
              Purge all
            </button>
          </div>
        </fieldset>
      </section>

      <aside className="alf-card" aria-label="On-device entries">
        <h3 className="alphabet-card-heading">
          On-device entries
          <span
            className="alphabet-pill"
            data-status="ready"
            style={{ marginInlineStart: '0.5rem' }}
          >
            local-only
          </span>
        </h3>
        <p className="alf-muted">
          {visibleEntries.length === 0
            ? 'No entries yet — ingest one on the left.'
            : `${visibleEntries.length} entr${visibleEntries.length === 1 ? 'y' : 'ies'} held in memory. Lower your consent tier to revoke them instantly.`}
        </p>
        {visibleEntries.length > 0 ? (
          <ol className="alphabet-log alphabet-log-stacked">
            {visibleEntries.map((e) => (
              <li key={e.id}>
                <header>
                  <span
                    className="alphabet-log-tier"
                    data-tier={e.tier}
                  >
                    {e.tier}
                  </span>
                  <code style={{ fontSize: '0.78rem' }}>{e.domain}</code>
                  <span
                    className="alphabet-log-time"
                    style={{ marginInlineStart: 'auto' }}
                  >
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </header>
                <span style={{ fontFamily: 'var(--alf-font-mono)', fontSize: '0.85rem' }}>
                  <strong>{e.key}</strong> = {e.value}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </aside>
    </div>
  );
}

function getMinTier(domain: MemoryDomain): ConsentTier {
  return DOMAINS.find((d) => d.id === domain)?.minTier ?? 'NO_MEMORY';
}
