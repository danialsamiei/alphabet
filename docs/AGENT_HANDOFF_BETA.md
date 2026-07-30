# Agent Handoff: Alphabet Beta Access and Alefba Lab

This file is the bounded continuation point for human and AI contributors.

## Current claim state

| Item | State |
|---|---|
| Beta LLM client source | Implemented |
| Default FreeGPT gateway contract | Implemented in source |
| BYOK contract | Implemented in source |
| Premium purchase flow | Intentionally absent |
| xAI-sponsored demo | Configuration-gated |
| Test execution | Not performed in this change |
| npm publication | Not performed |
| Live deployment | Not performed |

Do not convert source presence into a claim of live availability.

## Canonical files

- `packages/api/src/llm-client.ts`: access-mode client and secret boundary.
- `packages/api/src/llm-client.test.ts`: contract tests awaiting execution.
- `openapi/alphabet-llm-beta.yaml`: public gateway schema.
- `docs/BETA_LLM_ACCESS.md`: product and security contract.
- `examples/next-app-router-basic/app/api/alphabet-chat/route.ts`: remains an
  independent provider example and is not the managed production gateway.

The deployed integration source belongs in the private `danialsamiei/alef.ba`
repository under `app/alphabet` and `app/api/alphabet/chat`.

## Required next gates

1. Run typecheck, unit tests, package build, and `npm pack` consumption.
2. Perform browser acceptance in Chromium, Firefox, and WebKit.
3. Test RTL, reduced motion, no WebGL, save-data, keyboard, and screen reader.
4. Provision a dedicated FreeGPT key with a hard wallet cap and restricted
   model lane.
5. Replace process-local rate limiting with a shared durable limiter.
6. Add an aggregate daily token and spend circuit breaker.
7. Rotate the historical xAI key and install the replacement only as a server
   secret if a sponsored demonstration is approved.
8. Produce a rollbackable Alefba release and validate the public origin.

## Non-negotiable boundaries

- Never commit or print provider keys.
- Premium remains disabled until billing, consent, refunds, abuse handling, and
  entitlement verification have independent acceptance.
- The gateway never grants agent authority or tool execution.
- Model output is an experience-design candidate, not verified APIR meaning.
- Free access must degrade to an explicit deterministic fallback instead of
  silently changing provider or charging a user.

## High-value backlog

- Add short-lived anonymous gateway grants bound to origin and coarse client
  class.
- Emit an Experience Receipt tied to APIR commitment IDs.
- Add a shared Redis limiter and budget ledger.
- Add streaming with bounded SSE parsing.
- Add a Storybook context matrix and semantic-fallback visualizer.
- Publish a framework-neutral Web Component adapter.
