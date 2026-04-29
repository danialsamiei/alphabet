/**
 * @file components/Hero.tsx
 * @description
 * Flagship hero for the danial.ai Edition demo.
 *
 * Uses the Alphabet AdaptiveSlot as the animated background — so the hero
 * literally shows the SDK degrading itself in real time on the visitor's
 * device. The slot starts at R3F immersive when WebGL is available and
 * gracefully degrades to CSS 3D / Canvas 2D / Static HTML based on the
 * `LayerProvider` decision.
 */

import { useMemo, type CSSProperties } from 'react';
import {
  AdaptiveSlot,
  Canvas2DLayer,
  Css3DLayer,
  LayerProvider,
} from '@alphabet/ui';

interface HeroProps {
  readonly reducedMotion: boolean;
  readonly webglEnabled: boolean;
  readonly onJumpToDemo: () => void;
  readonly localeKey: 'en-US' | 'fa-IR' | 'ar-SA';
}

/**
 * Render the flagship hero — logo, slogans, founder strap, primary CTAs.
 *
 * The animated background is intentionally the live `AdaptiveSlot`, so the
 * hero is a self-demonstrating proof of the Adaptive Render Layers pattern.
 */
export function Hero({
  reducedMotion,
  webglEnabled,
  onJumpToDemo,
  localeKey,
}: HeroProps): JSX.Element {
  const layerOptions = useMemo(
    () => ({
      reducedMotionOverride: reducedMotion,
      webglSupportedOverride: webglEnabled,
      children: null,
    }),
    [reducedMotion, webglEnabled],
  );

  const fallbackStyle: CSSProperties = {
    width: '100%',
    height: '100%',
  };

  return (
    <header className="alf-hero" role="banner">
      <div className="alf-hero-bg" aria-hidden="true">
        <LayerProvider {...layerOptions}>
          <div style={fallbackStyle}>
            <AdaptiveSlot
              r3fFallback={<HeroFallback />}
              r3f={() => <HeroFallback />}
              css3d={(ctx) => (
                <Css3DLayer
                  heading="The Alphabet of Your Web"
                  description=""
                  direction={ctx.direction}
                />
              )}
              canvas2d={(ctx) => (
                <Canvas2DLayer
                  heading="The Alphabet of Your Web"
                  description=""
                  direction={ctx.direction}
                />
              )}
              staticHtml={() => <HeroFallback />}
              textOnly={() => <HeroFallback />}
            />
          </div>
        </LayerProvider>
      </div>
      <div className="alf-hero-bg-fallback" aria-hidden="true" />

      <div className="alf-hero-inner">
        <span className="alf-hero-eyebrow">
          <span className="alf-hero-eyebrow-dot" aria-hidden="true" />
          Alphabet 1.0 · danial.ai Edition
        </span>

        <img
          src="/logo.png"
          alt="Alphabet — stacked teal/cyan layered geometric logo"
          className="alf-hero-logo"
          width={320}
          height={320}
          decoding="async"
        />

        <h1 className="alf-hero-title">The Alphabet of Your Web</h1>

        <p className="alf-hero-slogan-fa" lang="fa-IR" dir="rtl">
          الفبای وب تو
        </p>

        <p className="alf-hero-slogan">
          A privacy-first, context-aware adaptive web SDK — the elementary
          letters every page assembles itself from at runtime.
        </p>

        <p className="alf-hero-strap">
          <strong>Built by Danial Samiei to power danial.ai</strong> —
          the first website that truly understands you{' '}
          <em>without tracking you</em>. Part of the{' '}
          <strong>Alefba International AI Research &amp; Development Program</strong>.
        </p>

        <div className="alf-hero-cta">
          <button
            type="button"
            className="alf-btn alf-btn-primary"
            onClick={onJumpToDemo}
          >
            ▶ Try the live demo
          </button>
          <a
            className="alf-btn alf-btn-ghost"
            href="https://github.com/danialsamiei/alphabet"
            rel="noopener noreferrer"
            target="_blank"
          >
            ★ Star on GitHub
          </a>
          <a
            className="alf-btn alf-btn-ghost"
            href="https://danial.ai"
            rel="noopener noreferrer"
            target="_blank"
          >
            danial.ai →
          </a>
        </div>

        <span className="alf-pill" aria-live="polite">
          {localeKey === 'fa-IR'
            ? 'حافظهٔ صفر · رضایت محور · لبه‌محور'
            : localeKey === 'ar-SA'
              ? 'ذاكرة صفرية · مبني على الموافقة · في الحافة'
              : 'Zero-memory by default · Consent-first · Edge-native'}
        </span>
      </div>
    </header>
  );
}

function HeroFallback(): JSX.Element {
  // A pure-CSS animated gradient — used when R3F can't be lazy-loaded.
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background:
          'radial-gradient(60% 80% at 30% 30%, rgba(0,212,200,0.35), transparent 60%), radial-gradient(50% 70% at 80% 70%, rgba(124,58,237,0.28), transparent 60%)',
      }}
    />
  );
}
