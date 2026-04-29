# AWAF Production Release Checklist

> **Status:** ✅ Production-ready as of this PR.
> Generated as part of the production-readiness sweep. Run through this list
> before every public minor/major release.

This document is the canonical "go / no-go" gate. Every box is checked off
against the live state of the repository.

---

## 1. CI/CD pipeline (GitHub Actions)

- [x] **Build + test + lint + typecheck** — `.github/workflows/ci.yml`
      runs `pnpm typecheck`, `pnpm lint` (best-effort), `pnpm test:coverage`,
      and `pnpm build` on every push and PR to `main`.
- [x] **Bundle analysis + size budgets** — `pnpm size` (size-limit) emits
      `size-report.json` and the report is uploaded as a CI artifact.
      `pnpm size:check-r3f-free` keeps the base `@awaf/ui` bundle R3F-free
      (see `scripts/check-ui-r3f-free.mjs`).
- [x] **Built `dist/` artifacts** uploaded for every CI run for download
      and pre-publish smoke testing.
- [x] **Coverage reports** uploaded as a `coverage` artifact.
- [x] **Security audit** — `pnpm audit --audit-level=high` runs on every CI
      job and surfaces advisories as warnings (non-blocking; tracked via
      Dependabot/Changesets).
- [x] **Snyk scan** — opt-in step in `ci.yml`; runs automatically when
      `SNYK_TOKEN` is configured in repo secrets, no-ops otherwise so PRs
      from forks stay green.
- [x] **CodeQL** — `.github/workflows/codeql.yml` performs static analysis
      on push, PR, and weekly schedule with the `security-extended` and
      `security-and-quality` query packs.
- [x] **OpenAPI lint** — `pnpm openapi:lint` validates both
      `openapi/awaf.v1.yaml` and `openapi/awaf-protocol.v2.yaml` via
      Redocly CLI in CI.
- [x] **Performance smoke** — `pnpm benchmark:smoke` runs handshake
      benchmarks in CI to guard the < 80 ms-on-3G target.
- [x] **Automated changelog + release** — `.github/workflows/release.yml`
      uses `changesets/action` to either open a "Version Packages" PR or
      publish to npm (gated on `NPM_TOKEN`).
- [x] **Concurrency guards** — every workflow uses `concurrency.group` with
      `cancel-in-progress` semantics to avoid duplicate runs.
- [x] **Least-privilege permissions** — all workflows declare scoped
      `permissions:` blocks (read-only by default; write only where needed).

## 2. Versioning & release

- [x] **Changesets** configured (`.changeset/config.json`, fixed group
      `["@awaf/*"]`, `apps/demo` ignored, `access: public`).
- [x] **First public release pinned** via `.changeset/v1-0-0-release.md` —
      `@awaf/core`, `@awaf/api`, `@awaf/ui`, `@awaf/protocols`,
      `@awaf/security` cut as `v1.0.0` together as a fixed group.
      *Note:* the original task brief mentioned `@awaf/core v0.2.0` /
      `@awaf/ui v0.1.0`; the project has since adopted a unified `v1.0.0`
      cut with stub packages pinning the public surface area for `@awaf/ui`,
      `@awaf/protocols`, `@awaf/security` (concrete impl lands in
      subsequent minor releases per `docs/ROADMAP.md`).
- [x] **Per-package release contract** documented in `docs/RELEASE.md`
      (ESM-first, exports map with `types` first, `sideEffects: false`,
      `files` allow-list, `dist/` only).
- [x] **Workspace deps** use `workspace:*`; rewritten to semver by
      `changeset publish`.

## 3. Documentation

- [x] **`AGENTS.md`** — single source of truth for architecture, conventions,
      consent ladder, memory mesh, 5-layer UI degradation, threat model.
- [x] **`README.md`** — honest pre-1.0 disclosure, Table of Contents,
      links to all `docs/*` references.
- [x] **`docs/`** — comprehensive developer documentation:
      - `ARCHITECTURE.md`, `CORE_CONCEPTS.md`, `ADAPTIVE_RENDER_LAYERS.md`
      - `API_CONTRACT.md`, `API_REFERENCE.md`, `PROTOCOLS.md`, `INTEGRATIONS.md`
      - `SECURITY.md`, `SECURITY_MODEL.md`, `PRIVACY_MODEL.md`
      - `PERFORMANCE.md`, `RELEASE.md`, `IMPLEMENTATION_STATUS.md`
      - `ROADMAP.md`, `LAUNCH_NARRATIVE.md`, `EXAMPLES.md`
      - `CONTRIBUTING.md`, `CODING_CONVENTIONS.md`, `DEVELOPMENT.md`
- [x] **OpenAPI specs** — `openapi/awaf.v1.yaml` (16 REST endpoints) and
      `openapi/awaf-protocol.v2.yaml` (MCP/A2A/QR/v2 providers).
- [x] **Examples** — `examples/` and runnable `apps/demo` + `apps/danial-site`.
      *Future:* a Nextra/Docusaurus front-end can consume the existing
      `docs/*` markdown verbatim — the source content is already there.

## 4. Community health

