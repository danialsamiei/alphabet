/**
 * @module layers/TextOnlyLayer
 * @description
 * لایه ۵ — Text-Only با semantic HTML و ARIA landmarks.
 * Layer 5 — Text-Only with semantic HTML and full ARIA landmark support
 * for screen readers. No images, no animations, minimal styles.
 */

import type { ReactNode } from 'react';

export interface TextOnlyLayerProps {
  /** عنوان اصلی صفحه. */
  readonly heading?: string;
  /** متن توضیحی کوتاه (lede). */
  readonly description?: string;
  /** محتوای اصلی. */
  readonly children?: ReactNode;
  /** جهت متن. */
  readonly direction?: 'ltr' | 'rtl';
  /** locale (برای lang attribute). */
  readonly locale?: string;
}

/**
 * لایه text-only — حاوی landmarkهای main / header / footer،
 * skip link، و focus visible default.
 */
export function TextOnlyLayer({
  heading = 'AWAF',
  description,
  children,
  direction = 'ltr',
  locale,
}: TextOnlyLayerProps): JSX.Element {
  return (
    <div
      data-awaf-layer="TEXT_ONLY"
      dir={direction}
      {...(locale !== undefined ? { lang: locale } : {})}
      style={{
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.6,
        maxWidth: '70ch',
        margin: '0 auto',
        padding: '1rem',
        color: 'inherit',
      }}
    >
      <a
        href="#awaf-main"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        Skip to main content
      </a>
      <header role="banner">
        <h1>{heading}</h1>
      </header>
      <main id="awaf-main" role="main" aria-label="Main content">
        {description !== undefined ? <p>{description}</p> : null}
        {children}
      </main>
      <footer role="contentinfo">
        <p>
          <small>Rendered with the AWAF text-only adaptive layer.</small>
        </p>
      </footer>
    </div>
  );
}

export default TextOnlyLayer;
