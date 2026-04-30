# Demo Deploy Runbook (`apps/danial-demo`)

This runbook describes a **Vercel-first** deployment path for the canonical demo app, with a **generic static hosting fallback** for providers like Netlify, Cloudflare Pages, GitHub Pages, S3+CloudFront, or any static CDN.

## 1) Prerequisites

- Node.js `>=20` and pnpm `>=9` available in CI/build environment.
- Monorepo root checkout (do **not** deploy only a partial app copy without workspace deps).
- Access to project env vars for target environment (`preview`, `staging`, `production`).
- Optional: `vercel` CLI if deploying from terminal.

Quick verification from repository root:

```bash
node -v
pnpm -v
pnpm install --frozen-lockfile
```

## 2) Canonical app selection

Alphabet has multiple apps/packages, but the **single canonical deployable demo** is:

- `apps/danial-demo`

Use this path consistently in CI/CD and docs to avoid drift.

## 3) Build command

### Vercel-first (recommended)

Set **Root Directory** to `apps/danial-demo`, and use monorepo-aware build:

```bash
cd ../.. && pnpm install --frozen-lockfile && pnpm --filter '@alphabet/danial-demo...' build
```

### Generic static hosting fallback

From repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter '@alphabet/danial-demo' build --mode production
```

If your host requires a single command, use:

```bash
pnpm install --frozen-lockfile && pnpm --filter '@alphabet/danial-demo' build --mode production
```

## 4) Output directory

For both Vercel and generic static hosts, publish:

- `apps/danial-demo/dist`

If the platform runs inside `apps/danial-demo` as project root, output is simply:

- `dist`

## 5) Environment variables

The app uses Vite environment profiles. Minimum recommended production set:

- `VITE_ALPHABET_PROFILE=production`
- `VITE_ALPHABET_API_BASE_URL=https://api.alphabet.alef.ba`
- `VITE_ALPHABET_ENABLE_TELEMETRY=true`
- `VITE_ALPHABET_ENABLE_EXPERIMENTAL_CHIPS=false`
- `VITE_ALPHABET_ENABLE_PROTOCOL_PLAYGROUND=true`
- `VITE_ALPHABET_ENABLE_MOCK_FALLBACK=false`
- `VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE=true`

For `preview`/`staging`, align vars to corresponding profile behavior and API base URL.

## 6) Smoke checks (post-deploy)

Run these checks immediately after release:

1. **Static health probe**
   - `GET /healthz.json`
   - Expect JSON containing `"status":"ok"` and `"service":"@alphabet/danial-demo"`.

2. **HTML boot check**
   - `GET /` returns `200` and includes app shell (`<div id="root">`).

3. **Asset check**
   - Verify major static assets (e.g. `/logo.png`) return `200`.

4. **Protocol playground safety check**
   - Open AI Protocol tab and confirm behavior matches env:
     - If backend unavailable and fallback enabled, it switches to mock.
     - If fallback disabled, degraded UX appears (no crash).

Example CLI smoke checks:

```bash
curl -fsS https://<your-domain>/healthz.json
curl -I https://<your-domain>/
curl -I https://<your-domain>/logo.png
```

## 7) Rollback

### Vercel rollback

- Use Vercel dashboard → Deployments → **Promote previous successful deployment**.
- Or alias the previous known-good deployment URL back to production domain.

### Generic static hosting rollback

- Re-point traffic (or origin) to previous `dist` artifact.
- If using versioned artifacts, redeploy last green build (N-1) and invalidate CDN cache.

Rollback decision trigger examples:

- Smoke checks fail.
- Significant increase in JS load/runtime errors.
- Demo tab(s) become non-interactive for primary browsers.

## 8) Failure Modes (Quick Fix Guide)

### A) Missing env vars

**Symptoms**
- Build succeeds but runtime points to wrong backend.
- Protocol playground stuck in error/degraded state unexpectedly.

**Fast fix**
1. Validate all required `VITE_ALPHABET_*` variables in host dashboard.
2. Confirm correct profile value (`preview` / `staging` / `production`).
3. Redeploy and re-run smoke checks.

### B) API timeout / backend unreachable

**Symptoms**
- Requests to `VITE_ALPHABET_API_BASE_URL` fail or time out.
- Protocol interactions fail in production.

**Fast fix**
1. Verify backend health separately.
2. Temporarily enable `VITE_ALPHABET_ENABLE_MOCK_FALLBACK=true` for non-prod stability.
3. Keep `VITE_ALPHABET_ENABLE_GRACEFUL_DEGRADE=true` to avoid hard UI failure.
4. Roll back if production UX is unacceptable.

### C) Asset path issues (404 on JS/CSS/images)

**Symptoms**
- Blank page or partially styled UI.
- `*.js` / `*.css` / image 404s in browser network panel.

**Fast fix**
1. Confirm host publish directory is exactly `dist` (or `apps/danial-demo/dist` in monorepo-root builds).
2. If deploying under subpath, ensure host rewrite/base-path settings match Vite output expectations.
3. Purge CDN cache and redeploy.

### D) SPA routing fallback misconfiguration

**Symptoms**
- Direct open of nested client route returns 404 from CDN.

**Fast fix**
1. Add host rewrite rule to serve `index.html` for non-file paths.
2. Keep static asset paths excluded from rewrite.
3. Re-test deep links.

---

## Operator checklist (copy/paste)

- [ ] Deploy target is `apps/danial-demo` (canonical app).
- [ ] Build command is monorepo-aware.
- [ ] Output directory is `dist`.
- [ ] Production env vars are set and reviewed.
- [ ] `healthz.json`, `/`, and key assets return `200`.
- [ ] Rollback path is identified before promotion.
