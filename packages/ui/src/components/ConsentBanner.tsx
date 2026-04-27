/**
 * @module components/ConsentBanner
 * @description
 * بنر consent با دسترسی‌پذیری کامل کیبورد و screen reader.
 * Keyboard- and screen-reader-accessible consent banner. Uses
 * `role="dialog"` with `aria-modal="false"` so it is announced but
 * does not trap focus, and exposes Accept / Reject / Customize as
 * standard `<button>` elements.
 */

import { useId, type CSSProperties, type ReactNode } from 'react';
import type { ConsentTier } from '@awaf/core';
import { useAwafContext } from './AwafProvider.js';
import {
  useAwafConsent,
  type UseAwafConsentReturn,
} from '../hooks/useAwafConsent.js';

export interface ConsentBannerProps {
  /** تیتر بنر — پیش‌فرض انگلیسی. */
  readonly title?: string;
  /** متن توضیح. */
  readonly description?: ReactNode;
  /** متن دکمه accept. */
  readonly acceptLabel?: string;
  /** متن دکمه reject. */
  readonly rejectLabel?: string;
  /** متن دکمه enriched (سطح بالاتر). */
  readonly enrichedLabel?: string;
  /** Tier پیش‌فرض هنگام accept (پیش‌فرض `CONSENTED`). */
  readonly acceptTier?: ConsentTier;
  /** آیا دکمه enriched نمایش داده شود. */
  readonly showEnriched?: boolean;
  /** override روی consent state — مفید برای استفاده standalone. */
  readonly consent?: UseAwafConsentReturn;
  /** className اختیاری. */
  readonly className?: string;
  /** style override. */
  readonly style?: CSSProperties;
  /** callback بعد از هر action. */
  readonly onChange?: (action: 'accept' | 'reject' | 'enriched') => void;
}

const baseStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1rem',
  left: '1rem',
  right: '1rem',
  maxWidth: '40rem',
  margin: '0 auto',
  padding: '1rem 1.25rem',
  borderRadius: '0.75rem',
  background: '#0f172a',
  color: '#f8fafc',
  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  fontFamily: 'system-ui, sans-serif',
  zIndex: 1000,
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '0.95rem',
};

const acceptStyle: CSSProperties = {
  ...buttonStyle,
  background: '#22c55e',
  color: '#052e16',
  fontWeight: 600,
};

/**
 * بنر consent — اگر state == "pending" نمایش داده می‌شود، در غیر این صورت
 * رشته خالی برمی‌گرداند. اگر privacy signals (DNT/GPC) فعال باشند، بنر
 * نمایش داده نمی‌شود زیرا consent از قبل به NO_MEMORY قفل شده است.
 */
export function ConsentBanner(props: ConsentBannerProps): JSX.Element | null {
  const {
    title = 'Your privacy choices',
    description = 'AWAF can adapt this experience using anonymous browser signals only, or remember your preferences across visits if you consent.',
    acceptLabel = 'Accept',
    rejectLabel = 'Reject',
    enrichedLabel = 'Enable personalization',
    acceptTier = 'CONSENTED',
    showEnriched = false,
    consent: consentOverride,
    className,
    style,
    onChange,
  } = props;

  const ctx = useAwafContext();
  const standalone = useAwafConsent({});
  const consent: UseAwafConsentReturn = consentOverride ?? ctx?.consent ?? standalone;
  const headingId = useId();
  const descId = useId();

  if (consent.state !== 'pending') return null;
  if (consent.lockedByPrivacySignal) return null;

  const accept = (): void => {
    consent.grant(acceptTier, ['personalization']);
    onChange?.('accept');
  };
  const reject = (): void => {
    consent.revoke();
    onChange?.('reject');
  };
  const enriched = (): void => {
    consent.grant('ENRICHED', ['personalization', 'behavioral_learning']);
    onChange?.('enriched');
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      aria-describedby={descId}
      data-awaf-consent-banner
      className={className}
      style={{ ...baseStyle, ...style }}
    >
      <h2 id={headingId} style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
        {title}
      </h2>
      <p id={descId} style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', opacity: 0.9 }}>
        {description}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={accept} style={acceptStyle} data-awaf-action="accept">
          {acceptLabel}
        </button>
        <button type="button" onClick={reject} style={buttonStyle} data-awaf-action="reject">
          {rejectLabel}
        </button>
        {showEnriched ? (
          <button type="button" onClick={enriched} style={buttonStyle} data-awaf-action="enriched">
            {enrichedLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
