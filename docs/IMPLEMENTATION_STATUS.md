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
> Last audit: 2026-04-27. Repository commit: see `git log -1`.

---

## 1. Packages — top-level reality check

| Package | Path | Status | Evidence | Next action |
|---|---|---|---|---|
| `@awaf/core` | `packages/core/src/` | ✅ Implemented | `types/`, `config/awaf-config.ts`, `logger/awaf-logger.ts`, `events/awaf-events.ts`, `handshake/{signal-collector,enrichment-pipeline,decision-engine}.ts`; 131 unit tests passing. | Maintain. Add `ContextHandshakeOrchestrator` (Phase 2). |
| `@awaf/api` | `packages/api/src/` | 🟡 Partial | `awaf-client.ts` (424 lines) wraps all 16 endpoints as HTTP method calls; `handshake-client.ts` legacy client; `types.ts` (605 lines) of request/response types. **No mock server, no SSE, no retry/backoff implementation, no rate-limit awareness.** | Implement transport features (retry, SSE, rate-limit) in Phase 2; add a mock server (Phase 1/2). |
| `@awaf/ui` | `packages/ui/src/index.ts` | 🟠 Stub | Single file, only `export type { CapabilityLayer } from '@awaf/core'`. JSDoc says “Phase 1 stub — implementation in Phase 2”. | Phase 2: implement `LayerSelector`, `useContextHandshake`, `useConsent`, and at least Layers 4 + 5. |
| `@awaf/protocols` | `packages/protocols/src/index.ts` | 🟠 Stub | Single file, only `export type { ProtocolType } from '@awaf/core'`. | Phase 4: implement REST adapter first, then MCP, A2A, QR. |
| `@awaf/security` | `packages/security/src/index.ts` | 🟠 Stub | Single file, only `export type { AWAFError } from '@awaf/core'`. | Phase 4: input sanitizer, audit logger, NIST AI RMF mapping. |
| `apps/demo` | `apps/demo/src/main.ts` | 🟠 Stub | 8-line file with only a JSDoc block. `package.json` declares React + Vite + workspace deps. | Phase 2/3: build a Vite + React demo that exercises Layers 4–5 first. |

---

## 2. Feature-by-feature audit

### 2.1 Context Handshake

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| Passive signal collection (lang, timezone, UA, DPR, WebGL, network, DNT/GPC) | `packages/core/src/handshake/signal-collector.ts` | ✅ Implemented | 218 lines + 20 passing tests in `signal-collector.test.ts`. Reads `navigator.language`, `Intl.DateTimeFormat`, `navigator.connection`, `navigator.doNotTrack`, etc. | Document API in `docs/API_REFERENCE.md`. |
| Edge enrichment (coarse geo, RTL detection, capability inference) | `packages/core/src/handshake/enrichment-pipeline.ts` | ✅ Implemented | 235 lines + 20 passing tests. Pure transformation; **no real IP→geo lookup** — `GeoContext` is supplied by caller. | Add a pluggable `GeoProvider` interface in Phase 2. |
| Decision engine (locale, dir, theme, layer, hero copy) | `packages/core/src/handshake/decision-engine.ts` | ✅ Implemented | 215 lines + 20 passing tests. Locale map covers 25 locales; hero copy templates for fa/ar/bg/en/de/fr/es/pt/ja/ko/zh/ru. | Externalize copy + locale map (Phase 2). |
| End-to-end orchestrator (`ContextHandshakeClient` referenced in old README) | not present | ⚪ Planned | `grep -r ContextHandshakeClient packages/` returns 0 matches. README example `new ContextHandshakeClient(...)` will not compile. | Phase 2: build `HandshakeOrchestrator` that wires `SignalCollector → EnrichmentPipeline → DecisionEngine → AwafClient.postHandshake`. |
| Six-phase lifecycle (`detect → enrich → decide → display → consent → morph`) | `packages/core/src/types/base.ts` (`HandshakeState`) | 🟡 Partial | The state-machine type exists; phases 4–6 (display, consent, morph) have no executor. | Phase 2: implement `display`/`consent`/`morph` phases in the orchestrator. |
| Sub-100 ms target | — | ⚪ Planned | No benchmark suite exists. | Phase 5: add benchmark in `apps/demo` and CI. |

