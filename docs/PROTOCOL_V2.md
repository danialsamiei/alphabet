# AlphabetProtocol v2

> Alphabet's provider-agnostic, privacy-preserving AI orchestration layer.
> Lives in [`@alphabet/protocols`](../packages/protocols) under the additive
> `./v2` subpath — v1 (`direct-api`, `mcp`, `a2a`, `qr-handoff`) is unchanged.

This page is the index for everything in `packages/protocols/src/v2/`. Each
section names the source files, explains the privacy contract, and links to
the deeper references (Memory Mesh, Consent Ladder) in
[`AGENTS.md`](../AGENTS.md).

---

## Four core innovations

| # | Innovation | Subpath | Source |
|---|---|---|---|
| 1 | Streaming + tool calling + structured output | `@alphabet/protocols/v2` | `src/v2/types.ts`, `src/v2/sdk/index.ts` |
| 2 | On-device context compression | `@alphabet/protocols/v2/compression` | `src/v2/compression/index.ts` |
| 3 | Memory-efficient PII redaction | `@alphabet/protocols/v2/privacy` | `src/v2/privacy/index.ts` |
| 4 | Cryptographic Consent Proofs (ECDSA P-256) | `@alphabet/protocols/v2/consent-proof` | `src/v2/consent-proof/index.ts` |

All four are wired together inside `AlphabetAiClient.prepareRequest()` so a
single `client.stream(request)` call already runs:

1. Consent proof verification (when supplied).
2. PII redaction.
3. Consent-aware system-prelude injection.
4. Token-budget-driven compression.
5. Provider streaming via the chosen adapter (or a fallback chain).

The `AGENTS.md` Memory Mesh and Consent Ladder define the consent tiers
(`NO_MEMORY` / `ANONYMOUS` / `CONSENTED` / `ENRICHED`) and the storage
domains; AlphabetProtocol v2 is the runtime that enforces them on every LLM
call.

---

## Six built-in providers + fallback chain

Each provider lives in `src/v2/providers/`:

| Provider | Source |
|---|---|
| OpenAI | `providers/openai.ts` |
| Anthropic | `providers/anthropic.ts` |
| xAI Grok | `providers/grok.ts` |
| Google Gemini | `providers/gemini.ts` |
| Mistral | `providers/mistral.ts` |
| Fireworks AI | `providers/fireworks.ts` |
| Any OpenAI-compatible endpoint | `providers/openai-compat.ts` |

`createFallbackChain({ providers, modelByProvider })` from
`providers/fallback-chain.ts` composes them into a single
`AlphabetProvider`. Failures are caught per-provider and the chain advances
to the next one without leaking errors to the caller until every provider
has been tried.

---

## Pulse v2 — proactive layer forecasting

`src/v2/pulse/index.ts` exports `ProactiveLayerForecaster`. It wraps
`CapabilityPredictor` from `@alphabet/core` and emits actionable
`LayerForecastHint` values:

| Hint | When |
|---|---|
| `preemptive-downgrade` | Network drop or low battery suggests stepping down a layer |
| `pause-animation` | Tab hidden or `prefers-reduced-motion` |
| `ethical-downgrade` | **Consent revoked / jurisdiction-restriction / content-sensitivity** |
| `no-change` | Confidence too low to recommend a change |

### Ethics-aware downgrades

Capability hints alone never override a consent revocation or a
jurisdiction risk. `forecaster.observeEthics({ consentTierChange,
jurisdictionRisk, contentFlag })` records non-capability signals and the
next `forecast()` emits the matching `ethical-downgrade` *before* any
capability hint:

```ts
forecaster.observeEthics({ consentTierChange: 'revoked' });
const hints = forecaster.forecast();
// → [{ kind: 'ethical-downgrade', from: 'R3F_IMMERSIVE', to: 'STATIC_HTML',
//      reason: 'consent-revoked', urgency: 'high' }, …]
```

Three reasons:
* `consent-revoked` — visitor downgraded back to `NO_MEMORY`.
* `jurisdiction-restriction` — `VisitorConsentManager` flagged a per-region
  rule (e.g. XR/biometric ban).
* `content-sensitivity` — content moderation flagged the current page or
  response stream.

---

## Cross-Reality Orchestrator (`@alphabet/protocols/v2/xr`)

The XR module layers WebXR (VR/AR) and **Spatial Web Layer 0** on top of
the existing capability ladder. Files in `src/v2/xr/`:

