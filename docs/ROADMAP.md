# Alphabet — Roadmap

> Alphabet aims to be **the default privacy-first adaptive web SDK**: a lightweight
> TypeScript toolkit that turns any website into a context-aware, multilingual,
> capability-adaptive, AI-ready experience without invasive tracking.
>
> This roadmap is a sequenced, **actionable** plan to get from today's state
> (see [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md)) to a 1.0 release.
> It is intentionally honest: each phase ends with concrete, demonstrable artifacts.
>
> No fixed dates are committed. Phases are scoped, not timeboxed.

---

## Guiding principles

1. **Truth over hype.** Every shipped feature must be backed by code, tests, and a working example. The README never claims more than the code does.
2. **Privacy-first by default.** Tier 0 (`NO_MEMORY`) must be the safe path; consent must be explicit; DNT/GPC always wins.
3. **Integrate, don't replace.** Alphabet is an adaptive context layer on top of existing tools (Next.js, Astro, i18next, Vercel AI SDK, GrowthBook, LaunchDarkly), not a substitute for any of them.
4. **Smallest useful surface.** Ship the smallest thing that works end-to-end before building the next layer. Layers 4 + 5 of UI degradation are first-class; Layer 1 (R3F) is last.
5. **Strict types, no `any`.** Maintain `strict` + `exactOptionalPropertyTypes`. No new runtime dependencies unless they pull their weight.

---

## Phase 1 — Truth alignment and API contract

**Goal.** Make the repository's public surface match what is actually shipped, and freeze a stable v0 API contract that later phases can build on without breaking changes.

**Scope.**
- Audit and document current implementation status — see `docs/IMPLEMENTATION_STATUS.md`.
- Rewrite `README.md` to clearly separate Implemented / Partial / Planned, remove overclaiming language, and add a Project Positioning section.
- Add ESLint + Prettier configuration so `pnpm lint` actually runs.
- Freeze the `AlphabetRequest` / `AlphabetResponse` envelope and `Result<T, E>` shapes as the v0 contract.
- Add a CHANGELOG entry and a Changeset for the documentation realignment.
- Add a CONTRIBUTING note: PRs may not introduce new "complete X" / "guarantees Y" language unless backed by code + tests.

**Exit criteria.**
- `docs/IMPLEMENTATION_STATUS.md` exists and is specific (Implemented / Partial / Stub / Planned, with file-level evidence).
- `docs/ROADMAP.md` exists (this file).
- `README.md` no longer references symbols that don't exist in source.
- `pnpm typecheck` and `pnpm test` are green.
- `pnpm lint` runs ESLint and reports zero errors on the existing code.

---

## Phase 2 — Core privacy, consent, and adaptive rendering

**Goal.** Deliver the smallest working Alphabet: a website can install `@alphabet/core` + `@alphabet/api` + `@alphabet/ui`, run a context handshake, render Layer 4 (semantic HTML) or Layer 5 (text-only), and persist tier-aware consent.

**Scope.**
- `@alphabet/core`
  - `HandshakeOrchestrator` that wires `SignalCollector → EnrichmentPipeline → HandshakeDecisionEngine` and emits the six lifecycle states (`detect → enrich → decide → display → consent → morph`).
  - `ConsentTierManager` state machine (`pending → granted → revoked`) with `grant(tier)`, `revoke()`, `reset()`, and `handlePrivacySignal(DNT|GPC)` (auto-downgrade to Tier 0).
  - Browser storage adapters (`sessionStorage` for Tier 1, `localStorage` for Tier 2) behind a `MemoryAdapter` interface; Tier 3 (vector DB) deferred to Phase 4.
  - Pluggable `GeoProvider` interface so consumers can inject coarse geo without the SDK doing IP lookups itself.
- `@alphabet/api`
  - Retry with exponential backoff and jitter (no new runtime dependency).
  - SSE handler for `postInteract` streaming.
  - Parsed rate-limit headers exposed on the `Result` value.
  - A small in-process mock server (under `packages/api/src/__mocks__/`) used in tests and in the demo.
