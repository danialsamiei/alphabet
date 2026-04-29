# Integrations

Alphabet is designed to **integrate**, not replace. This document explains
how Alphabet sits next to the tools you already use.

A short rule of thumb: Alphabet answers three questions and hands the
answers to whoever needs them.

1. *What does this visitor's browser tell me?* (`HandshakeDecision`)
2. *Which UI layer should I render?* (`CapabilityLayer`)
3. *What am I allowed to remember about this visitor?* (`PrivacyMode`)

Anything beyond those three answers — routing, rendering, i18n,
experimentation, model inference, CMP UX — is out of scope for Alphabet and
delegated to the tool you already chose.

---

## Web frameworks

### Next.js

Alphabet integrates with Next.js (App Router or Pages Router); it does not
replace it.

- Run the handshake on the **server** (Route Handler, Server Component,
  or Middleware) so the first paint is already locale- and
  direction-correct.
- Pass the `HandshakeDecision` to your client via a Server Component
  prop or a typed cookie.
- Hydrate `<AlphabetProvider initialDecision={…}>` to skip a re-handshake
  on the client.
- See [`examples/next-app-router-basic`](../examples/next-app-router-basic).

A first-class `@alphabet/next` adapter (with a `withAlphabet` config helper and
a Server Action wrapper) is on the roadmap (Phase 3).

### Astro

Alphabet shares Astro's static-first / progressive-enhancement principles.

- Render the static-HTML layer (`STATIC_HTML`) at build time.
- Mount Alphabet as a React island only on the routes that benefit from
  capability-aware rendering.
- See [`examples/astro-islands-basic`](../examples/astro-islands-basic).

A first-class `@alphabet/astro` integration is on the roadmap (Phase 3).

### Remix / Vite + React / plain React

Alphabet runs as a small SDK alongside any of these. Today the most
complete starter is [`examples/vite-react-basic`](../examples/vite-react-basic).

---

## Internationalization (i18next, next-intl, FormatJS)

Alphabet **detects and negotiates** the locale and direction; it then
delegates **localization** to your i18n library.

```ts
import { HandshakeDecisionEngine } from '@alphabet/core';
import i18next from 'i18next';

const decision = new HandshakeDecisionEngine().decide(enriched);

await i18next.changeLanguage(decision.uiConfig.locale);
document.documentElement.dir = decision.uiConfig.dir;
```

What Alphabet contributes:

- **BCP-47 locale** (`en-US`, `fa-IR`, `ar-EG`, `bg-BG`, …) negotiated
  from `Accept-Language` and timezone.
- **Writing direction** (`ltr` / `rtl`) — important for Persian, Arabic,
  Hebrew, Urdu.
- **Pre-localized hero copy** for 12+ language families (templates only,
  not full translations of your content).

What Alphabet does **not** do: ICU message formatting, plural rules,
runtime translation lookup, lazy translation chunks. That is your i18n
library's job.

---

## AI clients (Vercel AI SDK, LangChain, OpenAI / Anthropic SDK)

Alphabet complements an AI SDK with **context, consent, and adaptive UI**.
It does not bundle a model client.

- `@alphabet/protocols` exposes a normalized `AlphabetProtocolRequest` envelope
  that includes the visitor's `consentScope`, `memoryPermission`, and
  `uiConfig`.
- Every adapter calls `validateConsentScope` and
  `evaluateMemoryPermission` *before* exposing memory or personalization
  to a model. That means a chat agent never sees a memory write the
  visitor has not consented to.
- The optional `AlphabetAiProviderAdapter` contract lets you implement a
  provider integration in your own application without Alphabet taking on
  any LLM-vendor dependency.

```
Your app                     @alphabet/protocols              Your AI SDK
┌────────┐  AlphabetProtocol-   ┌────────────┐  forward       ┌─────────┐
│ Routes │ ───Request────▶  │ adapter +  │  with consent  │  Vercel │
│ / UI   │                  │ normalizers│ ──scoped────▶  │  AI SDK │
└────────┘  AlphabetProtocol-   └────────────┘  context       └─────────┘
            Response ◀───────
```

