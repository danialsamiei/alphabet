# AWAF Privacy Model

> **Source of truth** for what AWAF collects, what it stores, and under
> which conditions. The behaviour described here is **enforced by code**
> (see `packages/core/src/privacy` and `packages/security/src/consent`),
> not just by documentation.

## Principles

1. **Tier 0 by default.** Until a visitor explicitly grants consent, AWAF
   operates in `NO_MEMORY` mode: zero storage, zero profiling, zero
   tracking, zero personalization.
2. **DNT/GPC are first-class.** When `navigator.doNotTrack === '1'` or
   `navigator.globalPrivacyControl === true`, AWAF **forces** the
   privacy mode to Tier 0 and forbids personalization, even if the
   visitor previously granted a higher tier.
3. **DNT/GPC do not affect rendering.** Privacy signals control storage,
   profiling, analytics, and personalization. They do **not** downgrade
   the visual layer to STATIC_HTML. A visitor with a capable device and
   GPC enabled still sees an immersive UI — they just don't get tracked.
4. **No fingerprinting, no cookies, no PII.** AWAF reads passive browser
   signals (Accept-Language header, `Intl.DateTimeFormat().timeZone`,
   `screen.width`, `prefersReducedMotion`, DNT, GPC). It does **not**
   set cookies, does **not** hash navigator properties into a
   fingerprint, and does **not** store IP addresses, emails, names, or
   phone numbers.
5. **Coarse geo by default.** Without explicit consent, geo enrichment
   produces only `country`, `timezone`, and a broad `region` group.
   `city`, `coarseLatitude`, and `coarseLongitude` are reserved for
   future use and are **only** populated when the caller explicitly
   passes `{ allowPreciseGeo: true }` to `EnrichmentPipeline.enrich()`,
   which itself must only be set after `canUsePreciseGeo()` returns
   true.

## Consent ladder

AWAF defines four tiers, ordered by what each one permits:

| Tier         | Memory | Personalization | Analytics (k-anon) | Precise Geo |
|--------------|:------:|:---------------:|:------------------:|:-----------:|
| `NO_MEMORY`  |   ❌   |        ❌       |         ❌         |      ❌     |
| `ANONYMOUS`  |   ✅   |        ❌       |         ✅         |      ❌     |
| `CONSENTED`  |   ✅   |        ✅       |         ✅         |      ❌     |
| `ENRICHED`   |   ✅   |        ✅       |         ✅         |      ✅     |

Personalization, analytics, and precise geo additionally require **no
active DNT/GPC signal** — see the privacy helpers below.

### What is collected at each tier

#### `NO_MEMORY` (Tier 0)
Used for first visit, DNT/GPC users, revoked consent, and any state
prior to an explicit grant.

- Browser language (used in-memory only for current request)
- IANA timezone (used in-memory only)
- Country derived from timezone (used in-memory only)
- Region group derived from timezone (used in-memory only)

Nothing is persisted. Nothing leaves the request lifecycle.

#### `ANONYMOUS` (Tier 1)
Session-only memory. Cleared when the tab closes.

- Everything in `NO_MEMORY`
- Ephemeral session id (cleared on tab close)
- Aggregate, k-anonymous analytics (cohort size ≥ k)

#### `CONSENTED` (Tier 2)
Cross-session preferences and personalization with explicit opt-in.

- Everything in `ANONYMOUS`
- Stable visitor id (rotating, no cookies, no fingerprinting)
- Explicit preferences: theme, locale, content depth
- Personalized chip suggestions

#### `ENRICHED` (Tier 3)
Behavioral learning, vector embeddings, and precise geo.

- Everything in `CONSENTED`
- Vector embeddings of interests for retrieval
- Behavioral learning signals (within consented purposes)
- Precise geo (city, coarse latitude, coarse longitude)

## State machine

`ConsentTierManager` (in `@awaf/security`) implements the state machine.

```
                grant(tier)
   ┌─────────┐ ─────────────▶ ┌──────────┐
   │ pending │                │ granted  │ ◀────┐
   └─────────┘ ◀──────────────└──────────┘      │
        ▲       reset()             │           │ grant(tier ≥ current)
        │                           │ revoke()  │
        │                           ▼           │
        │       reset()       ┌──────────┐      │
        └─────────────────────│ revoked  │──────┘
                              └──────────┘
```

