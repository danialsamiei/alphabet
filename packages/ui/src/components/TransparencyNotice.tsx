/**
 * @module components/TransparencyNotice
 * @description
 * نمایش شفاف توضیح این‌که چرا Alphabet این لایه/حالت را انتخاب کرده است.
 * Transparency notice — explains *why* Alphabet chose the current adaptive
 * layer in plain language. Useful for the demo's "Alphabet selected this
 * layer because…" text and as a generic transparency primitive for
 * any Alphabet-aware UI.
 */

import type { CSSProperties } from 'react';
import { useAlphabetContext } from './AlphabetProvider.js';
import { useAdaptiveLayer, type UseAdaptiveLayerOptions } from '../hooks/useAdaptiveLayer.js';

export interface TransparencyNoticeProps extends UseAdaptiveLayerOptions {
  /** عنوان کوتاه قابل override. */
  readonly title?: string;
  /** style override. */
  readonly style?: CSSProperties;
  /** className اختیاری. */
  readonly className?: string;
}

const baseStyle: CSSProperties = {
  display: 'block',
  padding: '0.75rem 1rem',
  margin: '1rem 0',
  borderRadius: '0.5rem',
  background: 'rgba(15, 23, 42, 0.06)',
  border: '1px solid rgba(15, 23, 42, 0.12)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

/**
 * نوتیس شفافیت — متن "Alphabet selected this layer because…" را نمایش می‌دهد.
 *
 * @example
 * <TransparencyNotice />
 */
export function TransparencyNotice(props: TransparencyNoticeProps): JSX.Element {
  const { title = 'Alphabet selected this layer because…', style, className, ...layerOptions } = props;
  const ctx = useAlphabetContext();
  const handshakeFromProvider = ctx?.handshake;
  const layerInfo = useAdaptiveLayer({
    ...layerOptions,
    ...(handshakeFromProvider !== undefined ? { handshake: handshakeFromProvider } : {}),
  });
  return (
    <aside
      role="note"
      aria-label="Alphabet transparency notice"
      data-alphabet-transparency-notice
      className={className}
      style={{ ...baseStyle, ...style }}
    >
      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{title}</strong>
      <span data-alphabet-reason-code={layerInfo.reasonCode}>{layerInfo.reason}</span>
      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.75 }}>
        Active layer: <code>{layerInfo.layer}</code>
        {layerInfo.privacySignalActive ? ' · Privacy signal active (DNT/GPC).' : ''}
      </div>
    </aside>
  );
}
