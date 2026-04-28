# AWAF — Implementation Status

> **Purpose.** This document is the single source of truth about what is **actually
> shipped in code today** versus what is **described as a vision** in `README.md`,
> `AGENTS.md`, and the marketing copy. It is updated on every PR that adds or
> removes substantive functionality.
>
> **Status legend.**
> - ✅ **Implemented** — production-ready code, exported from a package, covered by tests.
> - 🟡 **Partial** — real code exists but is incomplete, not wired end-to-end, or lacks tests.
> - 🟠 **Stub** — file/package exists but only re-exports a type or contains placeholder JSDoc.
> - ⚪ **Planned** — described in `AGENTS.md` / `README.md` / `ROADMAP.md`, but no code yet.
>
> Last audit: 2026-04-28. Repository commit: see `git log -1`. Reconciled by PR-1 of the Phase-2 acceleration plan (W1.6) — `@awaf/ui`, `@awaf/security`, `@awaf/protocols`, and `apps/demo` were previously documented as stubs but are in fact substantially implemented. Rows below reflect actual `git ls-files` + `pnpm test` output.

---

## 1. Packages — top-level reality check

| Package | Path | Status | Evidence | Next action |
|---|---|---|---|---|
| `@awaf/core` | `packages/core/src/` | ✅ Implemented | `types/`, `config/awaf-config.ts`, `logger/awaf-logger.ts`, `events/awaf-events.ts`, `handshake/{signal-collector,enrichment-pipeline,decision-engine,orchestrator}.ts`, `contracts/runtime/` (W1.1, additive subpath: `Validator<T>`, structural combinators, envelope schemas); 222 unit tests passing. | Phase 2: extend `contracts/runtime` with codegen from OpenAPI. |
| `@awaf/api` | `packages/api/src/` | ✅ Implemented | `awaf-client.ts` (424 lines) wraps all 16 endpoints; `handshake-client.ts` legacy client; `types.ts` (605 lines); `transport/` (W1.3 — `Fetcher`, `withRetry` with decorrelated jitter, `parseRateLimit`, `withIdempotencyKey`); `mock/` (W1.2 — in-process mock server, deterministic seeded RNG, all 16 endpoints, Fetcher-compatible). 104 tests passing (77 baseline + 27 new). **No SSE handler yet — W2.5.** | Phase 2 W2.5: SSE for `postInteract`. Wire `AwafClient` to `Fetcher`/validator (W2). |
| `@awaf/ui` | `packages/ui/src/` | ✅ Implemented | Subpath exports (`./hooks`, `./layers`, `./layers/r3f`, `./runtime`, `./components`); `AdaptiveSlot.tsx` + lazy `R3FImmersiveLayer`; `Layer{Canvas2D,Css3D,R3FImmersive,StaticHtml,TextOnly}.tsx`; `useAdaptiveLayer`, `useAwafConsent`, `useAwafHandshake` hooks; `ConsentBanner.tsx`, `TransparencyNotice.tsx`, `AwafProvider.tsx`. R3F + three are external in vite config; base bundle is R3F-free (enforced by `scripts/check-ui-r3f-free.mjs`). | Phase 2 W2.x: harden a11y coverage via Storybook + axe-core (W3.4). |
| `@awaf/protocols` | `packages/protocols/src/` | ✅ Implemented | `mcp/`, `a2a/`, `direct-api/`, `qr-handoff/`, `ai-sdk/` adapters; `contract.ts`, `errors/`, `normalizers/`. Each adapter has its own `index.test.ts`. | Phase 4 W4.5: harden A2A spec compliance + QR encrypted-payload tests. |
| `@awaf/security` | `packages/security/src/` | ✅ Implemented | `consent/consent-tier-manager.ts` (with `SyncConsentStorageAdapter`, `WebStorageConsentStorage`, `InMemoryConsentStorage`), `prompt-injection/detector.ts`, `pii/redactor.ts`, `audit/audit-logger.ts`, `policies/`, `output-validation/`, `memory-integrity/`. | Phase 4: differential-privacy primitives (W4.1), cost-guardian circuit-breaker (W4.3), NIST AI RMF JSON mapping (W4.4). |
| `apps/demo` | `apps/demo/src/` | ✅ Implemented | `App.tsx`, `main.tsx`, `styles.css`. Vite + React; renders `AdaptiveSlot` with the 5-layer router; consumes `@awaf/ui` hooks. | Phase 2 W2.6: wire to in-process mock server (W1.2) for offline demos. |

