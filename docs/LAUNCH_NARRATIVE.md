# Launch narrative

> A 5-minute introduction to AWAF for developers who have never seen
> the project before. If you only read one document, read this one.

---

## Problem

Most websites today force a binary choice:

- **Static one-size-fits-all.** Fast and private — but it does not
  speak the visitor's language, respect their device, honour their
  motion preferences, or adapt to a screen reader. Every visitor sees
  the same glyphs in the same direction at the same fidelity.
- **Heavy client-side personalization.** Adaptive — but typically
  built on cookies, third-party trackers, fingerprints, and dark
  consent patterns. The cost is paid by the visitor's privacy, the
  bundle size, and the development team's compliance burden.

Web frameworks (Next.js, Astro, Remix) solve routing and rendering.
i18n libraries (i18next, next-intl) solve localization. AI SDKs solve
model inference. Feature-flag platforms solve experimentation. None of
them, by design, solves the cross-cutting problem of **"adapt the
experience to who is here, without spying on them."**

That is the gap AWAF fills.

---

## Solution

**AWAF is a privacy-first adaptive web SDK for building context-aware,
multilingual, capability-adaptive, AI-ready web experiences without
invasive tracking.**

It does four small things and gets out of your way:

1. **Reads passive browser signals** — `Accept-Language`, IANA
   timezone, viewport, WebGL probe, network class,
   `prefers-reduced-motion`, DNT, GPC. No cookies. No fingerprinting.
   No third-party calls.
2. **Decides a typed UI configuration** — locale, writing direction,
   theme, one of five Adaptive Render Layers, hero copy.
3. **Enforces a consent ladder in code** — four monotonic tiers
   (`NO_MEMORY` → `ANONYMOUS` → `CONSENTED` → `ENRICHED`), with DNT/GPC
   auto-downgrade and explicit revoke.
4. **Exposes a normalized request envelope** for AI clients
   (Direct REST, MCP, A2A, QR handoff) — without bundling a model
   client and without locking you to a vendor.

Everything else — routing, rendering, ICU formatting, model inference,
A/B tests — is *deliberately* delegated to the tool you already use.

---

## Why now

A handful of platform shifts have made this approach viable, and
necessary, in 2025–2026:

- **Privacy regulation is no longer optional.** GDPR, CCPA, LGPD, and
  the proliferation of Global Privacy Control mean that "track first,
  ask later" is both unethical and increasingly unprofitable. Tier 0
  by default is now a feature, not a constraint.
- **Browser capability detection has matured.** Network Information
  API, `navigator.connection`, `prefers-reduced-motion`,
  `prefers-contrast`, DPR, and reliable WebGL probes are widely
  supported. We can finally branch on real capability instead of UA
  strings.
- **Edge runtimes are everywhere.** Cloudflare Workers, Vercel Edge,
  and Deno Deploy make it cheap to do the handshake at request time,
  before any HTML reaches the browser. AWAF's pure-TypeScript core is
  edge-safe by construction.
- **AI surfaces are eating the web.** Every product is adding an LLM
  feature. None of them should leak unconsented memory or
  PII to the model. AWAF normalizes that boundary.
- **The accessibility and i18n communities have done the hard work.**
  RTL, BCP-47 negotiation, and reduced-motion fallbacks are now well
  understood. AWAF can stand on those shoulders.

Short version: the *signals* are universally available, the *legal
floor* is rising, the *runtime* is moving to the edge, and the *output*
needs to be safe for AI consumers. A small, opinionated SDK that ties
those four together is the missing piece.

---

## Target developers

AWAF is built for:

- **Indie product engineers** who want their site to feel correct in
  Persian, Arabic, Bulgarian, Japanese, and English — without learning
  five i18n stacks — and to do it without dropping a tracking pixel.
- **Privacy-conscious teams** at startups and agencies who need a
  "ship-it-monday" answer to "how do we adapt UX without a CMP and ten
  trackers?"
- **Edge / serverless developers** who are already running on
  Cloudflare Workers or Vercel Edge and want a dependency-free
  handshake they can run before HTML is generated.
- **Accessibility-minded teams** who want `prefers-reduced-motion` and
  screen-reader paths to be first-class, not afterthoughts.
- **Teams adding LLM features** who need a clean, provider-neutral
  contract for visitor context with consent enforcement at the
  boundary.

AWAF is **not** built for: marketing-attribution stacks, enterprises
that require a certified CMP, or projects that want a meta-framework.
For those, use the right tool.

---

## 5-minute demo story

