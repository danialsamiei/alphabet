# Contributing to Alphabet

Thanks for your interest in contributing! Alphabet is a privacy-first adaptive
web SDK and we welcome contributions from human developers and AI agents.

> **The full guide is in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)** —
> branching strategy, commit conventions, AI-agent rules, code review
> checklist, and PR workflow are documented there.

## Quick start

```bash
pnpm install --frozen-lockfile
pnpm typecheck       # strict TS, exactOptionalPropertyTypes, noUncheckedIndexedAccess
pnpm test            # vitest across the workspace
pnpm build           # turbo build
pnpm size            # size-limit budgets (R3F-free baseline)
pnpm benchmark:smoke # handshake performance smoke check
```

## Before opening a PR

1. Read [`AGENTS.md`](AGENTS.md) — single source of truth for architecture and
   conventions (consent ladder, memory mesh isolation, 5-layer UI degradation,
   Result<T,E>, brand types, no-`any`).
2. Read [`docs/CODING_CONVENTIONS.md`](docs/CODING_CONVENTIONS.md) and
   [`docs/RELEASE.md`](docs/RELEASE.md).
3. Add a Changeset for any user-visible change:
   ```bash
   pnpm changeset
   ```
4. Run the agent checklist in `AGENTS.md` § *Agent Checklist*.

## Reporting security issues

Please do **not** open public GitHub issues for security vulnerabilities.
See [`SECURITY.md`](SECURITY.md) for the responsible disclosure process.

## Code of Conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

By contributing you agree your contributions are licensed under the project's
MIT License (see [`LICENSE`](LICENSE) when published, or the `license` field in
the root `package.json`).
