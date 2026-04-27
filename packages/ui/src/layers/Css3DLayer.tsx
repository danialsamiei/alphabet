/**
 * @module layers/Css3DLayer
 * @description
 * لایه ۲ — CSS 3D transforms با initialization تنبل.
 * Layer 2 — CSS 3D transforms with `transform-style: preserve-3d`.
 * Animations are gated by reduced-motion support so SSR markup matches
 * the client. No JS animation loop, no canvas, no WebGL.
 */

import { type CSSProperties, type ReactNode } from 'react';
import { useMediaQuery } from '../runtime/hydration-safe.js';

export interface Css3DLayerProps {
  readonly heading?: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly direction?: 'ltr' | 'rtl';
  readonly locale?: string;
}

const wrapperStyle: CSSProperties = {
  perspective: '1200px',
  padding: '2rem',
  fontFamily: 'system-ui, sans-serif',
};

const cardBase: CSSProperties = {
  transformStyle: 'preserve-3d',
  transform: 'rotateX(8deg) rotateY(-12deg)',
  background: 'linear-gradient(135deg, #312e81 0%, #0ea5e9 100%)',
  color: 'white',
  borderRadius: '1rem',
  padding: '2rem',
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
};

/**
 * لایه CSS 3D — یک کارت با perspective و rotateX/Y که توسط CSS variables
 * آماده شده. animation فقط در صورت غیرفعال بودن reduced-motion اعمال می‌شود.
 */
export function Css3DLayer({
  heading = 'AWAF',
  description,
  children,
  direction = 'ltr',
  locale,
}: Css3DLayerProps): JSX.Element {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  const card: CSSProperties = reduced
    ? cardBase
    : { ...cardBase, transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)' };
  return (
    <section
      data-awaf-layer="CSS_3D"
      dir={direction}
      {...(locale !== undefined ? { lang: locale } : {})}
      style={wrapperStyle}
      aria-label="AWAF CSS 3D layer"
    >
      <div style={card}>
        <h1 style={{ margin: 0 }}>{heading}</h1>
        {description !== undefined ? <p>{description}</p> : null}
        {children}
      </div>
    </section>
  );
}

export default Css3DLayer;
