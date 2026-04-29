# Alphabet Certified Builder

> Status: **draft programme**. The criteria below are enforced today by
> `evaluateCertification` in `@alphabet/marketplace`. The branding,
> issuance ceremony, and revocation procedures are pending.

The **Alphabet Certified Builder** programme recognises maintainers who
publish components and protocol adapters that meet measurable standards
of privacy, accessibility, and resilience. Certification is *evidence
based*: every criterion is a function of a manifest (and optionally its
runtime telemetry). Anyone — not just the Alphabet team — can re-run
the evaluation with one function call.

```ts
import { evaluateCertification } from '@alphabet/marketplace';

const result = evaluateCertification(myManifest);
// result.level: 'bronze' | 'silver' | 'gold' | null
// result.criteriaMet, result.criteriaMissing
```

## Levels

Levels stack: **Silver implies Bronze, Gold implies Silver**. A
maintainer earns the highest level for which every criterion is met.

### Bronze — privacy hygiene

| Criterion | Code |
| --- | --- |
| Honours DNT / GPC by auto-downgrading to Tier 0 | `respects-dnt` |
| Required consent tier is at most 2 (no enriched-required components) | `tier-at-most-2` |
| Manifest declares at least one maintainer | `at-least-one-maintainer` |
| Manifest declares a non-empty license | `has-license` |

### Silver — adaptive correctness

Silver requires every Bronze criterion plus:

| Criterion | Code |
| --- | --- |
| Public trust score grade ≥ B | `trust-grade-b-or-better` |
| Component supports at least one degraded layer (Layer 4 or 5); auto-pass for protocol adapters | `supports-degraded-layers` |

### Gold — verifiable provenance and zero-PII default

Gold requires every Silver criterion plus:

| Criterion | Code |
| --- | --- |
| Public trust score grade ≥ A | `trust-grade-a-or-better` |
| Manifest asserts `collectsNoPii: true` | `collects-no-pii` |
| At least one maintainer publishes with a W3C DID for signed manifests | `signed-maintainer-did` |

## How certification interacts with the Public Trust Score

Trust score and certification are **independent but correlated**: trust
score is a continuous, real-valued signal; certification is a discrete,
threshold-based attestation. A manifest can have a high trust score and
still miss a certification level (e.g., no DID), and vice-versa.

## Issuance and revocation (future work)

When the registry backend is hosted, a successful publish that meets a
level will attach a `CertificationRecord` (signed by the registry) to
the manifest. Revocation will be honoured globally by republishing the
record with `level: null`; downstream consumers should treat the
absence of a current record as "not certified" rather than "previously
certified".

The current programme is intentionally minimal — its job is to give the
ecosystem one credible, machine-checkable signal that a maintainer's
work meets the *respectful web* baseline, without becoming a gatekeeper.
