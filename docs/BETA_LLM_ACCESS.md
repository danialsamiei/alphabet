# Alphabet Beta LLM Access

Status: **implementation candidate, not production evidence**

Alphabet's public beta defines three explicit access modes:

| Mode | Beta status | Credential owner | Default endpoint |
|---|---|---|---|
| `free` | Enabled when the managed gateway is healthy | Alefba service account | `https://alef.ba/api/alphabet/chat` |
| `byok` | Enabled | Integrating application | User-supplied OpenAI-compatible endpoint |
| `premium` | Disabled | Alefba | None during beta |

## Default free access

`new AlphabetLlmClient()` calls the managed Alefba gateway without requiring a
user key. The gateway is expected to use a dedicated FreeGPT service account
with a hard budget, bounded model lane, request limits, and no raw-content
logging.

Free access is a product allocation, not a claim that upstream inference has
zero cost. The gateway may return `429` when a visitor quota is exhausted and
`503` when the sponsored allocation is unavailable.

## BYOK

BYOK requires `providerBaseUrl`, `apiKey`, and `model`. The SDK keeps the key in
a JavaScript private field, omits it from receipts, and never includes provider
response bodies in error messages.

For browser applications, prefer configuring BYOK in the application's own
server route. A browser-held key remains visible to the browser user and
extensions even when Alphabet does not persist it.

```ts
import { AlphabetLlmClient } from '@alphabet/api';

const llm = new AlphabetLlmClient({
  mode: 'byok',
  providerBaseUrl: process.env.PROVIDER_BASE_URL,
  apiKey: process.env.PROVIDER_API_KEY,
  model: process.env.PROVIDER_MODEL,
});
```

## Premium

`mode: 'premium'` fails closed with `PREMIUM_DISABLED`. No checkout, billing, or
purchase flow is part of the beta. Alefba may sponsor selected public
demonstrations server-side, but that does not create a premium entitlement for
SDK users.

## Security boundaries

- Provider credentials are server secrets or application-owned BYOK values.
- The public gateway does not accept a provider selector from the browser.
- Raw provider errors and response bodies are not returned to public clients.
- Request content is bounded before forwarding.
- Gateway responses are `no-store`.
- The beta process-local rate limiter is not sufficient for horizontal
  production deployment; a shared limiter and global spend circuit breaker are
  release gates.
- A previously exposed xAI credential must not be reused. Activation requires
  an independently rotated secret.

## Availability contract

The SDK feature can be present while the managed allocation is unavailable.
Applications must handle `RATE_LIMITED` and `GATEWAY_UNAVAILABLE` and preserve
a deterministic non-LLM fallback.
