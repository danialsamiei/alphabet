# Alphabet 1.0 — Launch Security & Privacy Review

> **Audience.** Maintainers, security reviewers, and privacy officers preparing
> the public 1.0 release of Alphabet. This file is a **self-attestation**, not
> a third-party audit. It maps the controls actually shipped in this repository
> to the corresponding clauses of three external frameworks: **OWASP LLM
> Top‑10 v1.1**, **GDPR** (Articles 5, 7, 13–14, 17, 25, 32), and the
> **NIST AI Risk Management Framework 1.0** (`AI 100-1`, January 2023).
>
> **Honest scope.** Alphabet is a client-side, edge-safe SDK. Many controls
> below are *enabling primitives* that the host application is responsible for
> wiring in correctly. Where a clause requires a server-side or organizational
> control, this document says so. We do not claim full compliance with any
> framework; we claim *traceable alignment* on the items listed.

---

## How to read this document

Each table column has a fixed meaning:

| Column         | Meaning                                                                                                                                                                                         |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | ✅ shipped in code · 🟡 partial / planned · ⚪ host-application responsibility · ❌ not addressed (with reason).                                                                                  |
| **Mitigation** | The Alphabet primitive(s) that address the clause. Names are stable v1.0 public symbols.                                                                                                        |
| **Evidence**   | `path:line-line` ranges. Citations are against the v1.0 release commit and may drift on `main`; resolve them against the published tag for archival use.                                        |
| **Gaps**       | What this clause still requires from the host application or from a follow-up release. Empty when the shipped control is sufficient on its own.                                                 |

`@alphabet/security` controls live under `packages/security/src/`.
`@alphabet/core` privacy helpers live under `packages/core/src/privacy/` and `packages/core/src/privacy-wasm/`.
`@alphabet/protocols` v2 surfaces live under `packages/protocols/src/v2/`.

---

## 1. OWASP LLM Top‑10 v1.1 (2024)

OWASP LLM Top‑10 v1.1 enumerates ten risk categories specific to LLM
applications (`LLM01` – `LLM10`). Alphabet is **not** an LLM client — it
ships protocol *adapters* (`@alphabet/protocols`) and *guardrails*
(`@alphabet/security`) that the host application uses around its own LLM
client. We therefore claim alignment on the categories where we ship a
primitive, and explicitly delegate the rest to the host.

