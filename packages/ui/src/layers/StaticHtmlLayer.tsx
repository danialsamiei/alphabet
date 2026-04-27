/**
 * @module layers/StaticHtmlLayer
 * @description
 * لایه ۴ — Static HTML با semantic structure و CSS Grid.
 * Layer 4 — Semantic HTML5 + minimal CSS. No JS animations, no canvas,
 * no WebGL. The reduced-motion / no-canvas fallback target.
 */

import type { CSSProperties, ReactNode } from 'react';

export interface StaticHtmlLayerProps {
  readonly heading?: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly direction?: 'ltr' | 'rtl';
  readonly locale?: string;
  /** Override inline style. */
  readonly style?: CSSProperties;
}

const defaultStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: '1rem',
  padding: '1.5rem',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  lineHeight: 1.6,
};

/**
 * لایه Static HTML — مناسب برای reduced-motion، slow networks،
 * یا مرورگرهایی که Canvas ندارند.
 */
export function StaticHtmlLayer({
  heading = 'AWAF',
  description,
  children,
  direction = 'ltr',
  locale,
  style,
}: StaticHtmlLayerProps): JSX.Element {
  const merged: CSSProperties = { ...defaultStyle, ...style };
  return (
    <section
      data-awaf-layer="STATIC_HTML"
      dir={direction}
      {...(locale !== undefined ? { lang: locale } : {})}
      style={merged}
      aria-label="AWAF static layer"
    >
      <header>
        <h1 style={{ margin: 0 }}>{heading}</h1>
        {description !== undefined ? (
          <p style={{ margin: '0.5rem 0 0', opacity: 0.8 }}>{description}</p>
        ) : null}
      </header>
      <main role="main">{children}</main>
      <footer style={{ fontSize: '0.85em', opacity: 0.7 }}>
        AWAF static HTML layer
      </footer>
    </section>
  );
}

export default StaticHtmlLayer;
