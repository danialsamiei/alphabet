# My Alphabet app

Scaffolded with `npm create alphabet@latest`.

## Develop

```bash
npm install
npm run dev
```

## What's included

* Vite + React + TypeScript setup.
* `@alphabet/core`, `@alphabet/api`, `@alphabet/ui` wired through `<AlphabetProvider>`.
* `<AdaptiveSlot>` with all four base render layers (R3F is loaded
  lazily by Alphabet when the device can support it).
* `<ConsentBanner>` (honours DNT/GPC) and `<TransparencyNotice>`.

See [the Alphabet docs](https://github.com/danialsamiei/awaf) for the full API.
