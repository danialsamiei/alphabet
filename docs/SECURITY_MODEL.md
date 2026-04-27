# AWAF Security Model

> **Scope.** This document describes the threats `@awaf/security` is designed
> to mitigate, the guardrails it provides today, and — equally importantly —
> what it does **not** do. AWAF is a privacy-first SDK; security claims here
> are deliberately narrow and verifiable.
>
> **This document does not claim full compliance with OWASP LLM Top 10 or
> NIST AI RMF 1.0.** It documents alignment with their principles where the
> code actually implements a control, and explicitly lists gaps elsewhere.

---

## 1. Threat model summary

The SDK is consumed in two trust contexts:

1. **Browser SDK.** `@awaf/core`, `@awaf/api`, `@awaf/ui`, `@awaf/security`
   ship as a JavaScript bundle running on the visitor's device. The
   adversary may control the network, other scripts on the page, or
   crafted user input.
2. **Host application.** A consumer integrates AWAF behind their own
   backend. The host application is responsible for authentication,
   server-side storage, durability, and any compliance-grade audit
   logging.

`@awaf/security` provides **client-side and shared-utility guardrails**
that help the host application avoid common AI-aware-web pitfalls. It is
not a server-side security framework.

### Adversaries we explicitly consider

| Adversary                       | Capability                                                          | Mitigation in `@awaf/security`                                                  |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Malicious user input            | Authors free-text that will be passed to an LLM                     | `detectPromptRisk` heuristics; recommended `block` action for high-risk input.  |
| AI-generated output             | LLM produces HTML, links, or markup that will be rendered in the UI | `sanitizeHtml`, `validateUrl`, `markTextAsSafe`, branded `SafeRender` type.     |
| Accidental PII in logs          | A developer logs an error that contains an email or token           | `redactPII` / `redactPIIDeep` and audit-logger redaction-by-default.            |
| Cross-domain memory leak        | A site queries the wrong memory domain                              | `MemoryIntegrityGuard` enforces the read ACL and admin-only write list.         |
| Consent bypass                  | A caller stores data without checking tier                          | `ConsentTierManager` + `MemoryIntegrityGuard.canWrite` reject `NO_MEMORY` writes. |
| Stale consent after policy bump | Consent granted under a previous policy version is still honoured   | `ConsentTierManager.invalidateOnPolicyChange` with `DEFAULT_POLICY_VERSION`.    |

### Adversaries we do **not** address

`@awaf/security` does not attempt to mitigate the following — host
applications must use other tools:

- **Native model-level jailbreaks** that bypass heuristic patterns.
- **Mutation XSS** in arbitrary rich-text. Use a vetted library
  (DOMPurify) inside a sandboxed iframe for untrusted HTML.
- **Side-channel attacks** on the host page (e.g., timing leaks).
- **Server-side authentication, authorization, or rate limiting**.
- **Append-only / tamper-evident audit storage.** The provided audit
  logger is in-process; durability and integrity are the host
  application's responsibility.
- **Cost-exhaustion attacks** against an LLM provider. (Planned: a
  cost-guardian module — see [`docs/ROADMAP.md`](ROADMAP.md).)
- **Differential-privacy aggregation.** Planned but not shipped.

---

## 2. Controls shipped today

### 2.1 Consent

- `ConsentTierManager` is a state machine over `pending → granted →
  revoked`, with monotonic tier upgrades, DNT/GPC auto-downgrade, and
  policy-version invalidation. Every operation returns
  `Result<…, AWAFError>` so callers cannot silently bypass policy.
- The pure helpers `canStoreMemory`, `canPersonalize`,
  `canUseAnalytics`, and `canUsePreciseGeo` (in `@awaf/core/privacy`)
  are the only sanctioned way to gate behaviour on consent.

### 2.2 PII redaction

- `redactPII(input, opts)` returns the redacted text **and** the
  structured findings, with a configurable strictness:
  - `lenient` — emails, JWTs, AWS access keys, Google API keys, GitHub
    PATs, Slack tokens, PEM private-key blocks.
  - `standard` (default) — adds phone-like strings and Luhn-checked
    credit-card numbers.
  - `strict` — adds IPv4 addresses and high-entropy generic secrets.
- `redactPIIDeep` walks an arbitrary object graph (with cycle
  protection) and redacts every string leaf.
- The replacer never sees the raw value — only the kind and an index —
  to discourage misuse for sneaky logging.

### 2.3 Prompt-injection heuristics

- `detectPromptRisk(input, opts)` runs a fixed list of regular
  expressions covering the most common public attack vectors:
  instruction override, system-prompt exfiltration, role override,
  safety-off, exfiltration-via-URL, and fake `<system>` / `[[SYSTEM]]`
  delimiters. Each pattern contributes its weight at most once per
  input, capping total score at `1.0`.
