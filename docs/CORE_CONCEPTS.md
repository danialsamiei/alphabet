# Core concepts

Alphabet is built around four small ideas. This document describes each one
in enough depth to read the source code, write integrations, and review
PRs against the SDK.

> **Naming.** Alphabet expands to **Adaptive Web Awareness Framework**. The
> brand origin is **الفبا (Alefba)**, the Persian word for *alphabet* —
> the elementary letters from which any language is built. Alphabet treats
> *language*, *direction*, *device*, *network*, and *consent* as letters
> of an alphabet that the page assembles itself from at runtime.

---

## 1. Context Handshake

The Context Handshake is a **pure, pipelined transformation** from
passive browser signals to a UI configuration. It is implemented in
`@alphabet/core/handshake` and runs entirely on the client (or on the edge,
if you prefer to do it server-side at request time — the code is
dependency-free and edge-safe).

```
SignalCollector ──▶ EnrichmentPipeline ──▶ HandshakeDecisionEngine
   (passive          (coarse geo,             (locale, dir, theme,
    browser           RTL detection,            capability layer,
    signals)          capability inference)     hero copy, privacyMode)
```

### Phases (lifecycle)

The full lifecycle is a six-phase state machine
(`HandshakeState` in `@alphabet/core/types`):

1. `detect` — `SignalCollector.collect()` reads passive signals.
2. `enrich` — `EnrichmentPipeline.enrich(signals, geoSeed)` derives
   `EnrichedContext` (coarse geo, RTL flag, capability hints).
3. `decide` — `HandshakeDecisionEngine.decide(enriched)` returns a
   `HandshakeDecision` containing `uiConfig` and `privacyMode`.
