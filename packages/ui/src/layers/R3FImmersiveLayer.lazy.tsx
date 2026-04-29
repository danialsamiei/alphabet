/**
 * @module layers/R3FImmersiveLayer.lazy
 * @description
 * لایه ۱ — R3F Immersive (lazy entry point).
 * Layer 1 — React Three Fiber immersive layer. **This file is the lazy
 * entry point** that `AdaptiveSlot` loads with `React.lazy()`. It is
 * shipped as its own bundle (`@alphabet/ui/layers/r3f`) so the base
 * `@alphabet/ui` entrypoint does **not** include R3F or three.js.
 *
 * Note: `@react-three/fiber` and `three` are listed as `external` in
 * the rollup config. Consumers who actually want R3F must install them
 * separately and pass the scene as a render prop. This file
 * intentionally renders a thin host that mounts the user-provided
 * scene inside a `<Suspense>`-friendly container.
 */

import { type ReactNode } from 'react';

export interface R3FImmersiveLayerProps {
  readonly heading?: string;
  readonly description?: string;
  /**
   * Scene render prop — caller composes their own R3F scene with
   * `@react-three/fiber`. Kept opaque so this layer file never imports
   * R3F itself.
   */
  readonly scene?: ReactNode;
  readonly direction?: 'ltr' | 'rtl';
  readonly locale?: string;
  /** متن fallback برای screen reader (R3F canvas دسترس‌پذیر نیست). */
  readonly accessibleLabel?: string;
}

/**
 * R3F Immersive layer — host برای Canvas R3F.
 * R3F immersive layer host — renders the scene render prop inside a
 * decorative wrapper. Always paired with an accessible text fallback
 * so screen-reader users still receive content.
 */
export function R3FImmersiveLayer({
  heading = 'Alphabet',
  description,
  scene,
  direction = 'ltr',
  locale,
  accessibleLabel = 'Alphabet immersive 3D scene (decorative)',
}: R3FImmersiveLayerProps): JSX.Element {
  return (
    <section
      data-alphabet-layer="R3F_IMMERSIVE"
      dir={direction}
      {...(locale !== undefined ? { lang: locale } : {})}
      style={{
        position: 'relative',
        minHeight: '20rem',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: 'radial-gradient(circle at 30% 20%, #1e1b4b 0%, #020617 100%)',
        color: 'white',
        borderRadius: '1rem',
        overflow: 'hidden',
      }}
      aria-label={accessibleLabel}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {scene}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ margin: 0 }}>{heading}</h1>
        {description !== undefined ? <p>{description}</p> : null}
      </div>
    </section>
  );
}

export default R3FImmersiveLayer;
