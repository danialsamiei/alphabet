# Alphabet 1.0 — Launch Checklist

> **Status legend.** ✅ done in this repo · ⏳ ready, awaits human action ·
> ⚪ deferred to post-launch / out of scope. Items marked ⏳ are blocked
> on a maintainer or external system; the *Owner* column says exactly who.
>
> This is the **honest** launch checklist. Items that depend on a human
> action (merging the release PR, configuring `NPM_TOKEN`, pointing DNS,
> commissioning a third-party audit) are deliberately **not** pre-checked.
> A pre-checked human-owned item is a lie that comes back to bite at the
> worst moment. Walk this list top-to-bottom on launch day.

Last updated: 2026-04-29.
Companion docs: [`LAUNCH_SECURITY_REVIEW.md`](./LAUNCH_SECURITY_REVIEW.md),
[`PRODUCTION_RELEASE_CHECKLIST.md`](./PRODUCTION_RELEASE_CHECKLIST.md),
[`RELEASE.md`](./RELEASE.md), [`ROADMAP.md`](./ROADMAP.md).

---

## 1. Code & engineering

| # | Status | Item                                                                                                  | Owner                  |
| - | :----: | :---------------------------------------------------------------------------------------------------- | :--------------------- |
| 1 |   ✅   | All five public packages versioned at `1.0.0` (fixed group in `.changeset/config.json`)                | —                      |
| 2 |   ✅   | `pnpm typecheck` passes                                                                                | —                      |
| 3 |   ✅   | `pnpm test:coverage` passes                                                                            | —                      |
| 4 |   ✅   | `pnpm build` produces ESM + CJS + d.ts for every package                                               | —                      |
| 5 |   ✅   | `pnpm size` size-limit budgets enforced (`.size-limit.json`)                                           | —                      |
| 6 |   ✅   | Base `@alphabet/ui` bundle is R3F-free (`scripts/check-ui-r3f-free.mjs`)                               | —                      |
| 7 |   ✅   | `pnpm benchmark:smoke` keeps handshake under 80 ms-on-3G target                                        | —                      |
| 8 |   ✅   | OpenAPI specs validate (`pnpm openapi:lint`)                                                           | —                      |

## 2. CI/CD

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 9  |   ✅   | `ci.yml` — typecheck + lint + test + build + benchmark + size + OpenAPI on every PR              | —                      |
| 10 |   ✅   | `ci.yml` — bundle visualizer (`scripts/bundle-visualizer.mjs`) uploads `bundle-report/` artifact  | —                      |
| 11 |   ✅   | `codeql.yml` — security-extended + security-and-quality, weekly schedule                          | —                      |
| 12 |   ✅   | `dependency-review.yml` — license allow-list + high-severity advisory gate on every PR            | —                      |
| 13 |   ✅   | `chromatic.yml` — Storybook visual regression (gated on `CHROMATIC_PROJECT_TOKEN`)                | —                      |
| 14 |   ✅   | `release.yml` — Changesets PR / publish, npm provenance enabled (`NPM_CONFIG_PROVENANCE=true`)    | —                      |
| 15 |   ✅   | `release.yml` — post-publish step regenerates and commits aggregated `CHANGELOG.md`               | —                      |
| 16 |   ✅   | `release-dry-run.yml` — manual `npm pack` + `npm publish --dry-run` artifact                      | —                      |
| 17 |   ✅   | All workflows declare scoped `permissions:` blocks and `concurrency.group`                        | —                      |
| 18 |   ⏳   | `NPM_TOKEN` configured in repo secrets (Settings → Secrets → Actions)                              | **Maintainer**         |
| 19 |   ⏳   | `SNYK_TOKEN` configured (optional; CI no-ops without it)                                           | **Maintainer (opt-in)** |
| 20 |   ⏳   | `CHROMATIC_PROJECT_TOKEN` configured (optional; CI no-ops without it)                              | **Maintainer (opt-in)** |
| 21 |   ⏳   | npm 2FA enabled on the publishing account; package `access: public` confirmed                     | **Maintainer**         |
| 22 |   ⏳   | Branch protection on `main`: required checks = `ci` + `codeql` + `dependency-review`              | **Maintainer**         |

