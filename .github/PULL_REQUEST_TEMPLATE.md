<!--
  Thanks for contributing to Alphabet!
  Please fill in this template — it speeds up review significantly.
-->

## Summary

<!-- One- or two-sentence description of the change. -->

## Type of change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ Feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature causing existing behaviour to change)
- [ ] 📚 Docs / chore / tooling
- [ ] 🔒 Security fix (also opened a private advisory if user-impacting)

## Affected packages

- [ ] `@alphabet/core`
- [ ] `@alphabet/api`
- [ ] `@alphabet/ui`
- [ ] `@alphabet/protocols`
- [ ] `@alphabet/security`
- [ ] `apps/demo` / `apps/danial-site`
- [ ] tooling / CI / docs

## Linked issues

<!-- Closes #123, Refs #456 -->

## Implementation notes

<!--
  - Architecture trade-offs
  - New types / interfaces
  - Performance impact (handshake p95, bundle size)
  - Privacy/consent implications
-->

## Agent checklist (from `AGENTS.md`)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passes (and new behaviour is covered)
- [ ] `pnpm build` succeeds
- [ ] `pnpm size` within budgets (and `pnpm size:check-r3f-free` if `@alphabet/ui` changed)
- [ ] bundle delta checked (compare against base branch / latest main build)
- [ ] `pnpm openapi:lint` clean (if API contract changed)
- [ ] No `any` in production code; no PII in logs
- [ ] Files ≤ 300 lines, no circular deps
- [ ] JSDoc on all new public symbols
- [ ] Consent tier / DNT / GPC behaviour respected
- [ ] Coarse geo only — no city/IP persisted
- [ ] Accessibility: keyboard, ARIA, `prefers-reduced-motion`, RTL where relevant

## Changeset

- [ ] Added a Changeset (`pnpm changeset`) describing the user-visible impact,
      or this PR is `chore:` and intentionally has no changeset.

## AI agent attribution (if applicable)

<!--
  Alphabet accepts AI-agent contributions. Per `docs/CONTRIBUTING.md`, tag the PR
  title prefix with the agent name, e.g. `[KIMI]`, `[COPILOT]`, `[CLAUDE]`.
  Note here which agent wrote / co-wrote the change.
-->

Agent: <!-- e.g. Copilot / human / Kimi / Claude / mixed -->
