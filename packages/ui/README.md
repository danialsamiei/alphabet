# `@alphabet/ui`

Adaptive Render Layers SDK for React, plus an opt-in set of
shadcn-style **primitives** styled with the Alphabet design tokens.

The base bundle is intentionally lightweight (≤ 12 KB brotli) and
**R3F-free**. Heavier surfaces (R3F immersive layer, primitives) live on
isolated subpath exports so they only ship when imported.

## Subpath exports

| Subpath                             | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `@alphabet/ui`                      | `AlphabetProvider`, `AdaptiveSlot`, hooks, runtime     |
| `@alphabet/ui/hooks`                | React hooks (`useAlphabetHandshake`, …)                |
| `@alphabet/ui/layers`               | Static / Canvas / CSS-3D layers                        |
| `@alphabet/ui/layers/r3f`           | Lazy R3F immersive layer (loaded on demand)            |
| `@alphabet/ui/runtime`              | `LayerProvider`, capability helpers                    |
| **`@alphabet/ui/primitives`**       | shadcn-style primitives (Button, Card, Dialog, Sheet, Tabs, Tooltip, Switch) |
| `@alphabet/ui/styles/tokens.css`    | CSS variables (light / dark / RTL / reduced-motion)    |
| `@alphabet/ui/styles/primitives.css`| Component rules for the primitives subpath             |

## Primitives

Primitives are built on `@radix-ui/react-*` headless components for full
WCAG 2.2 AA accessibility (focus management, keyboard nav, `aria-*`
wiring). They use semantic class names (`alphabet-btn`, `alphabet-card`,
…) that resolve against the design tokens — no Tailwind dependency at
runtime, but consumers can layer Tailwind utility classes via
`className`.

```tsx
import '@alphabet/ui/styles/tokens.css';
import '@alphabet/ui/styles/primitives.css';

import {
  Button,
  Card, CardHeader, CardTitle, CardBody,
  Dialog, DialogTrigger, DialogContent, DialogTitle,
} from '@alphabet/ui/primitives';

<Card variant="glass">
  <CardHeader><CardTitle>Trust Pulse</CardTitle></CardHeader>
  <CardBody>
    <Dialog>
      <DialogTrigger asChild><Button variant="glass">Inspect</Button></DialogTrigger>
      <DialogContent glass>
        <DialogTitle>Provenance chain</DialogTitle>
      </DialogContent>
    </Dialog>
  </CardBody>
</Card>
```

### Glassmorphism

Each primitive that supports a frosted surface accepts a `glass` prop
(or `variant="glass"`) and reads from the `--alphabet-glass-*` tokens.
Override at the consumer level to retheme.

### RTL & reduced motion

Layout uses CSS logical properties (`inline-start/end`), so toggling
`dir="rtl"` on an ancestor flips primitives correctly. Animations
collapse to `0ms` automatically under `prefers-reduced-motion: reduce`
(driven by token overrides in `tokens.css`).

## Storybook

```bash
pnpm -F @alphabet/ui storybook         # http://localhost:6006
pnpm -F @alphabet/ui build-storybook   # static output → ./storybook-static
```

Addons enabled out of the box:
- `@storybook/addon-essentials`
- `@storybook/addon-a11y` (axe-core, WCAG 2.0/2.1/2.2 AA tags)
- `@storybook/addon-interactions`

A theme + direction toolbar is wired in `.storybook/preview.ts` so any
story can be flipped between light/dark and LTR/RTL.

## Chromatic

Visual-regression CI runs from `.github/workflows/chromatic.yml` and is
**gated on the `CHROMATIC_PROJECT_TOKEN` repo secret** — the workflow
becomes a no-op on forks and PRs without the secret, so external
contributors are never blocked.
