# Alphabet Marketplace — Architecture

> Status: **draft** — this document and the `@alphabet/marketplace` package
> together constitute the foundation for the Alphabet Ecosystem &
> Marketplace. The runtime API is shipped as a `0.1.0` additive package;
> the registry backend, the public CDN endpoint for trust badges, and the
> certification dashboard are still to be built.

The Alphabet Marketplace is the connective tissue of the *respectful web*:
a place to publish and discover **adaptive components** (UI building
blocks that adapt across the five UI degradation layers) and **protocol
adapters** (bridges between Alphabet and standard agent / data
protocols) without compromising on the privacy posture that gives
Alphabet its identity.

## Goals

1. **Open by default.** Anyone can publish; nothing in the registry
   requires reviewer approval to *exist*. Trust signals are emitted
   transparently and let consumers filter for themselves.
2. **Privacy-first manifests.** A manifest must declare its privacy
   posture (consent tier, DNT/GPC respect, PII collection, locality,
   memory domains read/written). The registry validates this declaration
   on publish; consumers can filter on it on read.
3. **Deterministic trust signalling.** The Public Trust Score is a pure
   function of the manifest plus optional, *coarse* runtime telemetry —
   no per-visitor data ever enters it.
4. **Verifiable certification.** The "Alphabet Certified Builder"
   programme is enforced by code, not by a private review. Any consumer
   can re-evaluate any manifest with one function call.

## Building blocks

The package `@alphabet/marketplace` ships four primitives:

| Primitive | Module | Purpose |
| --- | --- | --- |
| Manifest schema | `./manifest.ts` | Validate publishes; returns `Result<Manifest, ValidationError>` |
| Registry | `./registry.ts` | `Registry` interface + `InMemoryRegistry` implementation |
| Trust score / badge | `./trust-score.ts` | `computeTrustScore` + `renderTrustBadge` (SVG + JSON) |
| Certification | `./certification.ts` | `evaluateCertification` returns Bronze / Silver / Gold + criteria status |

The `@alphabet/marketplace/official` subpath bundles the first set of
official manifests:

- `@alphabet/official:consent-banner`
- `@alphabet/official:layer-selector`
- `@alphabet/official:language-negotiator`
- `@alphabet/official:mcp-adapter`

These manifests describe components that *already ship* in the monorepo
(`@alphabet/ui`, `@alphabet/protocols`, `@alphabet/core`); the
marketplace package does not re-bundle their code.

## Manifest format (summary)

A manifest is a JSON document with two shapes (`kind: 'component'` or
`kind: 'protocol-adapter'`). Required fields on both:

- `id` — slug, optionally scoped: `[@scope/]name[:variant]`
- `version` — SemVer 2.0
- `title`, `description`, `license`, `tags[]`
- `maintainers[]` — at least one, optionally with a W3C DID for
  signed entries
- `privacy` — `requiredConsentTier` (0–3), `respectsDoNotTrack`,
  `collectsNoPii`, `localOnly`, `memoryDomainsRead[]`,
  `memoryDomainsWritten[]`

Component manifests additionally declare `supportedLayers[]` (any of
1–5) and `capabilities[]`. Adapter manifests declare `protocol`
(`mcp` | `a2a` | `qr-handoff` | `rest` | `custom`) and `capabilities[]`.

The full Zod-shaped schema lives in `packages/marketplace/src/manifest.ts`
and is enforced at the registry boundary on every publish.

## Public Trust Score

`computeTrustScore({ manifest, telemetry? })` returns a deterministic
score in `[0, 100]`, a letter grade, and an itemised list of reasons.
The contributing factors are:

| Code | Source | Δ |
| --- | --- | ---: |
| `TIER_0_BY_DEFAULT` | manifest.privacy.requiredConsentTier === 0 | +20 |
| `ANONYMOUS_TIER` | manifest.privacy.requiredConsentTier === 1 | +10 |
| `ENRICHED_REQUIRED` | manifest.privacy.requiredConsentTier === 3 | -5 |
| `RESPECTS_DNT` | manifest.privacy.respectsDoNotTrack | +10 |
| `IGNORES_DNT` | not respectsDoNotTrack | -25 |
| `NO_PII` | manifest.privacy.collectsNoPii | +10 |
| `LOCAL_ONLY` | manifest.privacy.localOnly | +5 |
| `OFFICIAL_ENTRY` | manifest.official | +5 |
| `DNT_DOWNGRADES_HONOURED` | telemetry confirms downgrades | +5 |
| `REVOCATIONS_HONOURED` | telemetry.revocationsHonoured24h > 0 | +5 |
| `INTEGRITY_FAILURES` | telemetry.memoryIntegrityFailures24h > 0 | -10 |

Letter grades are `A+ ≥ 90`, `A ≥ 80`, `B ≥ 65`, `C ≥ 50`, else `D`.

`buildTrustBadge` composes scoring with `renderTrustBadge` to produce a
self-contained SVG plus a shields.io-shaped JSON envelope. The badge can
be embedded by any host with a single `<img>` tag once the public CDN
endpoint is deployed (`/api/v1/trust-badge?id=…&signed=…`).

`sanitizeTelemetry(input: unknown)` strips any field that is not part
of `RuntimeTelemetry` so that callers cannot accidentally feed PII into
the scorer — defence-in-depth even at the API boundary.

## Certification — Alphabet Certified Builder

`evaluateCertification(manifest)` returns the highest level reached and
the per-criterion `met[]` / `missing[]` arrays. See
[`CERTIFICATION.md`](./CERTIFICATION.md) for the level definitions.

## Publishing flow (target topology)

```
                 ┌───────────────────────┐
   maintainer    │   alphabet publish    │ ─── signs manifest with DID (optional)
   ───────────▶  │   (CLI, future)       │
                 └─────────┬─────────────┘
                           │ HTTPS POST /api/v1/marketplace/publish
                           ▼
                 ┌───────────────────────┐
                 │  Registry backend     │
                 │  (validateManifest +  │
                 │   InMemoryRegistry-   │
                 │   compatible store)   │
                 └─────────┬─────────────┘
                           │ event log
                           ▼
                 ┌───────────────────────┐
                 │  Public Trust Score   │
                 │  CDN edge function    │ ──── /api/v1/trust-badge?id=…
                 └───────────────────────┘
```

Today only the in-process pieces are implemented; the HTTP layer can be
built on `@alphabet/api` patterns when the registry is hosted.

## Governance

- **Reserved namespace.** `@alphabet/official:*` is reserved for
  manifests authored by the core team. `validateManifest` rejects any
  consumer-published manifest that asserts `official: true` on a
  non-reserved id.
- **Version monotonicity.** A publish must strictly increase the SemVer
  core. The registry refuses re-publishing the same version.
- **No retroactive edits.** Once published, a version is immutable; bug
  fixes ship as a new patch version.
- **Right to erasure.** Maintainers can `remove` an entry; consumers
  must treat removal as an upstream signal, not a guarantee that copies
  no longer exist.

## Privacy notes

- The trust score never depends on per-visitor data. The optional
  telemetry inputs are 24-hour aggregates with no joinable identifiers.
- `sanitizeTelemetry` enforces that contract at the boundary.
- The badge SVG is fully inlinable — no external font, no script, no
  network round-trip from the consuming page.
