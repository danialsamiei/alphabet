# AlphabetProtocol v2 × Vercel AI SDK

This snippet pack shows how to plug **AlphabetProtocol v2** into a Next.js App
Router project that uses the [Vercel AI SDK](https://sdk.vercel.ai). It is
not a stand-alone, runnable app — it lives inside the Alphabet monorepo as a
*documented reference* you copy into your own project.

## Why integrate?

The Vercel AI SDK gives you React hooks (`useChat`, `useCompletion`) and
edge-friendly streaming helpers. AlphabetProtocol v2 gives you:

1. A **provider-agnostic streaming contract** with built-in adapters for
   OpenAI, Anthropic, xAI Grok, Google Gemini, Mistral, and Fireworks AI,
   plus a `createFallbackChain` composer.
2. **Privacy-preserving prompt engineering** — every request is run
   through an automatic PII redactor and a consent-aware system prelude
   *before* it reaches the provider.
3. **Memory-efficient context compression** driven by a per-request token
   budget.
4. **Cryptographic Consent Proof** — clients send a short ECDSA P-256
   token that the route handler verifies before dispatching the model
   call, so you can prove the visitor consented before any inference.
5. **Cross-Reality Orchestrator** (`@alphabet/protocols/v2/xr`) — chooses
   the right response shape for the visitor's device (text → static-html
   → CSS-3D → R3F → WebXR → Spatial Web Layer 0) and revokes spatial
   anchors automatically when DNT/GPC is asserted.

These innovations live in `@alphabet/protocols/v2`. The Vercel AI SDK side of
the integration only needs the `AlphabetAiClient.stream()` async iterable
and a tiny `text/event-stream` bridge.

## File layout

```
examples/vercel-ai-sdk-protocol-v2/
├── README.md                            ← you are here
├── package.json
├── lib/
│   ├── to-ai-sdk.ts                     ← AsyncIterable<chunk> → ReadableStream
│   └── xr-bridge.ts                     ← CrossRealityOrchestrator → renderer hint
└── app/
    ├── api/alphabet-chat/route.ts       ← Edge route: AlphabetAiClient → SSE
    ├── chat/page.tsx                    ← Client: useChat + transparency UI
    └── layout.tsx                       ← Root layout
```

## Setup (in your own Next.js project)

```bash
pnpm add @alphabet/protocols @alphabet/core ai @ai-sdk/react react react-dom next
```

Then copy the files from this directory into the matching paths under
your project's `app/` directory.

Set the provider keys you want to use as environment variables. The
example wires up a fallback chain `OpenAI → Anthropic → Gemini`; change
the chain to suit your deployment.

| Env var | Purpose |
|:--|:--|
| `OPENAI_API_KEY` | Primary provider |
| `ANTHROPIC_API_KEY` | First fallback |
| `GEMINI_API_KEY` | Second fallback |
| `MISTRAL_API_KEY` | Optional — append to the chain |
| `ALPHABET_CONSENT_PROOF_PUBLIC_KEY_JWK` | ECDSA P-256 public key (JWK JSON) used to verify the `x-alphabet-consent-proof` header |

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
ALPHABET_CONSENT_PROOF_PUBLIC_KEY_JWK='{"kty":"EC","crv":"P-256",...}'
```

## How it works

### 1. The Edge route — `app/api/alphabet-chat/route.ts`

The route handler builds a fallback chain, wraps it in an `AlphabetAiClient`,
and pipes the resulting `AsyncIterable<AlphabetStreamChunk>` to a
`text/event-stream` `Response` that the Vercel AI SDK consumes natively.

The bridging is intentionally tiny — the Vercel AI SDK happily reads any
SSE stream; we just emit one `data:` line per chunk with a final
`data: [DONE]` marker for compatibility. For projects that prefer the
Vercel AI Stream protocol (`0:"<text>"\n` / `d:{...}\n`), import
`toAiSdkResponse(stream, { mode: 'text-only' })` from `lib/to-ai-sdk.ts`
instead of writing your own SSE encoder.

### 2. Privacy + consent proof

Before the route calls `client.stream`, it imports the request's
`x-alphabet-consent-proof` header (a compact `payload.signature` token) and
hands it to `AlphabetAiClient` as `callOptions.consentProof`. The client's
`stream()` first verifies the token's audience, expiry, and signature
using the public key loaded from `ALPHABET_CONSENT_PROOF_PUBLIC_KEY_JWK`. If
verification fails, a single `error` chunk is emitted and no provider
call is made.

PII redaction and the consent-aware system prelude are applied by
`prepareRequest` *inside* the client — you do not need to do anything
extra. Set `disablePiiRedaction: true` on the client if your upstream
already sanitizes inputs.

### 3. Cross-Reality bridge — `lib/xr-bridge.ts`

When the client passes an XR capability snapshot via the
`x-alphabet-xr-snapshot` header (base64url-encoded JSON), the route asks
`CrossRealityOrchestrator.decide()` for an `XRRealityDecision` *before*
streaming any tokens. The decision tells the route:

  * **`recommendedRenderer`** — `text` / `static-html` / `css-3d` / `r3f` /
    `webxr` / `spatial`. Clients render the matching component and skip
    expensive payloads (e.g. embedded WebGL scenes) when the device or
    consent posture wouldn't support them.
  * **`downgraded`** — `true` when DNT/GPC, jurisdiction risk, reduced
    motion, or insufficient consent forced a leaner shape. Surface this
    in the transparency panel so the visitor understands why the UI
    looks lean.

The orchestrator never reaches the network. Spatial anchors persist
*only* when the visitor has tier `ENRICHED` **and** the route has
verified an ECDSA consent proof; if either drops, the orchestrator
emits `reality:anchor-revoked` and downstream UI flushes overlays.

### 4. The client — `app/chat/page.tsx`

The page uses `useChat({ api: '/api/alphabet-chat' })`. Two Alphabet-specific
extras:

- It sends the consent proof as a request header on every fetch.
- It surfaces redaction diagnostics returned by the route in a "What was
  redacted?" disclosure panel — required by Alphabet's transparency model.

## Privacy guarantees

| Guarantee | Mechanism |
|:--|:--|
| No PII in logs | `prepareRequest` runs `redactPromptPII` before any provider call |
| No PII over the wire to providers | Same — redaction happens client-side of the LLM call |
| Consent verified before inference | ECDSA P-256 proof verified inside `AlphabetAiClient.stream` |
| No spatial telemetry leaves the device by default | XR orchestrator posture defaults to `on-device-only` for tier ≤ `ANONYMOUS` and any DNT/GPC / restricted-jurisdiction request |
| Anchor revocation is observable | `CrossRealityOrchestrator.on('reality:anchor-revoked', …)` fires on consent downgrade or mode exit |
| No third-party network calls during build | The XR orchestrator and Spatial Layer 0 default adapter are pure in-memory + zero deps |

## Running the snippet pack

`package.json` declares `"private": true` and a no-op `typecheck`
script — the snippets type-check against `@alphabet/protocols/v2` because
that package is part of the workspace, but `next` is not installed in
the monorepo. To actually run, copy the files into your own Next.js
project as described above.
