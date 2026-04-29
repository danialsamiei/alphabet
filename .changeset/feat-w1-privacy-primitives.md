---
'@alphabet/security': minor
---

**Bold Roadmap W1 P1 — `@alphabet/security/privacy` (additive subpath)**

Differential-privacy primitives, ready to power every Alphabet
publish flow. Purely additive: the `@alphabet/security` package root
is unchanged, the new surface lives only under
`@alphabet/security/privacy`.

- **Cryptographic randomness** (`sampleUniformUnitInterval`,
  `sampleStandardNormal`, `sampleLaplace`) backed exclusively by
  `crypto.getRandomValues`. The package never falls back to
  `Math.random` (enforced by a vitest spy).
- **Laplace mechanism** (`applyLaplaceMechanism`,
  `computeLaplaceScale`) for *pure* ε-DP queries. Adds noise drawn
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
  `BUDGET_EXHAUSTED`, *atomically* (failed spends never appear in
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