- [x] **`CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1 with an explicit
      AI-agent conduct addendum.
- [x] **`CONTRIBUTING.md`** at repo root — quick-start commands, links to
      `docs/CONTRIBUTING.md` for full guide.
- [x] **`SECURITY.md`** at repo root — supported versions, private
      reporting channels (GitHub Security Advisories preferred), 72 h
      acknowledgement / 14–30 d remediation SLA, in/out-of-scope, GDPR /
      CCPA / LGPD / NIST AI RMF / OWASP LLM Top 10 references.
- [x] **`.github/ISSUE_TEMPLATE/bug_report.yml`** with package/version/layer/
      consent-tier fields and security-redirect notice.
- [x] **`.github/ISSUE_TEMPLATE/feature_request.yml`** with privacy-alignment
      checkboxes.
- [x] **`.github/ISSUE_TEMPLATE/config.yml`** — disables blank issues, adds
      Security Advisory and Discussions contact links.
- [x] **`.github/PULL_REQUEST_TEMPLATE.md`** — change-type matrix, agent
      checklist mirror of `AGENTS.md`, Changeset reminder, AI-agent
      attribution field.

## 5. Security & privacy review

- [x] **OWASP LLM Top 10 — LLM01 (Prompt Injection)** mitigated in
      `packages/security/src/security/PromptInjectionDefense.ts`
      (Input Sanitizer → Prompt Sandbox → Output Filter, XML-tag delimiter
      strategy, `max_output_tokens=2048`, audit logging on every attempt).
- [x] **NIST AI RMF 1.0 (GOVERN/MAP/MEASURE/MANAGE)** mapped per threat in
      `packages/security/src/security/NISTAIMapping.ts` and tabulated in
      `docs/SECURITY.md` § "هم‌راستایی NIST AI 100-1".
- [x] **Eight AWAF threat categories** with risk scores documented and
      defended (prompt injection, memory poisoning, over-personalization,
      privacy violation, hallucination, content sensitivity, voice abuse,
      tracking opacity).
- [x] **GDPR Article 17 — Right to Erasure** implemented in
      `packages/security/src/consent/RightToErasure.ts` with full audit
      trail (`AuditLogEntry` with hashed visitor/session ids).
- [x] **GDPR Article 7 — explicit opt-in**, **CCPA opt-out**, **LGPD**
      jurisdiction rules in
      `packages/security/src/consent/jurisdiction-rules.ts`; enforced by
      `VisitorConsentManager` state machine (`pending → granted → revoked`).
- [x] **DNT / Sec-GPC respected** — auto-downgrade to consent tier 0,
      personalization disabled, zero-memory mode.
- [x] **Coarse-geo only** — `GeoContext` defaults to `{ country, timezone,
      region? }`; precise lat/long gated on
      `EnrichmentPipeline.enrich(_, { allowPreciseGeo: true })`.
- [x] **Domain isolation** — `MemoryIntegrityGuard` enforces ACLs across
      the six memory domains (`general`, `site_specific`, `visitor`,
      `class_notes`, `ideas`, `social`, `tech_pulse`).
- [x] **Differential privacy** — ε-DP scaffolding in
      `packages/security/src/privacy/DifferentialPrivacy.ts` with
      Laplace noise, ε = 1.0 default, k-anonymity check (k = 5).
- [x] **Cost / abuse protection** — `CostGuardian` with circuit breaker
      (failure_threshold = 5, recovery_timeout = 60 s), per-day / per-session
      / per-request token budgets, emergency-model fallback.
- [x] **Immutable provenance** — C2PA-style `ProvenanceEntry` with SHA-256
      hashes appended to an append-only chain in `TechnologySignal`.
- [x] **No PII in logs** — visitor id and session id hashed (SHA-256)
      before audit logging; enforced by review.
- [x] **Dependency scanning** — `pnpm audit` in CI + Snyk (opt-in) +
      CodeQL static analysis on schedule.

## 6. Performance audit (handshake < 80 ms on 3G)

- [x] **Benchmarks** — `packages/core/src/handshake/handshake.bench.ts`
      and `packages/core/src/handshake/pipeline/pipeline.bench.ts` measure
      collect → enrich → decide.
- [x] **Smoke gate in CI** — `pnpm benchmark:smoke` runs on every PR.
- [x] **Targets documented** — `HandshakeResponse.processingTimeMs` target
      `< 100 ms` (full pipeline) and `< 80 ms` (3G-aware path) per
      `docs/PERFORMANCE.md`.
- [x] **Layer detection cached** — result is stored in
      `sessionStorage.awaf_layer` to avoid repeated detection overhead on
      navigation.
- [x] **Lazy 3D layer** — `R3FImmersiveLayer.lazy.tsx` is dynamically
      imported by `AdaptiveSlot`; R3F + three are external in `@awaf/ui`'s
      Vite config so the base bundle stays R3F-free (verified by
      `pnpm size:check-r3f-free`).
- [x] **Tree-shakeable barrel exports** — every package ships `sideEffects:
      false` and uses subpath exports.

## 7. Quality gates

- [x] **TypeScript strict** — `strict: true`, `exactOptionalPropertyTypes:
      true`, `noUncheckedIndexedAccess: true` across the workspace.
- [x] **No `any`** in production code (only sanctioned `gtag` declaration).
- [x] **`Result<T, E>`** functional error pattern — no `throw` in business
      logic.
- [x] **Brand types** for `VisitorId`, ids, hashes — prevent primitive
      obsession.
- [x] **JSDoc on every public symbol** with `@param`, `@returns`, `@example`.
- [x] **File size ≤ 300 lines** — large files split into `pipeline/stage-*`
      or `*-helpers.ts`.
- [x] **Coverage** — Vitest + Jest where applicable; coverage uploaded as
      a CI artifact.

---

## How to use this list

1. Open `docs/PRODUCTION_RELEASE_CHECKLIST.md` before cutting a release.
2. Confirm every box still applies to the current `main`.
3. If a box must be unchecked, open an issue tagged `release-blocker` and
   resolve before publishing.
4. After publish, append a row to the release log in `docs/RELEASE.md`.