- `@alphabet/ui`
  - `LayerSelector` — pure capability detection (WebGL, Canvas, `prefers-reduced-motion`, `prefers-contrast`, `hardwareConcurrency`, viewport) with cached result in `sessionStorage`.
  - `Layer4StaticHTML` and `Layer5TextOnly` React components (no runtime 3D dep).
  - `useContextHandshake` and `useConsent` hooks.
  - `<ConsentBanner />` baseline component (RTL-aware, keyboard accessible, AA contrast).
- `apps/demo`
  - A minimal Vite + React app that exercises Layers 4 + 5, the consent banner, and a stub mock server.
- Tests
  - Unit tests for `HandshakeOrchestrator`, `ConsentTierManager`, `LayerSelector`.
  - One end-to-end test in the demo (Vitest in jsdom + Playwright optional).

**Exit criteria.**
- A developer can `pnpm add @alphabet/core @alphabet/api @alphabet/ui`, drop `<AlphabetProvider />` + `<ConsentBanner />` into a React app, and get correct RTL/LTR + locale + Tier 0 fallback under DNT.
- Demo app runs `pnpm dev` and shows Layer 4 by default, Layer 5 when reduced motion is set.
- `IMPLEMENTATION_STATUS.md` updated; ✅ row count goes up, 🟠 rows for `@alphabet/ui` shrink.

### Phase 2 acceleration plan (4-week roadmap)

The Phase-2 work above is sequenced into a four-week acceleration plan with explicit deliverable IDs. PR-1 implements the W1.1 + W1.2 + W1.3 + W1.6 slice:

| ID | Deliverable | Status (post-PR-1) |
|---|---|---|
| **W1.1** | `Validator<T>` runtime validator + envelope schemas (`@alphabet/core/contracts/runtime`) | ✅ Shipped |
| **W1.2** | In-process mock server, all 16 endpoints, deterministic seeded RNG (`@alphabet/api/mock`) | ✅ Shipped |
| **W1.3** | Resilient transport: retry + decorrelated jitter, rate-limit parsing, idempotency keys (`@alphabet/api/transport`) | ✅ Shipped |
| W1.4 | Internal `Task<R, E, A>` effect helper | ⚪ Planned (W1 follow-up) |
| W1.5 | CI matrix hardening (Node 20/22 × ubuntu/macos, codecov, release flow) | 🟡 Partial (audit step added) |
| **W1.6** | Reconcile `IMPLEMENTATION_STATUS.md` against actual source tree | ✅ Shipped |
| W2.1–W2.7 | `LayerSelector` cache, Layer 4/5, Suspense hooks, `<ConsentBanner />`, SSE for `postInteract`, demo wired to mock server, signed consent receipts | ⚪ Planned |
| W3.1–W3.7 | `@alphabet/next`, `@alphabet/astro`, `@alphabet/vite`, Storybook + Chromatic, Pulse forecaster (Bayesian), Protocols v0 (REST + MCP), benchmarks | ⚪ Planned |
| W4.1–W4.8 | Differential Privacy, prompt-injection defense (3 layers), cost guardian, NIST AI RMF mapping, A2A + QR, WASM signal acceleration, `@alphabet/cli`, 1.0-RC | ⚪ Planned |

The full plan with hard backward-compat invariants is in this PR's description.

---

## Phase 3 — React / Next.js / Vite / Astro adapters

**Goal.** Ship integration packages so Alphabet "just works" in the four most common modern web stacks, and add Layers 1–3 of UI degradation.

**Scope.**
- `@alphabet/react` — peer-dep on React 18+, exports `<AlphabetProvider />`, hooks, and the components from `@alphabet/ui`.
- `@alphabet/next` — App Router and Pages Router integrations, server-side handshake on the edge, RSC-safe hooks, integration with `next-intl` (recommended) without replacing it.
- `@alphabet/vite` — Vite plugin for build-time locale extraction and capability hints.
- `@alphabet/astro` — Astro integration with islands; works with `@astrojs/react`.
- UI Layers 1–3:
  - `Layer3Canvas2D` (no GPU dependency beyond Canvas2D).
  - `Layer2CSS3D` (CSS transforms only; no new dep).
  - `Layer1R3F` shipped as an **optional** subpath import (`@alphabet/ui/r3f`) so projects that don't want React Three Fiber don't pay the bundle cost.
