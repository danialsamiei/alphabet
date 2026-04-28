# Danial Samiei — Personal Site (`@awaf/danial-site`)

An interactive personal & professional page for **Danial Samiei**, researcher and assistant professor. Built on the [AWAF](../../README.md) SDK and powered by the [GitHub Models](https://docs.github.com/en/github-models) LLM API.

This app is a **demo**. The bio, publications, courses, and contact data in `src/data/profile.ts` are placeholder content — edit that single file to update the page.

## What's interactive?

- **Adaptive hero** — wrapped in `AwafProvider` + `AdaptiveSlot` so the same page degrades cleanly across AWAF's five render layers (R3F → CSS3D → Canvas2D → static HTML → text-only).
- **Grounded AI assistant** — a chat panel (`AssistantChat.tsx`) that talks to a GitHub Models chat-completion endpoint. The system prompt is built from the public profile (`buildSystemPrompt`) so the model is told **only** about Danial's published bio and is instructed to refuse fabrication.
- **Fully accessible** — skip link, ARIA-live chat log, prefers-reduced-motion, prefers-color-scheme, RTL support.

## Architecture (one diagram)

```
┌─────────────┐  POST /api/assistant   ┌─────────────────┐  POST   ┌────────────────┐
│  Browser    │ ─────────────────────▶ │  Node proxy     │ ──────▶ │ GitHub Models  │
│  (React)    │ ◀───────────────────── │  server.mjs     │ ◀────── │ inference API  │
└─────────────┘   JSON chat reply       │  + GITHUB_TOKEN │         └────────────────┘
                                        └─────────────────┘
```

The browser **never** sees the GitHub token — the Node proxy holds it and only allows an explicit allow-list of models (`ALLOWED_MODELS`).

## Setup

```bash
# from the repo root
pnpm install
```

Get a GitHub token with the `models:read` scope from <https://github.com/settings/tokens> (any free GitHub account can use GitHub Models for testing within the free tier).

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

## Run it

Open two terminals:

```bash
# Terminal 1 — the chat proxy (holds GITHUB_TOKEN)
GITHUB_TOKEN=$GITHUB_TOKEN pnpm --filter @awaf/danial-site dev:proxy

# Terminal 2 — the Vite dev server
pnpm --filter @awaf/danial-site dev
```

Open <http://localhost:5174>.

Vite forwards `/api/assistant` to the proxy on `:8787` (see `vite.config.ts`).

### Quick sanity check (without the UI)

```bash
curl -s http://localhost:8787/health
# -> {"ok":true,"hasToken":true}

curl -s http://localhost:8787/api/assistant \
  -H 'content-type: application/json' \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Say hi in 5 words."}]}'
```

## Test

```bash
pnpm --filter @awaf/danial-site test
```

The test suite mocks `fetch` and verifies the GitHub Models request envelope and response parsing — no token is required to run tests.

## Build

```bash
pnpm --filter @awaf/danial-site build
```

## Customize the profile

Edit `src/data/profile.ts`. Every component (Hero / About / Research / Publications / Teaching / Contact) and the assistant's grounding prompt are derived from that single object — change a field there and it propagates everywhere.

## Files of note

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Page shell, wraps everything in `AwafProvider` + `AdaptiveSlot` |
| `src/data/profile.ts` | Single source of truth for bio content (edit this) |
| `src/components/AssistantChat.tsx` | Chat UI, talks to `/api/assistant` |
| `src/lib/github-models.ts` | Tiny chat-completion client (browser + server) |
| `src/lib/build-system-prompt.ts` | Builds the grounded system prompt |
| `server.mjs` | Zero-dependency Node proxy that injects `GITHUB_TOKEN` |
