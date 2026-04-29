# Open Standard Proposal — Respectful Context Handshake

> Status: **draft proposal** for incubation in a W3C Community Group
> (target: Privacy CG / Web Platform Incubator CG). This document is
> the seed text the Alphabet project intends to bring to that group;
> it is **not** an adopted W3C deliverable.

## Abstract

This document proposes a small, declarative protocol — the **Respectful
Context Handshake (RCH)** — by which a web origin announces, in a
machine-readable way, the *context signals* it would adapt to and the
*privacy posture* under which it would do so. Browsers and user agents
can then enforce the user's chosen consent tier, surface a transparent
indicator, and refuse any signal collection that exceeds the announced
posture.

RCH is *additive*: it does not require new signal sources, new
identifiers, or any change to existing fingerprinting protections. It
is a public, auditable contract between the origin and the user agent.

## Motivation

Today, websites that wish to adapt to user context (language, device
class, accessibility preferences, network conditions) typically:

- collect signals **silently**, with no user-visible declaration of
  intent;
- mix capability adaptation with personalisation in a single bundle of
  cookies or fingerprints;
- depend on third-party tracking SDKs as a side-effect of using off-the-
  shelf "personalisation" libraries.

Privacy preferences expressed by `Sec-GPC` and `DNT` are honoured by
some origins and not by others, with no machine-readable way for a user
agent to verify that the origin is *capable* of operating without
behavioural data.

RCH addresses these gaps by giving origins a way to **declare upfront**:
"these are the signals I would use, this is the consent tier I would
need, here is the manifest of components I would activate, and here is
the public trust score for that posture."

## Non-goals

- RCH does not introduce new fingerprinting surfaces.
- RCH does not replace existing consent UIs; it provides the structured
  contract that those UIs render.
- RCH does not dictate any specific user agent affordance; it only
  defines the data that would let one exist.

## Terminology

The terms *consent tier*, *capability layer*, *memory domain*, and
*privacy posture* are used in the sense established by the Alphabet
SDK (see `docs/CORE_CONCEPTS.md` in the alphabet repository).

## Protocol — capability declaration

A site that wishes to participate publishes a JSON document at a
well-known URL:

```
GET /.well-known/respectful-context.json
```

The document MUST validate against the `RespectfulContextManifest`
schema:

```jsonc
{
  "version": "1.0.0",
  "originId": "example.com",
  "privacy": {
    "requiredConsentTier": 0,
    "respectsDoNotTrack": true,
    "collectsNoPii": true,
    "localOnly": true
  },
  "signals": [
    "accept-language",
    "timezone",
    "prefers-reduced-motion",
    "prefers-color-scheme",
    "viewport"
  ],
  "memoryDomainsRead": [],
  "memoryDomainsWritten": [],
  "components": [
    "@alphabet/official:layer-selector",
    "@alphabet/official:language-negotiator",
    "@alphabet/official:consent-banner"
  ],
  "trustBadge": "https://example.com/api/v1/trust-badge"
}
```

The `signals` array is drawn from a fixed registry of
*capability-grade* signals: signals that are either inherent to the
user agent's API surface (e.g., `prefers-reduced-motion`) or
explicitly user-configurable (e.g., `accept-language`). High-entropy
signals are excluded.

`requiredConsentTier` follows the four-step ladder used by the
Alphabet SDK:

| Tier | Name | Persistent storage |
| ---: | --- | --- |
| 0 | `NO_MEMORY` | none |
| 1 | `ANONYMOUS` | sessionStorage |
| 2 | `CONSENTED` | localStorage |
| 3 | `ENRICHED` | semantic / vector storage |

The schema is the same one validated by `@alphabet/marketplace`'s
`validateManifest`; that implementation is offered to the working
group as a reference implementation.

## User agent obligations (non-normative summary)

A conforming user agent SHOULD:

1. Surface the manifest's `requiredConsentTier`, `respectsDoNotTrack`,
   and `collectsNoPii` fields in a privacy indicator.
2. Refuse to share signals not listed in `signals[]`.
3. Refuse to allow the origin to escalate above the user's chosen
   consent tier without a fresh, explicit consent gesture.
4. Display the `trustBadge` link as a transparent attestation.

## Origin obligations (non-normative summary)

An origin that publishes a manifest MUST:

1. Honour `Sec-GPC` and `DNT` by auto-downgrading to Tier 0 with no
   persistence, regardless of any in-page consent UI.
2. Limit signal collection to the set declared in `signals[]`.
3. Limit memory operations to the declared `memoryDomainsRead` /
   `memoryDomainsWritten`.
4. Republish the manifest atomically when any of the above changes;
   silent posture upgrades are non-conforming.

## Public Trust Score

Origins MAY expose a public Trust Score endpoint computed deterministi-
cally from the manifest and (optionally) coarse 24-hour aggregate
telemetry. The endpoint returns a JSON shields.io-style envelope and a
self-contained SVG. The reference scoring function is shipped in
`@alphabet/marketplace` as `computeTrustScore` / `renderTrustBadge`;
its formula is published in `docs/MARKETPLACE.md` and is normatively
referenced by this proposal.

## Security and privacy considerations

- **No new identifiers.** RCH does not introduce origin-bound or
  cross-origin identifiers; it describes signals already available to
  the user agent.
- **No new entropy.** The fixed signal registry excludes high-entropy
  signals (e.g., GPU model, fonts list).
- **Tamper resistance.** The manifest is fetched from
  `/.well-known/`, served over HTTPS, and SHOULD be pinned by the user
  agent within a session to detect mid-session posture changes.
- **Coarse geo only.** RCH does not endorse IP geolocation; geo, when
  used at all, MUST be sourced from `Accept-Language` or explicit user
  input.
- **DNT/GPC supremacy.** Both signals MUST always force Tier 0 and
  override any in-page UI choice.

## Relationship to existing standards

- **GPC / DNT.** RCH does not replace either; it is the structured
  declaration that shows whether an origin is *engineered* to honour
  them.
- **Permissions Policy / Feature Policy.** Complementary: Permissions
  Policy gates *capabilities*; RCH declares *signals* and *consent
  tier*.
- **W3C DID.** Used as the optional maintainer identity in the
  `@alphabet/marketplace` manifest, suitable for cryptographically
  signed posture declarations.

## Open issues

- Manifest signature format (DID-VC vs JWS).
- Caching and posture-change semantics.
- Interaction with embedded contexts (iframes, web components).
- Internationalisation of the trust badge text.

## Acknowledgements

The model is grounded in the Alphabet SDK's six-phase context handshake,
five-layer UI degradation, and four-tier consent ladder.
See [`docs/CORE_CONCEPTS.md`](./CORE_CONCEPTS.md) and
[`docs/MARKETPLACE.md`](./MARKETPLACE.md) for the operational
counterpart of this proposal.