| Item    | Title                            | Status | Mitigation                                                                                          | Evidence                                                                                                                        | Gaps / host responsibility                                                                                              |
| :------ | :------------------------------- | :----: | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| LLM01   | Prompt Injection                 |   🟡   | `detectPromptRisk()` heuristics + recommended `block` action; OpenAI/Anthropic/Grok adapters route caller-supplied text through the same guard before dispatch. | `packages/security/src/prompt-injection/detector.ts:103-174`; `packages/protocols/src/v2/providers/`                            | Heuristic, not model-level. Host must still pass the assessment to a moderation API or in-context delimiter strategy.   |
| LLM02   | Insecure Output Handling         |   ✅   | `sanitizeHtml()`, `validateUrl()`, `markTextAsSafe()` + branded `SafeRender` type. Output is rendered only via `SafeRender`, which cannot be constructed without passing the sanitizer. | `packages/security/src/output-validation/output-guard.ts:29-332`                                                                | Mutation XSS in arbitrary rich text still requires DOMPurify in a sandboxed iframe.                                     |
| LLM03   | Training Data Poisoning          |   ⚪   | Out of scope — Alphabet does not train models.                                                      | —                                                                                                                               | Host LLM provider's responsibility.                                                                                     |
| LLM04   | Model Denial of Service          |   🟡   | `Fetcher` + `withRetry` (decorrelated jitter), `parseRateLimit` honours `Retry-After`/`X-RateLimit-Reset`. Provides backpressure but no per-tenant budget. | `packages/api/src/transport/`                                                                                                    | Cost-guardian / per-tenant budget is on the roadmap (see `docs/ROADMAP.md`).                                            |
| LLM05   | Supply-Chain Vulnerabilities     |   ✅   | CodeQL (security-extended + security-and-quality); `pnpm audit --audit-level=high`; Snyk (gated); Dependabot; `actions/dependency-review-action` on every PR. | `.github/workflows/codeql.yml`; `.github/workflows/ci.yml`; `.github/workflows/dependency-review.yml`; `.github/dependabot.yml` | High-severity findings surface as warnings, not blockers — by design, to keep PRs from forks green. Tighten in a host-policy pre-merge gate if needed. |
| LLM06   | Sensitive Information Disclosure |   ✅   | `redactPII()` / `redactPIIDeep()` with strictness ladder; `AlphabetAuditLogger` redacts by default. | `packages/security/src/pii/redactor.ts:228-366`; `packages/security/src/audit/audit-logger.ts:145-293`                            | None — but the host must opt the logger into a non-default strictness if their threat model demands `strict`.            |
| LLM07   | Insecure Plugin Design           |   ✅   | `MemoryIntegrityGuard` enforces a static read ACL and admin-only write list, returning `Result<…, AlphabetError>` so a caller cannot silently bypass policy. | `packages/security/src/memory-integrity/memory-integrity-guard.ts:39-195`                                                       | Tools/plugins external to Alphabet must adopt the same `Result<T,E>` discipline.                                        |
| LLM08   | Excessive Agency                 |   ✅   | A2A & MCP adapters require an explicit `consentTier` and `selectedLayer` in every envelope; `ENRICHED` is required for tools that mutate state. | `packages/protocols/src/v2/providers/`; `packages/protocols/src/v2/sdk/`                                                         | Host must enforce its own per-action authorisation server-side.                                                          |
| LLM09   | Overreliance                     |   ⚪   | Alphabet does not produce text directly; the host's UI must communicate uncertainty.               | —                                                                                                                               | Host responsibility (UI affordances).                                                                                   |
| LLM10   | Model Theft                      |   ⚪   | Out of scope — Alphabet ships no model weights.                                                     | —                                                                                                                               | Host LLM provider's responsibility.                                                                                     |

**Open items called out explicitly.** LLM01 is heuristic-only; LLM04 has no
per-tenant budget primitive; LLM05 is non-blocking by default. These are the
known gaps for v1.0 and are tracked in `docs/ROADMAP.md`.

---

## 2. GDPR — Articles 5, 7, 13–14, 17, 25, 32

GDPR is an organizational regulation; an SDK cannot be "compliant" on its own.
The table below maps each article's *technical-and-organizational measures*
language to the Alphabet primitives that make compliance achievable for a
host application processing personal data via the SDK.

| Article  | Title                                           | Status | Mitigation                                                                                                                              | Evidence                                                                                                                  | Gaps / host responsibility                                                                                |
| :------- | :---------------------------------------------- | :----: | :-------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| Art. 5   | Principles relating to processing                |   ✅   | Tier ladder enforces purpose limitation; `canStoreMemory`, `canPersonalize`, `canUseAnalytics`, `canUsePreciseGeo` gate behaviour by tier. | `packages/core/src/privacy/`; `packages/security/src/consent/consent-tier-manager.ts:181-402`                              | Host must register lawful basis for any tier other than `NO_MEMORY`.                                      |
| Art. 7   | Conditions for consent                           |   ✅   | Consent state machine: `pending → granted → revoked`; monotonic tier upgrades; explicit `revoke()`; policy-version invalidation. | `packages/security/src/consent/consent-tier-manager.ts:181-309`                                                            | Host must surface the revoke control in UI (`ConsentBanner` in `@alphabet/ui` is the reference impl).     |
| Art. 13  | Information to be provided — direct collection   |   🟡   | `TransparencyNotice` (UI primitive) + `docs/PRIVACY_MODEL.md` enumerate signals collected, retention, and lawful basis.                  | `packages/ui/src/` (TransparencyNotice); `docs/PRIVACY_MODEL.md`                                                          | Host must localize the notice text for its jurisdiction set.                                              |
| Art. 14  | Information — indirect collection                |   ⚪   | Alphabet does not perform indirect collection — all signals are read passively from the visitor's own browser.                          | —                                                                                                                         | Not applicable to the SDK.                                                                                |
| Art. 17  | Right to erasure                                 |   ✅   | `ConsentTierManager.reset()` clears every persisted consent tuple **and** purges the storage adapter ("designed for full data erasure (GDPR Article 17)" — code comment). Host wires this to the user-facing erasure flow. | `packages/security/src/consent/consent-tier-manager.ts:100-101, 289-309`                                                   | Host must also delete server-side storage of the same `visitorId`. Alphabet only owns client-side state. |
| Art. 25  | Data protection by design and by default         |   ✅   | Default tier is `NO_MEMORY`. DNT/GPC auto-downgrade is enforced in code, not configuration. `downgradeOnPrivacySignal()` cannot be overridden by tier upgrades. | `packages/security/src/consent/consent-tier-manager.ts:108, 312-330`                                                       | None for the controls Alphabet ships.                                                                     |
| Art. 32  | Security of processing                           |   🟡   | TLS via the host; AES-GCM for QR handoff payloads; `MemoryIntegrityGuard` for ACL; `AlphabetAuditLogger` for tamper-evident-by-convention logs. | `packages/protocols/src/qr-handoff/`; `packages/security/src/memory-integrity/memory-integrity-guard.ts`; `packages/security/src/audit/audit-logger.ts` | Audit log durability and integrity (Art. 32(1)(d) "ability to ensure ongoing confidentiality, integrity") is host-side. |

