/**
 * @file apps/docs/theme.config.tsx
 * @description
 * Nextra theme configuration. Dark-first, Alphabet brand palette
 * (`#1c2432` navy, `#00d4c8` teal, `#ffd93d` yellow), RTL-aware so Persian
 * pages render with the correct direction without forking the theme.
 */
import type { DocsThemeConfig } from 'nextra-theme-docs';
import React from 'react';

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#ffd93d',
          color: '#1c2432',
          fontWeight: 800,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 16,
        }}
      >
        A
      </span>
      <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>alphabet</span>
      <span style={{ opacity: 0.55, fontSize: 13 }}>v1.0</span>
    </span>
  ),
  project: {
    link: 'https://github.com/danialsamiei/alphabet',
  },
  docsRepositoryBase:
    'https://github.com/danialsamiei/alphabet/blob/main/apps/docs',
  // i18n locales. Persian content lives alongside the canonical English
  // markdown today; we declare both so RTL routing is wired for the future.
  i18n: [
    { locale: 'en', name: 'English' },
    { locale: 'fa', name: 'فارسی', direction: 'rtl' },
  ],
  // Brand colours used for the active link, pagination, etc.
  primaryHue: 175, // teal #00d4c8
  primarySaturation: 100,
  // Dark-first.
  darkMode: true,
  nextThemes: { defaultTheme: 'dark' },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Alphabet — a privacy-first, context-aware, adaptive web SDK." />
      <meta property="og:title" content="Alphabet — The Alphabet of Your Web" />
      <meta property="og:description" content="A privacy-first, context-aware, adaptive web SDK. Five render layers. Four consent tiers. Zero invasive tracking." />
      <meta name="theme-color" content="#1c2432" />
    </>
  ),
  footer: {
    content: (
      <span>
        © {new Date().getFullYear()} Alphabet — part of{' '}
        <a href="https://alef.ba" style={{ textDecoration: 'underline' }}>
          Alefba International AI Research &amp; Development Program
        </a>
        . MIT License.
      </span>
    ),
  },
  // Honour the visitor's reduced-motion preference; Nextra's default
  // animations are subtle, but RTL languages should also disable them.
  feedback: {
    content: 'Question? Open an issue →',
    labels: 'docs',
  },
  editLink: { content: 'Edit this page on GitHub' },
  search: { placeholder: 'Search docs…' },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  // Color tokens are exposed as CSS variables in the generated stylesheet.
  // Nextra's theme override hook is via `themeSwitch`/CSS, set in styles.css.
};

export default config;
