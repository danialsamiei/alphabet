<!--
  apps/danial-demo/README.md
  Public-facing README for the Alphabet 1.0 (danial.ai Edition) demo app.
-->

<div align="center">

<img src="./public/logo.png" alt="Alphabet" width="120" />

# Alphabet 1.0 — danial.ai Edition

### The Alphabet of Your Web · الفبای وب تو

Built by [Danial Samiei](https://danial.ai) to power **danial.ai** —
the first website that truly understands you **without tracking you**.

[![Live demo](https://img.shields.io/badge/▶_Try_the_live_demo-danial.ai-00d4c8?style=for-the-badge)](https://danial.ai/alphabet)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdanialsamiei%2Falphabet&project-name=alphabet-danial-demo&root-directory=apps%2Fdanial-demo&build-command=cd+..%2F..+%26%26+pnpm+install+--frozen-lockfile+%26%26+pnpm+--filter+%27%40alphabet%2Fdanial-demo...%27+build&output-directory=dist)

</div>

---

## This is the canonical deployable demo

`apps/danial-demo` is the **single canonical deployable demo** for the Alphabet SDK.
If you need one stable path for CI/CD pipelines, docs, onboarding, or production preview, use this directory.

## What this is

A flagship, production-grade interactive demo of the [Alphabet SDK](../../README.md)
— a privacy-first, context-aware adaptive web framework. Designed to live
embedded on **danial.ai** as the public showcase of the project.

Every section runs against the real `@alphabet/core`, `@alphabet/ui`,
`@alphabet/api`, and `@alphabet/protocols` packages. No mocked screenshots,
no hand-waving — it's the SDK explaining itself by running itself.

## Six interactive proofs

| # | Section | What you can do |
|---|---------|-----------------|
| 1 | **Render Layers** | Watch Alphabet seamlessly degrade between R3F Immersive → CSS 3D → Canvas 2D → Static HTML → Text-only. Manually override the layer or simulate slower hardware. |
| 2 | **Context** | Live Context Handshake stream — the `collect → enrich → decide` pipeline with phase timings, signal cards, and decision metadata. |
| 3 | **Consent** | Interactive 4-tier consent ladder with live event log. Every transition (NO_MEMORY → ANONYMOUS → CONSENTED → ENRICHED) is observable. |
| 4 | **Trust Pulse** | Real-time privacy posture — a live 0–100 privacy score, the exact list of signals used, and the active memory tier. Computed locally, never sent to a server. |
| 5 | **Living Memory** | Visualizes the six on-device memory domains (`general`, `site_specific`, `visitor`, `ideas`, `class_notes`, `tech_pulse`). Domains your tier doesn't unlock are visibly locked — no silent writes. |
| 6 | **AI Protocols** | Offline AI Protocol Playground — exercise Alphabet Protocol v2 against the in-process mock server. |

Plus the **Invisible Ethical Alef Agent** — a floating co-pilot (the FAB
in the corner) that offers context-aware suggestions like *"Reduced motion
is on — switch to Static HTML?"* without ever interrupting the user or
storing anything.

## Stack

- **Vite 5** + **React 18** + **TypeScript strict** (zero `any`).
- **Glassmorphism dark/light** design system with `prefers-color-scheme`,
  `prefers-reduced-motion`, and `prefers-contrast: more` support.
- **WCAG 2.2 AA** — skip link, keyboard navigation, ARIA roles, RTL
  support for Persian (`fa-IR`) and Arabic (`ar-SA`), screen-reader text
  layer, focus rings, color contrast > 4.5:1.
- Adaptive Render Layers in the hero — the page literally shows the SDK
  degrading itself in real time on your device.
- Sub-60 ms handshake on a modern laptop (`HandshakeOrchestrator.run ≈
  5.6 µs` mean — see `pnpm -F @alphabet/core bench`).

## Local development

This is a workspace package inside the Alphabet monorepo. Run from the
repository root:

```bash
pnpm install
pnpm --filter '@alphabet/danial-demo' dev       # → http://localhost:5173
pnpm --filter '@alphabet/danial-demo' build     # → dist/
pnpm --filter '@alphabet/danial-demo' preview   # serve dist/
```


## Environment profiles

The app ships with three Vite profiles:

- `preview` → `.env.preview`
- `staging` → `.env.staging`
- `production` → `.env.production`

### Env matrix

| Variable | preview | staging | production |
|---|---|---|---|
| `VITE_ALPHABET_PROFILE` | `preview` | `staging` | `production` |
| `VITE_ALPHABET_API_BASE_URL` | `https://preview-api.alphabet.alef.ba` | `https://staging-api.alphabet.alef.ba` | `https://api.alphabet.alef.ba` |
| `VITE_ALPHABET_ENABLE_TELEMETRY` | `false` | `true` | `true` |
| `VITE_ALPHABET_ENABLE_EXPERIMENTAL_CHIPS` | `true` | `true` | `false` |
| `VITE_ALPHABET_ENABLE_PROTOCOL_PLAYGROUND` | `true` | `true` | `true` |
| `VITE_ALPHABET_ENABLE_MOCK_FALLBACK` | `true` | `true` | `false` |
| `VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE` | `true` | `true` | `true` |

Run with a profile:

```bash
pnpm --filter '@alphabet/danial-demo' dev --mode preview
pnpm --filter '@alphabet/danial-demo' dev --mode staging
pnpm --filter '@alphabet/danial-demo' build --mode production
```

## Backend fallback behavior

Protocol Playground can use backend transport or in-process mock transport.

1. It starts in `mock` for preview/staging and `backend` for production profile.
2. If backend request fails and `VITE_ALPHABET_ENABLE_MOCK_FALLBACK=true`, it automatically switches to mock mode.
3. If fallback is disabled but `VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE=true`, UI shows a degraded UX error state instead of crashing.

## Smoke health endpoint

A static probe is available after deploy:

- `GET /healthz.json`

Expected payload includes `{"status":"ok","service":"@alphabet/danial-demo"}` for lightweight smoke checks in CI/CD.

## Embedding on danial.ai

The demo ships an embeddable React component — drop it into any page on
`danial.ai` (or any other host) and you get the full experience:

```tsx
import { AlphabetDemo } from '@alphabet/danial-demo';
import '@alphabet/danial-demo/styles';

export default function AlphabetPage() {
  return <AlphabetDemo defaultTab="layers" />;
}
```

### Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `defaultTab` | `'layers' \| 'context' \| 'consent' \| 'trust' \| 'memory' \| 'protocols'` | `'layers'` | Which experience to land on. |
| `compact` | `boolean` | `false` | Hide the simulation toggles fieldset. |
| `showHero` | `boolean` | `true` | Suppress the hero if the host page already has one. |
| `showAgent` | `boolean` | `true` | Render the floating Alef Agent FAB. |

The component owns its own `<AlphabetProvider>`, `<LayerProvider>`, and
`<ConsentBanner>`, so you don't need to wire anything up.

For an operator-focused deployment/rollback procedure, see [`docs/DEMO_DEPLOY_RUNBOOK.md`](../../docs/DEMO_DEPLOY_RUNBOOK.md).

## Deploying to Vercel

The repository is a pnpm workspace, so Vercel needs to install from the
root and build only this app. The included `vercel.json` does exactly
that:

```json
{
  "framework": "vite",
  "buildCommand": "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter '@alphabet/danial-demo...' build",
  "outputDirectory": "dist"
}
```

### One-click deploy

1. Click **Deploy with Vercel** at the top.
2. Set **Root Directory** to `apps/danial-demo`.
3. Vercel auto-detects `vercel.json` — no overrides needed.

Or via CLI:

```bash
cd apps/danial-demo
vercel deploy --prebuilt --prod=false
```

### Custom domain — `danial.ai/alphabet`

In Vercel project settings → **Domains**:
1. Attach `danial.ai` (or `alphabet.danial.ai`).
2. If embedding the demo at a sub-path on the existing `danial.ai` site
   (e.g. `danial.ai/alphabet`), prefer the `<AlphabetDemo />` component
   embed inside the existing Next.js app — that keeps SEO and analytics
   on a single deployment.

## SEO & Open Graph

The `<head>` ships with full canonical, OG, and Twitter card metadata,
referencing the official 3D stacked teal/cyan logo at `/logo.png`. Tune
the `og:url`, `canonical`, and program metadata in `index.html` for your
deployment target.

## Folder structure

```
apps/danial-demo/
├── public/
│   ├── logo.png              # Official Alphabet logo (3D stacked teal/cyan)
│   ├── logo-small.png        # Favicon / small surfaces
│   ├── og-card.svg           # OG card SVG (fallback)
│   └── wordmark.svg
├── src/
│   ├── components/
│   │   ├── Hero.tsx          # Flagship hero with adaptive render layer bg
│   │   └── AlefAgent.tsx     # Invisible ethical co-pilot FAB + panel
│   ├── experiences/
│   │   ├── LayerSwitcherExperience.tsx     # Render Layers
│   │   ├── ContextDashboardExperience.tsx  # Context handshake stream
│   │   ├── ConsentLadderExperience.tsx     # Consent Ladder
│   │   ├── TrustPulseExperience.tsx        # Trust Pulse Dashboard
│   │   ├── LivingMemoryExperience.tsx      # Living Memory engine
│   │   └── ProtocolPlaygroundExperience.tsx# AI Protocol Playground
│   ├── AlphabetDemo.tsx      # Embeddable component (public surface)
│   ├── App.tsx               # Standalone wrapper
│   ├── main.tsx              # Vite entry
│   ├── styles.css            # Glassmorphism design system
│   └── index.ts              # Barrel — exports <AlphabetDemo />
├── index.html                # SEO + OG meta tags
├── vercel.json               # Monorepo-aware Vercel config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## License

Same as the parent monorepo.