### 2.2 Memory Mesh & Consent

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| Consent tiers (`NO_MEMORY` / `ANONYMOUS` / `CONSENTED` / `ENRICHED`) — types | `packages/core/src/types/base.ts:18` | ✅ Implemented | Type + `CONSENT_TIER_LEVEL` ordering map. | — |
| `VisitorConsent`, `VisitorPreference`, `VisitorMemory` types | `packages/core/src/types/visitor.ts:107,130,170` | ✅ Implemented | Interfaces declared and exported. | — |
| `ConsentTierManager` state machine (`pending → granted → revoked`) | not present | ⚪ Planned | `grep -r ConsentTierManager packages/` returns 0 matches. README claims it exists. | Phase 2: implement in `@awaf/core` or `@awaf/security`. |
| `DomainFirewall` / cross-domain ACL | not present | ⚪ Planned | No code; only the `MemoryDomain` enum exists. | Phase 2/4. |
| Memory persistence backends (sessionStorage, localStorage, vector DB) | not present | ⚪ Planned | No storage adapter code. | Phase 2 (browser storage), Phase 4 (vector DB). |
| Right-to-erasure flow (`DELETE /api/visitor/memory`) | `AwafClient.deleteVisitorMemory` | 🟡 Partial | HTTP wrapper exists; no server, no audit-log emission. | Phase 4. |
| k-anonymity (k≥5) for analytics | not present | ⚪ Planned | No code. | Phase 4. |
| Differential privacy (ε-DP) | not present | ⚪ Planned | No code. | Phase 4. |

### 2.3 UI Degradation (5 layers)

| Feature | Package / files | Status | Evidence | Next action |
|---|---|---|---|---|
| `CapabilityLayer` enum (`'R3F' | 'CSS3D' | 'CANVAS2D' | 'STATIC' | 'TEXT_ONLY'`) | `packages/core/src/types/base.ts:91` | ✅ Implemented | Type + ordering map. | — |
| `UILayerSelector` decision logic | not present | ⚪ Planned | No file matching `*layer*selector*`. | Phase 2. |
| `Layer1R3F.tsx` … `Layer5TextOnly.tsx` React components | not present | ⚪ Planned | `packages/ui/src/index.ts` is a stub. | Phase 2 (Layers 4 + 5 first), Phase 3 (Layers 1–3). |
| `useContextHandshake`, `useConsent` React hooks | not present | ⚪ Planned | No `hooks/` directory in `@awaf/ui`. | Phase 3. |
| `prefers-reduced-motion` / `prefers-contrast` handling | not present | ⚪ Planned | — | Phase 2. |

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

The `README.md` previously referenced the following symbols/files that **do not exist in the codebase** as of this audit:

- `ContextHandshakeClient` (only `SignalCollector` + `EnrichmentPipeline` + `HandshakeDecisionEngine` primitives, plus `HandshakeClient` HTTP shim, are present)
- `RuntimeLoop`
- `ConsentTierManager`
- `DomainFirewall`
- `UILayerSelector`, `Layer1R3F.tsx` … `Layer5TextOnly.tsx`
- `MCPServer`, `A2AAdapter`, `QRChannel`, `DirectAPIAdapter`
- `SecurityAuditLogger`, `MemoryMesh`
- Per-endpoint client files (`handshake.ts`, `consent.ts`, …) — these are consolidated into one `awaf-client.ts`

The `README.md` has been rewritten in this PR to remove these unverifiable claims and to point readers to this status document and to `docs/ROADMAP.md` for what is coming.