4. `display` — render the chosen layer (currently driven by
   `@alphabet/ui`'s `AdaptiveSlot`).
5. `consent` — present a consent banner if required by jurisdiction or
   policy version. Implemented as the `ConsentBanner` component in
   `@alphabet/ui` and the `ConsentTierManager` state machine in
   `@alphabet/security`.
6. `morph` — re-render with elevated permissions if the visitor grants
   or upgrades consent.

Phases 1–3 are shipped today as pure code with full unit-test coverage.
Phases 4–6 ship as React surface in `@alphabet/ui`; an end-to-end
`HandshakeOrchestrator` that drives the whole lifecycle in one call is
on the roadmap (see `docs/ROADMAP.md`, Phase 2).

### Inputs (passive only)

`SignalCollector` reads only what the browser already exposes:

- `navigator.language` and `navigator.languages`
- `Intl.DateTimeFormat().resolvedOptions().timeZone`
- `navigator.connection` (Network Information API)
- `navigator.doNotTrack`, `navigator.globalPrivacyControl`
- `window.innerWidth`, `window.innerHeight`, `devicePixelRatio`
- WebGL-context probe (capability hint, no fingerprinting)
- `matchMedia('(prefers-reduced-motion: reduce)')`,
  `matchMedia('(prefers-contrast: more)')`,
  `matchMedia('(prefers-color-scheme: dark)')`

Things Alphabet does **not** read: cookies, IndexedDB, localStorage, third-party
iframes, IP address, canvas/WebGL fingerprints, font enumeration, audio
context probes.

### Output

```ts
interface HandshakeDecision {
  uiConfig: {
    locale: string;            // BCP-47, e.g. 'en-US' / 'fa-IR'
    dir: 'ltr' | 'rtl';
    theme: 'light' | 'dark';
    layer: CapabilityLayer;    // R3F_IMMERSIVE | CSS_3D | CANVAS_2D | STATIC_HTML | TEXT_ONLY
    heroCopy: string;          // pre-localized copy for the hero region
  };
  privacyMode: PrivacyMode;    // see §2
  reasons: string[];           // human-readable trace, e.g. for TransparencyNotice
}
```

---

## 2. Consent ladder

Alphabet defines **four monotonic consent tiers**, ordered by what each one
permits:

| Tier         | Memory | Personalization | Analytics (k-anon) | Precise geo |
|--------------|:------:|:---------------:|:------------------:|:-----------:|
| `NO_MEMORY`  |   ❌   |        ❌       |         ❌         |      ❌     |
| `ANONYMOUS`  |   ✅   |        ❌       |         ✅         |      ❌     |
| `CONSENTED`  |   ✅   |        ✅       |         ✅         |      ❌     |
| `ENRICHED`   |   ✅   |        ✅       |         ✅         |      ✅     |

Two rules make this a *ladder*, not a free-form set of flags:

1. **Monotonic upgrades only.** A visitor can move up
   (`NO_MEMORY → ANONYMOUS → CONSENTED → ENRICHED`) but never silently
   downgrade. Downgrades are explicit (`revoke`, `reset`, or
   `downgradeOnPrivacySignal`) and always emit an audit event.
2. **DNT/GPC always wins.** If `navigator.doNotTrack === '1'` or
   `navigator.globalPrivacyControl === true`, Alphabet forces the *runtime*
   privacy mode to Tier 0 even if the visitor previously granted a
   higher tier. The stored consent record is preserved; only the
   effective permissions are downgraded.

The state machine lives in `@alphabet/security/ConsentTierManager` and the
permission helpers in `@alphabet/core/privacy`:

```ts
import { canStoreMemory, canPersonalize, canUseAnalytics, canUsePreciseGeo } from '@alphabet/core';

if (canStoreMemory(tier, signals)) {
  // safe to write to VisitorMemory
}
```

These four pure helpers are the **only authoritative permission checks**
in the SDK. Anything that bypasses them is a bug.

See [`docs/PRIVACY_MODEL.md`](./PRIVACY_MODEL.md) for the full model.

---

## 3. Adaptive Render Layers

Alphabet renders one of **five fidelity layers**, chosen from real device
capability and accessibility preferences:

| Layer          | Renderer                       | Picked when… |
|----------------|--------------------------------|--------------|
| `R3F_IMMERSIVE`| React Three Fiber + WebGL 2.0  | capable GPU, fast network, no `prefers-reduced-motion`. |
| `CSS_3D`       | CSS 3D transforms              | medium-tier device or fast network without WebGL2. |
| `CANVAS_2D`    | HTML5 Canvas 2D                | low-power devices or 2g/slow-2g networks. |
| `STATIC_HTML`  | Semantic HTML + CSS Grid       | SSR fallback, no JS, or `prefers-reduced-motion`. |
| `TEXT_ONLY`    | ARIA landmarks + plain text    | screen readers, very low bandwidth, or explicit minimum. |

Three rules make this trustworthy:

1. **Capability and accessibility drive the choice — not privacy.** A
   visitor with GPC enabled and a capable device still sees the
   immersive layer; they just don't get tracked.
2. **The base bundle is R3F-free.** The immersive layer is loaded
   lazily by `AdaptiveSlot` from `@alphabet/ui/layers/r3f` only when
   selected. There is a CI check (`pnpm size:check-r3f-free`) that
   asserts the base bundle does not transitively import
   `@react-three/fiber` or `three`.
3. **Layer is a *first-class* enum, not a guess.** It is part of the
   `HandshakeDecision` and is available to every downstream consumer
   (your own components, your A/B tests, your AI prompts, etc.).

See [`docs/ADAPTIVE_RENDER_LAYERS.md`](./ADAPTIVE_RENDER_LAYERS.md) for
the full capability matrix and accessibility rules.

> Earlier drafts of the project called this concept "UI Degradation".
> The new public name is **Adaptive Render Layers**. The TypeScript
> enum values (`R3F_IMMERSIVE`, `CSS_3D`, `CANVAS_2D`, `STATIC_HTML`,
> `TEXT_ONLY`) are unchanged.

---

## 4. AI-ready, provider-neutral protocols

Alphabet treats LLMs as *one* possible consumer of the visitor context, not
as the centre of the SDK. The protocol layer
(`@alphabet/protocols`) defines a single normalized contract and exposes it
over multiple transports.

```
┌─────────────────────────────────────────────┐
│  AlphabetProtocolRequest / AlphabetProtocolResponse │
│            (the normalized contract)        │
└─────────────────────────────────────────────┘
        ▲          ▲          ▲           ▲
        │          │          │           │
   direct-api    mcp        a2a       qr-handoff
   (REST)    (Anthropic   (Google     (cross-device,
              MCP)        A2A)        AES-GCM-encrypted)
```

Three rules make this provider-neutral:

1. **No model client in the runtime.** `@alphabet/protocols` does not import
   OpenAI, Anthropic, or Vercel AI SDK. Provider integrations are
   exposed as the optional `AlphabetAiProviderAdapter` contract that
   consumers implement themselves.
2. **Consent is enforced at the boundary.** Every adapter calls
   `validateConsentScope` and `evaluateMemoryPermission` (the canonical
   implementations of the Alphabet consent ladder) before exposing memory
   or personalization to a model.
3. **QR handoff is encrypted by default.** Payloads are AES-GCM
   encrypted, audience-bound, expire in 60 seconds by default, and are
   PII-scrubbed before encoding.

See [`docs/PROTOCOLS.md`](./PROTOCOLS.md) and
[`docs/API_CONTRACT.md`](./API_CONTRACT.md).

---

## How the four concepts compose

```
    passive signals
          │
          ▼
   ┌──────────────┐
   │   Handshake  │ ──── decides ────▶  Adaptive Render Layer
   └──────────────┘
          │
          │ produces privacyMode
          ▼
   ┌──────────────┐
   │   Consent    │ ──── enforces ───▶  what is stored / personalized
   │    ladder    │
   └──────────────┘
          │
          │ produces a normalized request envelope
          ▼
   ┌──────────────┐
   │   Protocol   │ ──── exposes ────▶  Direct REST / MCP / A2A / QR
   │   adapters   │
   └──────────────┘
```

A useful one-liner: **Alphabet turns "what does this browser tell me?"
into a typed UI configuration, a typed consent posture, and a typed
protocol envelope — and then gets out of your way.**
