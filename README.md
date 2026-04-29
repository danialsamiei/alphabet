# Alphabet

> **Alphabet is a privacy-first adaptive web SDK for building context-aware, multilingual, capability-adaptive, AI-ready web experiences without invasive tracking.**

<p align="left">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/pnpm-9.0+-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="License" />
</p>

> ⚠️ **Alphabet is pre-alpha.** The README is honest about what ships today vs. what
> is planned. For a feature-by-feature audit, see
> [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md). For the
> sequenced plan to 1.0, see [`docs/ROADMAP.md`](docs/ROADMAP.md). For a
> 5-minute introduction, see [`docs/LAUNCH_NARRATIVE.md`](docs/LAUNCH_NARRATIVE.md).

**Alphabet** = **A**daptive **W**eb **A**wareness **F**ramework. The "A" also
honours the project's origin name **الفبا (Alefba)** — Persian for *alphabet*,
the elementary letters from which any language is built. Alphabet treats
*language*, *direction*, *device*, *network*, and *consent* as letters of an
alphabet that the page assembles itself from at runtime.

---

## Table of contents

- [Why Alphabet exists](#why-alphabet-exists)
- [What Alphabet is *not*](#what-alphabet-is-not)
- [Core concepts](#core-concepts)
- [Quick start](#quick-start)
- [Implemented features](#implemented-features)
- [Roadmap](#roadmap)
- [Examples](#examples)
- [Privacy model](#privacy-model)
- [Integration targets](#integration-targets)
- [Comparison with adjacent tools](#comparison-with-adjacent-tools)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [خلاصه فارسی (Persian summary)](#خلاصه-فارسی-persian-summary)

---

## Why Alphabet exists

Most websites still serve every visitor the same glyphs, in the same direction,
at the same visual fidelity, regardless of who they are or what their browser
already knows about them. The two common ways out of this are bad:

- **Static one-size-fits-all** — fast and private, but the experience does not
  speak the visitor's language, respect their device, or honour their motion
  preferences.
- **Heavy client-side personalization** — adaptive, but typically built on
  cookies, fingerprinting, third-party trackers, and dark consent patterns.

Alphabet takes a third path: read the **passive, non-invasive signals the browser
already exposes** (Accept-Language, IANA timezone, viewport, WebGL support,
network class, `prefers-reduced-motion`, DNT, GPC) and turn them into a small,
fully-typed UI configuration — *before* a single tracking pixel fires.

The goal is "a web that knows your language, respects your hardware, and
remembers what you let it remember — and nothing else."

---

## What Alphabet is *not*

To stay credible, here is what Alphabet deliberately is **not**:

- **Not a meta-framework.** Alphabet does not own routing, rendering, or your build
  pipeline. It runs alongside Next.js, Astro, Remix, or plain Vite + React.
- **Not an i18n library.** Alphabet detects and negotiates the locale and writing
  direction; it then hands them off to whatever i18n library you already use
  (i18next, next-intl, FormatJS, etc.).
- **Not an LLM SDK.** Alphabet does not bundle OpenAI, Anthropic, or Vercel AI SDK
  as runtime dependencies. It normalizes context, consent, and memory
  permissions for *whichever* AI client you pick.
- **Not a Consent Management Platform (CMP).** Alphabet ships a developer-grade
  consent state machine and DNT/GPC enforcement in code. It can interoperate
  with a full CMP (OneTrust, Cookiebot) — it does not aim to replace one.
- **Not a feature-flag / experimentation platform.** Alphabet can feed
  privacy-safe context traits (locale, capability layer, consent tier) to
  GrowthBook, LaunchDarkly, Statsig — it does not run experiments itself.
- **Not "production-ready" yet.** Alphabet is pre-alpha. The roadmap is honest;
  the README does not claim shipped what is only planned.
- **Not a compliance certification.** Alphabet's behaviour aligns with GDPR/CCPA
  *principles* (lawful basis, data minimization, right to erasure), but the
  project has not been audited and makes no compliance guarantees.

---

## Core concepts

Four ideas drive the entire SDK. Each is documented in depth in
[`docs/CORE_CONCEPTS.md`](docs/CORE_CONCEPTS.md).

### 1. Context Handshake
A small, fast, fully-typed pipeline (`SignalCollector → EnrichmentPipeline →
HandshakeDecisionEngine`) that turns passive browser signals into a UI
configuration: locale, direction, theme, capability layer, hero copy, and a
`privacyMode` object that says what the current request is allowed to do.

### 2. Consent ladder
Four monotonic tiers — `NO_MEMORY` → `ANONYMOUS` → `CONSENTED` → `ENRICHED` —
enforced by code through pure helpers (`canStoreMemory`, `canPersonalize`,
`canUseAnalytics`, `canUsePreciseGeo`). DNT/GPC auto-downgrade to `NO_MEMORY`
for *storage and personalization* without affecting which render layer is
shown. See [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md).

### 3. Adaptive Render Layers
Five UI fidelity layers — *R3F immersive*, *CSS 3D*, *Canvas 2D*, *Static
HTML*, *Text-only* — chosen from real device capability and accessibility
preferences (not from privacy signals, not from user-agent strings). The base
bundle is R3F-free; the immersive layer is loaded lazily only when selected.
See [`docs/ADAPTIVE_RENDER_LAYERS.md`](docs/ADAPTIVE_RENDER_LAYERS.md).

> *Adaptive Render Layers* is the public concept name. Earlier drafts called
> this "UI Degradation"; the TypeScript enum values
> (`R3F_IMMERSIVE`, `CSS_3D`, `CANVAS_2D`, `STATIC_HTML`, `TEXT_ONLY`) are
> unchanged for compatibility.

### 4. AI-ready, provider-neutral protocols
A normalized `AlphabetProtocolRequest` / `AlphabetProtocolResponse` envelope that
adapter packages expose over Direct REST, MCP (Model Context Protocol), A2A
(Agent-to-Agent), and QR handoff — without locking you to any LLM provider.
See [`docs/PROTOCOLS.md`](docs/PROTOCOLS.md) and
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

---

## Quick start

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0

### Install and run the test suite

```bash
git clone https://github.com/danialsamiei/alphabet.git
cd alphabet

pnpm install
pnpm build
pnpm typecheck
pnpm test
```

### Use the handshake primitives

The fully-shipped, end-user-facing surface today is `@alphabet/core`. A minimal,
honest example:

```typescript
import {
  SignalCollector,
  EnrichmentPipeline,
  HandshakeDecisionEngine,
} from '@alphabet/core';

// 1. Collect passive browser signals (no IP lookup, no third-party calls).
const signals = new SignalCollector().collect();

// 2. Enrich with a coarse geo context that *you* supply
//    (Alphabet does not do server-side IP→geo lookups itself).
const enriched = new EnrichmentPipeline().enrich(signals, {
  country: 'US', // ISO 3166-1 alpha-2
  timezone: signals.timezone,
});

// 3. Decide the UI configuration.
const decision = new HandshakeDecisionEngine().decide(enriched);

console.log(decision.uiConfig);
// { locale: 'en-US', dir: 'ltr', layer: 'STATIC_HTML', heroCopy: '…', … }
console.log(decision.privacyMode);
// { canStoreMemory: false, canPersonalize: false, canUseAnalytics: false, canUsePreciseGeo: false }
```

### Use the React surface

```tsx
import { AlphabetProvider, AdaptiveSlot, ConsentBanner } from '@alphabet/ui';

export function App() {
  return (
    <AlphabetProvider>
      <AdaptiveSlot
        r3f={({ direction, locale }) => <ImmersiveScene dir={direction} lang={locale} />}
        css3d={({ direction, locale }) => <Css3dHero dir={direction} lang={locale} />}
        canvas2d={({ direction, locale }) => <Canvas2dHero dir={direction} lang={locale} />}
        staticHtml={({ direction, locale }) => <StaticHero dir={direction} lang={locale} />}
        textOnly={({ direction, locale }) => <TextHero dir={direction} lang={locale} />}
      />
      <ConsentBanner />
    </AlphabetProvider>
  );
}
```

More examples (Vite + React, Next.js App Router, Astro Islands) live in
[`examples/`](examples/) and are catalogued in
[`docs/EXAMPLES.md`](docs/EXAMPLES.md).

---

## Implemented features

The following ships as real code, exported from a package, and covered by
unit tests in this repository. See
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for
file-level evidence.

### `@alphabet/core` ✅
- Strict-typed foundation: `Result<T, E>`, branded IDs (`VisitorId`,
  `SessionId`, `MemoryId`, `RequestId`, `ConsentToken`, `AuditLogId`,
  `ConfirmationId`), `ConsentTier`, `CapabilityLayer`, `MemoryDomain`,
  `ProtocolType`.
- `AlphabetConfig`, `AlphabetLogger` (PII-safe, `exactOptionalPropertyTypes`-clean),
  `AlphabetEventEmitter`.
- Three handshake primitives: `SignalCollector`, `EnrichmentPipeline`,
  `HandshakeDecisionEngine` (locale + hero-copy maps for 25+ locales).
- Privacy helpers: `canStoreMemory`, `canPersonalize`, `canUseAnalytics`,
  `canUsePreciseGeo` — the only authoritative permission checks in the SDK.

### `@alphabet/api` 🟡
- `AlphabetClient` with one method per documented endpoint, returning
  `Promise<Result<T, AlphabetError>>`. `fetch` + `AbortController` timeouts.
- `HandshakeClient` for `POST /api/alphabet/v1/context/handshake` (envelope
  in / envelope out).
- Canonical prefix `/api/alphabet/v1` (legacy `/api` accepted via
  `normalizeApiBaseUrl`). Full contract in
  [`openapi/alphabet.v1.yaml`](openapi/alphabet.v1.yaml).
- Not yet: retry/backoff, SSE handler, mock server, rate-limit parsing.

### `@alphabet/security` ✅ (defence-in-depth supplement)
- `ConsentTierManager` — code-enforced state machine
  (`pending → granted → revoked`) with monotonic upgrades, DNT/GPC
  auto-downgrade, and policy-version invalidation.
- PII redaction (`redactPII`, `redactPIIDeep`, `detectPII`) with three
  strictness levels.
- Prompt-injection heuristics (`detectPromptRisk`).
- Output validation (`validateUrl`, `sanitizeHtml`, `markTextAsSafe`).
- `MemoryIntegrityGuard`, `AlphabetAuditLogger` with structured event
  categories and automatic PII redaction.
- **Scope.** This is a defence-in-depth supplement, *not* a complete
  security solution. See [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md).

### `@alphabet/ui` 🟡
- `AlphabetProvider`, `AdaptiveSlot` (5-layer renderer with lazy R3F),
  `ConsentBanner`, `TransparencyNotice`, hooks (`useAlphabetContext`,
  `useConsent`).
- Subpath exports: `./hooks`, `./layers`, `./layers/r3f`, `./runtime`.
- R3F + `three` are external in the base bundle; the immersive layer is
  loaded only when selected.

### `@alphabet/protocols` 🟡
- Normalized `AlphabetProtocolRequest` / `AlphabetProtocolResponse` contract.
- `direct-api`, `mcp`, `a2a`, `qr-handoff`, `normalizers`, `errors`,
  `ai-sdk` subpaths. AES-GCM-encrypted QR handoff with audience binding
  and 60s default expiry.

### Repository tooling
- pnpm workspaces + Turborepo 2.x (`tasks` schema). `pnpm build` /
  `pnpm test` / `pnpm typecheck` all green.
- Per-package Vite library builds (ESM + CJS).
- Strict TypeScript everywhere — no `any` in source,
  `exactOptionalPropertyTypes: true`.
- Changesets + size-limit.

---

## Roadmap

A condensed view; the full plan is in [`docs/ROADMAP.md`](docs/ROADMAP.md).

| Phase | Focus | Key artifacts |
|---|---|---|
| **1 — Truth alignment** *(current)* | Honest README, Implementation Status, Roadmap, comparison & integration narrative. | This README, `docs/IMPLEMENTATION_STATUS.md`, `docs/CORE_CONCEPTS.md`, `docs/INTEGRATIONS.md`. |
| **2 — Smallest end-to-end** | `HandshakeOrchestrator`, real `display`/`consent`/`morph` phases, mock server, Layers 4 + 5 demo. | `apps/demo` running; `pnpm dev` opens an adaptive page. |
| **3 — Adapters** | `@alphabet/next`, `@alphabet/vite`, `@alphabet/astro` first-class wrappers. | Working examples in `examples/`. |
| **4 — Pulse plugin** | `@alphabet/pulse` (formerly Technology Pulse): trust-tiered ingestion, C2PA-style provenance, RAG brief generation. | Optional plugin module, opt-in. |
| **5 — Hardening** | Benchmarks (sub-100 ms handshake target), NIST AI RMF mapping doc, cost guardian, differential-privacy helpers, accessibility audit. | 1.0 release. |

No fixed dates are committed. Phases are scoped, not timeboxed.

---

## Examples

Three runnable starters live in [`examples/`](examples/):

| Example | Stack | What it demonstrates |
|---|---|---|
| [`examples/vite-react-basic`](examples/vite-react-basic) | Vite + React | `AlphabetProvider`, `AdaptiveSlot`, `ConsentBanner`, `TransparencyNotice`. |
| [`examples/next-app-router-basic`](examples/next-app-router-basic) | Next.js App Router | SSR-safe handshake, server / client boundaries. |
| [`examples/astro-islands-basic`](examples/astro-islands-basic) | Astro Islands | Static-first rendering with React island for Alphabet. |

Walk-throughs are in [`docs/EXAMPLES.md`](docs/EXAMPLES.md).

---

## Privacy model

The full model lives in [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md). The
short version:

- **Tier 0 (`NO_MEMORY`) by default.** Until a visitor explicitly grants
  consent, Alphabet stores nothing, profiles nothing, and personalizes nothing.
- **DNT/GPC restrict storage and personalization, *not* rendering.** A
  visitor with GPC enabled and a capable device still sees an immersive UI;
  they just don't get tracked. Render layer is selected from device
  capability and accessibility preferences only.
- **Coarse geo by default.** `EnrichmentPipeline.enrich(signals)` returns
  `{ country, timezone, region }`. `city`, `coarseLatitude`, and
  `coarseLongitude` are gated behind `{ allowPreciseGeo: true }` *and*
  `canUsePreciseGeo()` returning true.
- **No fingerprinting. No cookies. No PII in logs.** Alphabet reads passive
  signals only and never hashes navigator properties into a fingerprint.
- **Code-enforced consent ladder.** `ConsentTierManager` is a state machine
  with monotonic upgrades, explicit revoke, DNT/GPC auto-downgrade, and
  policy-version invalidation.

Alphabet is **aligned with GDPR, CCPA, and LGPD principles** (lawful basis, data
minimization, right to erasure, opt-out signals). It is **not certified
compliant** with any of them — that is the integrator's responsibility, and
auditing is on the roadmap.

---

## Integration targets

Alphabet is designed to *integrate*, not replace. See
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) for the full guide.

| Integration | What Alphabet contributes |
|---|---|
| **Next.js / Astro / Remix / Vite + React** | Runs alongside as a small SDK. Hands the handshake decision to your renderer; never owns routing or hydration. |
| **i18next, next-intl, FormatJS** | Detects `Accept-Language`, negotiates the primary locale + direction, hands the chosen `locale` and `dir` to your i18n library. |
| **Vercel AI SDK, LangChain, OpenAI/Anthropic SDK** | Provides a normalized `AlphabetProtocolRequest` envelope with consent and memory permissions. Alphabet stays provider-neutral; you keep your model client. |
| **GrowthBook, LaunchDarkly, Statsig** | Exposes privacy-safe context traits (`locale`, `capabilityLayer`, `consentTier`, `prefersReducedMotion`) for targeting and experimentation. |
| **OneTrust, Cookiebot, Klaro** | Interoperates with a full CMP via the consent state machine; Alphabet's `ConsentTierManager` can be the source-of-truth or a downstream consumer. |
| **Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy)** | The `@alphabet/core` handshake is pure-TypeScript, dependency-free, and edge-safe. |

---

## Comparison with adjacent tools

A short, accurate version of the integration table above:

| Tool | Alphabet's relationship |
|---|---|
| **Next.js** | Alphabet integrates with it; does not replace it. |
| **Astro** | Alphabet shares Astro's static-first / progressive-enhancement principles and runs as a React island or a server-side helper. |
| **Vercel AI SDK** | Alphabet complements it with context, consent, and adaptive UI. Alphabet does not bundle a model client. |
| **i18next / next-intl** | Alphabet detects language and direction, then delegates localization. |
| **GrowthBook / LaunchDarkly** | Alphabet can provide privacy-safe context traits for targeting and experimentation. |
| **OneTrust / Cookiebot** | Alphabet ships a developer-grade consent state machine; it interoperates with a full CMP rather than replacing one. |

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/LAUNCH_NARRATIVE.md`](docs/LAUNCH_NARRATIVE.md) | 5-minute introduction: problem, solution, why now, target devs, demo story. |
| [`docs/CORE_CONCEPTS.md`](docs/CORE_CONCEPTS.md) | Context Handshake, Consent Ladder, Adaptive Render Layers, AI-ready protocols. |
| [`docs/ADAPTIVE_RENDER_LAYERS.md`](docs/ADAPTIVE_RENDER_LAYERS.md) | The five layers, capability matrix, and accessibility rules. |
| [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md) | Tier 0 default, DNT/GPC behaviour, coarse geo, code-enforced consent. |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Request/response envelope, `Result<T, E>`, route table, versioning. |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Integration patterns for Next.js, Astro, i18next, AI SDKs, feature-flag platforms. |
| [`docs/EXAMPLES.md`](docs/EXAMPLES.md) | Walk-through of the example projects in `examples/`. |
| [`docs/PROTOCOLS.md`](docs/PROTOCOLS.md) | Direct REST, MCP, A2A, QR handoff adapters. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Conceptual 8-layer architecture (vision-level). |
| [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) | Truth-of-record audit: what is implemented vs. planned. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased plan to 1.0. |
| [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) | Scope and limitations of `@alphabet/security`. |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) · [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) · [`docs/CODING_CONVENTIONS.md`](docs/CODING_CONVENTIONS.md) | Contributor onboarding. |
| [`AGENTS.md`](AGENTS.md) | AI-agent onboarding (vision-level). |

---

## Contributing

We welcome code, documentation, translation, and security contributions.

- **General contribution guide:** [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- **Coding conventions:** [`docs/CODING_CONVENTIONS.md`](docs/CODING_CONVENTIONS.md)
- **AI-agent onboarding:** [`AGENTS.md`](AGENTS.md)

A few rules specific to this stage of the project:

1. **No new overclaiming.** PRs may not introduce phrases like "complete
   defense", "fully implemented", "guarantees", or "compliant" for features
   that are not backed by shipped code, tests, and an entry in
   `docs/IMPLEMENTATION_STATUS.md`.
2. **No new runtime dependencies** unless absolutely necessary. Alphabet stays
   light. Build-time dev dependencies are fine.
3. **TypeScript strictness is non-negotiable.** No `any` in source; use
   `unknown` + narrowing or branded types.
4. **Prefer files under 300 lines** where practical.

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## خلاصه فارسی (Persian summary)

<div dir="rtl" align="right">

**Alphabet** — *Alefba Web-Aware Framework* (با ریشهٔ نام **الفبا**) یک
SDK سبک به زبان TypeScript است: یک لایهٔ **بافتار تطبیقی و حریم خصوصی**
که در کنار Next.js، Astro، i18next، Vercel AI SDK، GrowthBook و
LaunchDarkly قرار می‌گیرد و **جایگزین** هیچ‌کدام نیست.

Alphabet در millisecond‌های اول ورود بازدیدکننده، **سیگنال‌های منفعل مرورگر**
(زبان، timezone، دستگاه، GPU، شبکه، DNT/GPC، prefers-reduced-motion) را
می‌خواند و بر پایه آن‌ها — و **با احترام کامل به consent کاربر** — locale،
جهت نوشتار، لایهٔ رندر، و کپی hero را انتخاب می‌کند. هیچ fingerprinting،
هیچ cookie، هیچ PII در لاگ.

«الفبا» مجموعه‌ای ابتدایی از حروف است که هر زبان از ترکیب آن‌ها ساخته
می‌شود. Alphabet نیز زبان، جهت نوشتار، دستگاه، و رضایت کاربر را به‌عنوان
حروف الفبای یک تجربه وب در نظر می‌گیرد.

**این پروژه در مرحله pre-alpha است.** برای دیدن دقیق آنچه پیاده‌سازی شده
در مقابل آنچه فقط طراحی شده، به
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) مراجعه
کنید. برای نقشه راه تا ۱.۰، به
[`docs/ROADMAP.md`](docs/ROADMAP.md) و برای معرفی پنج‌دقیقه‌ای، به
[`docs/LAUNCH_NARRATIVE.md`](docs/LAUNCH_NARRATIVE.md).

</div>

---

<p align="left">
  <sub>Made with ❤️ inside the <strong>الفبا (Alefba)</strong> framework — where the web becomes aware.</sub>
</p>
