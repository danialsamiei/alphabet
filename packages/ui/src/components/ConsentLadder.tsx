/**
 * @module components/ConsentLadder
 * @description
 * `ConsentLadder` — a visual, interactive component that renders all four
 * consent tiers (`NO_MEMORY` → `ANONYMOUS` → `CONSENTED` → `ENRICHED`)
 * as a ladder, highlights the current tier, and lets the user move up,
 * down, revoke, or reset. Each rung carries a transparent description
 * of what data is processed at that tier.
 *
 * Wires into the existing `useAwafConsent` hook by default but accepts
 * an override so the demo can drive a `ConsentTierManager` from
 * `@awaf/security` instead.
 *
 * Accessibility:
 *  - Rendered as a `<ol>` with `aria-label` describing the ladder.
 *  - Each rung is a `<button>` with `aria-current="step"` when active and
 *    `aria-disabled` when locked by a privacy signal (DNT/GPC).
 *  - Live region announces transitions via `role="status"`.
 */

import { useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { ConsentTier, ConsentPurpose } from '@awaf/core';
import { useAwafContext } from './AwafProvider.js';
import {
  useAwafConsent,
  type UseAwafConsentReturn,
} from '../hooks/useAwafConsent.js';

/** Static metadata for each tier — locale-overridable via `tierLabels`. */
export interface TierMetadata {
  readonly tier: ConsentTier;
  readonly title: string;
  readonly summary: string;
  readonly bullets: ReadonlyArray<string>;
}

const DEFAULT_TIERS: ReadonlyArray<TierMetadata> = [
  {
    tier: 'NO_MEMORY',
    title: 'No memory',
    summary: 'Nothing about you is stored, profiled, or tracked.',
    bullets: [
      'Browser language used in-memory only',
      'IANA timezone used in-memory only',
      'Country derived from timezone, never persisted',
    ],
  },
  {
    tier: 'ANONYMOUS',
    title: 'Anonymous session',
    summary: 'Session-only memory. Cleared when you close the tab.',
    bullets: [
      'Everything in No memory',
      'Ephemeral session id (no cookies, no fingerprinting)',
      'Aggregate, k-anonymous analytics',
    ],
  },
  {
    tier: 'CONSENTED',
    title: 'Consented preferences',
    summary: 'Cross-session preferences with explicit opt-in.',
    bullets: [
      'Everything in Anonymous session',
      'Stable rotating visitor id, no third-party cookies',
      'Theme, locale, and content depth remembered',
    ],
  },
  {
    tier: 'ENRICHED',
    title: 'Enriched experience',
    summary: 'Behavioral learning, embeddings, and precise geo.',
    bullets: [
      'Everything in Consented preferences',
      'Vector embeddings of interests for retrieval',
      'Precise geo (city + coarse latitude/longitude)',
    ],
  },
];

const TIER_ORDER: ReadonlyArray<ConsentTier> = [
  'NO_MEMORY',
  'ANONYMOUS',
  'CONSENTED',
  'ENRICHED',
];

const PURPOSES_BY_TIER: Readonly<
  Record<ConsentTier, ReadonlyArray<ConsentPurpose>>
> = {
  NO_MEMORY: [],
  ANONYMOUS: [],
  CONSENTED: ['personalization'],
  ENRICHED: ['personalization', 'behavioral_learning'],
};

export interface ConsentLadderProps {
  /** Override consent state (otherwise uses AwafContext or standalone hook). */
  readonly consent?: UseAwafConsentReturn;
  /** Override default per-tier labels (e.g. for localisation). */
  readonly tiers?: ReadonlyArray<TierMetadata>;
  /** Heading rendered above the ladder. */
  readonly heading?: string;
  /** Description rendered below the heading. */
  readonly description?: ReactNode;
  /** Show a "Revoke" button after the ladder. Default: true. */
  readonly showRevoke?: boolean;
  /** Show a "Reset" button (mostly useful for demos). Default: false. */
  readonly showReset?: boolean;
  /** Optional className for the outer wrapper. */
  readonly className?: string;
  /** Optional inline styles for the outer wrapper. */
  readonly style?: CSSProperties;
  /** Fired after every successful tier change. */
  readonly onChange?: (tier: ConsentTier) => void;
}

const wrapperStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  fontFamily: 'inherit',
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const rungBaseStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'start',
  gap: '0.75rem',
  width: '100%',
  textAlign: 'inherit',
  padding: '0.85rem 1rem',
  borderRadius: '0.6rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--awaf-border, rgba(15,23,42,0.12))',
  background: 'var(--awaf-surface, rgba(255,255,255,0.04))',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
};

