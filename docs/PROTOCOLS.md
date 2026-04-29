# Alphabet Protocols

`@alphabet/protocols` is the protocol-adapter layer of the Alphabet SDK. It
normalizes **context**, **consent**, **memory permissions**, and **UI
adaptation signals** across multiple transports (Direct REST API, Model
Context Protocol, Agent-to-Agent, QR Handoff) without committing the
SDK to any specific LLM provider.

## Design principles

- **Alphabet is not an LLM provider SDK.** Adapters never embed OpenAI,
  Anthropic, Vercel AI SDK, etc. as runtime dependencies. Provider
  integrations are exposed as the optional `AlphabetAiProviderAdapter`
  contract, which consumers implement themselves.
- **Single contract, many transports.** Every adapter converts its
  native input into an `AlphabetProtocolRequest` and returns an
  `AlphabetProtocolResponse`. The rest of the SDK works exclusively with the
  normalized shape.
- **Consent is enforced in code.** `validateConsentScope` and
  `evaluateMemoryPermission` are the canonical implementations of the
  Alphabet consent ladder; adapters must use them.
- **Tree-shakable subpaths.** Each adapter is exported under its own
  subpath so consumers pay only for what they use.
- **Security-first QR handoff.** Payloads are AES-GCM-encrypted, bound
  to an audience, expire by default in 60 seconds, and are scrubbed for
  PII before encoding.

## Package layout

```
packages/protocols/src/
├── direct-api/        # REST-like → AlphabetProtocolRequest
├── mcp/               # MCP tool manifests + handlers
├── a2a/               # A2A task/artifact normalization
├── qr-handoff/        # WebCrypto encrypted handoff payloads
├── normalizers/       # Consent scope + memory permission helpers
├── errors/            # Typed AlphabetProtocolError
├── ai-sdk/            # Optional AI provider adapter contract
└── contract.ts        # Normalized request/response/context types
```

## The normalized contract

```ts
import type {
  AlphabetProtocolRequest,
  AlphabetProtocolResponse,
  AlphabetToolContext,
  AlphabetConsentScope,
  AlphabetMemoryPermission,
  AlphabetProtocolError,
} from '@alphabet/protocols';
```

| Type | Purpose |
|------|---------|
| `AlphabetProtocolRequest<T>` | Container every adapter produces. Carries protocol, operation, context, consent, payload, and correlation id. |
| `AlphabetProtocolResponse<T>` | Container every handler returns. Wraps `Result<T, AlphabetProtocolError>`. |
| `AlphabetToolContext` | PII-free subset of visitor/session state safe to expose to tools. |
| `AlphabetConsentScope` | Operations + memory domains the caller wants. Validated against the authoritative tier. |
| `AlphabetMemoryPermission` | Read/write decision for a single memory domain. |
| `AlphabetProtocolError` | Typed error with codes such as `CONSENT_INSUFFICIENT`, `PII_DETECTED`, `AUDIENCE_MISMATCH`. |

All errors flow through the `Result<T, E>` pattern from `@alphabet/core`.

## Direct API adapter

Convert a parsed REST body into a normalized request. The adapter is
framework-agnostic — wire it into Express, Fastify, Hono, etc.

```ts
import { DirectApiAdapter, makeConsentScope } from '@alphabet/protocols';

const adapter = new DirectApiAdapter();

const result = adapter.normalizeRequest(
  {
    operation: 'context.handshake',
    context: {
      visitorId: 'v-abc12345',
      sessionId: 'sess-1',
      consentTier: 'ANONYMOUS',
      privacyRestricted: false,
      country: 'US',
    },
    consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
    payload: {},
  },
  // Authoritative state taken from the server-side consent manager.
  { tier: 'ANONYMOUS', privacy: { dntEnabled: false, gpcEnabled: false } },
);

if (result.success) {
  // result.data is an AlphabetProtocolRequest. Hand off to your dispatcher.
}
```

## MCP adapter

Provides serializable tool manifests for four Alphabet tools:
`context_handshake`, `memory_query`, `consent_status`, and
`adaptive_layer_explain`. The adapter does not pull in
`@modelcontextprotocol/sdk`; serve the manifests over any transport you
already operate.

```ts
import { McpAdapter, ALPHABET_MCP_TOOL_MANIFESTS } from '@alphabet/protocols/mcp';

// Expose tools/list:
const tools = Object.values(ALPHABET_MCP_TOOL_MANIFESTS);

// Dispatch a tools/call:
const adapter = new McpAdapter({
  // Optional plug-in memory backend, called only after permission checks.
  memoryBackend: async ({ domain, query, limit }) => {
    return queryMemoryDomain(domain, query, limit);
  },
});

const response = await adapter.invoke(
  'memory_query',
  { domain: 'general', query: 'webgl support', limit: 5 },
  request, // AlphabetProtocolRequest produced by your transport layer
  { dntEnabled: false, gpcEnabled: false },
);
```