### Operations

| Method                          | Effect                                                                                                  |
|---------------------------------|---------------------------------------------------------------------------------------------------------|
| `grant(tier)`                   | State → `granted`. Tier set. Monotonic upgrade enforced — downgrade returns `CONSENT_DOWNGRADE_FORBIDDEN`. |
| `revoke()`                      | State → `revoked`. Tier → `NO_MEMORY`. Caller is responsible for purging stored data (GDPR Art. 17).    |
| `reset()`                       | State → `pending`. Tier → `NO_MEMORY`. Audit fields cleared. Used after a complete erasure.             |
| `downgradeOnPrivacySignal(sig)` | If DNT or GPC active, tier → `NO_MEMORY`. State preserved as `granted` so the audit trail is kept.       |
| `invalidateOnPolicyChange(v)`   | If `v` differs from the manager's policy version, state → `pending`, tier → `NO_MEMORY`. Re-consent required. |

## Privacy policy helpers

All four helpers live in `@awaf/core/privacy/policy.ts`. They are pure
functions and the **only** authoritative source of truth for permission
checks across the codebase.

```ts
import {
  canStoreMemory,
  canPersonalize,
  canUseAnalytics,
  canUsePreciseGeo,
} from '@awaf/core';

canStoreMemory('NO_MEMORY');                              // false
canStoreMemory('ANONYMOUS');                              // true
canPersonalize('CONSENTED', { dntEnabled: false, gpcEnabled: false }); // true
canPersonalize('CONSENTED', { dntEnabled: true,  gpcEnabled: false }); // false
canUseAnalytics('ANONYMOUS', 4);                          // false (below k=5)
canUseAnalytics('ANONYMOUS', 5);                          // true
canUsePreciseGeo('ENRICHED', { dntEnabled: false, gpcEnabled: false }); // true
canUsePreciseGeo('ENRICHED', { dntEnabled: true,  gpcEnabled: false }); // false
```

## Enrichment pipeline contract

`EnrichmentPipeline.enrich(signals, options?)` returns geo data that is
country/timezone/region only by default:

```ts
const enriched = pipeline.enrich(signals);
enriched.visitor.geo.country;          // 'IR'
enriched.visitor.geo.region;           // 'Asia'
enriched.visitor.geo.timezone;         // 'Asia/Tehran'
enriched.visitor.geo.city;             // undefined
enriched.visitor.geo.coarseLatitude;   // undefined
enriched.visitor.geo.coarseLongitude;  // undefined
```

The optional `allowPreciseGeo: true` flag is the **single** opt-in
required to populate city/lat/lon, and callers must verify
`canUsePreciseGeo(tier, signals) === true` before passing it.

## Decision engine contract

`HandshakeDecisionEngine.decide(enriched)` returns a `HandshakeDecision`
that separates two concerns:

- **`selectedLayer`** — chosen from device capability and accessibility
  preferences only (WebGL support, viewport size,
  `prefers-reduced-motion`, network class). DNT/GPC are **not** inputs.
- **`privacyMode`** — derived from DNT/GPC. Reports the enforced
  consent tier and whether memory, personalization, analytics, and
  precise geo are allowed in this request.

A visitor with `gpcEnabled: true` and a capable device receives:
- `selectedLayer: 'R3F_IMMERSIVE'` (capability-driven, unchanged)
- `privacyMode: { restricted: true, enforcedConsentTier: 'NO_MEMORY',
  memoryAllowed: false, personalizationAllowed: false,
  preciseGeoAllowed: false }`

## Out of scope

- AWAF does **not** set cookies. It uses ephemeral, in-memory state and
  (at `CONSENTED`+) a rotating visitor id stored via the consuming
  application's chosen storage.
- AWAF does **not** fingerprint. No canvas hashing, no font enumeration,
  no WebGL renderer string capture.
- AWAF does **not** store PII. Email, name, phone, IP — none of these
  ever enter the pipeline.