const rungActiveStyle: CSSProperties = {
  borderColor: 'var(--awaf-accent, #4f46e5)',
  boxShadow: '0 0 0 2px var(--awaf-accent, #4f46e5)',
};

const rungLockedStyle: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
};

const stepDotStyle: CSSProperties = {
  width: '1.6rem',
  height: '1.6rem',
  borderRadius: '999px',
  background: 'var(--awaf-accent, #4f46e5)',
  color: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.85rem',
  flexShrink: 0,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const ghostBtn: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--awaf-border, rgba(15,23,42,0.16))',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
};

/**
 * Render the consent ladder with all four tiers. Movement honours the
 * monotonic upgrade rule baked into `ConsentTierManager` for reads
 * (downgrades are surfaced as `revoke()` calls), but the local
 * `useAwafConsent` hook accepts arbitrary tier transitions because it is
 * a UI-state mirror, not the security state machine.
 */
export function ConsentLadder(props: ConsentLadderProps): JSX.Element {
  const {
    consent: consentOverride,
    tiers = DEFAULT_TIERS,
    heading = 'Your privacy choices',
    description = 'Pick a tier. Move up to grant more memory, revoke at any time. We never set tracking cookies, and DNT or GPC pin you to No memory.',
    showRevoke = true,
    showReset = false,
    className,
    style,
    onChange,
  } = props;

  const ctx = useAwafContext();
  const standalone = useAwafConsent({});
  const consent: UseAwafConsentReturn =
    consentOverride ?? ctx?.consent ?? standalone;

  const headingId = useId();
  const descId = useId();
  const liveId = useId();

  const ordered = useMemo(
    () => TIER_ORDER.map((t) => tiers.find((m) => m.tier === t) ?? null),
    [tiers],
  );

  const setTier = (tier: ConsentTier): void => {
    if (consent.lockedByPrivacySignal) return;
    if (tier === 'NO_MEMORY') {
      consent.revoke();
      onChange?.(tier);
      return;
    }
    consent.grant(tier, PURPOSES_BY_TIER[tier]);
    onChange?.(tier);
  };

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descId}
      className={className}
      data-awaf-consent-ladder
      style={{ ...wrapperStyle, ...style }}
    >
      <header style={{ display: 'grid', gap: '0.25rem' }}>
        <h2 id={headingId} style={{ margin: 0, fontSize: '1.05rem' }}>
          {heading}
        </h2>
        <p id={descId} style={{ margin: 0, opacity: 0.85, fontSize: '0.95rem' }}>
          {description}
        </p>
      </header>

      <ol
        aria-label="Consent ladder"
        style={listStyle}
        data-awaf-consent-ladder-list
      >
        {ordered.map((meta, index) => {
          if (meta === null) return null;
          const isActive =
            consent.tier === meta.tier && consent.state !== 'pending';
          const isLocked =
            consent.lockedByPrivacySignal && meta.tier !== 'NO_MEMORY';

          return (
            <li key={meta.tier}>
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={isLocked || undefined}
                disabled={isLocked}
                data-awaf-tier={meta.tier}
                onClick={() => setTier(meta.tier)}
                style={{
                  ...rungBaseStyle,
                  ...(isActive ? rungActiveStyle : {}),
                  ...(isLocked ? rungLockedStyle : {}),
                }}
              >
                <span aria-hidden="true" style={stepDotStyle}>
                  {index + 1}
                </span>
                <span style={{ display: 'grid', gap: '0.35rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{meta.title}</strong>
                  <span style={{ opacity: 0.85, fontSize: '0.9rem' }}>
                    {meta.summary}
                  </span>
                  <ul
                    style={{
                      margin: '0.25rem 0 0',
                      paddingInlineStart: '1.1rem',
                      fontSize: '0.85rem',
                      opacity: 0.8,
                    }}
                  >
                    {meta.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div style={buttonRowStyle}>
        {showRevoke ? (
          <button
            type="button"
            data-awaf-action="revoke"
            onClick={() => {
              consent.revoke();
              onChange?.('NO_MEMORY');
            }}
            style={ghostBtn}
          >
            Revoke all
          </button>
        ) : null}
        {showReset ? (
          <button
            type="button"
            data-awaf-action="reset"
            onClick={() => {
              consent.reset();
            }}
            style={ghostBtn}
          >
            Reset
          </button>
        ) : null}
      </div>

      <p
        id={liveId}
        role="status"
        aria-live="polite"
        style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}
      >
        {consent.lockedByPrivacySignal
          ? 'A DNT or GPC privacy signal is active — consent is pinned to No memory.'
          : `Active tier: ${consent.tier}${consent.state === 'pending' ? ' (pending)' : ''}`}
      </p>
    </section>
  );
}