## A2A adapter

Normalizes A2A task/artifact messages into Alphabet protocol requests.
Serve `Alphabet_A2A_AGENT_CARD` from `/.well-known/agent.json`.

```ts
import { A2AAdapter, Alphabet_A2A_AGENT_CARD } from '@alphabet/protocols/a2a';

app.get('/.well-known/agent.json', (_req, res) => res.json(Alphabet_A2A_AGENT_CARD));

const adapter = new A2AAdapter();

const result = adapter.normalizeTask(incomingTask, {
  tier: 'ANONYMOUS',
  privacy: { dntEnabled: false, gpcEnabled: false },
});

if (result.success) {
  // result.data is an AlphabetProtocolRequest with operation === 'context.handshake'
  // (or whichever skill you registered in skillMap).
}
```

## QR handoff

Encrypts a short-lived handoff token using AES-GCM via WebCrypto. The
audience is bound as additional authenticated data, so swapping the
audience invalidates decryption. Tokens default to a 60-second lifetime
and are PII-scrubbed before encoding.

```ts
import { QrHandoffAdapter, makeConsentScope } from '@alphabet/protocols/qr-handoff';

const adapter = new QrHandoffAdapter();
const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit

const enc = await adapter.encode(
  {
    sessionId: 'sess-7f3e1c2a',
    visitorId: 'v-abc12345',
    audience: 'alphabet:demo',
    consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
  },
  key,
  { ttlMs: 30_000 },
);

if (!enc.success) {
  // PII_DETECTED, CRYPTO_UNAVAILABLE, …
  return;
}

// Render enc.data into a QR code with any QR library.

// On the receiving device:
const dec = await adapter.decode(enc.data, key, {
  expectedAudience: 'alphabet:demo',
});
if (dec.success) {
  // dec.data is the original payload. Replay protection: store dec.data.nonce
  // server-side and reject duplicates.
}
```

Failure codes you should branch on:

| Code | Meaning |
|------|---------|
| `PAYLOAD_TAMPERED` | AES-GCM auth tag failed — payload modified or wrong key. |
| `PAYLOAD_EXPIRED`  | `expiresAt` is in the past. |
| `AUDIENCE_MISMATCH`| Caller's expected audience differs from envelope. |
| `PII_DETECTED`     | A field on the payload looks like PII (email, phone, IP, …). |
| `CRYPTO_UNAVAILABLE` | The runtime does not expose `crypto.subtle`. |

## Optional AI SDK adapter

For consumers who want to plug in Vercel AI SDK or another provider:

```ts
import type { AlphabetAiProviderAdapter } from '@alphabet/protocols/ai-sdk';

export const myProvider: AlphabetAiProviderAdapter = {
  id: 'vercel-ai',
  async generate({ context, prompt, system, maxTokens }) {
    if (context.privacyRestricted) {
      // Disable behavioural personalization here.
    }
    // Call your provider of choice and translate the response.
    // Return ok({ text, tokensUsed }) or err(protocolError(...)).
  },
};
```

The package never imports Vercel AI SDK or any other provider. Add it
to your application's own `package.json` (or as a peer dependency) if
you need it.

## Testing

Every adapter ships with vitest tests. None of them performs real
network I/O. Run them with:

```sh
pnpm --filter @alphabet/protocols test
```

Coverage focus:

- **Direct API:** consent override, PII rejection, malformed body.
- **MCP:** dispatch, tool-not-found, memory permission gating.
- **A2A:** skill mapping, missing metadata, custom `skillMap`.
- **QR handoff:** round trip, tampering, expiry, wrong audience, wrong
  key, PII rejection.

## Security checklist

When writing new adapters, double-check that you:

- [ ] Use `validateConsentScope` against the authoritative tier — never
      trust `request.consent.tier` for security decisions.
- [ ] Run `ensureNoPIIInContext` before exposing context to a third
      party (MCP / A2A).
- [ ] Return `Result<…, AlphabetProtocolError>` instead of throwing.
- [ ] Avoid logging anything from `payload` or memory entries by
      default.
- [ ] For new payloads sent over the wire: bind the audience as AAD,
      include a nonce, set an explicit expiry, and refuse to encode if
      `looksLikePII` returns true on any string field.
