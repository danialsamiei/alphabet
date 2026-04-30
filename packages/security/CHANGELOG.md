# @alphabet/security

## 2.0.0

### Major Changes

- 4a40959: Release v1.0.0 — initial stable release.

  This release marks the first stable cut of the Alphabet SDK monorepo:

  - **@alphabet/core** — type system (brands, Result<T,E>, Alphabet events, AlphabetConfig, AlphabetLogger), Context Handshake (signal collector, enrichment pipeline, decision engine), and shared models. 131 unit tests passing.
  - **@alphabet/api** — `AlphabetClient` (all 16 endpoints, request/response envelopes) and `HandshakeClient`. 36 unit tests passing.
  - **@alphabet/ui**, **@alphabet/protocols**, **@alphabet/security** — published as type-only re-export stubs that pin the v1.0 public surface area. Concrete implementations land in subsequent minor releases per the Phase 2/3 roadmap in `AGENTS.md`.

  Tooling tune-up included in this release:

  - Added `vite.config.ts` to all library packages so `pnpm -r build` produces ESM + CJS + d.ts artifacts uniformly.
  - Wired TypeScript project `references` for the stub packages so `tsc --emitDeclarationOnly` resolves cross-package types via `@alphabet/core` / `@alphabet/api`.
  - Migrated `turbo.json` from `pipeline` → `tasks` for Turborepo 2.x.
  - Stub packages now use `vitest run --passWithNoTests` so `pnpm -r test` is green across the workspace.
  - Added a minimal `index.html` + `vite.config.ts` to `apps/demo` so the demo bundle builds.

### Minor Changes

- a8e0821: **Bold Roadmap W1 P1 — `@alphabet/security/privacy` (additive subpath)**

  Differential-privacy primitives, ready to power every Alphabet
  publish flow. Purely additive: the `@alphabet/security` package root
  is unchanged, the new surface lives only under
  `@alphabet/security/privacy`.

  - **Cryptographic randomness** (`sampleUniformUnitInterval`,
    `sampleStandardNormal`, `sampleLaplace`) backed exclusively by
    `crypto.getRandomValues`. The package never falls back to
    `Math.random` (enforced by a vitest spy).
  - **Laplace mechanism** (`applyLaplaceMechanism`,
    `computeLaplaceScale`) for _pure_ ε-DP queries. Adds noise drawn
    from `Lap(0, Δf / ε)` and validates that ε > 0, sensitivity ≥ 0,
    and δ ∈ [0, 1).
  - **Gaussian mechanism** (`applyGaussianMechanism`,
    `computeGaussianStdDev`) for `(ε, δ)`-DP queries. Uses the
    closed-form `σ = Δ₂f · √(2·ln(1.25/δ)) / ε`. Rejects ε > 1 with
    `EPSILON_OUT_OF_RANGE` so the API name never silently ships a
    weaker bound than it implies.
  - **k-anonymity gate** (`kAnonymityGate`) — a cheap pre-DP cohort
    check that defaults to `DEFAULT_K_ANONYMITY_THRESHOLD` (5) and
    returns a structured `Result` instead of throwing.
  - **`PrivacyBudgetLedger`** — sealed, append-only, monotonic
    `(ε, δ)` accountant under basic sequential composition. Refuses
    any spend that would exceed the operator-supplied cap with
    `BUDGET_EXHAUSTED`, _atomically_ (failed spends never appear in
    the ledger, even on validation errors). 256-character cap on
    query labels acts as a PII guard. No `reset()` or `delete()` by
    design — a new policy period requires a new ledger instance.

  Tests: `@alphabet/security` 121 → 175 (+54). Includes statistical
  sanity checks (mean / variance) on Laplace and Gaussian noise,
  budget-exhaustion + atomic-rejection tests, k-anonymity validation,
  and a runtime check that `Math.random` is never invoked.

  Documentation: new "Differential privacy primitives" section in
  `docs/PRIVACY_MODEL.md`, and `docs/IMPLEMENTATION_STATUS.md`
  reconciled (DP and k-anonymity rows promoted from ⚪ Planned to
  ✅ Implemented).

### Patch Changes

- Updated dependencies [b839adc]
- Updated dependencies [4a40959]
  - @alphabet/core@2.0.0
