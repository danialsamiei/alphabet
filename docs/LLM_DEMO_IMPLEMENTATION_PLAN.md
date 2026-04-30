# Alphabet LLM Demo Implementation Plan

This document maps practical ways to showcase Alphabet with a real LLM backend while keeping the framework privacy-first.

## 1) Recommended demo topology

1. Browser app runs Alphabet handshake/consent/memory logic locally.
2. Browser calls a same-origin relay (`/api/llm/chat`) with sanitized context only.
3. Relay injects provider API key from server env and forwards to one LLM provider.
4. Relay enforces provider/model allow-list and request-size limits.

## 2) Provider paths

- GitHub Models API: fastest path for teams already using GitHub.
- OpenAI API (or OpenAI sandbox key): canonical baseline for production.
- OpenRouter API: quick multi-model fallback experiments.

## 3) Security checklist before public demo

- Never expose any provider key in browser JS bundles.
- Keep model allow-lists narrow and explicit.
- Log request metadata only (provider/model/latency/status), not raw prompts.
- Respect consent tier: no Tier-2/3 memory in prompts when tier < `CONSENTED`.
- Apply prompt-risk detection before relay dispatch.

## 4) Suggested productized milestones

- Milestone A: relay + one provider + deterministic smoke prompt.
- Milestone B: provider failover chain (`@alphabet/protocols/v2/providers/createFallbackChain`).
- Milestone C: consent-proof verification in relay (`verifyConsentProof`).
- Milestone D: observability dashboard (latency/cost/error per provider and model).

## 5) Immediate implementation in this repository

- `apps/danial-demo/server.mjs` now provides a local relay with 3 providers.
- `apps/danial-demo/package.json` includes `dev:relay` script.
- `apps/danial-demo/README.md` documents commands and request format.