## 3. Documentation

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 23 |   ✅   | `README.md` accurate; no over-claiming; status badges                                              | —                      |
| 24 |   ✅   | `AGENTS.md` — single source of truth for agents and contributors                                   | —                      |
| 25 |   ✅   | `docs/ARCHITECTURE.md`, `CORE_CONCEPTS.md`, `API_REFERENCE.md`, `PROTOCOLS.md` present and current | —                      |
| 26 |   ✅   | `docs/SECURITY.md` + `SECURITY_MODEL.md` + `LAUNCH_SECURITY_REVIEW.md` in tree                    | —                      |
| 27 |   ✅   | `docs/PRIVACY_MODEL.md` describes consent ladder + DP primitives                                  | —                      |
| 28 |   ✅   | `docs/ROADMAP.md` accurate (phase exit criteria still match shipped state)                        | —                      |
| 29 |   ✅   | `docs/RELEASE.md` describes per-package release contract                                          | —                      |
| 30 |   ✅   | `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` at repo root                                              | —                      |
| 31 |   ✅   | `LICENSE` (MIT) at repo root — matches README badges                                               | —                      |
| 32 |   ✅   | `examples/` directory with at least one runnable example                                           | —                      |
| 33 |   ⚪   | Hosted documentation site at `alphabet.alef.ba` (scaffolded under `apps/docs`, deploy on push)    | **Maintainer (DNS)**   |

## 4. Security & privacy

| #  | Status | Item                                                                                                                  | Owner                       |
| -- | :----: | :-------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| 34 |   ✅   | `docs/LAUNCH_SECURITY_REVIEW.md` — OWASP LLM Top‑10, GDPR Arts. 5/7/13–14/17/25/32, NIST AI RMF 1.0 with code citations | —                           |
| 35 |   ✅   | DNT/GPC auto-downgrade enforced in code (not configurable)                                                             | —                           |
| 36 |   ✅   | All randomness in privacy primitives uses `crypto.getRandomValues`, never `Math.random`                                | —                           |
| 37 |   ✅   | `pnpm audit --audit-level=high` runs in CI; surfaces high-severity advisories                                          | —                           |
| 38 |   ⚪   | Third-party penetration test                                                                                            | **External (post-launch)** |
| 39 |   ⚪   | DPIA / Article 35 risk assessment                                                                                       | **External / DPO**          |
| 40 |   ⚪   | First external security review (slot reserved in `LAUNCH_SECURITY_REVIEW.md` §6)                                       | **External (post-launch)** |

## 5. Release plumbing

| #  | Status | Item                                                                                                | Owner                  |
| -- | :----: | :-------------------------------------------------------------------------------------------------- | :--------------------- |
| 41 |   ✅   | `.changeset/v1-0-0-release.md` pins v1.0 cut for all five public packages                            | —                      |
| 42 |   ✅   | Each package has `files: ["dist"]`, ESM-first `exports` map, `sideEffects: false`                    | —                      |
| 43 |   ✅   | Subpath exports (`./types`, `./mock`, `./transport`, `./privacy`, `./primitives`, `./v2/*`) wired   | —                      |
| 44 |   ⏳   | Maintainer triggers `release-dry-run.yml` from a release candidate branch and reviews the tarballs   | **Maintainer**         |
| 45 |   ⏳   | Maintainer merges the auto-generated "chore(release): version packages" PR                          | **Maintainer**         |
| 46 |   ⏳   | `release.yml` publishes to npm with provenance; tarballs visible at `npmjs.com/package/@alphabet/*` | **Auto, post-merge**   |
| 47 |   ⏳   | `git tag v1.0.0` pushed to GitHub (Changesets does not push tags by default)                        | **Maintainer**         |
| 48 |   ⏳   | GitHub Release notes published, linking to aggregated `CHANGELOG.md`                                 | **Maintainer**         |

## 6. Launch assets

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 49 |   ✅   | `assets/launch/og-card.svg` (1200×630)                                                            | —                      |
| 50 |   ✅   | `assets/launch/twitter-card.svg` (1600×900)                                                       | —                      |
| 51 |   ✅   | `assets/launch/logo-animated.svg` (CSS keyframes + `prefers-reduced-motion` honoured)              | —                      |
| 52 |   ✅   | `assets/launch/wordmark.svg`                                                                       | —                      |
| 53 |   ✅   | `assets/launch/press-kit/README.md` with 50/150/500-word pitches                                   | —                      |
| 54 |   ⚪   | High-fidelity animated GIF / MP4 marketing reel (the SVG is the lossless reference)                | **Designer (optional)** |
| 55 |   ⏳   | OG / Twitter PNG renders (export from SVG to `assets/launch/og-card.png` + `twitter-card.png`)    | **Maintainer**         |
| 56 |   ⏳   | `<meta property="og:image">` and `<meta name="twitter:image">` updated on the public site         | **Maintainer**         |