A demo that fits in five minutes and tells the story honestly:

1. **(0:00 – 0:30) Open `examples/vite-react-basic`.** Run
   `pnpm dev`. The page renders **immediately** with the static-HTML
   layer, the correct locale, and the correct writing direction. No
   loading spinner, no flash of un-styled text.

2. **(0:30 – 1:30) Show the `<TransparencyNotice />` panel.** It
   explains *why* this layer was chosen: detected locale, detected
   direction, capability tier, accessibility preferences. AWAF is
   honest about its inputs.

3. **(1:30 – 2:30) Resize the window / toggle DevTools "throttling: 3G"
   / toggle `prefers-reduced-motion`.** The render layer changes
   accordingly. None of these changes affects privacy posture; only
   visual fidelity. (Show the unchanged `consentTier` in the panel.)

4. **(2:30 – 3:30) Click the consent banner's *Accept* button.**
   `consentTier` upgrades from `NO_MEMORY` to `CONSENTED`. The render
   layer does **not** change — proving rendering and privacy are
   decoupled. Show the `privacyMode` object: `canStoreMemory`,
   `canPersonalize` flip to `true`.

5. **(3:30 – 4:30) Enable Global Privacy Control in the browser
   (`Sec-GPC: 1`).** Reload. The banner shows that storage is refused;
   `canStoreMemory` returns `false` even with consent granted. Code,
   not policy, enforces this.

6. **(4:30 – 5:00) Open `packages/core/src/handshake/decision-engine.ts`
   in the editor.** ~200 lines of strict TypeScript. No `any`, no
   cookies, no third-party imports. That is the entire core engine.

The point of the demo is not to show flash. It is to show **how small
the trustworthy core actually is**, and that nothing in the experience
is hidden behind a black box.

---

## Roadmap to v1.0

The full plan is in [`ROADMAP.md`](./ROADMAP.md). The condensed view:

| Phase | Theme | Headline outcome |
|---|---|---|
| **1 — Truth alignment** *(current)* | Honest README, status audit, documentation that is navigable in under five minutes. | What you are reading now. |
| **2 — Smallest end-to-end** | `HandshakeOrchestrator`, full lifecycle (`detect → enrich → decide → display → consent → morph`), in-repo mock server, working Layers 4 + 5 demo. | `pnpm dev` opens an adaptive page; handshake completes in < 100 ms. |
| **3 — First-class adapters** | `@awaf/next`, `@awaf/vite`, `@awaf/astro` integrations. | Drop-in install for the three most common stacks. |
| **4 — Pulse plugin (opt-in)** | `@awaf/pulse`: trust-tiered ingestion, C2PA-style provenance, RAG-grounded brief generation. | Optional plugin; not required for 1.0. |
| **5 — Hardening** | Sub-100 ms handshake benchmark in CI, NIST AI RMF mapping doc, cost guardian, differential-privacy helpers, accessibility audit, security review. | 1.0 release. |

No fixed dates are committed. Phases are scoped, not timeboxed. Every
phase ends with a concrete, demonstrable artifact.

---

## Principles

The four principles AWAF will not compromise on, even when convenient:

### Privacy-first
Tier 0 (`NO_MEMORY`) is the default. DNT and GPC always win at runtime.
PII never appears in logs. Geo defaults to coarse
(`country` + `timezone` + broad `region`). Precise geo is gated behind
explicit code flags **and** a passing `canUsePreciseGeo()` check.

### No fingerprinting
AWAF reads only passive signals the browser already exposes for
legitimate purposes. It never hashes navigator properties into a
fingerprint. No canvas / WebGL / audio / font-list fingerprints. No
cookies. No localStorage by default.

### Progressive enhancement
The static-HTML and text-only layers are first-class — not "fallbacks"
or broken versions of higher tiers. The base bundle is R3F-free and the
immersive layer is loaded lazily only when selected. CI enforces this.

### AI-ready, but provider-neutral
AWAF normalizes context, consent, and memory permissions for AI
consumers — and *stops there*. It does not bundle OpenAI, Anthropic, or
Vercel AI SDK as a runtime dependency. Provider integrations are
optional, user-supplied adapters.

---

## What "1.0" means

1.0 will mean: the README's "Implemented features" section matches the
codebase, the roadmap's Phase 5 exit criteria are met, and a fresh
developer can install AWAF, run an adaptive page, and ship to
production in under an hour, with **no** invasive tracking and **no**
overclaiming.

Everything in this document is intended to make that day arrive
faster, and arrive honestly.