| File | Purpose |
|---|---|
| `types.ts` | `XRRealityMode`, `XRCapabilitySnapshot`, `XRSpatialAnchor`, `XRRealityDecision`, `XRRealityHint`, `XROrchestratorEventMap` |
| `capability-probe.ts` | `probeXrCapabilities()` — pure feature detection, never throws, returns `Result<XRCapabilitySnapshot>` |
| `spatial-layer0.ts` | `SpatialLayer0Adapter` interface + `createInMemorySpatialLayer0Adapter()` default |
| `orchestrator.ts` | `CrossRealityOrchestrator` — composes `ProactiveLayerForecaster`, decides modes, manages anchors, emits events |

### Reality modes (richest → leanest)

```
spatial-layer-0  ─►  webxr-ar  ─►  webxr-vr  ─►  r3f  ─►  css-3d  ─►  flat
```

Every decision also returns a `fallbackLayer` (one of the existing
`CapabilityLayer` values) so the runtime can render the next-best UI when
the chosen mode can't be entered.

### Privacy posture

| Tier | Default posture | What persists |
|---|---|---|
| `NO_MEMORY` / `ANONYMOUS` | `on-device-only` | Nothing |
| `CONSENTED` | `session-ephemeral` | Local + world anchors for the active session |
| `ENRICHED` (with verified consent proof) | `persistent-with-proof` | Cross-session anchors |

Any DNT/GPC signal or `jurisdictionRestrictsXr: true` collapses the
posture back to `on-device-only` regardless of tier — and any world-scoped
anchors are revoked via `reality:anchor-revoked` events so the UI flushes
overlays.

### Event channel

```ts
const xr = new CrossRealityOrchestrator();
xr.on('reality:downgrade', ({ from, to, reasons }) => log(from, to, reasons));
xr.on('reality:anchor-revoked', ({ anchorId, cause }) => flushOverlay(anchorId));
xr.on('reality:consent-required', ({ forMode, minimumTier }) => promptConsent(forMode, minimumTier));
```

The orchestrator never inspects globals on its own; callers feed it
`XRCapabilitySnapshot` values from `probeXrCapabilities()` (browser) or
their own probe (server-rendered routes / edge runtimes).

---

## Vercel AI SDK example

`examples/vercel-ai-sdk-protocol-v2/` ships a Next.js App Router reference
integration:

| File | Purpose |
|---|---|
| `app/api/alphabet-chat/route.ts` | Edge route: AlphabetAiClient + fallback chain → SSE; calls `decideXrPayload` and exposes `x-alphabet-renderer` / `x-alphabet-xr-mode` / `x-alphabet-xr-posture` headers |
| `lib/to-ai-sdk.ts` | Bridges `AsyncIterable<AlphabetStreamChunk>` → SSE or Vercel AI Stream protocol — no runtime dependency on `ai` |
| `lib/xr-bridge.ts` | Reads `x-alphabet-xr-snapshot` / `x-alphabet-consent-tier` / DNT / GPC and asks `CrossRealityOrchestrator.decide()` for the renderer hint |
| `app/chat/page.tsx` | Client using `useChat`, surfacing redaction diagnostics + transparency panel |

The example documents env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, `ALPHABET_CONSENT_PROOF_PUBLIC_KEY_JWK`), the consent-proof
header contract, and the privacy guarantees in its README.

---

## Privacy guarantees, end to end

| Guarantee | Where it's enforced |
|---|---|
| No PII in logs | `redactPromptPII` in `prepareRequest`; SDK never logs raw payloads |
| No PII over the wire to providers | Same redactor runs *before* the provider call |
| Consent verified before inference | `verifyConsentProof` inside `AlphabetAiClient.stream` |
| No spatial telemetry leaves the device by default | `XRPrivacyPosture` defaults; `on-device-only` for tier ≤ `ANONYMOUS` |
| Anchor revocation is observable | `reality:anchor-revoked` event fires on consent downgrade or mode exit |
| Capability hints never override ethics | Pulse v2 emits `ethical-downgrade` before any capability hint |
| No third-party network calls during build | XR orchestrator + Spatial Layer 0 default adapter are pure in-memory |

For the storage-tier rules, see the **Memory Mesh** + **Consent Ladder**
sections of [`AGENTS.md`](../AGENTS.md).

---

## Versioning + scope

* `@alphabet/protocols` v1 surface (`direct-api`, `mcp`, `a2a`,
  `qr-handoff`) is **frozen** in v2 — no breaking changes.
* All v2 work lives under additive subpath exports (`./v2`,
  `./v2/providers`, `./v2/sdk`, `./v2/consent-proof`, `./v2/privacy`,
  `./v2/compression`, `./v2/pulse`, `./v2/xr`).
* The package takes no new runtime dependencies for v2. The Vercel AI SDK
  bridge stays in the example app so consumers who don't use Vercel pay
  no bundle cost.
