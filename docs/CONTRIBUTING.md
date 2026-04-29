# راهنمای مشارکت — Alphabet SDK
# Alphabet SDK Contributing Guide

> **نسخه:** 1.0.0 | **مخزن:** `github.com/danialsamiei/alphabet`
> **زبان:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## فهرست مطالب

1. [مدل مشارکت (Contribution Model)](#1-مدل-مشارکت)
2. [راه‌اندازی محیط توسعه](#2-راه‌اندازی-محیط-توسعه)
3. [استراتژی Branch (Branch Strategy)](#3-استراتژی-branch)
4. [قرارداد پیام Commit (Commit Message Conventions)](#4-قرارداد-پیام-commit)
5. [قوانین ویژه عامل‌های AI (AI Agent Rules)](#5-قوانین-ویژه-عاملهای-ai)
6. [نحوه نوشتن تست برای ماژول‌های جدید](#6-نحوه-نوشتن-تست)
7. [چک‌لیست Code Review](#7-چک‌لیست-code-review)
8. [فرایند Pull Request](#8-فرایند-pull-request)
9. [پرسش‌های متداول (FAQ)](#9-پرسشهای-متداول)

---

## 1. مدل مشارکت

### ۱.۱ سه نوع مشارکت

| نوع | شناسه | توضیح | نمونه |
|-----|-------|-------|-------|
| **Human Developer** | `human` | توسعه‌دهندگان انسانی | PR با signature GPG |
| **AI Agent (Kimi)** | `kimi` | عامل Kimi Code | PR با tag `[KIMI]` |
| **AI Agent (Other)** | `ai-agent` | سایر agentهای AI | PR با tag `[AI]` |

### ۱.۲ فلسفه مشارکت

> "هیچ کدبیس تنها مالکیت یک فرد نیست. هر خط کد — چه توسط انسان و چه توسط AI نوشته شود — باید توسط همان معیارهای کیفی سنجیده شود."

### ۱.۳ مالکیت کد

- کلیه مشارکت‌ها تحت MIT License منتشر می‌شوند
- هر مشارکت‌کننده (انسانی یا AI) باید DCO (Developer Certificate of Origin) را رعایت کند
- commit message باید شامل `Signed-off-by` باشد

---

## 2. راه‌اندازی محیط توسعه

### ۲.۱ پیش‌نیازها

```bash
# بررسی پیش‌نیازها
node --version   # >= 20.0.0
pnpm --version   # >= 9.0.0
git --version    # >= 2.40.0
```

### ۲.۲ Clone و Setup

```bash
# Fork مخزن (برای انسان‌ها)
git clone https://github.com/YOUR_USERNAME/alphabet.git
cd alphabet

# نصب وابستگی‌ها
pnpm install

# بررسی سلامت
pnpm typecheck
pnpm test
pnpm build
```

### ۲.۳ قبل از شروع کار

> **⚠️ مهم:** عامل‌های AI باید **ابتدا** فایل `AGENTS.md` را بخوانند. این فایل شامل context اختصاصی برای agent است.

```bash
# عامل‌های AI: همیشه AGENTS.md را بخوانید
cat AGENTS.md

# سپس این چک‌لیست را مرور کنید
cat CONTRIBUTING.md  # همین فایل
```

---

## 3. استراتژی Branch

### ۳.۱ ساختار Branchها

```
main
 │
 ├─── feature/context-handshake
 ├─── feature/memory-mesh-tier2
 ├─── feature/ui-layer-5-textonly
 ├─── fix/rate-limit-calculation
 ├─── docs/api-reference-update
 ├─── security/threat-model-update
 │
hotfix/ (فقط در emergency)
 ├─── hotfix/gdpr-consent-bypass
```

### ۳.۲ قوانین Branch

| نوع Branch | Prefix | مثال | توضیح |
|-----------|--------|------|-------|
| Feature | `feature/` | `feature/memory-mesh` | قابلیت جدید |
| Bug Fix | `fix/` | `fix/signal-collector-race` | رفع باگ |
| Documentation | `docs/` | `docs/security-standards` | به‌روزرسانی مستندات |
| Security | `security/` | `security/input-validation` | اصلاح امنیتی |
| Hotfix | `hotfix/` | `hotfix/consent-bypass` | اصلاح فوری emergency |
| Refactor | `refactor/` | `refactor/api-client` | بازنویسی بدون تغییر behavior |

### ۳.۳ قوانین main branch

- **هیچ commit مستقیماً روی `main` مجاز نیست**
- همه تغییرات از طریق Pull Request انجام می‌شوند
- هر PR نیاز به **حداقل ۱ review** دارد
- PRهای `security/` نیاز به **۲ review** دارند
- CI باید green باشد (typecheck + build + test)

### ۳.۴ Rebase vs Merge

```bash
# روش ترجیحی: rebase قبل از PR
git checkout feature/my-feature
git rebase main

# سپس push force
git push --force-with-lease origin feature/my-feature
```

---

## 4. قرارداد پیام Commit

### ۴.۱ فرمت پیام (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]

Signed-off-by: Name <email>
```

### ۴.۲ انواع Type

| Type | معنی | نمونه |
|------|------|-------|
| `feat` | قابلیت جدید | `feat(handshake): add IP-to-Geo enrichment` |
| `fix` | رفع باگ | `fix(memory): prevent Tier 0 write to Tier 2` |
| `docs` | تغییر مستندات | `docs(api): add rate limit notes to all endpoints` |
| `style` | تغییرات formatting | `style(types): fix indentation in interfaces` |
| `refactor` | بازنویسی کد | `refactor(api): extract retry logic to decorator` |
| `test` | تست جدید یا اصلاح | `test(handshake): add integration tests for DNT flow` |
| `chore` | تغییرات build/tooling | `chore(deps): upgrade vitest to v1.5` |
| `security` | اصلاح امنیتی | `security(xss): sanitize user input in interact endpoint` |
| `perf` | بهبود performance | `perf(cache): reduce prompt cache lookup by 40%` |

### ۴.۳ Scopes مجاز

```
core, api, ui, protocols, security, memory, handshake, types,
config, logger, events, signals, enrichment, decision, streaming,
tech-pulse, claw, admin, deps, build, ci, docs
```

### ۴.۴ نمونه پیام‌های Commit

```
feat(memory): implement Tier2ProfileStore with consent validation

- Store explicit preferences with localStorage sync
- Validate consent tier before cross-session storage
- Add source tracking for transparency report

Signed-off-by: Alphabet Bot <bot@alphabet.dev>
```

```
fix(handshake): handle null timezone from Client Hints

When navigator.language is set but Intl.DateTimeFormat
returns null for timeZone, fallback to UTC with a warning.

Fixes #42
Signed-off-by: Alphabet Bot <bot@alphabet.dev>
```

```
security(threat-03): prevent prompt injection via input sanitization

- Add input sanitizer before LLM prompt template
- Escape all user-controlled variables
- Add test cases for 5 injection vectors

BREAKING CHANGE: postInteract now requires input validation
Signed-off-by: Alphabet Bot <bot@alphabet.dev>
```

---

## 5. قوانین ویژه عامل‌های AI

### ۵.۱ قوانین طلایی (Golden Rules)

> **هر عامل AI قبل از هر commit باید موارد زیر را اجرا کند:**

| # | قانون | الزام | پیامد عدم رعایت |
|---|-------|-------|-----------------|
| ۱ | **همیشه AGENTS.md بخوانید** | قبل از شروع هر task | Loss of context مهم |
| ۲ | **Build باید pass شود** | `pnpm build` صفر error | PR رد می‌شود |
| ۳ | **Typecheck باید clean باشد** | `pnpm typecheck` صفر error | PR رد می‌شود |
| ۴ | **No `any`** | استفاده از `unknown` یا تایپ صریح | Error TypeScript |
| ۵ | **Result<T,E>** | تمام APIها باید Result<T,E> return کنند | Breaking pattern |
| ۶ | **ترتیب فایل‌ها** | ایجاد بر اساس وابستگی | Circular dependency |
| ۷ | **Brand Types** | شناسه‌ها باید Brand Type باشند | Type confusion |
| ۸ | **JSDoc** | توابع public باید JSDoc داشته باشند | Doc gap |
| ۹ | **Test همراه کد** | هر ماژول جدید = تست همراه | Coverage drop |
| ۱۰ | **Changeset** | تغییر API = changeset جدید | Version drift |

### ۵.۲ ترتیب ایجاد فایل‌ها (File Creation Order)

عامل AI باید فایل‌ها را به ترتیب زیر ایجاد کند:

```
فاز ۱: Types (پایه‌ترین — هیچ وابستگی داخلی)
├── src/types/base.ts           → Enums (ConsentTier, MemoryDomain, UILayer, ...)
├── src/types/brands.ts         → Brand Types (VisitorId, SessionId, MemoryId)
├── src/types/result.ts         → Result<T,E> pattern
├── src/types/visitor.ts        → VisitorContext, VisitorConsent, VisitorPreference
├── src/types/api.ts            → AlphabetRequest, AlphabetResponse, TokenBudget
├── src/types/memory.ts         → VisitorMemory, TechnologySignal
└── src/types/index.ts          → Re-exports

فاز ۲: Infrastructure
├── src/config/alphabet-config.ts   → AlphabetConfig class
├── src/logger/alphabet-logger.ts   → AlphabetLogger (۴ سطح)
└── src/events/alphabet-events.ts   → AlphabetEventEmitter

فاز ۳: Signals & Enrichment
├── src/signals/SignalCollector.ts
├── src/enrichment/EnrichmentPipeline.ts

فاز ۴: Decision & Handshake
├── src/decision/HandshakeDecisionEngine.ts
├── src/decision/UIConfigGenerator.ts
└── src/handshake/ContextHandshakeClient.ts

فاز ۵: API Client
├── src/client/http-client.ts
└── src/endpoints/*.ts          → ۱۶ endpoint

فاز ۶: Memory Mesh
├── src/memory/Tier0PassiveHandler.ts
├── src/memory/Tier1SessionStore.ts
├── src/memory/ConsentTierManager.ts
├── src/memory/Tier2ProfileStore.ts
├── src/memory/DomainFirewall.ts
└── src/claw/OpenClawClient.ts
```

### ۵.۳ چک‌لیست Pre-Commit برای AI Agents

```markdown
- [ ] فایل AGENTS.md خوانده شده
- [ ] تمام فایل‌های ویرایش‌شده با read_file خوانده شده‌اند
- [ ] pnpm typecheck → صفر error
- [ ] pnpm build → موفق
- [ ] pnpm test → همه pass
- [ ] هیچ `any` در کد جدید وجود ندارد
- [ ] Brand types برای شناسه‌ها استفاده شده
- [ ] Result<T,E> برای توابع public
- [ ] JSDoc برای توابع و کلاس‌های public
- [ ] تست برای ماژول‌های جدید نوشته شده
- [ ] Changeset ایجاد شده (در صورت تغییر API)
- [ ] Commit message از فرمت conventional پیروی می‌کند
```

### ۵.۴ مدیریت Context Window برای AI Agents

- هر فایل حداکثر **۵۰۰ خط** — در صورت بزرگتر، split کنید
- فایل‌های بزرگتر از **۳۰۰ خط** با `<split_point>` مشخص شوند
- هر فایل در یک **context unit جداگانه** ویرایش شود
- فایل‌های root (package.json, tsconfig) در ابتدای هر session لود شوند
- dependencyهای فایل قبل از ویرایش باید **کامیت شده** باشند

### ۵.۵ نمونه Session کاری یک AI Agent

```
[Session Start]
├── ۱. خواندن AGENTS.md
├── ۲. خواندن فایل‌های مرتبط (read_file)
├── ۳. بررسی وضعیت فعلی (git status)
├── ۴. ایجاد branch جدید: feature/memory-tier2
├── ۵. نوشتن کد جدید
│   ├── ۵.۱ src/memory/ConsentTierManager.ts
│   ├── ۵.۲ src/memory/Tier2ProfileStore.ts
│   └── ۵.۳ src/memory/Tier2ProfileStore.test.ts
├── ۶. اجرای typecheck → fix errors
├── ۷. اجرای build → fix errors
├── ۸. اجرای test → fix failures
├── ۹. نوشتن changeset
├── ۱۰. commit با conventional message
└── ۱۱. push + PR description
```

---

## 6. نحوه نوشتن تست برای ماژول‌های جدید

### ۶.۱ اصول کلی تست‌نویسی

- **هر ماژول جدید باید حداقل یک فایل تست همراه داشته باشد**
- **Coverage حداقل ۸۰%** برای statements و functions
- **Test naming باید توصیفی باشد**: `should <expected behavior> when <condition>`
- **Pattern**: Arrange → Act → Assert

### ۶.۲ ساختار فایل تست

```
src/
├── memory/
│   ├── Tier2ProfileStore.ts
│   └── Tier2ProfileStore.test.ts   # ← کنار فایل اصلی
```

### ۶.۳ الگوی تست استاندارد

```typescript
// src/memory/Tier2ProfileStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Tier2ProfileStore } from './Tier2ProfileStore';
import { ConsentTierManager } from './ConsentTierManager';
import type { VisitorConsent } from '../types';

describe('Tier2ProfileStore', () => {
  let store: Tier2ProfileStore;
  let consentManager: ConsentTierManager;

  beforeEach(() => {
    consentManager = new ConsentTierManager();
    store = new Tier2ProfileStore(consentManager);
  });

  // ── Positive tests ──
  describe('storeProfile', () => {
    it('should store profile when consent tier is CONSENTED', () => {
      // Arrange
      const consent: VisitorConsent = {
        visitorId: 'v-test-001',
        consentTier: 'CONSENTED',
        state: 'granted',
        grantedAt: new Date().toISOString(),
        purposes: [{ id: 'profile', name: 'Profile Storage', description: 'Store preferences', granted: true }],
      };

      // Act
      const result = store.storeProfile({
        visitorId: 'v-test-001',
        language: 'fa',
        topics: ['AI', 'privacy'],
        contentDepth: 'expert',
      }, consent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.language).toBe('fa');
    });

    it('should reject profile storage when consent tier is ANONYMOUS', () => {
      const consent: VisitorConsent = {
        visitorId: 'v-test-001',
        consentTier: 'ANONYMOUS',
        state: 'granted',
      };

      const result = store.storeProfile({
        visitorId: 'v-test-001',
        language: 'fa',
      }, consent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONSENT_TIER_INSUFFICIENT');
    });
  });

  // ── Negative tests ──
  describe('error handling', () => {
    it('should return error when visitorId is empty', () => {
      const result = store.storeProfile({
        visitorId: '',
        language: 'fa',
      } as any, {} as any);

      expect(result.success).toBe(false);
    });
  });

  // ── Edge cases ──
  describe('edge cases', () => {
    it('should handle empty topics array', () => {
      const consent: VisitorConsent = {
        visitorId: 'v-test-001',
        consentTier: 'CONSENTED',
        state: 'granted',
      };

      const result = store.storeProfile({
        visitorId: 'v-test-001',
        language: 'en',
        topics: [],
      }, consent);

      expect(result.success).toBe(true);
      expect(result.data?.topics).toEqual([]);
    });
  });
});
```

### ۶.۴ Mocking وابستگی‌ها

```typescript
// Mock کردن fetch برای تست API client
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

it('should retry on 429 rate limit', async () => {
  mockFetch
    .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

  const result = await postHandshake(validRequest);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(result.success).toBe(true);
});
```

### ۶.۵ تست‌های امنیتی (Security Tests)

```typescript
describe('security', () => {
  it('should sanitize XSS payload in message', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const result = await sanitizeInput(xssPayload);
    expect(result).not.toContain('<script>');
  });

  it('should downgrade to Tier 0 when DNT is enabled', async () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const result = await determineConsentTier();
    expect(result).toBe('NO_MEMORY');
  });

  it('should block cross-domain memory write', () => {
    const result = domainFirewall.canWrite('visitor', 'site_specific');
    expect(result).toBe(false);
  });
});
```

---

## 7. چک‌لیست Code Review

### ۷.۱ چک‌لیست کلی (All PRs)

| # | چک | انتظار | اولویت |
|---|-----|--------|--------|
| ۱ | CI Green | typecheck + build + test همه pass | 🔴 Blocker |
| ۲ | Coverage | Coverage drop > ۲% ممنوع | 🔴 Blocker |
| ۳ | No `any` | هیچ `any` در کد جدید | 🔴 Blocker |
| ۴ | Brand Types | شناسه‌ها Brand Type باشند | 🔴 Blocker |
| ۵ | Result Pattern | توابع public از Result<T,E> استفاده کنند | 🔴 Blocker |
| ۶ | JSDoc | توابع public JSDoc داشته باشند | 🟡 Required |
| ۷ | Error Handling | همه مسیرهای error مدیریت شده | 🟡 Required |
| ۸ | Logging | Operationهای مهم log شوند | 🟡 Required |
| ۹ | Naming | kebab-case فایل، PascalCase کلاس | 🟡 Required |
| ۱۰ | Tests | تست برای منطق جدید وجود دارد | 🔴 Blocker |
| ۱۱ | Changeset | تغییر API دارای changeset است | 🟡 Required |
| ۱۲ | Security | Input sanitization برای داده کاربر | 🔴 Blocker |
| ۱۳ | Privacy | GDPR/ePrivacy compliance بررسی شده | 🔴 Blocker |
| ۱۴ | Performance | Hot path تحلیل performance شده | 🟢 Recommended |
| ۱۵ | Accessibility | UI changes با a11y بررسی شده | 🟢 Recommended |

### ۷.۲ چک‌لیست اختصاصی Security PRs

| # | چک | انتظار | اولویت |
|---|-----|--------|--------|
| ۱ | Threat Mapping | تهدید در threat model مپ شده | 🔴 Blocker |
| ۲ | Mitigation Test | تست برای vector attack وجود دارد | 🔴 Blocker |
| ۳ | No Regressions | تست‌های security قبلی همچنان pass | 🔴 Blocker |
| ۴ | Audit Trail | Operationهای admin log می‌شوند | 🔴 Blocker |
| ۵ | ۲ Reviewers | حداقل ۲ reviewer سطح admin | 🔴 Blocker |
| ۶ | GDPR Impact | تغییرات privacy impact بررسی شده | 🔴 Blocker |

### ۷.۳ فرایند Review

```
[PR Created]
    │
    ├── CI Pipeline
    │   ├── typecheck ✅/❌
    │   ├── build     ✅/❌
    │   ├── lint      ✅/❌
    │   ├── test      ✅/❌
    │   └── coverage  ✅/❌
    │
    ├── Auto-Assign Reviewers
    │   ├── Security PR → ۲ admin reviewers
    │   └── Other PR → ۱ reviewer
    │
    ├── Review Comments
    │   ├── Request Changes
    │   ├── Approve
    │   └── Comment (non-blocking)
    │
    └── Merge
        ├── Squash and Merge (feature)
        ├── Merge Commit (release)
        └── Rebase (hotfix)
```

---

## 8. فرایند Pull Request

### ۸.۱ Template PR Description

```markdown
## توضیحات
<!-- توضیح کوتاه تغییر -->

## نوع تغییر
- [ ] feat: قابلیت جدید
- [ ] fix: رفع باگ
- [ ] docs: مستندات
- [ ] refactor: بازنویسی
- [ ] test: تست
- [ ] security: امنیت
- [ ] perf: performance

## چک‌لیست
- [ ] typecheck pass
- [ ] build pass
- [ ] test pass
- [ ] coverage >= ۸۰%
- [ ] changeset (در صورت نیاز)
- [ ] security review (در صورت security PR)

## Impact Analysis
- **Packageهای affected:** @alphabet/core, @alphabet/api
- **API Breaking:** خیر
- **Privacy Impact:** خیر
- **Performance Impact:** ناچیز

## نحوه تست
<!-- نحوه تست دستی تغییرات -->
```

### ۸.۲ اندازه PR

| اندازه | خط تغییر | توصیه |
|--------|---------|-------|
| Small | < ۲۰۰ خط | ایده‌آل — review سریع |
| Medium | ۲۰۰-۵۰۰ خط | قابل قبول — review دقیق |
| Large | ۵۰۰-۱۰۰۰ خط | نیاز به توضیح بیشتر — احتمال split |
| XLarge | > ۱۰۰۰ خط | **باید split شود** — غیرقابل review مؤثر |

---

## 9. پرسش‌های متداول

### Q: آیا AI agents می‌توانند به صورت مستقل commit کنند؟
**A:** بله، اما باید تمام قوانین بخش ۵ را رعایت کنند و PR ایجاد کنند. هیچ commit مستقیماً روی `main` مجاز نیست.

### Q: چگونه changeset ایجاد کنم؟
**A:** `pnpm changeset` اجرا کنید. نوع تغییر (major/minor/patch) را انتخاب و summary بنویسید. فایل در `.changeset/` ایجاد می‌شود.

### Q: آیا می‌توانم از `as any` استفاده کنم؟
**A:** **خیر.** استفاده از `as any` ممنوع است. از `as unknown` و سپس type guard یا از satisfies operator استفاده کنید.

### Q: چگونه یک type جدید اضافه کنم؟
**A:** ابتدا `src/types/base.ts` (برای enum) یا `src/types/` مربوطه (برای interface) را ویرایش کنید. سپس `src/types/index.ts` را به‌روزرسانی کنید.

### Q: آیا Brand Types الزامی هستند؟
**A:** **بله.** تمام شناسه‌ها (visitorId, sessionId, memoryId, requestId) باید Brand Type باشند تا type confusion جلوگیری شود.

### Q: چگونه تست امنیتی بنویسم؟
**A:** در فایل تست، بخش `describe('security', ...)` اضافه کنید. حداقل ۳ تست: (۱) sanitization، (۲) consent validation، (۳) cross-domain isolation.

---

*این سند بخشی از مستندات SDK Alphabet است. برای معماری کلی به ARCHITECTURE.md و برای قراردادهای کدنویسی به CODING_CONVENTIONS.md مراجعه کنید.*