## 7. Site & DNS

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 57 |   ⚪   | Documentation site scaffolded at `apps/docs` (Nextra)                                             | **Maintainer**         |
| 58 |   ⚪   | `.github/workflows/docs.yml` deploys to GitHub Pages on push to `main`                            | **Maintainer**         |
| 59 |   ⏳   | DNS for `alphabet.alef.ba` points at GitHub Pages (CNAME → `<user>.github.io`)                    | **Maintainer (DNS)**   |
| 60 |   ⏳   | Custom domain configured in repo Pages settings; HTTPS enforced                                    | **Maintainer**         |

## 8. Communication

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 61 |   ⏳   | GitHub Release announcement post (use the 150-word pitch from the press kit)                       | **Maintainer**         |
| 62 |   ⏳   | Hacker News / Reddit / X post (use the 50-word pitch)                                              | **Maintainer**         |
| 63 |   ⏳   | Alefba programme cross-post on `alef.ba`                                                           | **Maintainer**         |
| 64 |   ⏳   | Email any partners or design-partners who pre-tested the SDK                                       | **Maintainer**         |

## 9. Day-after

| #  | Status | Item                                                                                              | Owner                  |
| -- | :----: | :------------------------------------------------------------------------------------------------ | :--------------------- |
| 65 |   ⏳   | Watch GitHub Issues for v1.0.x bug reports; cut a `1.0.x` patch within 48 h if a regression lands | **Maintainer**         |
| 66 |   ⏳   | Confirm npm download stats begin recording on `npmjs.com/package/@alphabet/core`                   | **Maintainer**         |
| 67 |   ⏳   | Open a tracking issue for the items listed in `docs/LAUNCH_SECURITY_REVIEW.md` "Out of scope"     | **Maintainer**         |
| 68 |   ⏳   | Schedule the first quarterly security review (Item #40) in the team calendar                       | **Maintainer**         |

---

## How to use this checklist on launch day

1. Walk down the table from the top. Anything that is ✅ requires no
   action; it is true at the time of writing.
2. ⏳ items are the *manual* launch path. Most are 30 seconds each
   (`gh release create`, configure secret, post tweet); a few require
   real attention (review the dry-run tarballs, watch the publish job).
3. ⚪ items are explicitly **not** part of v1.0 — they are tracked here
   so we do not lose them. Open issues for any that should land in 1.0.x
   or 1.1.

A pre-merge dry-run sequence:

```bash
# 1. Trigger the dry-run from the Actions tab → "Release dry-run" → "Run workflow"
# 2. Download the tarballs artifact and locally:
mkdir /tmp/alphabet-dry-run && cd /tmp/alphabet-dry-run
unzip ~/Downloads/release-tarballs-*.zip
for tgz in *.tgz; do tar -tzf "$tgz" | head -20; echo "---"; done
# 3. Confirm `dist/` is present and source files are NOT in the tarball.
# 4. Approve the Changesets "Version Packages" PR.
# 5. The post-merge `release.yml` does the actual publish with provenance.
```

That is the entire launch path. If any ⏳ item turns into a hard blocker,
revert the release commit and cut a 1.0.0-rc.N from the same branch.

---

*End of Alphabet 1.0 Launch Checklist.*

## 10. danial-demo deploy verification (preview/staging/production)

### Pre-deploy

- [ ] Confirm selected profile: `preview`, `staging`, or `production`.
- [ ] Verify matching env file exists in `apps/danial-demo` (`.env.preview`, `.env.staging`, `.env.production`).
- [ ] Verify `VITE_ALPHABET_API_BASE_URL` points to the right backend for that profile.
- [ ] Verify telemetry/feature flags are correct for release window.
- [ ] Verify fallback policy:
  - [ ] `VITE_ALPHABET_ENABLE_MOCK_FALLBACK`
  - [ ] `VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE`
- [ ] Run smoke build with profile mode:
  - `pnpm --filter '@alphabet/danial-demo' build --mode <profile>`

### Post-deploy

- [ ] Check static health probe returns 200:
  - `GET /healthz.json`
- [ ] Open Protocol Playground and verify transport mode label is expected for profile.
- [ ] Force backend outage (temporary wrong origin or blocked network) and verify fallback behavior:
  - [ ] Auto-switch to mock mode when enabled.
  - [ ] Graceful degraded message when mock fallback is disabled.
- [ ] Verify no white-screen crash occurs when backend is unavailable.
- [ ] Capture deployment timestamp, profile, and smoke result in release notes.
