---
'@alphabet/core': minor
'@alphabet/api': minor
---

**Phase 2 acceleration — PR-1 (W1.1, W1.2, W1.3, W1.6)**

Three additive subpaths plus a documentation reconciliation. Backward-compatible: no public surface (constructors, return types, exports from package roots) is changed.

- **`@alphabet/core/contracts/runtime`** (new subpath, additive): a dependency-free runtime validator with a `Validator<T>` interface and `StructuralValidator` combinators (`v.object`, `v.array`, `v.union`, `v.literal`, `v.enum`, `v.optional`, etc.). Hand-authored schemas for `AlphabetRequest`, `AlphabetResponse`, `ResponseMeta`, `AlphabetError`, and the handshake payload/result. Validation errors are first-class `AlphabetError` extensions (`code: 'VALIDATION_ERROR'`) with `path[]` so failures point at the offending field. Never throws.
- **`@alphabet/api/transport`** (new subpath, additive): a `Fetcher` interface, a `withRetry` decorator using exponential backoff with decorrelated jitter (Marsaglia), parsers for `Retry-After` and the GitHub-style `X-RateLimit-*` triplet, and `withIdempotencyKey` for unsafe verbs. Only 5xx, 408, 429, and network errors are retried; `AbortError` is propagated immediately.
- **`@alphabet/api/mock`** (new subpath, additive): an in-process mock server that implements all 16 Alphabet endpoints with deterministic responses (seeded `xoshiro128**` PRNG, ~50 LOC, no dep). The `MockServerHandle` is itself a `Fetcher`, so it composes with `withRetry` and the broader transport stack. Includes a `forceFailure: { failFirst: N }` knob for exercising retry paths in CI.
- **Documentation**: `docs/IMPLEMENTATION_STATUS.md` rows for `@alphabet/ui`, `@alphabet/security`, `@alphabet/protocols`, and `apps/demo` were stale (marked 🟠 stub) but those packages are in fact substantially implemented. Reconciled against `git ls-files` + `pnpm test`.

Test totals: `@alphabet/core` 184 → 222 (+38); `@alphabet/api` 77 → 104 (+27); full monorepo green.
