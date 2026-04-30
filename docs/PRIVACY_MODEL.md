# Alphabet Privacy Model

> **Source of truth** for what Alphabet collects, what it stores, and under
> which conditions. The behaviour described here is **enforced by code**
> (see `packages/core/src/privacy` and `packages/security/src/consent`),
> not just by documentation.

## Principles

1. **Tier 0 by default.** Until a visitor explicitly grants consent, Alphabet
   operates in `NO_MEMORY` mode: zero storage, zero profiling, zero
   tracking, zero personalization.
2. **DNT/GPC are first-class.** When `navigator.doNotTrack === '1'` or
   `navigator.globalPrivacyControl === true`, Alphabet **forces** the
   privacy mode to Tier 0 and forbids personalization, even if the
   visitor previously granted a higher tier.
3. **DNT/GPC do not affect rendering.** Privacy signals control storage,
   profiling, analytics, and personalization. They do **not** downgrade
   the visual layer to STATIC_HTML. A visitor with a capable device and
   GPC enabled still sees an immersive UI — they just don't get tracked.
4. **No fingerprinting, no cookies, no PII.** Alphabet reads passive browser
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

Alphabet defines four tiers, ordered by what each one permits:

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

`ConsentTierManager` (in `@alphabet/security`) implements the state machine.

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

All four helpers live in `@alphabet/core/privacy/policy.ts`. They are pure
functions and the **only** authoritative source of truth for permission
checks across the codebase.

```ts
import {
  canStoreMemory,
  canPersonalize,
  canUseAnalytics,
  canUsePreciseGeo,
} from '@alphabet/core';

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

## Differential privacy primitives (`@alphabet/security/privacy`)

> Status: **Implemented (W1 P1 of the Bold Roadmap)** — additive subpath, no
> breaking change. See `packages/security/src/privacy/`.

The `@alphabet/security/privacy` subpath ships the formal building blocks
that turn Alphabet's *promise* of "no individual visitor is ever recoverable
from a published aggregate" into a *mathematical guarantee*.

### What is shipped

- **Cryptographic randomness** (`sampleUniformUnitInterval`, `sampleStandardNormal`,
  `sampleLaplace`) — backed exclusively by `crypto.getRandomValues`. Web Crypto
  is available in browsers, Node ≥ 18, Cloudflare Workers, Vercel Edge, Deno,
  and Bun. **`Math.random` is never used** for privacy-critical noise.
- **Laplace mechanism** (`applyLaplaceMechanism`, `computeLaplaceScale`) for
  *pure* ε-DP queries (counts, sums, means). Adds noise drawn from
  `Lap(0, Δf / ε)` where `Δf` is the L1 sensitivity supplied by the caller.
- **Gaussian mechanism** (`applyGaussianMechanism`, `computeGaussianStdDev`)
  for `(ε, δ)`-DP queries. Uses the closed-form
  `σ = Δ₂f · √(2·ln(1.25/δ)) / ε` and rejects `ε > 1` with
  `EPSILON_OUT_OF_RANGE` to avoid silently shipping a weaker bound. Callers
  who need ε > 1 must compose smaller-ε queries via the budget ledger.
- **k-anonymity gate** (`kAnonymityGate`) — a cheap pre-DP check that
  refuses cohorts smaller than `DEFAULT_K_ANONYMITY_THRESHOLD` (5). Returns
  `Result<KAnonymityPass, AlphabetError>` so the decision plugs straight
  into the rest of the Alphabet stack.
- **`PrivacyBudgetLedger`** — the *enforcement point* for `(ε, δ)` spend.
  Sealed, append-only, monotonic accountant under basic sequential
  composition. Refuses any spend that would exceed the operator-supplied
  cap with `BUDGET_EXHAUSTED`, atomically (failed spends never appear in
  the ledger).

### Privacy guarantees

| Property | Guaranteed by | Enforcement |
|---|---|---|
| ε-DP for L1-sensitivity-bounded queries | Laplace mechanism | Code |
| (ε,δ)-DP for L2-sensitivity-bounded queries, ε ∈ (0, 1] | Gaussian mechanism | Code |
| Cohorts smaller than k=5 are never published | `kAnonymityGate` | Code |
| Cumulative `(ε, δ)` spend ≤ cap | `PrivacyBudgetLedger` | Code (basic composition) |
| Budget ledger is append-only | Sealed class — no `reset()`, no `delete()` | Code |
| No PII in budget entries | 256-character query-label cap + `INVALID_QUERY_LABEL` validation | Code |
| Cryptographic randomness | `crypto.getRandomValues` — `Math.random` is never called | Code (`spy(Math, 'random')` test) |

### Usage example

```ts
import {
  PrivacyBudgetLedger,
  applyLaplaceMechanism,
  kAnonymityGate,
} from '@alphabet/security/privacy';

const ledger = new PrivacyBudgetLedger({
  cap: { epsilon: 1.0, delta: 0 },
});

function publishDailyPageviews(rawCount: number, cohortSize: number) {
  const gate = kAnonymityGate(cohortSize);
  if (!gate.success) return gate; // refuse — too few visitors

  const cfg = { sensitivity: 1, params: { epsilon: 0.1, delta: 0 } };
  const spend = ledger.spend('daily-pageviews', 'laplace', cfg);
  if (!spend.success) return spend; // refuse — budget exhausted

  return applyLaplaceMechanism(rawCount, cfg);
}
```

### Limitations

- `PrivacyBudgetLedger` uses **basic sequential composition**, which is
  conservative. Future releases may add a pluggable `Accountant` for
  Rényi-DP / zero-concentrated-DP accounting.
- Sensitivity (`Δf`) is the operator's responsibility to bound correctly.
  Alphabet validates that the supplied sensitivity is finite and ≥ 0, but
  cannot verify it is the true L1/L2 sensitivity of an arbitrary query.
- The k-anonymity gate is a *necessary* but not *sufficient* condition.
  Always pair it with one of the noise mechanisms.

## Out of scope

- Alphabet does **not** set cookies. It uses ephemeral, in-memory state and
  (at `CONSENTED`+) a rotating visitor id stored via the consuming
  application's chosen storage.
- Alphabet does **not** fingerprint. No canvas hashing, no font enumeration,
  no WebGL renderer string capture.
- Alphabet does **not** store PII. Email, name, phone, IP — none of these
  ever enter the pipeline.


## Explicit Non-Logging Guarantees

Alphabet telemetry and demo sinks **do not log**:
- PII (name, email, phone, postal address, messages).
- Raw IP addresses.
- Persistent/stable identifiers that can track a person across sessions/devices.
- Full user-agent strings or high-entropy fingerprint material.
- Exact latitude/longitude.