A first-class `@alphabet/ai-sdk` (Vercel AI SDK adapter) is planned as an
optional package; Alphabet stays provider-neutral by default.

---

## Feature flags & experimentation (GrowthBook, LaunchDarkly, Statsig)

Alphabet can provide **privacy-safe context traits** for targeting and
experimentation. The traits are derived from the handshake and are safe
to send to a flag SDK at any tier:

| Trait              | Source                                    | Tier required |
|--------------------|-------------------------------------------|:-------------:|
| `locale`           | `HandshakeDecision.uiConfig.locale`       | NO_MEMORY     |
| `dir`              | `HandshakeDecision.uiConfig.dir`          | NO_MEMORY     |
| `capabilityLayer`  | `HandshakeDecision.uiConfig.layer`        | NO_MEMORY     |
| `prefersReducedMotion` | `DetectedSignals`                     | NO_MEMORY     |
| `country` (ISO)    | `EnrichedContext.geo.country`             | NO_MEMORY     |
| `consentTier`      | `ConsentTierManager.current()`            | NO_MEMORY     |
| `visitorId`        | `VisitorId` (branded)                     | ANONYMOUS+    |

Feed these to your flag SDK as user attributes. Alphabet does not run
experiments itself.

```ts
import { GrowthBook } from '@growthbook/growthbook';

const gb = new GrowthBook();
gb.setAttributes({
  locale: decision.uiConfig.locale,
  capabilityLayer: decision.uiConfig.layer,
  prefersReducedMotion: signals.prefersReducedMotion,
  country: enriched.geo.country,
  consentTier: tierManager.current(),
});
```

---

## Consent Management Platforms (OneTrust, Cookiebot, Klaro)

Alphabet ships a developer-grade consent state machine in
`@alphabet/security/ConsentTierManager`. It can interoperate with a full
CMP — not necessarily replace one.

Two integration patterns:

1. **Alphabet as source of truth.** Your app stores Alphabet's
   `VisitorConsent` record; the CMP UI is rendered by Alphabet's
   `ConsentBanner`. Best for greenfield projects.
2. **Alphabet as downstream consumer.** The CMP owns the consent UI; on
   change events you call
   `tierManager.grant({ tier, purposes, source: 'cmp' })`. Best when you
   already have an enterprise CMP.

In either case Alphabet still enforces DNT/GPC auto-downgrade in code.

---

## Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy)

The `@alphabet/core` handshake is pure-TypeScript and dependency-free. It
runs on edge runtimes without modification — the only requirement is
that you supply a `GeoContext` to `EnrichmentPipeline.enrich` (since
edge runtimes typically expose geo through a request header rather than
through `Intl.DateTimeFormat`).

```ts
// Cloudflare Workers example (sketch)
import { EnrichmentPipeline, HandshakeDecisionEngine } from '@alphabet/core';

export default {
  fetch(req: Request) {
    const country = req.cf?.country ?? 'US';
    // …build DetectedSignals from headers (Accept-Language, UA hints)…
    const enriched = new EnrichmentPipeline().enrich(signals, { country, timezone });
    const decision = new HandshakeDecisionEngine().decide(enriched);
    return new Response(renderHtml(decision));
  },
};
```

---

## Cross-references

- Concepts: [`docs/CORE_CONCEPTS.md`](./CORE_CONCEPTS.md).
- Privacy model: [`docs/PRIVACY_MODEL.md`](./PRIVACY_MODEL.md).
- Examples: [`docs/EXAMPLES.md`](./EXAMPLES.md) and the runnable
  [`examples/`](../examples/) directory.
- Roadmap (which adapters are planned vs. shipped):
  [`docs/ROADMAP.md`](./ROADMAP.md).
