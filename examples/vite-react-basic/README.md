# AWAF — Vite + React basic example

Minimal Vite + React app showing how to wire AWAF into a fresh project.

## What it shows

1. **Install AWAF** — `@awaf/core`, `@awaf/api`, and `@awaf/ui` as workspace
   dependencies (replace with `npm`/`pnpm`/`yarn add` in a real project).
2. **Run the handshake** — `<AwafProvider>` at the root calls
   `useAwafHandshake` once and shares the result via React context.
3. **Use `<AdaptiveSlot>`** — the SDK picks one of five render layers
   (R3F → CSS 3D → Canvas 2D → Static HTML → Text-only) based on device
   capability and accessibility preferences. The R3F layer is loaded
   lazily so the base bundle stays small.
4. **Respect consent** — `<ConsentBanner>` collects an explicit consent
   tier; DNT/GPC are honoured automatically (banner is suppressed when
   privacy signals are active).
5. **Show transparency** — `<TransparencyNotice>` explains *why* AWAF
   chose the current layer in plain language.

## Run

```bash
pnpm install
pnpm --filter @awaf/example-vite-react-basic dev
```

Then open the printed URL.

## Build

```bash
pnpm --filter @awaf/example-vite-react-basic build
```

## In a real project

Replace the workspace deps in `package.json` with the published versions
once the registry release is enabled (see `docs/RELEASE.md`):

```json
{
  "dependencies": {
    "@awaf/core": "^1.0.0",
    "@awaf/api": "^1.0.0",
    "@awaf/ui":  "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

You also do **not** need the `vite.config.ts` workspace aliases — they
exist here only so the example runs against the in-tree source.
