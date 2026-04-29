# `@alphabet/docs` — documentation site

Nextra v3 (Next.js 15 + MDX) site that serves the Alphabet documentation.

## Why this app is **outside** the pnpm workspace

`apps/docs` is excluded from the root workspace (see
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) — the `!apps/docs` line).
This is intentional:

* Next.js + Nextra pull in a much larger dependency graph than the SDK
  packages need. Keeping it in the root workspace would inflate
  `pnpm install --frozen-lockfile` in `ci.yml` for every PR even when
  the change is unrelated to docs.
* The docs site has its own deploy job (`.github/workflows/docs.yml`)
  which runs `pnpm install --no-frozen-lockfile` at this directory only.
  The job is gated on `paths:` filters so unrelated PRs do not pay for it.

The trade-off: there is no shared lockfile with the rest of the monorepo.
The `docs.yml` workflow caches the pnpm store across runs to keep this
fast; in practice the docs site re-resolves in ~10 s.

## Single source of truth: `/docs` at the repo root

Documentation Markdown lives **only** under `docs/*.md` in the monorepo
root. `apps/docs/scripts/sync-docs.mjs` mirrors those files into
`apps/docs/pages/docs/*.mdx` on every `predev` and `prebuild`. The mirror
directory is gitignored (`.gitignore` excludes `pages/docs/`). **Never
edit a file under `pages/docs/`** — your changes will be overwritten on
the next sync. Edit the canonical file under `docs/*.md`.

The information architecture (the sidebar order, section grouping) is
the only thing hand-authored here, in the `IA` array of
`scripts/sync-docs.mjs`. To add a new doc to the site, drop it in
`docs/`, then add a row to `IA`.

## Local development

```bash
cd apps/docs
pnpm install              # one-time, no lockfile needed
pnpm dev                  # runs sync-docs then `next dev` on :4321
```

Open http://localhost:4321 — Nextra hot-reloads on MDX changes, but
edits to source `docs/*.md` only flow through after a `pnpm sync-docs`
(which `predev` runs once at startup; re-run manually or restart `dev`).

## Deploying

Pushed to `main` deploys via `.github/workflows/docs.yml` to GitHub
Pages. To use a custom apex domain (e.g. `alphabet.alef.ba`):

1. Set the repo variable `DOCS_BASE_PATH` to the empty string (under
   Settings → Secrets and variables → Actions → Variables).
2. Add `apps/docs/public/CNAME` containing the apex hostname.
3. Point a `CNAME` DNS record at `<user>.github.io`.

## License

MIT — same as the rest of the repository.