- The output classifies risk as `low` / `medium` / `high` and emits a
  recommended action (`allow` / `flag` / `review` / `block`) plus a
  human-readable explanation listing pattern ids.
- Thresholds and additional patterns can be passed in `opts`.

> **This is a heuristic.** It will miss obfuscated, multi-step, or
> model-specific exploits. It is intended as an *input filter* to be
> combined with output filtering, sandboxed tools, and human review.

### 2.4 Output validation

- `validateUrl(input, opts)` parses with the URL constructor and
  rejects everything outside an allow-list of protocols. Surrounding
  whitespace and case-insensitive `javascript:` / `data:` / `vbscript:`
  / `file:` schemes are rejected before parsing, mitigating
  whitespace-prefix bypasses.
- `sanitizeHtml(input, opts)` is a small, conservative tokeniser that
  drops dangerous container tags (`script`, `style`, `iframe`,
  `object`, `embed`, `noscript`, `template`) along with their children;
  strips `on*` event handlers; rejects `href` / `src` values whose
  protocol is not in the allow-list; and HTML-escapes stray text.
- `markTextAsSafe(input)` HTML-escapes a string and brands it as
  `SafeRender` so `dangerouslySetInnerHTML` / `innerHTML` consumers
  refuse anything that has not been through a sanitizer.

> **This is not a full HTML5 sanitizer.** For arbitrary rich-text from
> third parties, use DOMPurify and render inside a `sandbox=""` iframe.

### 2.5 Memory integrity

- `MemoryIntegrityGuard` enforces three policies in pure functions:
  1. **Consent tier.** Tier `NO_MEMORY` blocks every write. Each domain
     has a minimum tier for write (`visitor`, `ideas`, `social` require
     `CONSENTED`; the rest require `ANONYMOUS`).
  2. **Actor role.** `class_notes` and `tech_pulse` are admin-write
     only. Visitor and site actors are rejected.
  3. **Cross-domain read ACL.** A read from owner domain `O` by reader
     domain `R` is allowed only if `R` is in
     `DEFAULT_DOMAIN_READ_ACL[O]`. The default ACL keeps `visitor`
     strictly isolated.
- All three checks return `Result<{ allowed: true }, AWAFError>` with
  a stable error code (`MEMORY_WRITE_BLOCKED_NO_CONSENT`,
  `MEMORY_WRITE_BLOCKED_TIER`, `MEMORY_WRITE_BLOCKED_ROLE`,
  `MEMORY_READ_BLOCKED_NO_CONSENT`, `MEMORY_READ_BLOCKED_ACL`) so the
  audit logger can report them verbatim.

### 2.6 Audit logging

- `AWAFAuditLogger` exposes one method per documented event category:
  `consent_changed`, `privacy_signal_detected`, `memory_write_blocked`,
  `memory_read_blocked`, `prompt_risk_detected`, `output_rejected`,
  `policy_version_changed`.
- Every event payload is passed through `redactPIIDeep` before reaching
  the sink (configurable, default on). A failing sink can never break
  the host application — sink calls are wrapped in try / catch.
- The default `InMemoryAuditSink` is suitable for tests and SDK
  self-checks. Production deployments should provide their own
  append-only, tamper-evident sink.

---

## 3. OWASP LLM Top 10 alignment

The table below records *partial alignment* — i.e., where AWAF ships a
control that mitigates **some** of the risk in each category. It is not
a compliance claim.

| OWASP risk                            | What AWAF does                                                                                            | What AWAF does **not** do                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **LLM01** Prompt Injection            | `detectPromptRisk` heuristics + `block`/`review` actions, audit event `prompt_risk_detected`.             | LLM-side sandboxing, fine-grained tool gating, model-specific guards.    |
| **LLM02** Insecure Output Handling    | `sanitizeHtml`, `validateUrl`, `markTextAsSafe`, branded `SafeRender` type.                               | DOMPurify-grade HTML5 parsing, iframe sandboxing, response streaming.    |
| **LLM03** Training Data Poisoning     | Memory ACL keeps `class_notes` / `tech_pulse` admin-only.                                                 | Provenance-chain tracking, training-data validation.                     |
| **LLM04** Model Denial of Service     | —                                                                                                         | Cost guardian, token-budget circuit breaker (planned).                   |
| **LLM05** Supply-chain Vulnerabilities| Zero runtime dependencies in `@awaf/security`; CI runs lockfile checks.                                   | SBOM publication, provenance attestation.                                |
| **LLM06** Sensitive Info Disclosure   | `redactPII`, audit-logger redaction-by-default, `MemoryIntegrityGuard` cross-domain read ACL.             | Server-side DLP, encrypted storage at rest.                              |
| **LLM07** Insecure Plugin Design      | Output validation rejects `javascript:`, `data:`, `file:`, `vbscript:` URLs.                              | Plugin / tool authorization, rate limits.                                |
| **LLM08** Excessive Agency            | Consent tiers gate all personalization and memory writes.                                                 | Action-confirmation UI, undo / right-to-erasure flow (partially planned).|
| **LLM09** Overreliance                | `detectPromptRisk` returns explanation strings for human review.                                          | Confidence-scoring of model outputs.                                     |
| **LLM10** Model Theft                 | —                                                                                                         | Watermarking, request signing.                                           |