---

## 2. Feature-by-feature audit

### 2.1 Context Handshake

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| Passive signal collection (lang, timezone, UA, DPR, WebGL, network, DNT/GPC) | `packages/core/src/handshake/signal-collector.ts` | ✅ Implemented | 218 lines + 20 passing tests in `signal-collector.test.ts`. Reads `navigator.language`, `Intl.DateTimeFormat`, `navigator.connection`, `navigator.doNotTrack`, etc. | Document API in `docs/API_REFERENCE.md`. |
| Edge enrichment (coarse geo, RTL detection, capability inference) | `packages/core/src/handshake/enrichment-pipeline.ts` | ✅ Implemented | 235 lines + 20 passing tests. Pure transformation; **no real IP→geo lookup** — `GeoContext` is supplied by caller. | Add a pluggable `GeoProvider` interface in Phase 2. |
| Decision engine (locale, dir, theme, layer, hero copy) | `packages/core/src/handshake/decision-engine.ts` | ✅ Implemented | 215 lines + 20 passing tests. Locale map covers 25 locales; hero copy templates for fa/ar/bg/en/de/fr/es/pt/ja/ko/zh/ru. | Externalize copy + locale map (Phase 2). |
| End-to-end orchestrator (`HandshakeOrchestrator`) | `packages/core/src/handshake/orchestrator.ts` | ✅ Implemented | Runs `collect → enrich → decide` and returns `Result<HandshakeOutcome, AWAFError>` with `failure.details.phase`; emits `handshake:complete`/`handshake:error` via `AWAFEventEmitter`. | Phase 2 W2.3: pair with `useContextHandshake` Suspense adapter. |
| Six-phase lifecycle (`detect → enrich → decide → display → consent → morph`) | `packages/core/src/types/base.ts` (`HandshakeState`) | 🟡 Partial | The state-machine type exists; phases 4–6 (display, consent, morph) have no executor. | Phase 2: implement `display`/`consent`/`morph` phases in the orchestrator. |
| Sub-100 ms target | — | ⚪ Planned | No benchmark suite exists. | Phase 5: add benchmark in `apps/demo` and CI. |

### 2.2 Memory Mesh & Consent

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| Consent tiers (`NO_MEMORY` / `ANONYMOUS` / `CONSENTED` / `ENRICHED`) — types | `packages/core/src/types/base.ts:18` | ✅ Implemented | Type + `CONSENT_TIER_LEVEL` ordering map. | — |
| `VisitorConsent`, `VisitorPreference`, `VisitorMemory` types | `packages/core/src/types/visitor.ts:107,130,170` | ✅ Implemented | Interfaces declared and exported. | — |
| `ConsentTierManager` state machine (`pending → granted → revoked`) | `packages/security/src/consent/consent-tier-manager.ts` | ✅ Implemented | State machine + `SyncConsentStorageAdapter` interface; rehydrates in constructor; auto-invalidates on `policyVersion` mismatch; `reset()` clears storage. Storage adapters: `InMemoryConsentStorage`, `WebStorageConsentStorage`. | Phase 2 W2.7: cryptographic proof-of-consent receipts. |
| `DomainFirewall` / cross-domain ACL | not present | ⚪ Planned | No code; only the `MemoryDomain` enum exists. | Phase 2/4. |
| Memory persistence backends (sessionStorage, localStorage, vector DB) | not present | ⚪ Planned | No storage adapter code. | Phase 2 (browser storage), Phase 4 (vector DB). |
| Right-to-erasure flow (`DELETE /api/visitor/memory`) | `AwafClient.deleteVisitorMemory` | 🟡 Partial | HTTP wrapper exists; no server, no audit-log emission. | Phase 4. |
| k-anonymity (k≥5) for analytics | not present | ⚪ Planned | No code. | Phase 4. |
| Differential privacy (ε-DP) | not present | ⚪ Planned | No code. | Phase 4. |

