# Examples

Three runnable starters live in [`examples/`](../examples/). Each one
exists for a different purpose and demonstrates a different subset of
Alphabet.

| Example | Stack | What it demonstrates |
|---|---|---|
| [`vite-react-basic`](../examples/vite-react-basic) | Vite + React | The full client-side surface: provider, adaptive slot, consent banner, transparency notice. |
| [`next-app-router-basic`](../examples/next-app-router-basic) | Next.js App Router | Server-side handshake; SSR-safe initial render; client hydration. |
| [`astro-islands-basic`](../examples/astro-islands-basic) | Astro Islands | Static-first rendering with Alphabet mounted only on routes that benefit. |

All three are intentionally minimal — about one page each. They do not
yet show every feature of Alphabet; they show the ones that are real.

---

## `vite-react-basic`

The most complete example today, because it exercises every component
in `@alphabet/ui` that ships now.

```bash
cd examples/vite-react-basic
pnpm install
pnpm dev
```

What you should observe:

- The page renders **immediately** with one of the five Adaptive Render
  Layers (most likely `STATIC_HTML` on a typical dev machine).
- A `<TransparencyNotice />` panel explains *why* the layer was
  chosen — locale, direction, capability tier, accessibility prefs.
- A `<ConsentBanner />` collects consent. Clicking *Accept* upgrades
  the consent tier from `NO_MEMORY` to a higher tier; the page does
  **not** re-render at a different fidelity (privacy and rendering are
  decoupled).
- If you set `dnt: 1` or enable Global Privacy Control in your browser,
  the consent banner reflects an automatic downgrade and storage is
  refused even after clicking *Accept*.

Source: `examples/vite-react-basic/src/App.tsx`. The example uses only
the public top-level entry of `@alphabet/ui` plus the lazy R3F subpath; no
internal imports.

---

## `next-app-router-basic`

Demonstrates the SSR pattern: run the handshake on the server, hand the
decision to the client through a typed prop, and avoid hydration
mismatch.

```bash
cd examples/next-app-router-basic
pnpm install
pnpm dev
```

Notable points:

- The handshake runs in a Server Component or Route Handler.
- The first paint is locale- and direction-correct.
- `<AlphabetProvider initialDecision={…}>` skips a re-handshake on the
  client.
- The `STATIC_HTML` layer is what SSR emits; client hydration may
  upgrade to `CSS_3D` / `R3F_IMMERSIVE` if the device qualifies.

This example is the seed for the planned `@alphabet/next` adapter package
(see [`docs/ROADMAP.md`](./ROADMAP.md), Phase 3).

---

## `astro-islands-basic`

Demonstrates the static-first pattern: the bulk of the page is
pre-rendered HTML and Alphabet is mounted as a React island.

```bash
cd examples/astro-islands-basic
pnpm install
pnpm dev
```

Notable points:

- Astro renders `STATIC_HTML` at build time.
- An island runs the Alphabet handshake on the client and may upgrade the
  hero region to `CSS_3D` or `R3F_IMMERSIVE`.
- All content remains accessible to crawlers and visitors with JS
  disabled.

This example is the seed for the planned `@alphabet/astro` integration
(see [`docs/ROADMAP.md`](./ROADMAP.md), Phase 3).

---

## What no example demonstrates yet

To stay honest:

- **No real backend** is included. Endpoints called by `AlphabetClient`
  return mock data via `fetch` mocks where used. A first-party mock
  server is on the roadmap (Phase 2).
- **No AI integration** is included. `@alphabet/protocols` ships, but the
  examples do not yet wire an LLM through it. A small Vercel AI SDK
  example is on the roadmap (Phase 3+).
- **No Pulse / OpenClaw demo** is included. Those subsystems are
  planned (Phase 4).

When new examples land, they will be added to this document and to
`examples/`.

---

## Cross-references

- Quick start in the README: [`../README.md#quick-start`](../README.md#quick-start).
- Concepts behind the examples: [`docs/CORE_CONCEPTS.md`](./CORE_CONCEPTS.md).
- Render-layer selection: [`docs/ADAPTIVE_RENDER_LAYERS.md`](./ADAPTIVE_RENDER_LAYERS.md).
- Privacy guarantees: [`docs/PRIVACY_MODEL.md`](./PRIVACY_MODEL.md).
- Integration patterns: [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md).
