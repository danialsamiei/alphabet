# AWAF Performance Budgets

> These are **engineering targets**, not guaranteed SLAs. They exist to catch
> regressions in the AWAF Context Handshake hot path and the Adaptive Render
> Layers selector. Concrete production numbers depend on the host application,
> network, and device.

## Latency targets (mean per call)

| Module | Target | Source benchmark |
|:-------|:------:|:-----------------|
| `SignalCollector.collect` | **< 5ms** in a typical browser-like mock environment | `benchmarks/signal-collection.bench.ts` |
| `EnrichmentPipeline.enrich` | **< 5ms** without network access | `benchmarks/enrichment.bench.ts` |
| `HandshakeDecisionEngine.decide` | **< 2ms** for normal input | `benchmarks/decision-engine.bench.ts` |
| `normalizeApiBaseUrl` / `joinRoute` | **< 0.5ms** / **< 0.1ms** | `benchmarks/route-normalization.bench.ts` |
| `canStoreMemory`, `canPersonalize`, `canUseAnalytics`, `canUsePreciseGeo`, `hasPrivacySignal` | **< 0.05ms** each | `benchmarks/consent-policy.bench.ts` |
| `selectAdaptiveLayer` (`@awaf/ui/runtime`) | **< 0.1ms** | `benchmarks/layer-selection.bench.ts` |

Run `pnpm benchmark` to verify locally; `pnpm benchmark:smoke` is the
CI-friendly fast pass. The benchmark runner exits non-zero if any task
exceeds its declared budget.

## Bundle-size budgets

Tracked via [`size-limit`](https://github.com/ai/size-limit) (`pnpm size`):

| Entry | Limit (brotli) | Notes |
|:------|:--------------:|:------|
| `@awaf/core` ESM | **20 KB** | full barrel; tree-shakable for downstream apps |
| `@awaf/api` ESM | **8 KB** | `@awaf/core` excluded (peer-style import) |
| `@awaf/ui` base entry | **12 KB** | React, `@awaf/core`, `@awaf/api` excluded; **MUST stay R3F-free** |
| `@awaf/ui/layers/r3f` lazy entry | **2 KB** | excludes `@react-three/fiber` and `three` (true peers) |

The dedicated `scripts/check-ui-r3f-free.mjs` static check guarantees that
the base `@awaf/ui` ESM and CJS bundles do not import `@react-three/fiber`
or `three`. R3F is loaded at runtime by `AdaptiveSlot` via the `./layers/r3f`
subpath only when the R3F layer is actually selected.

## Why these targets

* **Signal collection** runs once per `useAwafHandshake` call. 5ms keeps the
  first paint budget intact even on low-end devices.
* **Decision engine** runs once per handshake too, so 2ms is comfortable.
* **Enrichment** is computational only (no I/O); 5ms is conservative.
* **Layer selection** runs on every render of `<AdaptiveSlot>`. Sub-millisecond
  is required to avoid jank.
* **Consent policy helpers** run on every memory operation. They are pure
  enum/object lookups and must remain effectively O(1).

## Updating the budgets

Adjust them in two places:

1. The `budgets:` block of the relevant `benchmarks/*.bench.ts` file.
2. This document.

Increasing a budget is a code-review-required change. Decreasing one is fine
without ceremony — that's a free improvement.
