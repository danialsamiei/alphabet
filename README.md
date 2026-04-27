# AWAF — Alefba Web-Aware Framework

> **The privacy-first adaptive web SDK.** A lightweight TypeScript toolkit that
> turns any website into a context-aware, multilingual, capability-adaptive,
> AI-ready experience — without invasive tracking.

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/pnpm-9.0+-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="License" />
</p>

> ⚠️ **AWAF is pre-alpha.** Some packages described in older drafts of this
> README were aspirational. The current README is honest about what ships
> today. For a feature-by-feature audit, see
> [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md). For the
> sequenced plan to 1.0, see [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Table of contents

- [Vision](#vision)
- [Project positioning](#project-positioning)
- [What is implemented today](#what-is-implemented-today)
- [What is partially implemented](#what-is-partially-implemented)
- [What is planned](#what-is-planned)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Origin story — الفبا (Alefba)](#origin-story--الفبا-alefba)
- [Repository layout](#repository-layout)
- [Common commands](#common-commands)
- [Contributing](#contributing)
- [License](#license)
- [خلاصه فارسی (Persian summary)](#خلاصه-فارسی-persian-summary)

---

## Vision

AWAF treats every visitor as a context, not a row. In the first milliseconds of a
page load, AWAF collects **passive, non-invasive browser signals** — language,
timezone, device class, GPU capability, network class, `prefers-reduced-motion`,
DNT/GPC — and uses them to adapt the UI: locale, direction, visual fidelity,
hero copy, and the privacy posture itself.

The vision is "a web that knows your language, respects your hardware, and
remembers what you let it remember — and nothing else."

Concretely, AWAF is built around four ideas:

- **Context Handshake** — a small, fast, fully-typed pipeline that turns passive signals into a UI configuration.
- **Consent ladder** — four tiers (`NO_MEMORY` → `ANONYMOUS` → `CONSENTED` → `ENRICHED`) with explicit, monotonic upgrades, code-enforced permission helpers, and DNT/GPC auto-downgrade for storage and personalization (rendering is unaffected).
- **Capability-adaptive rendering** — five UI layers, from immersive 3D down to pure text, chosen from real device capabilities and accessibility preferences rather than user-agent guesses or privacy signals.
- **AI-ready protocols** — a normalized request/response envelope that adapter packages can expose over MCP, A2A, QR handoff, and direct REST.

Today, the type system, configuration, logger, event hub, and the three core
handshake primitives ship as production code. The rest is on the roadmap and is
labeled as such throughout this README.

---

## Project positioning

**AWAF is not a replacement for any of these tools:**

| You already use… | …keep using it. AWAF |
|---|---|
| **Next.js**, **Astro**, **Remix**, **Vite/React** | runs alongside as a small SDK; it does not own routing or rendering. |
| **i18next**, **next-intl**, **FormatJS** | feeds them the negotiated locale and direction; it does not replace the i18n library. |
| **Vercel AI SDK**, **LangChain**, **OpenAI/Anthropic SDK** | normalizes context and consent for them; it does not replace your model client. |
| **GrowthBook**, **LaunchDarkly**, **Statsig** | feeds them context attributes (locale, capability layer, consent tier); it does not replace your flag/experimentation platform. |
| **OneTrust**, **Cookiebot** (consent management) | provides a developer-grade consent state machine and DNT/GPC auto-downgrade; it can interoperate with a CMP, not necessarily replace it. |

**AWAF is the missing adaptive context and privacy layer that integrates with
those tools.** It answers the questions "what does this visitor's browser tell
me?", "which UI layer should I render?", and "what am I allowed to remember?",
and then hands the answers to whatever framework, i18n library, or AI client
you already use.

---

## Privacy

AWAF's privacy behaviour is **enforced by code**, not just documented.
The full model lives in [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md);
the short version is:

- **Tier 0 by default.** Until the visitor explicitly grants consent, AWAF stores nothing, profiles nothing, tracks nothing, and personalizes nothing.
- **DNT and GPC restrict storage, profiling, tracking, analytics, and personalization.** They **do not** force the visual layer down to STATIC_HTML — render layer is selected from device capability and accessibility preferences (e.g. `prefers-reduced-motion`) only. A visitor with GPC enabled and a capable device still sees an immersive UI; they just don't get tracked.
- **Geo is country/region/timezone only by default.** `EnrichmentPipeline.enrich(signals)` returns `{ country, timezone, region }`. The `city`, `coarseLatitude`, and `coarseLongitude` fields exist on the type but are only populated when the caller explicitly passes `{ allowPreciseGeo: true }` and `canUsePreciseGeo(tier, signals)` returns true.
- **No fingerprinting. No cookies. No PII.** AWAF reads passive signals (Accept-Language, IANA timezone, viewport, WebGL support, DNT, GPC, `prefers-reduced-motion`). It does **not** hash navigator properties into a fingerprint, set cookies, or store IP addresses, emails, names, or phone numbers.
- **Code-enforced consent ladder.** `ConsentTierManager` (in `@awaf/security`) is a state machine with monotonic upgrades, explicit revoke, DNT/GPC auto-downgrade, and policy-version invalidation. Permissions are checked through the pure helpers `canStoreMemory`, `canPersonalize`, `canUseAnalytics`, and `canUsePreciseGeo` (in `@awaf/core/privacy`).

---

## What is implemented today

The following is shipped as real code, exported from a package, and covered by
unit tests in this repository. See
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for file-level
evidence.

### `@awaf/core`

- **Type system** — `Result<T, E>`, branded IDs (`VisitorId`, `SessionId`, `MemoryId`, `RequestId`, `ConsentToken`, `AuditLogId`, `ConfirmationId`), `ConsentTier`, `TrustTier`, `MemoryDomain`, `IntentType`, `CapabilityLayer`, `ProtocolType`, `TokenTier`, `LogLevel`, `DeviceClass`, `HandshakeState`.
- **Domain types** — `DetectedSignals`, `GeoContext`, `VisitorContext`, `VisitorConsent`, `VisitorPreference`, `EnrichedContext`, `VisitorMemory`, `TechnologySignal`, `ProvenanceLink`, `SuggestionOption`, `IntentSession`, plus the `AWAFRequest` / `AWAFResponse` envelope.
- **`AWAFConfig`** — typed configuration object with overrides and defaults.
- **`AWAFLogger`** — structured logger with conditional optional-property spreads (compatible with `exactOptionalPropertyTypes: true`).
- **`AWAFEventEmitter`** — typed event hub with a typed event map.
- **Handshake primitives:**
  - `SignalCollector` — reads passive browser signals (`navigator.language`, `Intl.DateTimeFormat`, `navigator.connection`, `navigator.doNotTrack`, `navigator.globalPrivacyControl`, viewport, DPR, WebGL, `prefers-reduced-motion`). No fingerprinting, no cookies, no PII.
  - `EnrichmentPipeline` — derives a coarse `GeoContext` from the IANA timezone. **By default emits only `country`, `timezone`, and a broad `region` group**; `city`, `coarseLatitude`, and `coarseLongitude` are gated behind an explicit `allowPreciseGeo: true` option.
  - `HandshakeDecisionEngine` — derives locale, direction, theme, capability layer, and hero copy. Ships locale and hero-copy maps for 25+ locales. Returns a `privacyMode` object that reports whether memory, personalization, analytics, and precise geo are allowed in the current request. **DNT/GPC do not change `selectedLayer`** — render is capability- and a11y-driven only.
- **Privacy policy helpers** — `canStoreMemory`, `canPersonalize`, `canUseAnalytics`, `canUsePreciseGeo`. Pure functions in `@awaf/core/privacy` and the only authoritative source of permission checks across the codebase.

### `@awaf/api`

- **`AwafClient`** — HTTP client with one method per documented endpoint (16 in total). Returns `Promise<Result<T, AWAFError>>`. Uses `fetch` with `AbortController`-based timeouts. All routes are sourced from the shared route contract in `@awaf/core` (`AWAF_ROUTES`); `apiBaseUrl` is normalized via `normalizeApiBaseUrl()` so callers may pass a bare origin (`https://x.com`), the canonical prefix (`https://x.com/api/awaf/v1`), or the legacy `/api` segment for backwards compatibility.
- **`HandshakeClient`** — legacy client for the `POST /api/awaf/v1/context/handshake` endpoint, posts an `AWAFRequest<HandshakeRequestPayload>` envelope and unwraps the `AWAFResponse<HandshakeResult>` envelope.
- **Request / response types** for all 16 endpoints in `packages/api/src/types.ts`.
- **Canonical API prefix:** `/api/awaf/v1`. The full OpenAPI 3.1 contract is at [`openapi/awaf.v1.yaml`](openapi/awaf.v1.yaml). Endpoints not yet wired end-to-end are tagged with `x-awaf-status: planned`.

### `@awaf/security`

> **Scope.** `@awaf/security` is a **defence-in-depth supplement**, not a complete security solution. It ships conservative, lightweight guardrails with explicit limitations documented in [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md). It does not claim full OWASP-LLM or NIST AI RMF compliance.

- **`ConsentTierManager`** — code-enforced consent state machine. States: `pending` → `granted` → `revoked` (plus `reset`). Tiers: `NO_MEMORY` < `ANONYMOUS` < `CONSENTED` < `ENRICHED`. Operations: `grant`, `revoke`, `reset`, `downgradeOnPrivacySignal` (DNT/GPC), `invalidateOnPolicyChange`. Enforces the monotonic-upgrade rule via `Result<T, AWAFError>` and exposes a transparent `ConsentTierExplanation` for direct rendering in a consent UI.
- **PII redaction** — `redactPII`, `redactPIIDeep`, `detectPII` for emails, phone-like strings, JWTs, AWS / Google / GitHub / Slack tokens, PEM private-key blocks, IPv4 (strict), and Luhn-checked credit-card numbers. Three strictness levels (`lenient`, `standard`, `strict`). Designed to satisfy the AWAF "no PII in logs by default" rule; not a replacement for a server-side DLP.
- **Prompt-injection heuristics** — `detectPromptRisk` returns `low` / `medium` / `high` plus a recommended action (`allow` / `flag` / `review` / `block`) and an explanation. Bundled patterns cover instruction override, system-prompt exfiltration, role override, safety-off, exfiltration via URL, and fake tool delimiters. Conservative scoring keeps normal user content from being blocked.
- **Output validation** — `validateUrl` (allow-list of protocols and optional hosts; rejects `javascript:`, `data:`, `vbscript:`, `file:`), `sanitizeHtml` (small allow-list of tags, strips `script`/`style`/`iframe`/`object`/`embed`/`on*` handlers, blocks dangerous href / src protocols), and `markTextAsSafe` for plain-text rendering. Returns a branded `SafeRender` type so consumers can refuse to render anything that has not passed through the sanitizer.
- **Memory integrity guard** — `MemoryIntegrityGuard` validates memory writes against consent tier and actor role, enforces admin-only domains (`class_notes`, `tech_pulse`), and applies a configurable cross-domain read ACL. `visitor` is strictly isolated by default.
- **Audit logger** — `AWAFAuditLogger` with structured event categories (`consent_changed`, `privacy_signal_detected`, `memory_write_blocked`, `memory_read_blocked`, `prompt_risk_detected`, `output_rejected`, `policy_version_changed`), automatic PII redaction on every payload, pluggable sinks, and an `InMemoryAuditSink` for tests.
- **Policy defaults** — `DEFAULT_POLICY_VERSION`, `DEFAULT_DOMAIN_READ_ACL`, `ADMIN_ONLY_WRITE_DOMAINS`, and `DEFAULT_PROMPT_INJECTION_PATTERNS` exposed for easy override.

**Not yet shipped:** NIST AI RMF 1.0 mapping document, cost guardian (circuit breaker + token budget), differential privacy helpers, integration with a vector-DB storage layer.

### Repository tooling

- pnpm workspaces + Turborepo 2.x (`tasks` schema), `pnpm build` / `pnpm test` / `pnpm typecheck` all green.
- Per-package Vite library builds (ESM + CJS).
- Vitest test runner, `--passWithNoTests` for stub packages.
- Strict TypeScript everywhere (`strict: true`, `exactOptionalPropertyTypes: true`, no `any` in source).
- Changesets configured for semantic versioning.

---

## What is partially implemented

These items have real code but are not yet end-to-end usable.

- **`@awaf/api` transport features** — every endpoint method is wrapped, but there is no retry/backoff, no SSE handler for `postInteract`, no rate-limit-header parsing, and no mock server in this repository. Consumers need their own backend today.
- **Six-phase handshake lifecycle** — `detect`, `enrich`, and `decide` have executors. `display`, `consent`, and `morph` have a `HandshakeState` type but no orchestrator that drives them yet.
- **Right-to-erasure flow** — the HTTP wrapper (`AwafClient.deleteVisitorMemory`) exists, but the audit-log emission, the consent reset, and the GDPR Article 17 verification flow are not yet implemented in code.

---

## What is planned

These are described in [`AGENTS.md`](AGENTS.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) and **do not yet exist as code**. They are listed here so you can see the destination, not so they can be claimed today.

- **`@awaf/ui`** — `LayerSelector`, the five UI degradation layers (`Layer1R3F` through `Layer5TextOnly`), the `useContextHandshake` and `useConsent` React hooks, and the `<ConsentBanner />` component. Currently a stub package.
- **`@awaf/protocols`** — MCP server, A2A adapter, QR handoff, and a normalized REST adapter. Currently a stub package.
- **`@awaf/security`** — `ConsentTierManager`, PII redaction, prompt-injection heuristics, URL / HTML output validation, `MemoryIntegrityGuard` (consent-tier + ACL enforcement), and `AWAFAuditLogger` (structured events with PII redaction by default) all ship today. NIST AI RMF 1.0 mapping document, cost guardian (circuit breaker + token budget), and differential-privacy helpers are still planned.
- **Memory Mesh runtime** — `DomainFirewall`, browser storage adapters, and (Phase 4) vector-database storage for Tier 3.
- **Technology Pulse pipeline** — five-stage ingestion (ingest → extract → trust-score → verify → embed), C2PA-style provenance, hallucination firewall, RAG brief generation.
- **Adapters** — `@awaf/react`, `@awaf/next`, `@awaf/vite`, `@awaf/astro`.
- **CLI** — `@awaf/cli` with `awaf init`, `awaf doctor`, `awaf bench`.
- **Demo app** — `apps/demo` is currently a stub. A real Vite + React demonstration of Layers 4 + 5 is the first item in Phase 2 of the roadmap.

---

## Quick start

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0

### Install and run the test suite

```bash
git clone https://github.com/danialsamiei/awaf.git
cd awaf

pnpm install
pnpm build
pnpm typecheck
pnpm test
```

You should see all packages build and `@awaf/core` report 131 passing tests.
Stub packages (`@awaf/ui`, `@awaf/protocols`, `apps/demo`)
build and run `vitest run --passWithNoTests` cleanly.

### Use the parts that are real

Today, the only end-user-facing API that is fully implemented is the
**handshake primitives** in `@awaf/core`. A minimal, honest example:

```typescript
import {
  SignalCollector,
  EnrichmentPipeline,
  HandshakeDecisionEngine,
} from '@awaf/core';

// 1. Collect passive browser signals (no IP lookup, no third-party calls).
const signals = new SignalCollector().collect();

// 2. Enrich with a coarse geo context that *you* supply
//    (AWAF does not do server-side IP→geo lookups itself).
const enriched = new EnrichmentPipeline().enrich(signals, {
  country: 'US', // ISO 3166-1 alpha-2
  timezone: signals.timezone,
});

// 3. Decide the UI configuration (locale, dir, theme, capability layer, hero copy).
const decision = new HandshakeDecisionEngine().decide(enriched);

console.log(decision.uiConfig);
// { locale: 'en-US', dir: 'ltr', layer: 'STATIC', heroCopy: '…', … }
```

Anything beyond this — React components, the consent banner, the protocol
adapters, the security pipeline — is on the roadmap and **not yet shipped**.
The README will be updated as each piece lands.

---

## Architecture

The repository is a pnpm + Turborepo monorepo. Today five packages are
published in source and one demo app is scaffolded:

```
┌───────────────────────────────────────────────────────────────┐
│                        apps/demo  (stub)                       │
├───────────────────────────────────────────────────────────────┤
│   @awaf/ui      │   @awaf/protocols   │   @awaf/security      │
│   (stub)        │   (stub)            │   (stub)              │
├───────────────────────────────────────────────────────────────┤
│             @awaf/api  (HTTP client, partial)                  │
├───────────────────────────────────────────────────────────────┤
│  @awaf/core  (types, config, logger, events, handshake) ✅     │
└───────────────────────────────────────────────────────────────┘
```

Build dependencies:

```
@awaf/core      ← no internal dependencies (foundation)
@awaf/api       ← @awaf/core
@awaf/security  ← @awaf/core
@awaf/protocols ← @awaf/core + @awaf/api
@awaf/ui        ← @awaf/core + @awaf/api
apps/demo       ← all packages
```

For the eight-layer conceptual architecture (Signal Ingestion → Context
Handshake → Intent Detection → Memory Mesh → UI Degradation → Protocol
Adaptation → Security & Privacy → Technology Pulse), see
[`AGENTS.md`](AGENTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
That conceptual map is the destination; `IMPLEMENTATION_STATUS.md` tells you
how much of it exists in code right now.

---

## Origin story — الفبا (Alefba)

The name **AWAF** stands for **Alefba Web-Aware Framework**. *Alefba*
(الفبا) is the Persian word for "alphabet": the elementary set of letters
out of which any language is built.

The metaphor is deliberate. Most websites today serve every visitor the same
glyphs in the same direction, regardless of who they are or what their
browser already knows. AWAF treats *language*, *direction*, *device*, and
*consent* as letters of an alphabet — small, composable, locally-detectable
primitives — and lets the page assemble itself from those letters at runtime.

Persian is a right-to-left language; the project was born from the practical
problem of building web experiences that work as gracefully in `dir="rtl"` as
in `dir="ltr"`, without bolting on internationalization as an afterthought.
That bilingual instinct is preserved everywhere in the codebase: branded type
prefixes, locale maps, hero-copy templates, and the consent ladder are all
designed to be neutral with respect to writing direction and cultural context.

This origin story is part of AWAF's identity and will be preserved as the
project grows beyond Persian and English.

---

## Repository layout

```
awaf/
├── packages/
│   ├── core/          # @awaf/core      — types, config, logger, events, handshake primitives ✅
│   ├── api/           # @awaf/api       — HTTP client (16 endpoints), envelope types 🟡
│   ├── ui/            # @awaf/ui        — stub 🟠
│   ├── protocols/     # @awaf/protocols — stub 🟠
│   └── security/      # @awaf/security  — guardrails ✅
├── apps/
│   └── demo/          # @awaf/demo      — stub 🟠
├── docs/
│   ├── IMPLEMENTATION_STATUS.md   # ← truth-of-record audit
│   ├── ROADMAP.md                 # ← 5-phase plan to 1.0
│   ├── ARCHITECTURE.md            # ← conceptual architecture (vision)
│   ├── API_REFERENCE.md           # ← endpoint reference (forward-looking)
│   ├── DEVELOPMENT.md
│   ├── CONTRIBUTING.md
│   ├── CODING_CONVENTIONS.md
│   └── SECURITY.md
├── AGENTS.md          # AI-agent onboarding guide (vision-level)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

Status legend: ✅ implemented · 🟡 partial · 🟠 stub.

---

## Naming and concept aliases

The product surface uses a few new names. Old names remain as aliases in the docs and TypeScript types so existing integrations are not broken.

| Old name | New name | Notes |
|---|---|---|
| UI Degradation | **Adaptive Render Layers** | Same five-layer model (R3F → CSS 3D → Canvas 2D → Static HTML → Text-Only); only the marketing/concept name changed. |
| Memory Mesh | **Consent-Aware Memory** (a.k.a. Consent Memory Graph) | Same six-domain graph + four-tier consent ladder. Type names like `MemoryDomain`, `VisitorMemory`, and the `tech_pulse` domain are unchanged. |
| Technology Pulse | **AWAF Pulse** (plugin module) | Same RAG/trust-tiered ingestion. The HTTP routes (`/technology-pulse`, `/technology-pulse/brief`) are unchanged for backwards compatibility; only the product framing shifted to "plugin module" so consumers can opt out cleanly. |

The `IntentType` alias in `@awaf/core` is now a deprecated structural alias of the new `DomainIntent` (visitor purpose). UI suggestion chips use the separate `SuggestionActionIntent` vocabulary (`learn` / `compare` / `contact` / `personalize` / `language` / `voice` / `explore`). See `packages/core/src/contracts/intents.ts`.

---

## Common commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies. |
| `pnpm build` | Build every package (Turborepo handles ordering). |
| `pnpm typecheck` | Run `tsc --noEmit` per package via Turborepo. |
| `pnpm test` | Run Vitest in every package; stubs use `--passWithNoTests`. |
| `pnpm lint` | Wired but not yet configured. ESLint + Prettier are scheduled for Phase 1 (see roadmap). |
| `pnpm changeset` | Create a Changeset entry for a release. |

---

## Contributing

We welcome code, documentation, translation, and security contributions.

- **General contribution guide:** [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- **Coding conventions:** [`docs/CODING_CONVENTIONS.md`](docs/CODING_CONVENTIONS.md)
- **AI-agent onboarding:** [`AGENTS.md`](AGENTS.md)

A few rules specific to this stage of the project:

1. **No new overclaiming.** PRs may not introduce phrases like "complete defense", "fully implemented", or "guarantees" for features that are not backed by shipped code, tests, and an entry in `docs/IMPLEMENTATION_STATUS.md`. If a feature moves from 🟠 / 🟡 → ✅, update that document in the same PR.
2. **No new runtime dependencies** unless absolutely necessary. AWAF aims to stay light. Build-time dev dependencies are fine.
3. **TypeScript strictness is non-negotiable.** No `any` in source; use `unknown` + narrowing or branded types.
4. **Prefer files under 300 lines** where practical, per the rule documented in `AGENTS.md`.

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## خلاصه فارسی (Persian summary)

<div dir="rtl" align="right">

**AWAF (Alefba Web-Aware Framework)** یک SDK سبک به زبان TypeScript است که هدف آن تبدیل وب‌سایت‌ها به تجربه‌هایی **آگاه از بافتار، چندزبانه، تطبیق‌پذیر با قابلیت دستگاه، و آماده برای AI** بدون استفاده از ردیابی تهاجمی است.

AWAF در millisecond‌های اول ورود بازدیدکننده، **سیگنال‌های منفعل مرورگر** (زبان، timezone، دستگاه، GPU، شبکه، DNT/GPC) را جمع می‌کند و بر پایه آن‌ها — و **با احترام کامل به consent کاربر** — UI را به‌صورت RTL/LTR، با locale و کیفیت بصری متناسب با دستگاه، تطبیق می‌دهد.

**این پروژه در مرحله pre-alpha است.** آنچه امروز به‌صورت کد واقعی شیپ شده، صرفاً پکیج `@awaf/core` (سیستم type، config، logger، event hub، و سه primitive اصلی handshake: `SignalCollector`، `EnrichmentPipeline`، `HandshakeDecisionEngine`) و یک کلاینت HTTP در `@awaf/api` است. باقی پکیج‌ها (`@awaf/ui`، `@awaf/protocols`، `@awaf/security`) فعلاً stub هستند و در فازهای بعدی پیاده‌سازی خواهند شد.

برای دیدن دقیق آنچه پیاده‌سازی شده در مقابل آنچه فقط طراحی شده، به [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) مراجعه کنید. برای نقشه راه پنج‌فازه تا انتشار نسخه ۱.۰، به [`docs/ROADMAP.md`](docs/ROADMAP.md) مراجعه کنید.

**جایگاه AWAF:** این پروژه **جایگزین** Next.js، Astro، i18next، Vercel AI SDK، GrowthBook، یا LaunchDarkly نیست. AWAF لایهٔ گمشدهٔ **بافتار تطبیقی و حریم خصوصی** است که در کنار آن ابزارها قرار می‌گیرد.

**ریشه نام:** «الفبا» — مجموعه‌ای ابتدایی از حروف که هر زبان از ترکیب آن‌ها ساخته می‌شود. AWAF نیز زبان، جهت نوشتار، دستگاه، و رضایت کاربر را به‌عنوان حروف الفبای یک تجربه وب در نظر می‌گیرد و صفحه را در زمان اجرا از این حروف می‌سازد.

</div>

---

<p align="center">
  <sub>Made with ❤️ inside the <strong>الفبا (Alefba)</strong> framework — where the web becomes aware.</sub>
</p>
