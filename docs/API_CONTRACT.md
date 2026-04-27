# API contract

This document describes the **stable shapes** that AWAF guarantees
across versions and the **route table** that the HTTP surface exposes.
The full OpenAPI 3.1 description lives at
[`openapi/awaf.v1.yaml`](../openapi/awaf.v1.yaml); this file is the
narrative companion.

---

## Versioning

- **Canonical version prefix:** `/api/awaf/v1`. Single source of truth
  is `packages/core/src/contracts/routes.ts` (the `AWAF_ROUTES`
  constant), re-exported from `@awaf/api` for clients.
- **Legacy `/api` mount** is still accepted by `@awaf/api` clients via
  `normalizeApiBaseUrl()`, but is deprecated.
- **`Result<T, E>` and `AWAFRequest` / `AWAFResponse` envelopes** are
  v0/v1-frozen. Breaking changes will require a major version bump.

```ts
type Result<T, E = AWAFError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

interface AWAFRequest<T> {
  meta: RequestMeta;     // requestId, locale, traceId, …
  data: T;
}

interface AWAFResponse<T> {
  meta: ResponseMeta;    // requestId, latencyMs, deprecation hints, …
  data: T;
}
```

Every method on `AwafClient` returns `Promise<Result<T, AWAFError>>`.
This is the AWAF answer to "where is the try/catch?": exceptions are
reserved for genuinely unrecoverable conditions (corrupted state,
infrastructure failure); business errors are values.

---

## Route table

| # | Group | Endpoint | Method | Path |
|---|-------|----------|:------:|------|
| 1 | Context Handshake | Handshake     | `POST`   | `/api/awaf/v1/context/handshake`            |
| 2 | Context Handshake | Consent       | `POST`   | `/api/awaf/v1/context/consent`              |
| 3 | Context Handshake | Preference    | `POST`   | `/api/awaf/v1/context/preference`           |
| 4 | Visitor Interaction | Interact    | `POST`   | `/api/awaf/v1/interact`                     |
| 5 | Visitor Interaction | Voice       | `POST`   | `/api/awaf/v1/voice/transcribe`             |
| 6 | Visitor Interaction | Suggestions | `GET`    | `/api/awaf/v1/suggestions`                  |
| 7 | AWAF Pulse | Pulse list             | `GET`    | `/api/awaf/v1/technology-pulse`             |
| 8 | AWAF Pulse | Pulse brief            | `POST`   | `/api/awaf/v1/technology-pulse/brief`       |
| 9 | Consent-Aware Memory | Store        | `POST`   | `/api/awaf/v1/visitor/memory`               |
| 10 | Consent-Aware Memory | Retrieve    | `GET`    | `/api/awaf/v1/visitor/memory`               |
| 11 | Consent-Aware Memory | Erase       | `DELETE` | `/api/awaf/v1/visitor/memory`               |
| 12 | OpenClaw Mesh | Query              | `POST`   | `/api/awaf/v1/claw/query`                   |
| 13 | OpenClaw Mesh | Ingest             | `POST`   | `/api/awaf/v1/claw/ingest`                  |
| 14 | OpenClaw Mesh | Admin audit        | `POST`   | `/api/awaf/v1/claw/admin/audit`             |
| 15 | Admin | Visitor insights           | `GET`    | `/api/awaf/v1/admin/visitor-insights`       |
| 16 | Admin | Pulse sources              | `GET`    | `/api/awaf/v1/admin/technology-pulse/sources` |

> Endpoints not yet wired end-to-end are tagged `x-awaf-status: planned`
> in the OpenAPI document. The HTTP wrappers exist on `AwafClient`, but
> there is no in-repo mock server yet — see
> [`docs/IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

---

## Common envelope

Every documented endpoint accepts and returns JSON with the AWAF
envelope:

```jsonc
// Request
{
  "meta": {
    "requestId": "req-…",
    "locale": "en-US",
    "traceId": "abc-…"
  },
  "data": { /* endpoint-specific payload */ }
}
```

```jsonc
// Response (success)
{
  "meta": {
    "requestId": "req-…",
    "latencyMs": 23
  },
  "data": { /* endpoint-specific result */ }
}
```

```jsonc
// Response (error)
{
  "meta": { "requestId": "req-…" },
  "error": {
    "code": "CONSENT_REQUIRED",
    "message": "Endpoint requires CONSENTED tier or higher.",
    "details": { "currentTier": "ANONYMOUS" }
  }
}
```

---

## Error codes (selection)

| Code                          | HTTP | When |
|-------------------------------|------|------|
| `INVALID_REQUEST`             | 400  | Schema mismatch, missing required fields. |
| `CONSENT_REQUIRED`            | 403  | Operation needs a higher consent tier. |
| `PRIVACY_SIGNAL_DOWNGRADE`    | 403  | DNT/GPC active; operation forbidden at runtime. |
| `MEMORY_DOMAIN_FORBIDDEN`     | 403  | Cross-domain read denied by ACL, or admin-only write. |
| `RATE_LIMITED`                | 429  | Per-visitor or per-session quota exceeded. |
| `OUTPUT_REJECTED`             | 422  | Model output failed `sanitizeHtml` or `validateUrl`. |
| `PROMPT_RISK_BLOCKED`         | 422  | `detectPromptRisk` returned `block`. |
| `INTERNAL_ERROR`              | 500  | Unexpected failure; details redacted. |

---

## Client usage

```ts
import { AwafClient } from '@awaf/api';

const client = new AwafClient({
  apiBaseUrl: 'https://example.com', // or 'https://example.com/api/awaf/v1'
  timeoutMs: 5_000,
});

const result = await client.postHandshake({ /* … */ });
if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  console.log(result.value.uiConfig.layer);
}
```

`apiBaseUrl` accepts:

- a bare origin: `https://example.com`
- the canonical prefix: `https://example.com/api/awaf/v1`
- the legacy mount: `https://example.com/api`

`normalizeApiBaseUrl()` ensures every method appends the right path.

---

## Cross-references

- OpenAPI: [`openapi/awaf.v1.yaml`](../openapi/awaf.v1.yaml).
- Routes: `packages/core/src/contracts/routes.ts` and
  `packages/api/src/index.ts` (re-export).
- Detailed endpoint reference (Persian + English):
  [`docs/API_REFERENCE.md`](./API_REFERENCE.md).
- Protocols (MCP / A2A / QR): [`docs/PROTOCOLS.md`](./PROTOCOLS.md).