**Differential privacy, k-anonymity, privacy budget.** `@alphabet/security/privacy`
ships Laplace + Gaussian mechanisms (`packages/security/src/privacy/laplace.ts:1-121`;
`gaussian.ts:1-125`), a `kAnonymityGate` (default *k*=5,
`k-anonymity.ts:1-85`), and a sealed `PrivacyBudgetLedger`
(`budget.ts:1-264`). All randomness is sampled from `crypto.getRandomValues`
(`random.ts:1-135`) — never `Math.random()`. These are the technical
measures behind Art. 5(1)(c) (data minimisation) and Art. 25(2) (default
to the minimum necessary processing).

---

## 3. NIST AI Risk Management Framework 1.0 — `AI 100-1`

The NIST AI RMF is organized around four functions: **GOVERN**, **MAP**,
**MEASURE**, **MANAGE**. The eight Alphabet threats below are the same
threats enumerated in `AGENTS.md` "8 Threats + Risk Score" — this table
maps each one across all four NIST functions, with a metric threshold
where one is meaningful at the SDK layer.

| #   | Threat                            | GOVERN                                                              | MAP                                                                            | MEASURE                                                                                          | MANAGE                                                                                                                                           |
| :-- | :-------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Prompt injection (LLM01)          | Quarterly prompt-template review; red-team in `e2e/`.               | Coverage of OWASP LLM01 attack vectors in `detectPromptRisk()`.                | High-risk hits per session **<5**.                                                                | `packages/security/src/prompt-injection/detector.ts:103-174` + `Result`-returning provider adapters.                                              |
| 2   | Memory poisoning                  | Mandatory human review for tier-3 (`ENRICHED`) writes.              | Anomaly detection on memory write rate per visitor.                            | Failed `MemoryIntegrityGuard.canWrite` rate **<0.1%**.                                            | `packages/security/src/memory-integrity/memory-integrity-guard.ts:101-195` (read ACL + admin-only write list).                                   |
| 3   | Over-personalization (filter bubble) | Diversity quota in suggestion ranking; editorial oversight.       | Bubble detection at the suggestion layer.                                      | Diversity score **>0.7** (skew under threshold triggers alarm).                                  | Host application (Alphabet provides the consent layer; ranking diversity is host-side). 🟡                                                       |
| 4   | Privacy violation                  | Annual privacy impact assessment (PIA); DPO sign-off on policy version bumps. | Data minimization audit per signal collected.                       | Explicit-consent rate **>95%** of `tier ≥ ANONYMOUS`.                                            | Edge-first design + DNT/GPC auto-downgrade `consent-tier-manager.ts:312-330`. ✅                                                                  |
| 5   | Hallucination                      | Provenance & source attestation mandatory in every tool response.   | RAG grounding on T1/T2 sources only; T3 cross-referenced.                       | Hallucination rate **<2%** (host-measured).                                                      | Output guards + flagging in `packages/security/src/output-validation/output-guard.ts:29-332`. Host LLM client must surface citations.            |
| 6   | Content sensitivity                | Content policy reviewed annually; takedown SLA 4 h.                  | Llama Guard / Alibaba Guardrails pipeline (host-side).                          | Moderation flag rate within 1 σ of historical baseline.                                          | Host responsibility; Alphabet ships `sanitizeHtml` only. ⚪                                                                                       |
| 7   | Voice abuse                        | Voice logs retained ≤30 d; local processing preferred.               | No persistent voice storage at the SDK layer.                                  | ≤20 voice requests / hour / session.                                                              | Host responsibility; Alphabet does not ship a voice primitive in v1.0. ⚪                                                                          |
| 8   | Tracking opacity                   | Annual transparency report.                                          | `Context Handshake` UI signals visible to the visitor in the consent banner.    | Consent-tier violation count = **0** in production logs.                                          | DNT/GPC respect + zero-memory mode (`NO_MEMORY` is the default tier). ✅                                                                          |

