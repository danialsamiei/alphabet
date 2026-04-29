# Alphabet — Next.js App Router basic example

> **Documentation-only snippet pack.** Next.js drags in a large dependency
> tree (>200 packages), so to keep the Alphabet monorepo lightweight we ship
> this example as ready-to-paste source files plus install steps. Drop
> the `app/` files into a fresh `create-next-app` project and you have
> a working Alphabet integration.

## Set up a fresh Next.js project

```bash
npx create-next-app@latest my-alphabet-app --ts --app --no-eslint --no-tailwind --no-src-dir --import-alias "@/*"
cd my-alphabet-app
npm install @alphabet/core @alphabet/api @alphabet/ui   # once published
```

Until the registry release is enabled, link the packages locally with
`pnpm pack` artefacts or workspace `file:` paths.

## Files to copy

Copy `app/layout.tsx` and `app/page.tsx` from this directory into your
new project. The key points:

* `<AlphabetProvider>` is a Client Component (`"use client"` directive). The
  Alphabet handshake reads browser-only APIs, so it can't run during the
  RSC render. Mount it in `app/providers.tsx` and wrap your tree.
* `<AdaptiveSlot>` and `<TransparencyNotice>` are Client Components too.
  During SSR they always pick `STATIC_HTML`, which is the safest layer
  for hydration parity.
* `<ConsentBanner>` is also a Client Component; it only renders after
  hydration so server-rendered HTML stays stable.

## What it shows

1. **Install Alphabet** — see `package.json` snippet above.
2. **Run handshake** — `<AlphabetProvider>` in `app/providers.tsx`.
3. **Use `<AdaptiveSlot>`** — five render layers, R3F lazy-loaded.
4. **Respect consent** — `<ConsentBanner>` honours DNT/GPC.
5. **Show transparency** — `<TransparencyNotice>`.

## Why not a full Next.js install in the monorepo?

The Alphabet monorepo intentionally avoids large app-framework dependencies.
The Vite + React example covers full end-to-end integration; the Next.js
and Astro examples document the framework-specific glue.
