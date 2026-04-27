# Release Readiness

This document describes the contract every AWAF package must satisfy before
publishing, and the workflow used to cut a release.

> **Status:** AWAF is pre-1.0 software. We do **not** publish to npm yet.
> All packages are workspace-local; consumers should pin to a commit SHA or
> use `pnpm pack` artefacts. The release process below is the documented
> contract for when publishing is enabled.

## Per-package checklist

Every public package (`@awaf/core`, `@awaf/api`, `@awaf/ui`, `@awaf/security`,
`@awaf/protocols`) MUST satisfy all of the following:

- [x] **`type: "module"`** — packages are ESM-first.
- [x] **`main` (CJS) + `module` (ESM) + `types`** at the top level — for
      bundlers and TypeScript consumers that read root fields.
- [x] **`exports` map** — `types` condition listed **first** in every
      conditional entry. Subpath exports (`./hooks`, `./layers`, etc.)
      use the same shape as the root.
- [x] **`./package.json` re-export** — required by some bundlers.
- [x] **`sideEffects: false`** — declares the package safe to tree-shake.
      AWAF code is purely declarative; no module-load side effects.
- [x] **`files` allow-list** — only `dist/` ships to the registry tarball,
      never source or test files. (Per-package READMEs are tracked but not
      yet present; the root `README.md` documents the SDK.)
- [x] **Generated `.d.ts`** — `tsc --emitDeclarationOnly --outDir dist`
      runs as part of `build`. Subpath types resolve to
      `dist/<subpath>/index.d.ts` per the project's tsconfig layout.
- [x] **Workspace `dependencies`** use `workspace:*`. They are rewritten
      to real semver ranges by `changeset publish` at release time.

## Validation pipeline

Run before any release:

```bash
pnpm install --frozen-lockfile
pnpm typecheck                 # strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess
pnpm test                      # vitest in every package
pnpm build                     # turbo build → dist/
pnpm benchmark:smoke           # fail loud if a perf budget regresses
pnpm size                      # size-limit tracks @awaf/core, @awaf/api, @awaf/ui
pnpm size:check-r3f-free       # base @awaf/ui bundle MUST NOT import @react-three/fiber or three
pnpm openapi:lint              # canonical /api/awaf/v1 spec is valid OpenAPI 3.1
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

## Versioning with Changesets

We use [Changesets](https://github.com/changesets/changesets). Authors add
a changeset alongside any user-facing change:

```bash
pnpm changeset
```

The interactive prompt asks which packages changed and whether the bump is
`patch`, `minor`, or `major`. Markdown files land in `.changeset/`.

To prepare a release:

```bash
pnpm version-packages   # changeset version → bumps versions, updates CHANGELOG.md
pnpm release            # build + changeset publish (when publishing is enabled)
```

The `.changeset/config.json` file is the source of truth for the public/
private set, base branch, and access policy.

## Backwards compatibility policy

* **Don't break existing imports** without a deprecation cycle:
  1. Keep the old export with a `@deprecated` JSDoc tag for one minor.
  2. Document the migration in the CHANGELOG entry.
  3. Remove in the next major.
* The canonical API prefix `/api/awaf/v1` is stable; the legacy `/api`
  prefix is preserved by `normalizeApiBaseUrl` for backwards compat
  (see `packages/core/src/contracts/routes.ts`).
* Brand IDs (`v-`, `sess-`, `mem-`, …) are stable.
* Adaptive Render Layer enum values (`R3F_IMMERSIVE`, `CSS_3D`, …) are
  stable across `@awaf/core` and `@awaf/ui`.

## Pre-publish manual checks

Before flipping the publish switch:

1. `pnpm pack` each package; inspect the tarball with `tar -tvf …` to
   confirm only `dist/` is included.
2. Install one of the `examples/` apps against the freshly packed tarballs
   (`pnpm install ./awaf-core-1.0.0.tgz …`) to verify resolution end-to-end.
3. Confirm `docs/PERFORMANCE.md` budgets still match
   `benchmarks/*.bench.ts`.
4. Confirm `openapi/awaf.v1.yaml` lints cleanly with `pnpm openapi:lint`.

## What is NOT released

* `apps/demo` — internal playground.
* `benchmarks/` — workspace package, `private: true`.
* `examples/*` — workspace packages, `private: true`.
* `packages/create-awaf` — currently planned/private (see its README).
