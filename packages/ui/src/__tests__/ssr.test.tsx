/**
 * SSR safety — `renderToString` must not crash and the layer-selector
 * must return STATIC_HTML when `isBrowser=false`.
 *
 * The hooks themselves use `useEffect` for any browser-only access, so
 * the initial render on the server is safe by construction. This test
 * locks in that behavior.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TextOnlyLayer } from '../layers/TextOnlyLayer.js';
import { StaticHtmlLayer } from '../layers/StaticHtmlLayer.js';
import { Css3DLayer } from '../layers/Css3DLayer.js';
import { Canvas2DLayer } from '../layers/Canvas2DLayer.js';
import { selectAdaptiveLayer } from '../runtime/layer-selector.js';

describe('SSR safety', () => {
  it('selectAdaptiveLayer with isBrowser=false returns STATIC_HTML', () => {
    const r = selectAdaptiveLayer({ isBrowser: false, webglSupported: true });
    expect(r.layer).toBe('STATIC_HTML');
    expect(r.reasonCode).toBe('ssr-fallback');
  });

  it('TextOnlyLayer renders to a string with all landmarks', () => {
    const html = renderToString(
      <TextOnlyLayer heading="SSR" description="From the server" locale="en" />
    );
    expect(html).toContain('role="banner"');
    expect(html).toContain('role="main"');
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain('SSR');
  });

  it('StaticHtmlLayer renders to a string', () => {
    const html = renderToString(<StaticHtmlLayer heading="Static" />);
    expect(html).toContain('Static');
    expect(html).toContain('data-awaf-layer="STATIC_HTML"');
  });

  it('Css3DLayer renders to a string without crashing on matchMedia', () => {
    // useMediaQuery's getServerSnapshot returns the SSR fallback (false)
    // so this must succeed without window/matchMedia.
    const html = renderToString(<Css3DLayer heading="3D" />);
    expect(html).toContain('3D');
    expect(html).toContain('data-awaf-layer="CSS_3D"');
  });

  it('Canvas2DLayer renders to a string without invoking canvas APIs', () => {
    const html = renderToString(<Canvas2DLayer heading="Canvas" />);
    expect(html).toContain('Canvas');
    expect(html).toContain('data-awaf-layer="CANVAS_2D"');
  });
});
