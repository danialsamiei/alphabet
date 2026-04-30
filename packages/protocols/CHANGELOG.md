# @alphabet/protocols

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

### Patch Changes

- Updated dependencies [b839adc]
- Updated dependencies [4a40959]
  - @alphabet/core@2.0.0
  - @alphabet/api@2.0.0