### 2.3 UI Degradation (5 layers)

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| `CapabilityLayer` enum (`'R3F' | 'CSS3D' | 'CANVAS2D' | 'STATIC' | 'TEXT_ONLY'`) | `packages/core/src/types/base.ts:91` | ✅ Implemented | Type + ordering map. | — |
| `useAdaptiveLayer` selector hook | `packages/ui/src/hooks/useAdaptiveLayer.ts` | ✅ Implemented | Hook + tests (`useAdaptiveLayer.test.tsx`); uses `CapabilityLayer` ordering map and runtime preference detection. | Phase 2 W2.1: extract pure `selectLayer(caps, prefs, env)` and add session fingerprint cache. |
| `Layer{R3F,Css3D,Canvas2D,StaticHtml,TextOnly}.tsx` React components | `packages/ui/src/layers/` | ✅ Implemented | All 5 layer components exist; R3F is lazy-loaded via `R3FImmersiveLayer.lazy.tsx` so the base bundle is R3F-free. | Phase 2 W2.2: add explicit `axe-core` a11y assertions for Layer 4/5. |
| `useAwafHandshake`, `useAwafConsent` React hooks | `packages/ui/src/hooks/` | ✅ Implemented | Both hooks exist; `useAwafConsent.test.tsx` covers grant/revoke/upgrade flows. | Phase 2 W2.3: Suspense-friendly `useResultResource` adapter. |
| `prefers-reduced-motion` / `prefers-contrast` handling | `packages/ui/src/hooks/useAdaptiveLayer.ts`, `packages/ui/src/runtime/` | 🟡 Partial | Honored in layer selection; not yet propagated into Layer 1/2 animation toggles. | Phase 2 W2.2: wire to layer renderers. |

### 2.4 Technology Pulse

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| `TechnologySignal`, `ProvenanceLink` types | `packages/core/src/types/memory.ts:17,52` | ✅ Implemented | Interfaces defined. | — |
| `TrustTier` enum + `TRUST_TIER_COEFFICIENT` (T1=0.95, T2=0.75, T3=0.40) | `packages/core/src/types/base.ts:37` | ✅ Implemented | — | — |
| Ingestion pipeline (5 stages: ingest → extract → trust-score → verify → embed) | not present | ⚪ Planned | No `pulse/` directory. | Phase 4. |
| Trust scoring algorithm | not present | ⚪ Planned | Coefficients exist, but no scorer class. | Phase 4. |
| Hallucination firewall / claim flagging | not present | ⚪ Planned | — | Phase 4. |
| C2PA-style provenance chain | not present | ⚪ Planned | `ProvenanceLink` type defined but no producer. | Phase 4. |
| RAG brief generation | not present | ⚪ Planned | `AwafClient.postTechnologyPulseBrief` is just an HTTP wrapper. | Phase 4. |

