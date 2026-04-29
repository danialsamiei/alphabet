# Adaptive Render Layers

Alphabet renders one of five fidelity layers per visitor. The choice is
driven by **device capability** and **accessibility preferences**, not
by privacy signals or user-agent strings.

> Earlier drafts called this concept "UI Degradation". The public name
> is now **Adaptive Render Layers**. The TypeScript enum
> (`CapabilityLayer` in `@alphabet/core`) is unchanged for compatibility:
> `R3F_IMMERSIVE`, `CSS_3D`, `CANVAS_2D`, `STATIC_HTML`, `TEXT_ONLY`.

---

## The five layers

| Enum            | Renderer                                 | Typical role |
|-----------------|------------------------------------------|--------------|
| `R3F_IMMERSIVE` | React Three Fiber + WebGL 2.0            | Hero scenes, 3D product viewers, generative backgrounds. |
| `CSS_3D`        | CSS `transform-style: preserve-3d` + CSS animations | Mid-range devices or no-WebGL2. Subtle depth without GPU cost. |
| `CANVAS_2D`     | HTML5 Canvas 2D context + particle systems | Low-power devices, 2g/slow-2g networks. |
| `STATIC_HTML`   | Semantic HTML5 + CSS Grid + zero JS animation | SSR/SSG fallback. Always available. |
| `TEXT_ONLY`     | ARIA landmarks + plain text + no images  | Screen readers, very low bandwidth, explicit minimum. |

Each layer is a fully-functional UI. None of them is a "broken" version
of a higher tier — the static HTML layer is supposed to look intentional
and the text-only layer is supposed to be excellent for screen readers.

---

## Capability matrix

The `HandshakeDecisionEngine` selects a layer using inputs collected by
`SignalCollector` and refined by `EnrichmentPipeline`. Conceptually:

```
                                   Network
                          4g         3g        2g / slow-2g
                       ┌─────────┬─────────┬─────────────────┐
GPU  WebGL2 + capable  │  R3F    │  R3F    │   Canvas 2D     │
                       ├─────────┼─────────┼─────────────────┤
GPU  WebGL only        │  CSS 3D │ CSS 3D  │   Canvas 2D     │
                       ├─────────┼─────────┼─────────────────┤
GPU  no WebGL          │ Canvas  │ Canvas  │   Static HTML   │
                       ├─────────┼─────────┼─────────────────┤
JS off / SSR           │ Static HTML across the board        │
                       └─────────────────────────────────────┘
```

The actual decision engine is more conservative than the matrix above.
It applies these accessibility and resource modifiers *before* picking a
layer:

- `prefers-reduced-motion: reduce` — caps at `STATIC_HTML` for animated
  layers; the immersive and CSS-3D layers are still picked but rendered
  with their motion-free variants.
- `prefers-contrast: more` — keeps the layer choice; downstream
  components add high-contrast borders.
- Screen reader detected (heuristic) → `TEXT_ONLY`.
- `window.innerWidth < 768` and `R3F_IMMERSIVE` selected → downgrade to
  `CSS_3D`.
- Battery level < 20% and not charging (where the API is available) →
  one tier down.

---

## What does *not* affect layer choice

- **Privacy signals.** DNT, GPC, and the consent tier do **not** force
  the layer down. They restrict storage, profiling, analytics, and
  personalization — never rendering. A visitor with GPC enabled and a
  capable device still sees the immersive layer; they just don't get
  tracked.
- **User-Agent strings.** Alphabet does not branch on UA strings. It
  branches on real capability probes and Media Queries.
- **IP-based geo.** Layer choice is independent of `country` or
  `region`. (Geo influences `locale`, not `layer`.)

This separation of concerns is the central trust property of the layer
selection: a visitor's privacy posture and their visual fidelity are
two independent decisions.

---

## Bundle behaviour

The base `@alphabet/ui` entrypoint is intentionally lightweight and **does
not import** `@react-three/fiber` or `three`. The R3F immersive layer is
exposed under the subpath export `@alphabet/ui/layers/r3f` and is loaded
**lazily** by `AdaptiveSlot` (via dynamic import) only when the
handshake selects `R3F_IMMERSIVE`.

A CI check (`pnpm size:check-r3f-free`) asserts that the base bundle
does not transitively pull in R3F or `three`. This is a hard guarantee:
sites that never reach the immersive layer never pay its bytes.

---

## React API

```tsx
import { AlphabetProvider, AdaptiveSlot } from '@alphabet/ui';

function App() {
  return (
    <AlphabetProvider>
      <AdaptiveSlot
        r3f={({ direction, locale }) => <Immersive />}
        css3d={({ direction, locale }) => <Css3dHero />}
        canvas2d={({ direction, locale }) => <Canvas2dHero />}
        staticHtml={({ direction, locale }) => <StaticHero />}
        textOnly={({ direction, locale }) => <TextHero />}
      />
    </AlphabetProvider>
  );
}
```

`AdaptiveSlot` accepts one render function per layer. Only the function
for the selected layer is invoked, and only the modules it imports are
loaded.

For a transparency surface that explains *why* a given layer was chosen
(useful for trust + debugging), use the `<TransparencyNotice />`
component, which renders the `reasons` array from the
`HandshakeDecision`.

---

## SSR

On the server, no real `navigator` exists, so the handshake degrades
deterministically to `STATIC_HTML` (or `TEXT_ONLY` if explicitly
requested). The first client-side render of `AlphabetProvider` then runs the
handshake against the live `navigator` and may upgrade to a higher
layer. To avoid hydration mismatch:

- Always render the static HTML layer as the SSR output.
- Allow `AdaptiveSlot` to upgrade after hydration.
- If you need to lock the SSR output (no upgrade), pass
  `<AdaptiveSlot lockSSR />`.

---

## Cross-references

- Source: `packages/ui/src/components/AdaptiveSlot.tsx` and
  `packages/core/src/handshake/decision-engine.ts`.
- Concept: [`docs/CORE_CONCEPTS.md`](./CORE_CONCEPTS.md) §3.
- Privacy interaction: [`docs/PRIVACY_MODEL.md`](./PRIVACY_MODEL.md).
- Examples: [`examples/vite-react-basic`](../examples/vite-react-basic).
