# AWAF Benchmarks

Microbenchmarks for the AWAF Context Handshake hot path, route normalization, consent policy helpers, and the Adaptive Render Layer selector.

> **Note:** these numbers are **engineering targets**, not guaranteed claims. They run on whatever Node.js host invokes them (CI runner, your laptop, etc.) and are intended to catch large regressions, not to publish marketing benchmarks.

## Run

```bash
pnpm install
pnpm benchmark            # full run (~10s)
pnpm benchmark:smoke      # CI smoke check (~2s)
```

## Suites

| Suite | Module | Budget (mean) |
|:------|:-------|:--------------|
| `signal-collection` | `SignalCollector.collect` | < 5ms |
| `enrichment-pipeline` | `EnrichmentPipeline.enrich` | < 5ms |
| `decision-engine` | `HandshakeDecisionEngine.decide` | < 2ms |
| `route-normalization` | `normalizeApiBaseUrl`, `joinRoute` | < 0.5ms |
| `consent-policy` | `canStoreMemory`, `canPersonalize`, … | < 0.05ms |
| `layer-selection` | `selectAdaptiveLayer` (`@awaf/ui/runtime`) | < 0.1ms |

Each suite uses [tinybench](https://github.com/tinylibs/tinybench) (≈3KB minified, zero runtime deps) and writes results to stdout. A `❌` annotation appears next to any task that exceeds its declared budget; `pnpm benchmark` exits non-zero in that case so CI fails loudly.

## Engineering targets

The targets above are intentionally generous so they remain meaningful on slow CI runners. The actual measured numbers on a typical laptop tend to be 10–100× faster. See [`docs/PERFORMANCE.md`](../docs/PERFORMANCE.md) for the full performance budget contract.
