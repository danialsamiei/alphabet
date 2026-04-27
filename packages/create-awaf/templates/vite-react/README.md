# My AWAF app

Scaffolded with `npm create awaf@latest`.

## Develop

```bash
npm install
npm run dev
```

## What's included

* Vite + React + TypeScript setup.
* `@awaf/core`, `@awaf/api`, `@awaf/ui` wired through `<AwafProvider>`.
* `<AdaptiveSlot>` with all four base render layers (R3F is loaded
  lazily by AWAF when the device can support it).
* `<ConsentBanner>` (honours DNT/GPC) and `<TransparencyNotice>`.

See [the AWAF docs](https://github.com/danialsamiei/awaf) for the full API.
