# قراردادهای کدنویسی — Alphabet SDK
# Alphabet SDK Coding Conventions

> **نسخه:** 1.0.0 | **مخزن:** `github.com/danialsamiei/alphabet`
> **زبان:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## فهرست مطالب

1. [قوانین TypeScript Strict Mode](#1-قوانین-typescript-strict-mode)
2. [Brand Types برای شناسه‌ها](#2-brand-types)
3. [الگوی Result<T,E>](#3-الگوی-resultte)
4. [مدیریت خطای Functional](#4-مدیریت-خطای-functional)
5. [الگوهای React برای لایه UI](#5-الگوهای-react)
6. [قرارداد نام‌گذاری فایل‌ها](#6-قرارداد-نامگذاری-فایلها)
7. [قوانین Import](#7-قوانین-import)
8. [قرارداد کامنت‌ها (JSDoc)](#8-قرارداد-کامنتها)
9. [قرارداد تست‌ها (Vitest)](#9-قرارداد-تستها)
10. [اصلاحات امنیتی کد](#10-اصلاحات-امنیتی)

---

## 1. قوانین TypeScript Strict Mode

### ۱.۱ پیکربندی کامل

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### ۱.۲ جدول کامل قوانین

| # | گزینه | مقدار | هدف | مثال خطا |
|---|-------|-------|-----|----------|
| ۱ | `strict` | `true` | فعال‌سازی همه چک‌ها | — |
| ۲ | `noUnusedLocals` | `true` | جلوگیری از متغیر بلااستفاده | `const x = 5; // never used → error` |
| ۳ | `noUnusedParameters` | `true` | جلوگیری از پارامتر بلااستفاده | `function f(x: number) { return 5; } → error` |
| ۴ | `noImplicitReturns` | `true` | همه مسیرها باید return داشته باشند | `if (cond) return 5; // else path → error` |
| ۵ | `noFallthroughCasesInSwitch` | `true` | جلوگیری از fallthrough | `case 1: stmt; case 2: → error` |
| ۶ | `exactOptionalPropertyTypes` | `true` | `?:` ≠ `\| undefined` | `field?: string` فقط `string` یا مفقود |
| ۷ | `noUncheckedIndexedAccess` | `true` | Index access = `T \| undefined` | `arr[0].x → error (must check undefined)` |
| ۸ | `noImplicitOverride` | `true` | override باید صریح باشد | `method() {} // should be override → error` |
| ۹ | `noPropertyAccessFromIndexSignature` | `true` | Index sig با `['key']` | `obj.key → error (use obj['key'])` |
| ۱۰ | `isolatedModules` | `true` | فایل‌ها مستقل transpile شوند | `const enum` ممنوع |
| ۱۱ | `forceConsistentCasingInFileNames` | `true` | حساسیت به case | `import from './Foo' vs './foo' → error` |

### ۱.۳ نکات کلیدی

#### noUnusedLocals
```typescript
// ❌ ERROR: 'unused' is declared but never read
const unused = computeSomething();

// ✅ OK: همه متغیرها استفاده شده
const result = computeSomething();
console.log(result);

// ✅ OK: underscore prefix مجاز است
const _unused = computeSomething(); // intentional unused
```

#### noUnusedParameters
```typescript
// ❌ ERROR: 'index' is declared but never read
items.map((item, index) => item.name);

// ✅ OK: underscore prefix
items.map((item, _index) => item.name);

// ✅ OK: استفاده شده
items.map((item, index) => `${index}: ${item.name}`);
```

#### exactOptionalPropertyTypes
```typescript
interface Config {
  timeout?: number;  // می‌تواند مفقود باشد — نه undefined显式
}

// ❌ ERROR: Type 'undefined' is not assignable
const c: Config = { timeout: undefined };

// ✅ OK: مفقود کردن مجاز است
const c: Config = {};

// ✅ OK: مقدار valid
const c: Config = { timeout: 5000 };
```

#### noUncheckedIndexedAccess
```typescript
// ❌ ERROR: Object is possibly 'undefined'
const name = users[0].name;

// ✅ OK: با check
const first = users[0];
if (first) {
  console.log(first.name);
}

// ✅ OK: با optional chaining
const name = users[0]?.name;
```

---

## 2. Brand Types برای شناسه‌ها

### ۲.۱ تعریف Brand Type

Brand types از type confusion جلوگیری می‌کنند — نمی‌توان یک `VisitorId` را به جای `SessionId` استفاده کرد.

```typescript
// src/types/brands.ts

declare const __brand: unique symbol;

type Brand<B> = { readonly [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

// شناسه‌های اصلی
export type VisitorId = Branded<string, 'VisitorId'>;
export type SessionId = Branded<string, 'SessionId'>;
export type MemoryId = Branded<string, 'MemoryId'>;
export type RequestId = Branded<string, 'RequestId'>;
export type ConsentToken = Branded<string, 'ConsentToken'>;
export type ConfirmationId = Branded<string, 'ConfirmationId'>;
export type AuditLogId = Branded<string, 'AuditLogId'>;
```

### ۲.۲ Factory Functions

```typescript
// ✅ ساخت Brand Type با validation
export function createVisitorId(raw: string): Result<VisitorId, ValidationError> {
  if (!raw || raw.length < 8) {
    return err({ code: 'INVALID_VISITOR_ID', message: 'Visitor ID must be at least 8 chars' });
  }
  return ok(raw as VisitorId);
}

export function createSessionId(): SessionId {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as SessionId;
}

export function createMemoryId(): MemoryId {
  return `mem_${crypto.randomUUID()}` as MemoryId;
}
```

### ۲.۳ استفاده در Interfaceها

```typescript
// ✅ BEFORE (prone to confusion):
interface VisitorMemory {
  visitorId: string;  // ممکن است با sessionId اشتباه شود
  sessionId: string;  // ممکن است با visitorId اشتباه شود
}

// ✅ AFTER (type-safe):
interface VisitorMemory {
  visitorId: VisitorId;  // فقط VisitorId پذیرفته می‌شود
  sessionId: SessionId;  // فقط SessionId پذیرفته می‌شود
  memoryId: MemoryId;
}

// ❌ Compile error: Type 'SessionId' is not assignable to type 'VisitorId'
const wrong: VisitorMemory = {
  visitorId: sessionId,  // ERROR!
  sessionId: sessionId,
  memoryId: memoryId,
};
```

### ۲.۴ لیست کامل Brand Types

| Brand Type | پسوند | کاربرد | Factory Function |
|-----------|-------|--------|-----------------|
| `VisitorId` | `v-` یا `anon-` | شناسه بازدیدکننده | `createVisitorId(raw)` |
| `SessionId` | `sess-` | شناسه session | `createSessionId()` |
| `MemoryId` | `mem-` | شناسه حافظه | `createMemoryId()` |
| `RequestId` | `req-` | شناسه درخواست | `createRequestId()` |
| `ConsentToken` | `ct-` | توکن رضایت | `generateConsentToken()` |
| `ConfirmationId` | `cfm-` | شناسه تأیید | `generateConfirmationId()` |
| `AuditLogId` | `aud-` | شناسه audit | `createAuditLogId()` |

---

## 3. الگوی Result<T,E>

### ۳.۱ تعریف

الگوی Result<T,E> برای همه عملیات SDK **الزامی** است. هیچ تابع public نباید throw کند.

```typescript
// src/types/result.ts

export type Result<T, E = AlphabetError> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Helper functions
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = AlphabetError>(error: E): Result<never, E> {
  return { success: false, error };
}
```

### ۳.۲ الگوی استفاده

```typescript
// ✅ BEFORE (with throwing):
function parseConfig(json: string): Config {
  const parsed = JSON.parse(json);  // ممکن است throw کند!
  if (!parsed.apiBaseUrl) {
    throw new Error('Missing apiBaseUrl');  // ممکن است throw کند!
  }
  return parsed;
}

// ✅ AFTER (with Result<T,E>):
function parseConfig(json: string): Result<Config, AlphabetError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return err({ code: 'INVALID_JSON', message: 'Failed to parse config JSON' });
  }

  if (!parsed || typeof parsed !== 'object') {
    return err({ code: 'INVALID_CONFIG', message: 'Config must be an object' });
  }

  const config = parsed as Record<string, unknown>;
  if (typeof config.apiBaseUrl !== 'string') {
    return err({ code: 'MISSING_BASE_URL', message: 'apiBaseUrl is required' });
  }

  return ok({
    apiBaseUrl: config.apiBaseUrl,
    timeoutMs: typeof config.timeoutMs === 'number' ? config.timeoutMs : 5000,
  });
}
```

### ۳.۳ استفاده از Result

```typescript
// ✅ استفاده صحیح — همیشه check success
const result = parseConfig(configJson);

if (!result.success) {
  console.error(`Config error: ${result.error.code} — ${result.error.message}`);
  process.exit(1);
}

// از اینجا به بعد result.data safe است
const config = result.data;
```

### ۳.۴ Result در Async Functions

```typescript
// ✅ Async function با Result
async function postHandshake(
  request: HandshakeRequest
): Promise<Result<HandshakeResponse, AlphabetError>> {
  try {
    const response = await fetch(`${API_BASE}/context/handshake`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return err({
        code: `HTTP_${response.status}`,
        message: `Handshake failed: ${response.statusText}`,
      });
    }

    const data = (await response.json()) as HandshakeResponse;
    return ok(data);
  } catch {
    return err({ code: 'NETWORK_ERROR', message: 'Failed to connect to handshake endpoint' });
  }
}
```

### ۳.۵ Chain Operations با Result

```typescript
// ✅ Helper برای chain کردن Results
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  return result.success ? ok(fn(result.data)) : result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  return result.success ? fn(result.data) : result;
}

// ✅ Usage:
const configResult = parseConfig(json)
  .flatMap(validateConfig)
  .flatMap(initializeClient);
```

---

## 4. مدیریت خطای Functional

### ۴.۱ قوانین

| # | قانون | هدف |
|---|-------|-----|
| ۱ | **هیچ throw در APIهای public** | Consumer باید خطا را handle کند |
| ۲ | **try/catch فقط در boundary** | Internal functions از Result استفاده می‌کنند |
| ۳ | **Errorها باید typed باشند** | هر error کد machine-readable دارد |
| ۴ | **Error messages human-readable** | برای debugging و logging |
| ۵ | **هیچ PII در error message** | Security: هیچ اطلاعات حساس |

### ۴.۲ Error Types

```typescript
interface AlphabetError {
  code: string;              // کد machine-readable (UPPER_SNAKE_CASE)
  message: string;           // پیام human-readable
  details?: Record<string, unknown>;  // اطلاعات اضافی (بدون PII)
}

// Error codes برای هر module
const HANDSHAKE_ERRORS = {
  INVALID_REQUEST: 'Invalid handshake request',
  TIMEOUT: 'Handshake timed out',
  RATE_LIMITED: 'Too many handshake attempts',
  SERVICE_UNAVAILABLE: 'Backend service unavailable',
} as const;

const MEMORY_ERRORS = {
  CONSENT_TIER_INSUFFICIENT: 'Consent tier insufficient for operation',
  DOMAIN_WRITE_DENIED: 'Cross-domain write is not allowed',
  MEMORY_NOT_FOUND: 'Memory not found',
  CONSENT_REVOKED: 'Consent has been revoked',
} as const;
```

### ۴.۳ مثال کامل: بدون throw

```typescript
// ✅ تابع کاملاً functional — هیچ throw
export function validateHandshakeRequest(
  request: unknown
): Result<HandshakeRequest, AlphabetError> {
  if (!request || typeof request !== 'object') {
    return err({ code: 'INVALID_REQUEST', message: 'Request must be an object' });
  }

  const req = request as Record<string, unknown>;

  // Validate requestId
  if (typeof req.requestId !== 'string' || req.requestId.length === 0) {
    return err({ code: 'MISSING_REQUEST_ID', message: 'requestId is required' });
  }

  // Validate visitorId
  if (typeof req.visitorId !== 'string' || req.visitorId.length === 0) {
    return err({ code: 'MISSING_VISITOR_ID', message: 'visitorId is required' });
  }

  // Validate signals
  if (!req.signals || typeof req.signals !== 'object') {
    return err({ code: 'MISSING_SIGNALS', message: 'signals object is required' });
  }

  const signals = req.signals as Record<string, unknown>;
  if (typeof signals.language !== 'string') {
    return err({ code: 'MISSING_LANGUAGE', message: 'signals.language is required' });
  }

  // All validations passed
  return ok(request as HandshakeRequest);
}
```

---

## 5. الگوهای React برای لایه UI

### ۵.۱ Layer Detection

```typescript
// ✅ استفاده از Capability Detection قبل از render
import { runCapabilityDetection, CapabilityLayer } from '@alphabet/core';

function App() {
  const [layer, setLayer] = useState<CapabilityLayer | null>(null);

  useEffect(() => {
    runCapabilityDetection().then(report => {
      setLayer(report.layer);
    });
  }, []);

  if (!layer) return <Loading />;

  switch (layer) {
    case CapabilityLayer.R3F_IMMERSIVE: return <Layer1R3F />;
    case CapabilityLayer.CSS_3D:        return <Layer2CSS3D />;
    case CapabilityLayer.CANVAS_2D:     return <Layer3Canvas2D />;
    case CapabilityLayer.STATIC_HTML:   return <Layer4StaticHTML />;
    case CapabilityLayer.TEXT_ONLY:     return <Layer5TextOnly />;
    default:                            return <Layer5TextOnly />;
  }
}
```

### ۵.۲ Error Boundary برای R3F

```typescript
// ✅ Error boundary برای جلوگیری از crash
import { Suspense, ErrorInfo } from 'react';

class LayerErrorBoundary extends React.Component<
  { fallback: React.ReactNode; onError?: (error: Error, info: ErrorInfo) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    // Downgrade به لایه پایین‌تر
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Usage
<LayerErrorBoundary
  fallback={<Layer2CSS3D />}
  onError={(err) => console.error('R3F error, downgrading:', err)}
>
  <Suspense fallback={<Loading />}>
    <Layer1R3F />
  </Suspense>
</LayerErrorBoundary>
```

### ۵.۳ Performance Monitoring

```typescript
// ✅ Performance monitoring با PerformanceMonitor از Drei
import { PerformanceMonitor } from '@react-three/drei';

function Scene() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        onDecline={() => setDpr(1)}      // fps dropped → reduce DPR
        onIncline={() => setDpr(p => Math.min(p + 0.5, 2))}
        flipflops={3}
        onFallback={() => setDpr(0.5)}    // last resort
      />
      {/* scene content */}
    </Canvas>
  );
}
```

### ۵.۴ React Hooks برای Alphabet

```typescript
// ✅ Custom hook برای handshake
export function useHandshake(config: HandshakeConfig) {
  const [state, setState] = useState<HandshakeState>({ phase: 'idle' });

  useEffect(() => {
    const client = new ContextHandshakeClient(config);
    client.performHandshake()
      .then(result => setState({ phase: 'complete', result }))
      .catch(error => setState({ phase: 'error', error }));
  }, []);

  return state;
}

// ✅ Custom hook برای consent
export function useConsent(visitorId: VisitorId) {
  const [consent, setConsent] = useState<VisitorConsent | null>(null);

  const grant = useCallback(async (tier: ConsentTier) => {
    const result = await postConsent({ visitorId, action: 'grant', tier });
    if (result.success) setConsent(result.data);
    return result;
  }, [visitorId]);

  const revoke = useCallback(async () => {
    const result = await postConsent({ visitorId, action: 'revoke', tier: 'NO_MEMORY' });
    if (result.success) setConsent(null);
    return result;
  }, [visitorId]);

  return { consent, grant, revoke };
}
```

---

## 6. قرارداد نام‌گذاری فایل‌ها

### ۶.۱ فایل‌ها — kebab-case

| نوع | فرمت | مثال |
|-----|------|------|
| TypeScript source | `kebab-case.ts` | `handshake-decision.ts` |
| TypeScript test | `kebab-case.test.ts` | `signal-collector.test.ts` |
| TypeScript integration test | `kebab-case.integration.test.ts` | `context-handshake.integration.test.ts` |
| React component | `PascalCase.tsx` | `Layer1R3F.tsx` |
| React component test | `PascalCase.test.tsx` | `Layer1R3F.test.tsx` |
| Type definition | `kebab-case.d.ts` | `alphabet-config.d.ts` |
| Utility | `kebab-case.ts` | `result-helpers.ts` |
| Constants | `SCREAMING_SNAKE.ts` | `HANDSHAKE_ERRORS.ts` |

### ۶.۲ کلاس‌ها — PascalCase

| نوع | فرمت | مثال |
|-----|------|------|
| Class | `PascalCase` | `ContextHandshakeClient` |
| Interface | `PascalCase` | `VisitorContext`, `AlphabetRequest` |
| Type alias | `PascalCase` | `ConsentTier`, `MemoryDomain` |
| Enum | `PascalCase` | `UILayer`, `CapabilityLayer` |
| Function | `camelCase` | `detectDeviceClass`, `sanitizeInput` |
| Constant | `SCREAMING_SNAKE_CASE` | `DEFAULT_TIMEOUT_MS`, `MAX_RETRY_COUNT` |
| Variable | `camelCase` | `currentLayer`, `consentManager` |
| Private method | `#camelCase` یا `_camelCase` | `#validateConsent`, `_internalHelper` |
| Brand Type | `PascalCase` | `VisitorId`, `SessionId` |

### ۶.۳ مثال کامل یک module

```
src/
├── types/
│   ├── base.ts                    # Enums (ConsentTier, MemoryDomain)
│   ├── brands.ts                  # Brand Types (VisitorId, SessionId)
│   ├── result.ts                  # Result<T,E> pattern
│   ├── visitor.ts                 # Visitor models
│   ├── api.ts                     # Request/Response models
│   ├── memory.ts                  # Memory models
│   └── index.ts                   # Re-exports
│
├── memory/
│   ├── consent-tier-manager.ts    # کلاس ConsentTierManager
│   ├── consent-tier-manager.test.ts
│   ├── tier-0-passive-handler.ts
│   ├── tier-0-passive-handler.test.ts
│   ├── tier-1-session-store.ts
│   ├── tier-1-session-store.test.ts
│   ├── domain-firewall.ts
│   ├── domain-firewall.test.ts
│   └── index.ts
│
└── index.ts                       # exports اصلی package
```

---

## 7. قوانین Import

### ۷.۱ No Barrel Imports در Hot Paths

```typescript
// ❌ AVOID: Barrel imports در hot paths
import { VisitorContext, VisitorConsent, VisitorMemory } from '@alphabet/core';

// ✅ PREFER: Import صریح از فایل مبدأ
import { VisitorContext } from '@alphabet/core/types/visitor';
import { VisitorConsent } from '@alphabet/core/types/visitor';

// ✅ EXCEPTION: فایل‌های index.ts و config می‌توانند barrel import کنند
import type { AlphabetConfig } from '@alphabet/core/config';
```

### ۷.۲ ترتیب Importها

```typescript
// ۱. External dependencies (React, Three.js)
import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';

// ۲. Internal packages (@alphabet/*)
import { runCapabilityDetection } from '@alphabet/core';
import { postInteract } from '@alphabet/api';
import { sanitizeInput } from '@alphabet/security';

// ۳. Relative imports (همان package)
import { Layer1R3F } from './layers/Layer1R3F';
import type { HandshakeConfig } from './types';

// ۴. CSS/Assets (در صورت نیاز)
import './styles.css';
```

### ۷.۳ Import Type برای Type-only

```typescript
// ✅ استفاده از import type برای type-only imports
import type { VisitorContext } from '@alphabet/core/types/visitor';
import { createVisitorId } from '@alphabet/core/types/brands';

// ✅ این distinction باعث می‌شود type imports در runtime حذف شوند
```

---

## 8. قرارداد کامنت‌ها (JSDoc)

### ۸.۱ توابع Public

```typescript
/**
 * جمع‌آوری سیگنال‌های passive از مرورگر بازدیدکننده.
 * هیچ client-side storage استفاده نمی‌کند — صرفاً سیگنال‌های passive.
 *
 * @param hints - Client Hints از navigator.userAgentData
 * @returns سیگنال‌های passive شامل زبان، timezone، device class و UTM
 * @throws هیچ — این تابع همیشه safe است و never throw می‌کند
 *
 * @example
 * ```typescript
 * const signals = SignalCollector.collect(navigator.userAgentData?.getHighEntropyValues);
 * console.log(signals.language); // "fa-IR"
 * ```
 */
export function collect(
  hints?: Promise<UALowEntropyHints>
): PassiveSignals {
  // implementation
}
```

### ۸.۲ کلاس‌ها

```typescript
/**
 * مدیریت tierهای consent بازدیدکننده.
 *
 * State machine: PENDING → GRANTED → REVOKED
 *                        ↓ upgrade
 *                      ENRICHED
 *
 * Tierها:
 * - NO_MEMORY (T0): هیچ چیزی ذخیره نمی‌شود
 * - ANONYMOUS (T1): فقط session (۲۴h TTL)
 * - CONSENTED (T2): cross-session preferences
 * - ENRICHED (T3): vector embeddings
 *
 * @see {@link ConsentTier} برای تعریف tierها
 * @see {@link DOMAIN_TIER_MAP} برای mapping domain به tier
 */
export class ConsentTierManager {
  // implementation
}
```

### ۸.۳ Interfaceها

```typescript
/**
 * UI Configuration تولید شده توسط HandshakeDecisionEngine.
 *
 * این config توسط morphUI() روی DOM اعمال می‌شود:
 * - lang attribute روی <html>
 * - dir attribute (ltr/rtl)
 * - CSS variables برای theme
 * - Hero copy localized
 *
 * @see {@link UIConfigGenerator.generate} برای تولید
 * @see {@link morphUI} برای اعمال روی DOM
 */
export interface UIConfig {
  /** Locale کامل، e.g., "fa-IR", "en-US" */
  readonly locale: string;

  /** لایه UI توانمندی: R3F, CSS3D, CANVAS2D, STATIC_HTML, TEXT_ONLY */
  readonly uiLayer: UILayer;

  /** Directionality: "ltr" یا "rtl" */
  readonly direction: 'ltr' | 'rtl';

  /** Theme: light یا dark */
  readonly theme: 'light' | 'dark';

  /** پیام welcome localized */
  readonly heroCopy: string;
}
```

### ۸.۴ TODO Comments

```typescript
// TODO(phase-2): Add vector embedding support when Tier 3 is implemented
// TODO(security-review): Validate this input more strictly
// FIXME: Handle edge case where timezone is null
// NOTE: This is intentional — see issue #42
```

---

## 9. قرارداد تست‌ها (Vitest)

### ۹.۱ ساختار تست

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
  // Group: مرتبط‌سازی تست‌ها بر اساس تابع/روش
  describe('functionName', () => {

    // Positive tests — مسیرهای happy path
    describe('happy path', () => {
      it('should return expected result when valid input', () => {
        // Arrange
        const input = createValidInput();

        // Act
        const result = functionUnderTest(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    // Negative tests — خطاها و edge cases
    describe('error cases', () => {
      it('should return error when input is null', () => {
        const result = functionUnderTest(null);
        expect(result.success).toBe(false);
      });
    });

    // Edge cases — boundary values
    describe('edge cases', () => {
      it('should handle empty array', () => {
        const result = functionUnderTest([]);
        expect(result.data).toEqual([]);
      });
    });
  });
});
```

### ۹.۲ Arrange-Act-Assert Pattern

```typescript
it('should detect desktop device from Client Hints', () => {
  // Arrange — setup
  const hints: UALowEntropyHints = {
    platform: 'Windows',
    mobile: false,
    formFactor: null,
  };

  // Act — execute
  const result = detectDeviceClass(hints);

  // Assert — verify
  expect(result).toBe('desktop');
});
```

### ۹.۳ Naming Convention برای تست‌ها

| Pattern | مثال | توضیح |
|---------|------|-------|
| `should <expected> when <condition>` | `should return "mobile" when mobile=true` | توصیفی |
| `should reject <input> because <reason>` | `should reject empty string because required` | خطا |
| `should handle <edge case>` | `should handle null timezone` | edge case |
| `should not <action>` | `should not throw when input is valid` | negative |

### ۹.۴ Mocking

```typescript
describe('with mocked dependencies', () => {
  // Mock کردن fetch
  const mockFetch = vi.fn();
  globalThis.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should retry on 429', async () => {
    // Arrange: 429 سپس 200
    mockFetch
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { 'Retry-After': '1' } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    // Act
    const result = await postHandshake(validRequest);

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
```

### ۹.۵ Snapshot Testing (با احتیاط)

```typescript
// ✅ برای schema validation مناسب
it('should match handshake output schema', () => {
  const result = generateUIConfig(validContext);
  expect(result).toMatchSnapshot('ui-config-schema');
});

// ❌ برای data پویا مناسب نیست
it('should return correct timestamp', () => {
  const result = getTimestamp();
  // expect(result).toMatchSnapshot(); // ❌ timestamp همیشه تغییر می‌کند
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ✅ Regex pattern
});
```

---

## 10. اصلاحات امنیتی کد

### ۱۰.۱ Input Sanitization

```typescript
// ✅ همیشه input را sanitize کنید
import DOMPurify from 'dompurify';

export function sanitizeInput(input: string): string {
  // حذف HTML tags
  const noHtml = input.replace(/<[^>]*>/g, '');
  // Trim whitespace
  const trimmed = noHtml.trim();
  // Limit length
  return trimmed.slice(0, 10000);
}

export function sanitizeForPrompt(input: string): string {
  // Escape delimiter characters
  return input
    .replace(/===/g, '≡≡≡')
    .replace(/\{\{/g, '｛｛')
    .replace(/\}\}/g, '｝｝');
}
```

### ۱۰.۲ No Sensitive Data در Output

```typescript
// ❌ NEVER: Exposing internal details
return err({
  code: 'DB_ERROR',
  message: `PostgreSQL connection failed: ${connectionString}`,  // LEAK!
});

// ✅ ALWAYS: Generic error messages
return err({
  code: 'SERVICE_UNAVAILABLE',
  message: 'Service temporarily unavailable. Please try again.',
});
```

### ۱۰.۳ Consent Check Pattern

```typescript
// ✅ Pattern: Consent check قبل از هر operation
function storeMemory(data: MemoryData, consent: VisitorConsent): Result<MemoryId, AlphabetError> {
  // ۱. Check state
  if (consent.state === 'revoked') {
    return err({ code: 'CONSENT_REVOKED', message: 'Consent revoked' });
  }

  // ۲. Check tier
  const required = DOMAIN_TIER_MAP[data.domain];
  if (!tierMeetsRequirement(consent.consentTier, required)) {
    return err({ code: 'CONSENT_INSUFFICIENT', message: `Tier ${required} required` });
  }

  // ۳. Proceed
  return persistMemory(data);
}
```

### ۱۰.۴ Secure Defaults

| تنظیم | مقدار پیش‌فرض | دلیل |
|-------|---------------|------|
| `ALPHABET_DEFAULT_CONSENT_TIER` | `NO_MEMORY` | حداقل data collection |
| `ALPHABET_TIMEOUT_MS` | `5000` | جلوگیری از hanging connections |
| `ALPHABET_MAX_RETRIES` | `3` | محدودیت retry |
| `ALPHABET_LOG_LEVEL` | `warn` | حداقل logging در production |
| `ALPHABET_ENABLE_TELEMETRY` | `false` | Opt-in، نه opt-out |
| Session TTL | `۲۴h` | حداکثر anonymous session |
| Token budget | `ANONYMOUS` | حداقل tier |

---

*این سند بخشی از مستندات SDK Alphabet است. برای معماری کلی به ARCHITECTURE.md و برای راهنمای توسعه به DEVELOPMENT.md مراجعه کنید.*