- Bundle-size budgets in CI for each adapter.
- Documentation: one quick-start page per stack under `docs/integrations/`.

**Exit criteria.**
- Four working starter examples (one per stack) under `examples/` that pass `pnpm typecheck`.
- A `pnpm test` run includes adapter unit tests.
- Bundle for the React adapter (Layers 4+5 only) is under a documented budget.

---

## Phase 4 — Protocols, AI integration, and security

**Goal.** Make Alphabet AI-ready and credibly secure: ship the protocol adapters, the Technology Pulse pipeline, and the defense-in-depth that the README has long described as a vision.

**Scope.**
- `@alphabet/protocols`
  - REST adapter first (formalize the existing 16-endpoint contract).
  - MCP server with at minimum `context_handshake`, `memory_query`, and `technology_pulse` tools.
  - A2A adapter (Task / Artifact lifecycle) — `submitted → working → input-required → completed | cancelled | failed`.
  - QR Handoff with AES-GCM encrypted payload and a short-TTL channel server.
- `@alphabet/security`
  - Input sanitizer (OWASP LLM01 patterns), output filter, prompt sandbox.
  - `SecurityAuditLogger` writing append-only entries with hashed `visitor_id`.
  - Cost Guardian: circuit breaker + per-session and per-day token budgets.
  - Memory Integrity Guard: drift / outlier / cross-domain leak checks.
  - NIST AI RMF 1.0 mapping document and runtime hooks (`GOVERN / MAP / MEASURE / MANAGE`).
  - Differential privacy helper (ε-DP) for analytics aggregation.
  - k-anonymity (k≥5) gate for admin dashboards.
- Technology Pulse
  - Five-stage ingestion pipeline (ingest → extract → trust-score → verify → embed).
  - Trust scorer using the existing `TRUST_TIER_COEFFICIENT` map.
  - Hallucination firewall with five claim states.
  - C2PA-style provenance chain stored in append-only storage.
  - RAG brief generator that grounds claims with citations.
- AI integration
  - Optional `@alphabet/ai` package that provides Vercel AI SDK and OpenAI/Claude/Kimi adapters as **integrations** (not replacements).

**Exit criteria.**
- `@alphabet/security` and `@alphabet/protocols` are no longer stubs in `IMPLEMENTATION_STATUS.md`.
- A reference MCP host (e.g., Claude Desktop) can call `context_handshake`, `memory_query`, `technology_pulse`.
- A documented threat-model audit walks through each of the 8 threat categories with code links.

---

## Phase 5 — Developer experience, benchmarks, and release readiness

**Goal.** Polish Alphabet into a 1.0 release: fast onboarding, measurable performance, and a credible public launch.

**Scope.**
- `@alphabet/cli` with `alphabet init`, `alphabet doctor` (capability + consent + privacy diagnostics), and `alphabet bench`.
- Benchmark suite:
  - Handshake p95 < 100 ms on a reference machine.
  - Bundle-size dashboard per adapter (gzipped + brotli).
  - Lighthouse + axe-core checks for the demo and each integration example.
- Documentation site (`docs/` + a published site) with quick-starts, conceptual guides, and the API reference auto-generated from TSDoc.
- Migration guides:
  - From hand-rolled `next-intl` setups.
  - From cookie-banner-only consent solutions.
  - For projects already using GrowthBook / LaunchDarkly (Alphabet feeds context, the flag platform decides the variant).
- Release engineering:
  - Stable Changesets workflow.
  - Semantic-release notes for v1.0.
  - A public security disclosure policy in `SECURITY.md`.
  - SBOM + provenance attestation for published packages.

**Exit criteria.**
- v1.0.0 published to npm under `@alphabet/*`.
- Public docs site live.
- `IMPLEMENTATION_STATUS.md` shows ✅ for every feature listed in `README.md`'s "What is implemented" section, and any remaining ⚪ rows are explicitly described as post-1.0 enhancements.
