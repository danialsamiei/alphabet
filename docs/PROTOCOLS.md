# AWAF Protocols

`@awaf/protocols` is the protocol-adapter layer of the AWAF SDK. It
normalizes **context**, **consent**, **memory permissions**, and **UI
adaptation signals** across multiple transports (Direct REST API, Model
Context Protocol, Agent-to-Agent, QR Handoff) without committing the
SDK to any specific LLM provider.

## Design principles

- **AWAF is not an LLM provider SDK.** Adapters never embed OpenAI,
  Anthropic, Vercel AI SDK, etc. as runtime dependencies. Provider
  integrations are exposed as the optional `AwafAiProviderAdapter`
  contract, which consumers implement themselves.
- **Single contract, many transports.** Every adapter converts its
  native input into an `AwafProtocolRequest` and returns an
  `AwafProtocolResponse`. The rest of the SDK works exclusively with the
  normalized shape.
- **Consent is enforced in code.** `validateConsentScope` and
  `evaluateMemoryPermission` are the canonical implementations of the
  AWAF consent ladder; adapters must use them.
- **Tree-shakable subpaths.** Each adapter is exported under its own
  subpath so consumers pay only for what they use.
- **Security-first QR handoff.** Payloads are AES-GCM-encrypted, bound
  to an audience, expire by default in 60 seconds, and are scrubbed for
  PII before encoding.

## Package layout

```
packages/protocols/src/
├── direct-api/        # REST-like → AwafProtocolRequest
├── mcp/               # MCP tool manifests + handlers
├── a2a/               # A2A task/artifact normalization
├── qr-handoff/        # WebCrypto encrypted handoff payloads
├── normalizers/       # Consent scope + memory permission helpers
├── errors/            # Typed AwafProtocolError
├── ai-sdk/            # Optional AI provider adapter contract
└── contract.ts        # Normalized request/response/context types
```

## The normalized contract

```ts
import type {
  AwafProtocolRequest,
  AwafProtocolResponse,
  AwafToolContext,
  AwafConsentScope,
  AwafMemoryPermission,
  AwafProtocolError,
} from '@awaf/protocols';
```

| Type | Purpose |
|------|---------|
| `AwafProtocolRequest<T>` | Container every adapter produces. Carries protocol, operation, context, consent, payload, and correlation id. |
| `AwafProtocolResponse<T>` | Container every handler returns. Wraps `Result<T, AwafProtocolError>`. |
| `AwafToolContext` | PII-free subset of visitor/session state safe to expose to tools. |
| `AwafConsentScope` | Operations + memory domains the caller wants. Validated against the authoritative tier. |
| `AwafMemoryPermission` | Read/write decision for a single memory domain. |
| `AwafProtocolError` | Typed error with codes such as `CONSENT_INSUFFICIENT`, `PII_DETECTED`, `AUDIENCE_MISMATCH`. |

All errors flow through the `Result<T, E>` pattern from `@awaf/core`.

## Direct API adapter

Convert a parsed REST body into a normalized request. The adapter is
framework-agnostic — wire it into Express, Fastify, Hono, etc.

```ts
import { DirectApiAdapter, makeConsentScope } from '@awaf/protocols';

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
  // result.data is an AwafProtocolRequest. Hand off to your dispatcher.
}
```

## MCP adapter

Provides serializable tool manifests for four AWAF tools:
`context_handshake`, `memory_query`, `consent_status`, and
`adaptive_layer_explain`. The adapter does not pull in
`@modelcontextprotocol/sdk`; serve the manifests over any transport you
already operate.

```ts
import { McpAdapter, AWAF_MCP_TOOL_MANIFESTS } from '@awaf/protocols/mcp';

// Expose tools/list:
const tools = Object.values(AWAF_MCP_TOOL_MANIFESTS);

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
  request, // AwafProtocolRequest produced by your transport layer
  { dntEnabled: false, gpcEnabled: false },
);
```

## A2A adapter

Normalizes A2A task/artifact messages into AWAF protocol requests.
Serve `AWAF_A2A_AGENT_CARD` from `/.well-known/agent.json`.

```ts
import { A2AAdapter, AWAF_A2A_AGENT_CARD } from '@awaf/protocols/a2a';

app.get('/.well-known/agent.json', (_req, res) => res.json(AWAF_A2A_AGENT_CARD));

const adapter = new A2AAdapter();

const result = adapter.normalizeTask(incomingTask, {
  tier: 'ANONYMOUS',
  privacy: { dntEnabled: false, gpcEnabled: false },
});

if (result.success) {
  // result.data is an AwafProtocolRequest with operation === 'context.handshake'
  // (or whichever skill you registered in skillMap).
}
```

## QR handoff

Encrypts a short-lived handoff token using AES-GCM via WebCrypto. The
audience is bound as additional authenticated data, so swapping the
audience invalidates decryption. Tokens default to a 60-second lifetime
and are PII-scrubbed before encoding.

```ts
import { QrHandoffAdapter, makeConsentScope } from '@awaf/protocols/qr-handoff';

const adapter = new QrHandoffAdapter();
const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit

const enc = await adapter.encode(
  {
    sessionId: 'sess-7f3e1c2a',
    visitorId: 'v-abc12345',
    audience: 'awaf:demo',
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
  expectedAudience: 'awaf:demo',
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
import type { AwafAiProviderAdapter } from '@awaf/protocols/ai-sdk';

export const myProvider: AwafAiProviderAdapter = {
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
pnpm --filter @awaf/protocols test
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
- [ ] Return `Result<…, AwafProtocolError>` instead of throwing.
- [ ] Avoid logging anything from `payload` or memory entries by
      default.
- [ ] For new payloads sent over the wire: bind the audience as AAD,
      include a nonce, set an explicit expiry, and refuse to encode if
      `looksLikePII` returns true on any string field.
