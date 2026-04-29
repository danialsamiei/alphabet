# معماری امنیت — Alphabet SDK
# Alphabet SDK Security Architecture

> **نسخه:** 1.0.0 | **طبقه‌بندی:** Security-Critical
> **استاندارد مرجع:** NIST AI 100-1, GDPR Art. 17, CCPA, ePrivacy Directive
> **زبان:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## فهرست مطالب

1. [نمای کلی معماری امنیت](#1-نمای-کلی)
2. [۸ دسته تهدید (Threat Categories)](#2-۸-دسته-تهدید)
3. [استراتژی Defense in Depth](#3-defense-in-depth)
4. [هم‌راستایی NIST AI 100-1](#4-nist-ai-100-1)
5. [نردبان رضایت و ماشین حالت (Consent Ladder)](#5-نردبان-رضایت)
6. [Isolation دامنه در Memory Mesh](#6-isolation-دامنه)
7. [Right to Erasure (GDPR/CCPA)](#7-right-to-erasure)
8. [مدیریت DNT/GPC](#8-dntgpc)
9. [Audit Logging](#9-audit-logging)
10. [چک‌لیست امنیتی برای توسعه‌دهندگان](#10-چک‌لیست-امنیتی)

---

## 1. نمای کلی

### ۱.۱ Statement امنیتی

> "Alphabet SDK با اصل **Privacy-by-Design** و **Security-by-Design** طراحی شده است. هیچ data ای بدون explicit consent جمع‌آوری نمی‌شود، هیچ data ای بدون anonymization aggregate نمی‌شود، و هیچ data ای بدون audit trail حذف نمی‌شود."

### ۱.۲ نمودار معماری امنیت

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: PERIMETER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Rate Limit   │  │ DNT/GPC      │  │ Input        │  │ CORS / CSP      │ │
│  │ (per IP/     │  │ Detection    │  │ Sanitization │  │ Headers         │ │
│  │  per visitor)│  │ (auto-tier   │  │ (XSS, inj)   │  │                 │ │
│  │              │  │  downgrade)  │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                        LAYER 2: AUTHENTICATION & AUTHORIZATION               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Bearer Token │  │ API Key      │  │ Consent Tier │  │ k-Anonymity     │ │
│  │ (per session)│  │ (per role)   │  │ Validation   │  │ Check           │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                        LAYER 3: DATA PROTECTION                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Encryption   │  │ Token Budget │  │ Domain       │  │ Right to        │ │
│  │ (in transit  │  │ (rate        │  │ Isolation    │  │ Erasure         │ │
│  │  + at rest)  │  │  limiting)   │  │ (7 domains)  │  │ (GDPR Art. 17)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                        LAYER 4: MONITORING & AUDIT                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Audit Log    │  │ Anomaly      │  │ Integrity    │  │ Transparency    │ │
│  │ (all ops)    │  │ Detection    │  │ Validation   │  │ Report          │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ۸ دسته تهدید

### تهدید ۰۱: Injection Attacks (XSS, SQLi, Command Injection)

| مشخصه | مقدار |
|-------|-------|
| ** severity** | Critical |
| ** Attack Vector** | User input در prompt template، query parameters، memory content |
| ** Mitigation** | Input sanitization قبل از هر LLM prompt؛ parameterized queries؛ HTML entity encoding |
| ** File مسئول** | `packages/security/src/sanitizers/input-sanitizer.ts` |

```typescript
// BEFORE (vulnerable):
const prompt = `User said: ${userInput}`;  // ⚠️ Prompt injection risk

// AFTER (secure):
import { sanitizeInput } from '@alphabet/security';
const safeInput = sanitizeInput(userInput);  // ✅ Escaped + validated
const prompt = `User said: ${safeInput}`;
```

**تست‌های امنیتی:**
- `<script>alert('xss')</script>` → sanitized
- `'; DROP TABLE users; --` → rejected
- `${process.env.SECRET}` → template literal injection blocked
- Unicode normalization attack → NFC normalized + validated

---

### تهدید ۰۲: LLM Prompt Injection

| مشخصه | مقدار |
|-------|-------|
| ** severity** | Critical |
| ** Attack Vector** | Crafted user input که system instructions را override می‌کند |
| ** Mitigation** | Strict prompt template با delimiters؛ input sandboxing؛ output validation |
| ** File مسئول** | `packages/core/src/decision/promptTemplate.ts` |

```typescript
// Prompt template با delimiter محکم:
const HANDSHAKE_PROMPT_TEMPLATE = `=== SYSTEM INSTRUCTIONS (DO NOT OVERRIDE) ===
You are a context analyzer. Output MUST be valid JSON.
Schema: {SCHEMA_PLACEHOLDER}

=== USER CONTEXT (SANITIZED) ===
{CONTEXT_PLACEHOLDER}

=== END CONTEXT ===

Generate UI config based ONLY on the provided context.`;
```

**防御策略:**
- System instructions با `===` delimiter جدا می‌شوند
- User input در بخش جداگانه قرار می‌گیرد
- Output validation با JSON Schema (Ajv/zod) انجام می‌شود
- Prompt caching فقط prefix cacheable است (system instructions)

---

### تهدید ۰۳: Data Exfiltration via Side Channels

| مشخصه | مقدار |
|-------|-------|
| ** severity** | High |
| ** Attack Vector** | Timing attacks, error message leakage, log exposure |
| ** Mitigation** | Constant-time comparison؛ generic error messages؛ structured logging بدون PII |
| ** File مسئول** | `packages/security/src/threats/side-channel.ts` |

**اقدامات:**
- Error message عمومی: "Authentication failed" (بدون تفکیک user not found vs wrong password)
- Timing normalization: تمام validation paths زمان مشابه consume کنند
- Log sanitization: هیچ PII در log level `info` و پایین‌تر

---

### تهدید ۰۴: Consent Bypass / Unauthorized Data Collection

| مشخصه | مقدار |
|-------|-------|
| ** severity** | Critical |
| ** Attack Vector** | تغییر tier بدون consent، نوشتن به domain بالاتر از tier فعلی |
| ** Mitigation** | ConsentTierManager با state machine؛ DomainFirewall با cross-domain write prevention |
| ** File مسئول** | `packages/core/src/memory/ConsentTierManager.ts`, `DomainFirewall.ts` |

```typescript
// DomainFirewall: Cross-domain write = NEVER
canWrite(fromDomain: MemoryDomain, toDomain: MemoryDomain): boolean {
  return fromDomain === toDomain;  // فقط write در domain خود مجاز
}
```

---

### تهدید ۰۵: Privilege Escalation via Token Manipulation

| مشخصه | مقدار |
|-------|-------|
| ** severity** | High |
| ** Attack Vector** | Token tampering، tier spoofing در request payload |
| ** Mitigation** | Server-side token validation؛ tier از token extract می‌شود (نه از client payload) |
| ** File مسئول** | `packages/security/src/threats/token-validation.ts` |

---

### تهدید ۰۶: Supply Chain Attack (Dependency Compromise)

| مشخصه | مقدار |
|-------|-------|
| ** severity** | High |
| ** Attack Vector** | Compromised npm package، malicious dependency |
| ** Mitigation** | pnpm lockfile integrity checking؛ minimal external dependencies؛ vendoring critical code |
| ** File مسئول** | `pnpm-lock.yaml`, `package.json` review process |

**اقدامات:**
- `pnpm install --frozen-lockfile` در CI
- Audit: `pnpm audit` در pipeline
- Zero runtime dependency در `@alphabet/core`

---

### تهدید ۰۷: Re-identification from Aggregated Data

| مشخصه | مقدار |
|-------|-------|
| ** severity** | High |
| ** Attack Vector** | k-anonymity violation در admin dashboard |
| ** Mitigation** | k-anonymity check قبل از aggregate؛ cell suppression؛ data generalization |
| ** File مسئول** | `packages/security/src/privacy/k-anonymity.ts` |

```typescript
// k-Anonymity check
function checkKAnonymity(records: AggregateRecord[], k: number = 5): KAnonymityResult {
  const quasiIdentifiers = ['country', 'language', 'deviceClass'];
  const groups = groupByQuasiIdentifiers(records, quasiIdentifiers);
  
  const violations = groups.filter(g => g.count < k);
  return {
    kValue: k,
    compliant: violations.length === 0,
    violations: violations.map(v => v.key),
  };
}
```

---

### تهدید ۰۸: Model Poisoning via Training Data Injection

| مشخصه | مقدار |
|-------|-------|
| ** severity** | Medium |
| ** Attack Vector** | Ingest malicious content به Memory Mesh که LLM behavior را poison می‌کند |
| ** Mitigation** | Provenance validation؛ trust tier scoring؛ content moderation pre-ingest |
| ** File مسئول** | `packages/core/src/claw/ProvenanceValidator.ts` |

```typescript
// Provenance validation
validateProvenance(source: SignalSource): ProvenanceResult {
  const checks = [
    this.validateDomainReputation(source.url),
    this.checkSSLCertificate(source.url),
    this.verifyCrossReferences(source),
    this.checkAgainstBlocklist(source),
  ];
  return { valid: checks.every(c => c.passed), checks };
}
```

---

## 3. استراتژی Defense in Depth

### ۳.۱ لایه‌های دفاع

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: PREVENTION — جلوگیری از وقوع attack                    │
│ • Input sanitization                                            │
│ • DNT/GPC auto-downgrade                                        │
│ • Consent tier validation                                       │
│ • Parameterized queries                                         │
│ • Strict TypeScript (no any)                                    │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: DETECTION — تشخیص attack در حال وقوع                   │
│ • Anomaly detection on request patterns                         │
│ • Rate limit monitoring                                         │
│ • Consent state auditing                                        │
│ • Prompt injection heuristics                                   │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: RESPONSE — پاسخ به attack شناسایی‌شده                  │
│ • Circuit breaker                                               │
│ • Tier downgrade automatic                                      │
│ • Session invalidation                                          │
│ • Alert to admin                                                │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 4: RECOVERY — بازیابی پس از attack                        │
│ • Rollback manager                                              │
│ • Data integrity audit                                          │
│ • GDPR breach notification                                      │
│ • Forensic logging                                              │
└─────────────────────────────────────────────────────────────────┘
```

### ۳.۲ نمودار Defense in Depth — Handshake Flow

```
Visitor
  │
  ├── [Perimeter] DNT/GPC check ──▶ Tier 0 downgrade (if enabled)
  │
  ├── [Perimeter] Rate limit check ──▶ 429 (if exceeded)
  │
  ├── [Prevention] Input sanitization ──▶ Sanitized signals
  │
  ├── [Detection] Anomaly: language != geo ──▶ Log warning
  │
  ├── [Prevention] Consent tier validation ──▶ Block if insufficient
  │
  ├── [Detection] Prompt injection heuristic ──▶ Block + alert
  │
  ├── [Prevention] DomainFirewall ──▶ Block cross-domain write
  │
  └── [Recovery] Audit log ──▶ Immutable log entry
```

---

## 4. هم‌راستایی NIST AI 100-1

### ۴.۱ نقشه NIST AI RMF (Risk Management Framework)

| NIST AI 100-1 Function | Alphabet Implementation | فایل/ماژول |
|-----------------------|-------------------|------------|
| **GOVERN** | Consent management system + audit trail | `ConsentTierManager.ts` |
| **MAP** | Threat model with 8 categories + risk scoring | `security/src/threats/` |
| **MEASURE** | k-anonymity checks + coverage metrics + performance monitoring | `k-anonymity.ts` |
| **MANAGE** | Risk response: mitigate/accept/transfer/avoid per threat | `threat-register.md` |

### ۴.۲ نگاشت NIST Functions به کد

```
GOVERN  ──────────────────────────────────────────────────
  ├── Map-1.1: Context establishment  →  AlphabetConfig class
  ├── Map-1.2: Categorize AI system   →  UILayer enum (1-5)
  ├── Govern-1.1: Legal compliance    →  GDPR/CCPA alignment
  └── Govern-1.2: Risk management     →  Threat register (8 categories)

MAP     ──────────────────────────────────────────────────
  ├── Map-2.1: Identify risks         →  8 threat categories
  ├── Map-2.2: Assess impacts         →  Severity scoring per threat
  └── Map-2.3: Map to components      →  Component-threat matrix

MEASURE ──────────────────────────────────────────────────
  ├── Measure-3.1: Identify metrics   →  Coverage, k-anonymity, latency
  ├── Measure-3.2: Evaluate risks     →  Pre/post mitigation scoring
  └── Measure-3.3: Track metrics      →  Dashboard + CI integration

MANAGE  ──────────────────────────────────────────────────
  ├── Manage-4.1: Respond to risks    →  Mitigation per threat
  ├── Manage-4.2: Incident response   →  Rollback + notification
  └── Manage-4.3: Risk communication  →  Transparency report
```

### ۴.۳ Control Mapping NIST → Alphabet

| NIST Control | Alphabet Control | پیاده‌سازی |
|-------------|-------------|------------|
| AI RMF GOVERN 1.1 | Consent Policy | `ConsentTierManager` |
| AI RMF GOVERN 1.2 | Legal Mapping | `GDPR Art. 17 implementation` |
| AI RMF GOVERN 2.1 | Risk Tolerance | Threat severity thresholds |
| AI RMF MAP 1.1 | System Context | `AlphabetConfig` + env vars |
| AI RMF MAP 1.2 | AI System Category | `UILayer` + `CapabilityLayer` |
| AI RMF MAP 2.1 | Risk Identification | 8 threat categories |
| AI RMF MEASURE 1.1 | Metrics Selection | Coverage + k-anonymity + latency |
| AI RMF MEASURE 2.1 | Evaluation Frequency | CI pipeline + daily audit |
| AI RMF MANAGE 1.1 | Risk Response | Mitigation per threat file |
| AI RMF MANAGE 2.1 | Incident Response | Rollback + notification + forensic log |

---

## 5. نردبان رضایت و ماشین حالت (Consent Ladder)

### ۵.۱ ماشین حالت Consent

```
                    ┌──────────────────────┐
                    │                      │
                    ▼                      │
┌─────────┐    grant    ┌─────────┐   revoke  ┌─────────┐
│ PENDING │────────────▶│ GRANTED │─────────▶│ REVOKED │
└────┬────┘             └────┬────┘          └────┬────┘
     │                       │                    │
     │ auto (DNT/GPC)        │ upgrade            │ re-grant
     ▼                       ▼                    ▼
┌─────────┐             ┌─────────┐          ┌─────────┐
│  NO_    │             │ENRICHED │          │ PENDING │
│ MEMORY  │             │  (T3)   │          │ (retry) │
│  (T0)   │             │         │          │         │
└─────────┘             └─────────┘          └─────────┘
     ▲
     │ downgrade (revoke)
     │
┌─────────┐             ┌─────────┐
│ANONYMOUS│◄───────────▶│CONSENTED│
│  (T1)   │  upgrade    │  (T2)   │
└─────────┘             └─────────┘
```

### ۵.۲ State Transitions

| از | به | Trigger | شرط |
|----|----|---------|-----|
| `PENDING` | `GRANTED` | `grant()` | User explicit consent |
| `PENDING` | `NO_MEMORY` | `auto-downgrade` | DNT/GPC detected |
| `GRANTED` | `REVOKED` | `revoke()` | User explicit revoke |
| `GRANTED` | `ENRICHED` | `upgrade(tier=3)` | Admin approval + user grant |
| `CONSENTED` | `ANONYMOUS` | `downgrade()` | User requests less storage |
| `ANONYMOUS` | `NO_MEMORY` | `revoke()` | Complete opt-out |
| `REVOKED` | `PENDING` | `re-request` | User re-engages |

### ۵.۳ Consent Validation در Runtime

```typescript
function validateOperation(
  operation: MemoryOperation,
  visitorConsent: VisitorConsent,
  targetDomain: MemoryDomain
): Result<void, ConsentError> {
  // ۱. بررسی state
  if (visitorConsent.state === 'revoked') {
    return err({ code: 'CONSENT_REVOKED', message: 'Consent has been revoked' });
  }

  // ۲. بررسی tier برای domain
  const requiredTier = DOMAIN_TIER_MAP[targetDomain];
  if (!tierMeetsRequirement(visitorConsent.consentTier, requiredTier)) {
    return err({ code: 'CONSENT_TIER_INSUFFICIENT', message: `Tier ${requiredTier} required` });
  }

  // ۳. بررسی expiration
  if (visitorConsent.expiresAt && new Date(visitorConsent.expiresAt) < new Date()) {
    return err({ code: 'CONSENT_EXPIRED', message: 'Consent has expired' });
  }

  // ۴. بررسی DNT/GPC
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) {
    return err({ code: 'DNT_ENABLED', message: 'Do Not Track is enabled' });
  }

  return ok(undefined);
}
```

---

## 6. Isolation دامنه در Memory Mesh

### ۶.۱ اصل Domain Isolation

> **Cross-domain write = NEVER.** Cross-domain read = gate-based (consent + tier).

### ۶.۲ Domain Matrix

| Domain | Trust Level | TTL | Write Source | Cross-Read | Collection |
|--------|------------|-----|-------------|------------|------------|
| `general` | T1 | ۳۶۵d | Admin | site, ideas | `general_mem` |
| `site_specific` | T1 | ۱۸۰d | Site Owner | general | `site_mem` |
| `visitor` | T2 | ۹۰d | Visitor | — (self) | `visitor_mem` |
| `class_notes` | T1 | ۳۶۵d | Instructor | visitor* | `class_mem` |
| `ideas` | T1 | ۳۶۵d | Dual-sign | general | `ideas_mem` |
| `social` | T3 | ۳۰d | Scraper | — (none) | `social_mem` |
| `tech_pulse` | T1-T2 | ۱۴d | Curator | site, gen | `tech_pulse` |

*با consent显式

### ۶.۳ DomainFirewall Implementation

```typescript
export class DomainFirewall {
  // Write: فقط در domain خود
  canWrite(fromDomain: MemoryDomain, toDomain: MemoryDomain): boolean {
    return fromDomain === toDomain;
  }

  // Read: gate-based
  canRead(
    fromDomain: MemoryDomain,
    toDomain: MemoryDomain,
    consent: VisitorConsent
  ): boolean {
    // خواندن از domain خود همیشه مجاز
    if (fromDomain === toDomain) return true;

    // Cross-domain read نیاز به consent + tier دارد
    const allowedCrossReads = CROSS_READ_MAP[fromDomain];
    if (!allowedCrossReads?.includes(toDomain)) return false;

    // بررسی tier
    const requiredTier = DOMAIN_TIER_MAP[toDomain];
    return tierMeetsRequirement(consent.consentTier, requiredTier);
  }
}
```

### ۶.۴ نمودار Isolation

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   general    │◄────│  site_owner  │     │   visitor    │
│   (admin)    │────►│  (site_mem)  │     │  (self)      │
└──────┬───────┘     └──────────────┘     └──────┬───────┘
       │                                          │
       │         ┌──────────────────┐             │
       └────────►│   DomainFirewall │◄────────────┘
                 │  (gate-based)    │
       ┌────────►│                  │◄────────────┐
       │         └──────────────────┘             │
┌──────┴───────┐     ┌──────────────┐     ┌──────┴───────┐
│    ideas     │     │ class_notes  │     │   curator    │
│  (dual-sign) │     │ (instructor) │     │  (tech_pulse)│
└──────────────┘     └──────────────┘     └──────────────┘

social ──► NO cross-read (isolated)
```

---

## 7. Right to Erasure (GDPR Art. 17 / CCPA)

### ۷.۱ پیاده‌سازی

```typescript
// Endpoint: DELETE /api/visitor/memory
export async function eraseVisitorMemory(
  request: EraseMemoryRequest
): Promise<Result<EraseMemoryResponse, AlphabetError>> {
  // ۱. احراز هویت
  const auth = await authenticate(request.visitorId, request.sessionId);
  if (!auth.success) return err(AUTH_ERROR);

  // ۲. تأیید دو مرحله‌ای
  const confirmation = await validateConfirmationToken(request.confirmationToken);
  if (!confirmation.valid) return err(INVALID_TOKEN_ERROR);

  // ۳. تعیین scope حذف
  let memoriesToDelete: string[];
  switch (request.scope) {
    case 'all':
      memoriesToDelete = await getAllMemoryIds(request.visitorId);
      break;
    case 'domain':
      memoriesToDelete = await getMemoryIdsByDomain(request.visitorId, request.domain!);
      break;
    case 'specific':
      memoriesToDelete = request.memoryIds!;
      break;
  }

  // ۴. Audit log قبل از حذف
  await auditLog.record({
    action: 'ERASE_REQUEST',
    visitorId: request.visitorId,
    scope: request.scope,
    reason: request.reason,
    memoryCount: memoriesToDelete.length,
    timestamp: new Date().toISOString(),
  });

  // ۵. حذف
  const deletedIds = await memoryStore.deleteMany(memoriesToDelete);

  // ۶. تأیید حذف
  await auditLog.record({
    action: 'ERASE_COMPLETE',
    visitorId: request.visitorId,
    deletedCount: deletedIds.length,
    confirmationId: generateConfirmationId(),
  });

  return ok({
    success: true,
    deletedCount: deletedIds.length,
    deletedIds,
    confirmationId: generateConfirmationId(),
    gdprReceipt: {
      article: 'GDPR Art. 17',
      processingDate: new Date().toISOString(),
      retentionDaysRemaining: 0,
      thirdPartyNotifications: [],
    },
  });
}
```

### ۷.۲ مراحل Erasure

```
[User Request]
    │
    ├── ۱. Identity Verification ──▶ Confirm visitor identity
    │
    ├── ۲. Confirmation Token ──▶ Email/SMS verification
    │
    ├── ۳. Scope Selection ──▶ all / domain / specific
    │
    ├── ۴. Pre-Erase Audit ──▶ Immutable log entry
    │
    ├── ۵. Data Deletion ──▶ Soft delete → hard delete (۷d grace)
    │
    ├── ۶. Third-Party Notification ──▶ Inform data processors
    │
    ├── ۷. Post-Erase Audit ──▶ Confirmation log
    │
    └── ۸. GDPR Receipt ──▶ User receives confirmation
```

---

## 8. مدیریت DNT/GPC

### ۸.۱ Do Not Track (DNT) Signal

| سیگنال | مقدار | رفتار Alphabet |
|--------|-------|------------|
| `navigator.doNotTrack` | `'1'` | Auto-downgrade به Tier 0 |
| `navigator.doNotTrack` | `'0'` | Normal behavior |
| `navigator.doNotTrack` | `null` | Check GPC |

### ۸.۲ Global Privacy Control (GPC)

| سیگنال | مقدار | رفتار Alphabet |
|--------|-------|------------|
| `navigator.globalPrivacyControl` | `true` | Auto-downgrade به Tier 0 |
| `navigator.globalPrivacyControl` | `false` | Normal behavior |

### ۸.۳ پیاده‌سازی

```typescript
export function checkPrivacySignals(): PrivacySignalResult {
  const dnt = navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes';
  const gpc = !!(navigator as any).globalPrivacyControl;

  if (dnt || gpc) {
    return {
      downgradeRequired: true,
      targetTier: 'NO_MEMORY',
      reason: dnt ? 'DNT_ENABLED' : 'GPC_ENABLED',
      signals: { dnt, gpc },
    };
  }

  return {
    downgradeRequired: false,
    targetTier: null,
    reason: null,
    signals: { dnt, gpc },
  };
}
```

### ۸.۴ Flowchart DNT/GPC

```
┌──────────────┐
│ Visitor      │
│ arrives      │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ SignalCollector      │
│ detects DNT/GPC?     │
└──────┬───────┬───────┘
       │       │
     Yes│       │No
       ▼       ▼
┌──────────┐  ┌──────────────┐
│ Set tier │  │ Continue with│
│ = T0     │  │ detected tier│
│ NO_MEMORY│  │              │
└────┬─────┘  └──────┬───────┘
     │               │
     ▼               ▼
┌──────────────────────────┐
│ Log privacy signal       │
│ (audit trail)            │
└──────────────────────────┘
```

---

## 9. Audit Logging

### ۹.۱ ساختار Audit Log

```typescript
interface AuditLogEntry {
  entryId: string;              // ULID
  timestamp: string;            // ISO 8601
  action: AuditAction;
  actor: {
    type: 'visitor' | 'admin' | 'system' | 'ai-agent';
    id: string;                 // hashed
    ipHash?: string;            // SHA-256 hashed IP
  };
  resource: {
    type: 'memory' | 'consent' | 'config' | 'visitor' | 'source';
    id: string;                 // hashed resource ID
  };
  result: 'success' | 'failure' | 'blocked';
  details: Record<string, unknown>;  // sanitized — no PII
  gdprCategory?: 'data_access' | 'data_deletion' | 'consent_change' | 'breach';
}
```

### ۹.۲ Events Audit‌شده

| Action | Actor | Resource | GDPR Category |
|--------|-------|----------|---------------|
| `CONSENT_GRANTED` | Visitor | Consent | consent_change |
| `CONSENT_REVOKED` | Visitor | Consent | consent_change |
| `CONSENT_UPGRADED` | Visitor | Consent | consent_change |
| `MEMORY_STORED` | Visitor/System | Memory | data_access |
| `MEMORY_RETRIEVED` | Visitor | Memory | data_access |
| `MEMORY_ERASED` | Visitor | Memory | data_deletion |
| `ADMIN_AUDIT` | Admin | Visitor | data_access |
| `SOURCE_INGESTED` | Curator | Source | data_access |
| `PRIVACY_SIGNAL` | System | Visitor | — |
| `TIER_DOWNGRADE` | System | Visitor | — |
| `ANOMALY_DETECTED` | System | — | breach |

### ۹.۳ Requirements Audit Logging

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Immutability** | ✅ | Write-once log store (append-only) |
| **Integrity** | ✅ | HMAC-SHA256 chain per entry |
| **Retention** | ✅ | ۲ سال (GDPR minimum) |
| **Encryption** | ✅ | AES-256 at rest |
| **Access Control** | ✅ | Admin-only read, system-only write |
| **PII Sanitization** | ✅ | هیچ PII plaintext در log |
| **Export** | ✅ | GDPR Art. 20 format support |
| **Alerting** | ✅ | Anomaly-based alerts |

### ۹.۴ نمونه Audit Log Chain

```
Entry 1: CONSENT_GRANTED
  hash: SHA256(entry1_data)
  prevHash: null (genesis)

Entry 2: MEMORY_STORED
  hash: SHA256(entry2_data + entry1_hash)
  prevHash: entry1_hash

Entry 3: CONSENT_REVOKED
  hash: SHA256(entry3_data + entry2_hash)
  prevHash: entry2_hash

[Tamper-proof chain — هر تغییر hash را invalidate می‌کند]
```

---

## 10. چک‌لیست امنیتی برای توسعه‌دهندگان

### ۱۰.۱ چک‌لیست Before Writing Code

- [ ] تهدیدهای مرتبط در threat model بررسی شده (۸ category)
- [ ] Privacy impact assessment انجام شده
- [ ] حداقل tier consent برای operation مشخص شده
- [ ] Audit log entry برای operation تعریف شده

### ۱۰.۲ چک‌لیست During Development

- [ ] Input sanitization برای همه user-controlled data
- [ ] No `any` type — type safety از injection جلوگیری می‌کند
- [ ] Brand types برای شناسه‌ها — type confusion prevention
- [ ] Result<T,E> — error handling explicit
- [ ] Parameterized queries — SQL injection prevention
- [ ] No sensitive data در error messages
- [ ] No PII در log level info و پایین‌تر

### ۱۰.۳ چک‌لیست Before Commit

- [ ] تست امنیتی برای vectorهای مرتبط نوشته شده
- [ ] `pnpm audit` صفر vulnerability
- [ ] Rate limit برای endpoint جدید تعریف شده
- [ ] Consent validation برای operation data اضافه شده
- [ ] Domain firewall rule برای domain جدید اضافه شده
- [ ] GDPR impact بررسی شده

### ۱۰.۴ چک‌لیست Code Review (Security)

- [ ] Security PR توسط ۲ reviewer بررسی شده
- [ ] Threat-10 mapping به‌روز شده
- [ ] تست‌های security pass
- [ ] No regression در تست‌های security قبلی
- [ ] Audit trail برای عملیات admin
- [ ] Privacy impact assessment موجود

---

*این سند بخشی از مستندات SDK Alphabet است. برای معماری کلی به ARCHITECTURE.md و برای قراردادهای کدنویسی به CODING_CONVENTIONS.md مراجعه کنید.*