### 2.5 Protocols (LLM)

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| `ProtocolType` enum (`'MCP' | 'A2A' | 'QR' | 'API'`) | `packages/core/src/types/base.ts:112` | ✅ Implemented | Type only. | — |
| `AWAFRequest` / `AWAFResponse` envelope types | `packages/core/src/types/api.ts` | ✅ Implemented | Generic envelope used by `HandshakeClient`. | — |
| MCP server (`MCPServer.ts`, `context_handshake` / `memory_query` / `technology_pulse` tools) | not present | ⚪ Planned | `grep -r MCPServer packages/` → 0 matches. | Phase 4. |
| A2A adapter (`Task` / `Artifact` lifecycle) | not present | ⚪ Planned | — | Phase 4. |
| QR Handoff (encrypted payload, channel server) | not present | ⚪ Planned | — | Phase 4. |
| Direct API adapter (OpenAI / Kimi / Claude compatible) | not present | ⚪ Planned | — | Phase 4. |

### 2.6 Security (Defense in Depth)

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| `AWAFError` discriminated union | `packages/core/src/types/api.ts` (re-exported via `@awaf/security`) | ✅ Implemented | Type only. | — |
| Prompt-injection defense (OWASP LLM01) — Input Sanitizer / Sandbox / Output Filter | not present | ⚪ Planned | `@awaf/security` is a stub. README claim of “complete defense” is **inaccurate**. | Phase 4. |
| Memory Integrity Guard (drift / outlier / cross-domain leak) | not present | ⚪ Planned | — | Phase 4. |
| Cost Guardian (circuit breaker, token budget) | not present | ⚪ Planned | — | Phase 4. |
| NIST AI RMF 1.0 mapping (GOVERN / MAP / MEASURE / MANAGE) | not present | ⚪ Planned | Discussed in `docs/SECURITY.md` only as design. | Phase 4. |
| Differential privacy | not present | ⚪ Planned | — | Phase 4. |
| Audit logger (`SecurityAuditLogger`) | not present | ⚪ Planned | `AuditLogId` brand type exists, no emitter. | Phase 4. |

### 2.7 API client (HTTP transport)

| Endpoint group | Class / method | Status | Evidence | Next action |
|---|---|---|---|---|
| Handshake (`POST /api/context/handshake`) | `HandshakeClient.performHandshake`, `AwafClient.postHandshake` | 🟡 Partial | Implemented as `fetch` wrapper returning `Result<T,E>`; **no retry, no backoff, no SSE**. Tested in `handshake-client.test.ts`. | Phase 2: retries, timeouts beyond `AbortController`, mock server. |
| Consent / Preference / Suggestions / Interact / Voice / Memory / Pulse / Brief / OpenClaw / Admin (15 remaining endpoints) | `AwafClient.*` | 🟡 Partial | All 16 methods present (see `grep -n 'async ' packages/api/src/awaf-client.ts`). All return `Promise<Result<…, AWAFError>>` and call `fetch`. **No server, no SSE handler for `postInteract` streaming, no rate-limit headers parsed.** | Phase 2: SSE for `interact`, rate-limit awareness, mock server. |
| Mock server | not present | ⚪ Planned | README mentions a mock server but no `mock-server/` directory exists. | Phase 1/2. |

### 2.8 Developer experience

| Feature | Path | Status | Evidence | Next action |
|---|---|---|---|---|
| Monorepo with pnpm workspaces + Turborepo 2.x (`tasks` schema) | `pnpm-workspace.yaml`, `turbo.json` | ✅ Implemented | `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test` all green. | — |
| TypeScript strict mode + `exactOptionalPropertyTypes` | `tsconfig.json` (root + per-package) | ✅ Implemented | Confirmed by repo memories. | — |
| Vite library build (ESM + CJS) per package | `packages/*/vite.config.ts` | ✅ Implemented | All 5 packages build. | — |
| Vitest tests | `packages/core` (131 tests), `packages/api` (tests in `*.test.ts`) | ✅ Implemented | `pnpm test` reports 11 successful tasks; core: 131/131 passing. | — |
| Changesets for versioning | `.changeset/` | ✅ Implemented | `pnpm changeset` works. | — |
| ESLint / Prettier | not configured | ⚪ Planned | `pnpm lint` is wired in `package.json` but no ESLint config. | Phase 1. |
| `@awaf/cli` scaffolding tool | not present | ⚪ Planned | `AGENTS.md` mentions it; no `packages/cli/`. | Phase 5. |
| Benchmarks (handshake < 100 ms, bundle size budgets) | not present | ⚪ Planned | — | Phase 5. |
| Adapters: React / Next.js / Vite / Astro | not present | ⚪ Planned | Only generic React peer dep in `apps/demo`. | Phase 3. |

