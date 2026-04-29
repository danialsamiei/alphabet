# Security Policy

> Detailed threat model, NIST AI 100-1 mapping, GDPR/CCPA/LGPD jurisdiction
> rules, OWASP LLM01 defense, and Right-to-Erasure flows live in
> [`docs/SECURITY.md`](docs/SECURITY.md) and [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md).

## Supported Versions

AWAF is in active pre-1.0 development. Security fixes will be backported to
the latest published minor of every package per the table below once the
first public release is cut.

| Package          | Supported versions |
|------------------|--------------------|
| `@awaf/core`     | latest minor       |
| `@awaf/api`      | latest minor       |
| `@awaf/ui`       | latest minor       |
| `@awaf/protocols`| latest minor       |
| `@awaf/security` | latest minor       |

Pre-release `0.x` versions receive fixes only on the highest published minor.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Use one of these private channels instead:

1. **GitHub Security Advisories** — preferred. Open a private advisory at
   <https://github.com/danialsamiei/awaf/security/advisories/new>.
2. **Email** — contact the maintainer listed in the repository profile.
   Encrypt with the maintainer's public key if possible.

We will acknowledge your report within **72 hours** and aim to provide an
initial assessment within **7 days**. Critical issues (RCE, auth bypass,
PII exfiltration, consent-bypass) target a fix within **14 days**; other
issues within **30 days**.

When you report, please include:

- Affected package and version (or commit SHA)
- A minimal reproduction (preferably a failing test)
- Threat category (mapped to AWAF's eight categories in `docs/SECURITY.md`)
- Suggested mitigation if you have one

## Disclosure

We follow **coordinated disclosure**:

1. Acknowledgement → triage → fix → release a patched version.
2. Public CVE / GitHub Security Advisory published once users have a
   reasonable upgrade window (typically 14–30 days post-fix).
3. Reporters are credited unless they request anonymity.

## In-scope

- All `@awaf/*` packages in this monorepo
- `apps/demo` and `apps/danial-site` insofar as they exercise SDK behaviour
- The OpenAPI specs in `openapi/`
- The protocol adapters in `packages/protocols`

## Out-of-scope

- Vulnerabilities in third-party dependencies (please report upstream;
  we will track and update via Changesets/Dependabot)
- Issues that require a malicious browser extension or compromised host
- Social engineering of maintainers
- Denial of service via traffic flooding (mitigated at infrastructure layer)

## Privacy & Data Protection

AWAF is privacy-first by construction. If you discover an issue that:

- Causes PII to be persisted at consent tier 0 or 1
- Bypasses DNT / Sec-GPC handling
- Leaks precise geolocation when the visitor has not opted in
- Allows cross-domain reads against the memory-mesh isolation rules
- Defeats the consent state machine (`pending → granted → revoked`)

…treat it as **critical** and report it via the channels above.

## Compliance References

- **GDPR** Articles 7, 17, 25, 32 — consent, erasure, privacy-by-design
- **CCPA** §1798.105, §1798.135 — opt-out / Do-Not-Sell
- **LGPD** Articles 7, 18 — explicit consent and data-subject rights
- **NIST AI RMF 1.0** — GOVERN / MAP / MEASURE / MANAGE mapping in
  `packages/security/src/security/NISTAIMapping.ts`
- **OWASP LLM Top 10** — LLM01 (prompt injection) defense in
  `packages/security/src/security/PromptInjectionDefense.ts`