**MEASURE — automated metrics in CI.** `pnpm benchmark:smoke` keeps the
handshake pipeline below the 80 ms-on-3G target (`docs/PERFORMANCE.md`).
`pnpm size:check-r3f-free` keeps the base `@alphabet/ui` bundle R3F-free.
Both gates run on every PR.

---

## 4. Cross-cutting controls

These are not specific to any single framework but support all three.

### 4.1 Cryptographic randomness
All sampling routines in `@alphabet/security/privacy` use
`crypto.getRandomValues` exclusively. `Math.random` is forbidden in
privacy code paths. See `packages/security/src/privacy/random.ts:1-135`.

### 4.2 Result-returning APIs
Every public consent / output / memory primitive returns
`Result<T, AlphabetError>` (the success-shape convention used across the
monorepo, `{ success: true, data } | { success: false, error }`). Callers
**cannot** silently bypass policy because there is no `throw` to swallow.
See `packages/core/src/types/result.ts:33-35`.

### 4.3 Append-only privacy budget ledger
`PrivacyBudgetLedger` (`packages/security/src/privacy/budget.ts:1-264`)
is sealed and append-only. Once a budget is exhausted, the ledger atomically
returns `BUDGET_EXHAUSTED` for every subsequent claim — no retroactive
edits, no partial commits.

### 4.4 Policy versioning
`ConsentTierManager.invalidateOnPolicyChange()` invalidates a stored
consent tuple when the policy version on disk does not match the SDK's
`DEFAULT_POLICY_VERSION`. Host applications **must** bump
`DEFAULT_POLICY_VERSION` whenever they change the privacy notice text.
See `packages/security/src/consent/consent-tier-manager.ts:181-402`.

---

## 5. Out of scope for v1.0

The following are deliberately **not** addressed by this SDK and require host-
or provider-side controls:

* Server-side authentication, authorization, rate limiting.
* Append-only / tamper-evident *durable* audit storage. The shipped
  `AlphabetAuditLogger` is in-process only.
* Native model-level jailbreaks that bypass heuristic patterns.
* Mutation XSS in arbitrary rich text — use DOMPurify inside a sandboxed
  iframe.
* Side-channel attacks on the host page.
* DPIA / Article 35 risk assessments — organizational obligation.
* Third-party penetration testing — must be commissioned by the host.

---

## 6. Sign-off log

| Date         | Reviewer (role)                  | Notes                                                                                |
| :----------- | :------------------------------- | :----------------------------------------------------------------------------------- |
| 2026-04-29   | Maintainer self-attestation      | Initial v1.0 self-attestation cut. No third-party review on file yet.               |
| _pending_    | _External reviewer_              | _Slot reserved for the first external security review (commissioned post-launch)._ |
| _pending_    | _Privacy officer / DPO_          | _Slot reserved for the host's DPO sign-off when Alphabet is integrated downstream._ |

---

*End of Launch Security & Privacy Review.*