---

## 4. NIST AI RMF 1.0 alignment

`@awaf/security` partially supports the *MEASURE* and *MANAGE*
functions of the AI RMF 1.0 by emitting structured audit events
(`prompt_risk_detected`, `memory_write_blocked`, `output_rejected`)
that downstream tooling can aggregate to compute the metrics required
by the framework.

A formal mapping table linking AWAF audit events to specific RMF
sub-categories is **planned** (see [`docs/ROADMAP.md`](ROADMAP.md))
and will live alongside the existing privacy model document. Until
that mapping is published, do not represent AWAF as RMF-aligned in
public messaging.

---

## 5. Recommended deployment practices

1. **Treat `@awaf/security` as one layer.** Always combine with: a
   server-side authentication / authorization layer, server-side
   rate-limiting, and a vetted HTML sanitizer (DOMPurify in a sandboxed
   iframe) for any *untrusted* rich text.
2. **Run audit logs through a durable sink.** The provided
   `InMemoryAuditSink` is a developer convenience. Production
   deployments must persist events to an append-only, tamper-evident
   store (e.g., AWS QLDB, GCP Cloud Audit Logs, or a signed log
   pipeline).
3. **Refresh `DEFAULT_POLICY_VERSION` whenever the privacy policy
   changes** and call `ConsentTierManager.invalidateOnPolicyChange`
   in the consent flow. Stale consent under an old policy version is a
   compliance hazard.
4. **Wire `MemoryIntegrityGuard` at the storage boundary.** Call
   `canWrite` immediately before any `setItem` / DB insert, and `canRead`
   before any cross-domain query. When a check fails, emit
   `memoryWriteBlocked` / `memoryReadBlocked` and return the structured
   error to the caller.
5. **Treat `redactPII` as best-effort.** For high-stakes flows, run a
   server-side DLP tool on the payload before durable storage.
6. **Tune prompt-injection thresholds per surface.** A search box can
   afford `block` at `high`; a power-user "instruction" textarea may
   warrant a stricter `medium` threshold.
7. **Never store raw prompts or raw model output in audit logs.** The
   audit logger redacts strings, but the *category* is the right place
   for security-relevant metadata — not the raw payload.

---

## 6. Wiring guide

### 6.1 Consent check before memory writes

```ts
import { MemoryIntegrityGuard, AWAFAuditLogger } from '@awaf/security';

const guard = new MemoryIntegrityGuard();
const audit = new AWAFAuditLogger({ sink: mySink });

const decision = guard.canWrite({
  domain: 'visitor',
  consentTier: currentTier,
  actorRole: 'visitor',
});

if (!decision.success) {
  audit.memoryWriteBlocked({
    domain: 'visitor',
    consentTier: currentTier,
    errorCode: decision.error.code,
    reason: decision.error.message,
  });
  return decision; // bubble up the typed error
}

await storage.write('visitor', key, value);
```

### 6.2 PII redaction before audit logging

The audit logger does this for you by default. If you log directly
through your own pipeline:

```ts
import { redactPIIDeep } from '@awaf/security';

const safe = redactPIIDeep(errorPayload).value;
myLogger.error(safe);
```

### 6.3 Output validation before rendering

```tsx
import { sanitizeHtml, validateUrl } from '@awaf/security';

const html = sanitizeHtml(aiText);
if (!html.safe) return <FallbackPlainText value={aiText} />;
return <article dangerouslySetInnerHTML={{ __html: html.value }} />;

const url = validateUrl(aiLinkHref);
if (!url.ok) return null;
return <a href={url.normalized} rel="noopener noreferrer">…</a>;
```

### 6.4 Prompt-risk gate before LLM invocation

```ts
import { detectPromptRisk } from '@awaf/security';

const r = detectPromptRisk(userInput);
if (r.action === 'block') {
  audit.promptRiskDetected({
    level: r.level,
    score: r.score,
    action: r.action,
    patterns: r.matches.map((m) => m.id),
  });
  return { error: 'High-risk input was blocked' };
}
```

---

## 7. Reporting security issues

See [`docs/SECURITY.md`](SECURITY.md) for the disclosure process.
Please do **not** open public issues for vulnerabilities.

---

*Document version: 1.0.0 — published alongside `@awaf/security` 1.0.0.*
