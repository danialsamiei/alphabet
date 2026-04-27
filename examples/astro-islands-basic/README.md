# AWAF — Astro Islands basic example

> **Documentation-only snippet pack.** Astro plus its React integration
> brings a sizeable dependency tree into the repo, so this example ships
> as ready-to-paste source files. Drop them into a fresh `astro@latest`
> project with `@astrojs/react` enabled.

## Set up a fresh Astro project

```bash
npm create astro@latest my-awaf-astro -- --template minimal --typescript strict
cd my-awaf-astro
npx astro add react
npm install @awaf/core @awaf/api @awaf/ui   # once published
```

Until the registry release is enabled, link the packages locally with
`pnpm pack` artefacts or workspace `file:` paths.

## Files to copy

* `src/components/AwafIsland.tsx` — the React island that mounts
  `AwafProvider` and the AWAF UI tree. Keep AWAF inside one island; do
  not spread `useAwafHandshake` across multiple islands or you will run
  the handshake more than once.
* `src/pages/index.astro` — the host page. Renders the island with
  `client:load` so the handshake runs as soon as hydration begins.

## Astro-specific notes

* AWAF's base entry is **R3F-free**; the R3F layer is loaded lazily via
  the `@awaf/ui/layers/r3f` subpath. Astro's island builder will keep it
  as a separate chunk.
* During SSR (Astro's static build) `AdaptiveSlot` selects `STATIC_HTML`,
  so the HTML you ship in the island wrapper is hydration-safe.
* DNT/GPC are honoured in the browser; the consent banner only shows
  after hydration.

## What it shows

1. **Install AWAF** — see snippet above.
2. **Run handshake** — inside `<AwafProvider>` in the React island.
3. **Use `<AdaptiveSlot>`** — five render layers, R3F lazy.
4. **Respect consent** — `<ConsentBanner>` honours DNT/GPC.
5. **Show transparency** — `<TransparencyNotice>`.