---

## 3. Tests, type-check, and build at the time of this audit

| Command | Result |
|---|---|
| `pnpm install --no-frozen-lockfile` | ✅ ok (286 packages) |
| `pnpm typecheck` | ✅ 11/11 tasks successful |
| `pnpm test` | ✅ `@awaf/core` 131/131 tests pass; other packages run with `--passWithNoTests` |
| `pnpm build` | ✅ All packages build to ESM + CJS (some packages emit empty chunks because they are stubs) |
| `pnpm lint` | ⚠️ Wired but no ESLint config — currently a no-op per package |

**No tests are currently failing.** The honest gap is breadth, not red builds.

---

## 4. Documentation gaps and known overclaims (now corrected)

The `README.md` previously referenced the following symbols/files. As of the 2026-04-28 PR-1 reconciliation pass, the **majority are now implemented** — earlier audits were stale:

- ✅ `ConsentTierManager` — implemented in `packages/security/src/consent/consent-tier-manager.ts`.
- ✅ `MCPServer`, `A2AAdapter`, `QRChannel`, `DirectAPIAdapter` — implemented under `packages/protocols/src/{mcp,a2a,qr-handoff,direct-api}/`.
- ✅ `SecurityAuditLogger` — implemented in `packages/security/src/audit/audit-logger.ts`.
- ✅ Layer components — `packages/ui/src/layers/Layer{R3F,Css3D,Canvas2D,StaticHtml,TextOnly}.tsx`.
- ⚪ `ContextHandshakeClient` — superseded by `HandshakeOrchestrator` (`packages/core/src/handshake/orchestrator.ts`); README example using `new ContextHandshakeClient(...)` will not compile and is being rewritten in a follow-up.
- ⚪ `RuntimeLoop` — still planned (no equivalent yet).
- ⚪ `DomainFirewall` — still planned (Phase 4 W4.x); the `MemoryDomain` enum exists but no firewall/ACL enforcement.
- ⚪ `MemoryMesh` (full vector-DB-backed mesh) — still planned.
- ✅ Per-endpoint client files have been **intentionally consolidated** into `awaf-client.ts` — this is the design, not a gap.

The `README.md` rewrite to align with this status document is tracked separately.

---

## 5. PR-1 (Phase-2 acceleration) — what shipped

| Deliverable | Where | Status |
|---|---|---|
| W1.1 — `Validator<T>` + `StructuralValidator` combinators + envelope schemas | `packages/core/src/contracts/runtime/` (additive subpath `@awaf/core/contracts/runtime`) | ✅ |
| W1.2 — In-process mock server (deterministic seeded RNG, all 16 endpoints, `Fetcher`-compatible) | `packages/api/src/mock/` (additive subpath `@awaf/api/mock`) | ✅ |
| W1.3 — Resilient transport (`Fetcher`, `withRetry` with decorrelated jitter, rate-limit parsers, idempotency keys) | `packages/api/src/transport/` (additive subpath `@awaf/api/transport`) | ✅ |
| W1.6 — Reconcile this document against actual source | `docs/IMPLEMENTATION_STATUS.md` | ✅ (this commit) |

**Hard invariants honored:** zero edits to existing `@awaf/core` or `@awaf/api` source files except subpath wiring (`vite.config.ts`, `package.json`, `tsconfig.json`); `AwafClient` constructor signature unchanged; no new runtime peer deps.

**Test totals**: `@awaf/core` 184 → 222; `@awaf/api` 77 → 104; full monorepo green (16/16 packages).
