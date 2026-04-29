# معماری سیستم Alphabet SDK
# Alphabet SDK System Architecture

> **نسخه:** 1.0.0 | **تاریخ:** 2026-04-27
> **مخزن:** `github.com/danialsamiei/awaf`
> **زبان مستندات:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## 1. نمای کلی (Overview)

چارچوب وب‌آگاه الفبا (Alphabet — Alefba Web-Aware Framework) یک SDK کامل TypeScript/React است که برای ایجاد تجربه‌های وب تطبیقی (adaptive web experiences) طراحی شده است. این SDK در یک monorepo با پنج package و یک اپلیکیشن demo سازمان‌دهی می‌شود.

| شاخص | مقدار |
|------|-------|
| **لایه‌های معماری** | ۸ لایه |
| **Endpointهای API** | ۱۶ endpoint |
| **مدل‌های داده** | ۱۱ TypeScript interface |
| **لایه‌های UI Degradation** | ۵ لایه (از R3F تا Text-only) |
| **پروتکل‌های LLM** | ۴ پروتکل (MCP, A2A, QR, API) |
| **دسته‌های تهدید امنیتی** | ۸ دسته |

---

## 2. نمودار معماری ۸ لایه (8-Layer Architecture Diagram)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  LAYER 8 — EXPERIENCE & DEMO                                                 ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  apps/demo/                                                             │ ║
║  │  اپلیکیشن نمونه برای تست و توسعه (Vite + React)                        │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 7 — FRONTEND & UI DEGRADATION                                         ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/ui/                                                           │ ║
║  │  Layer 1: R3F Immersive (React Three Fiber)                            │ ║
║  │  Layer 2: CSS 3D Transforms                                              │ ║
║  │  Layer 3: Canvas 2D API                                                  │ ║
║  │  Layer 4: Static HTML + Semantic CSS                                     │ ║
║  │  Layer 5: Text-only (ARIA landmarks, Screen Reader)                    │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 6 — PROTOCOL ADAPTERS                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/protocols/                                                    │ ║
║  │  MCP Adapter (Model Context Protocol)                                   │ ║
║  │  A2A Adapter (Agent-to-Agent Protocol)                                 │ ║
║  │  QR Handoff Adapter (QR-Code Cross-Device)                             │ ║
║  │  API Adapter (Direct RESTful)                                         │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 5 — SECURITY & PRIVACY                                              ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/security/                                                     │ ║
║  │  Threat Mitigation (8 threat categories)                               │ ║
║  │  Input Sanitization (XSS, Injection)                                     │ ║
║  │  Audit Logging (GDPR compliance trail)                                  │ ║
║  │  NIST AI 100-1 Alignment                                               │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 4 — API CLIENT & STREAMING                                          ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/api/                                                          │ ║
║  │  ۱۶ Endpoint Client (HTTP + fetch)                                     │ ║
║  │  SSE Streaming Handler (Server-Sent Events)                             │ ║
║  │  Rate Limit Awareness & Retry Logic                                     │ ║
║  │  Error Classification & Circuit Breaker                                   │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 3 — CONTEXT HANDSHAKE & DECISION                                    ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/core/src/handshake/                                           │ ║
║  │  SignalCollector (Passive Signal Detection)                            │ ║
║  │  EnrichmentPipeline (IP-to-Geo, Referrer Categorization)                │ ║
║  │  HandshakeDecisionEngine (LLM/RAG Prompt + Validation)                 │ ║
║  │  UIConfigGenerator (RTL/LTR, Theme, Directionality)                    │ ║
║  │  morphUI (DOM Attribute & CSS Variable Injection)                      │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 2 — MEMORY MESH & CONSENT                                           ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/core/src/memory/                                              │ ║
║  │  Tier 0: Passive Handler (No Storage)                                  │ ║
║  │  Tier 1: Session Store (Anonymous, 24h TTL)                              │ ║
║  │  Tier 2: Profile Store (Cross-Session, Consented)                        │ ║
║  │  Tier 3: Enriched Store (Vector Embedding, 768-dim)                   │ ║
║  │  DomainFirewall (7 Memory Domains, Cross-Domain Isolation)             │ ║
║  │  ConsentTierManager (State Machine: pending→granted→revoked)           │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LAYER 1 — FOUNDATION TYPES & CONFIGURATION                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  packages/core/src/                                                     │ ║
║  │  types/ — 11 Base Types + Brand Types + Result<T,E> Pattern           │ ║
║  │  config/ — AlphabetConfig Class (Env + File + Defaults)                    │ ║
║  │  logger/ — AlphabetLogger (4 Levels, Structured, JSON Sink)                │ ║
║  │  events/ — AlphabetEventEmitter (Typed, Priority, Once)                    │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. جریان داده اصلی (Primary Data Flow)

```
┌─────────┐     ┌───────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│ Visitor │────▶│ SignalCollector│────▶│ EnrichmentPipeline│────▶│ HandshakeDecisionEngine│
└─────────┘     └───────────────┘     └───────────────────┘     └─────────────────────┘
       │                    │                    │                      │
       │                    │                    │                      │
       ▼                    ▼                    ▼                      ▼
  ┌─────────┐         ┌────────────┐      ┌─────────────┐        ┌───────────────┐
  │ Browser │         │ Passive    │      │ IP-to-Coarse│        │ LLM Prompt   │
  │ Signals │         │ Signals    │      │ Geo (MaxMind│        │ Template +   │
  │ (lang,  │         │ (language, │      │ GeoLite2)   │        │ JSON Schema  │
  │ time,   │         │ timezone,  │      │ Referrer    │        │ Validation   │
  │ device) │         │ device,    │      │ Category    │        │ (Ajv/zod)    │
  │         │         │ DNT/GPC)   │      │ UTM Campaign│        │              │
  └─────────┘         └────────────┘      └─────────────┘        └───────────────┘
                                                                              │
                                                                              ▼
┌─────────────────┐     ┌────────────┐     ┌──────────────────┐     ┌──────────────┐
│  UIConfigGenerator│────▶│   morphUI   │────▶│  RuntimeLoop      │────▶│   Visitor    │
└─────────────────┘     └────────────┘     └──────────────────┘     └──────────────┘
       │                       │                    │
       ▼                       ▼                    ▼
┌──────────────┐      ┌────────────────┐    ┌─────────────────────┐
│ UIConfig     │      │ DOM Attributes │    │ Event Loop          │
│ (locale,     │      │ (lang, dir,    │    │ (handshake:runtime, │
│  theme,      │      │  CSS vars,     │    │  consent:changed,   │
│  direction,  │      │  hero copy)    │    │  token:used,        │
│  heroCopy)   │      │                │    │  memory:stored)     │
└──────────────┘      └────────────────┘    └─────────────────────┘
```

### 3.1 شرح مراحل جریان داده

| مرحله | کلاس/تابع | ورودی | خروجی | توضیح |
|-------|-----------|-------|-------|-------|
| **1. Detect** | `SignalCollector.collect()` | `navigator`, `document` | `PassiveSignals` | استخراج سیگنال‌های passive از مرورگر |
| **2. Enrich** | `EnrichmentPipeline.enrich()` | `PassiveSignals` + `Request` | `EnrichedContext` | IP-to-geo، referrer categorization، UTM mapping |
| **3. Decide** | `HandshakeDecisionEngine.decide()` | `EnrichedContext` | `HandshakeDecision` | فراخوانی LLM/RAG endpoint + validation |
| **4. Generate** | `UIConfigGenerator.generate()` | `HandshakeDecision` | `UIConfig` | تعیین RTL/LTR، theme، consent_required |
| **5. Morph** | `morphUI()` | `UIConfig` + `rootSelector` | `void` | تزریق CSS variables و attributes روی DOM |
| **6. Runtime** | `enterRuntimeLoop()` | `HandshakeResult` | `CustomEvent` | dispatch event برای شروع runtime loop |

---

## 4. نقشه Endpointهای API — ۱۶ Endpoint

### 4.1 گروه‌بندی Endpointها

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTEXT HANDSHAKE (3 endpoints)                                              │
│  ├─ POST /api/context/handshake    — دریافت سیگنال، enrich، UI config        │
│  ├─ POST /api/context/consent      — ثبت/به‌روزرسانی/revoke رضایت            │
│  └─ POST /api/context/preference   — ذخیره preferenceهای کاربر              │
├─────────────────────────────────────────────────────────────────────────────┤
│  VISITOR INTERACTION (3 endpoints)                                            │
│  ├─ POST /api/interact             — نقطه پایانی text/voice (SSE streaming) │
│  ├─ POST /api/voice/transcribe     — تبدیل voice به text (Whisper)           │
│  └─ GET  /api/suggestions          — دریافت suggestionهای پویا             │
├─────────────────────────────────────────────────────────────────────────────┤
│  TECHNOLOGY PULSE (2 endpoints)                                               │
│  ├─ GET  /api/technology-pulse      — لیست signals با فیلتر                  │
│  └─ POST /api/technology-pulse/brief — تولید daily/weekly brief               │
├─────────────────────────────────────────────────────────────────────────────┤
│  MEMORY (3 endpoints)                                                           │
│  ├─ POST /api/visitor/memory        — ذخیره memory با consent validation      │
│  ├─ GET  /api/visitor/memory        — بازیابی memory (domain filter)           │
│  └─ DELETE /api/visitor/memory      — right to erasure (GDPR Art. 17)       │
├─────────────────────────────────────────────────────────────────────────────┤
│  OPENCLAW MESH (3 endpoints)                                                  │
│  ├─ POST /api/claw/query            — unified query با domain filter           │
│  ├─ POST /api/claw/ingest           — ingestion با provenance validation       │
│  └─ POST /api/claw/admin/audit      — inspect و delete visitor memory        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ADMIN (2 endpoints)                                                            │
│  ├─ GET /api/admin/visitor-insights     — dashboard (k-anonymity aggregated) │
│  └─ GET /api/admin/technology-pulse/sources — مدیریت منابع T1/T2/T3          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 جدول کامل Endpointها

| # | Method | Path | Auth | Rate Limit | Timeout | Client File |
|---|--------|------|------|------------|---------|-------------|
| ۱ | `POST` | `/api/context/handshake` | None | ۱۰ req/min/IP | ۵s | `handshake.ts` |
| ۲ | `POST` | `/api/context/consent` | Bearer | ۵ req/min/visitor | ۳s | `consent.ts` |
| ۳ | `POST` | `/api/context/preference` | Bearer | ۱۰ req/min/visitor | ۳s | `preference.ts` |
| ۴ | `POST` | `/api/interact` | Bearer | ۳۰/۶۰ req/min | ۱۵s | `interact.ts` |
| ۵ | `POST` | `/api/voice/transcribe` | Bearer | ۱۰ req/min/visitor | ۳۰s | `voice-transcribe.ts` |
| ۶ | `GET` | `/api/suggestions` | None | ۲۰ req/min/IP | ۳s | `suggestions.ts` |
| ۷ | `GET` | `/api/technology-pulse` | None | ۳۰ req/min/IP | ۵s | `technology-pulse.ts` |
| ۸ | `POST` | `/api/technology-pulse/brief` | Bearer | ۵ req/min/visitor | ۳۰s | `technology-pulse-brief.ts` |
| ۹ | `POST` | `/api/visitor/memory` | Bearer | ۱۰ req/min/visitor | ۵s | `visitor-memory-post.ts` |
| ۱۰ | `GET` | `/api/visitor/memory` | Bearer | ۲۰ req/min/visitor | ۵s | `visitor-memory-get.ts` |
| ۱۱ | `DELETE` | `/api/visitor/memory` | Bearer | ۲ req/hour/visitor | ۱۰s | `visitor-memory-delete.ts` |
| ۱۲ | `POST` | `/api/claw/query` | Bearer | ۱۵ req/min/visitor | ۱۰s | `claw-query.ts` |
| ۱۳ | `POST` | `/api/claw/ingest` | API Key | ۶۰ req/min/key | ۱۰s | `claw-ingest.ts` |
| ۱۴ | `POST` | `/api/claw/admin/audit` | API Key | ۳۰ req/min/key | ۱۰s | `claw-admin-audit.ts` |
| ۱۵ | `GET` | `/api/admin/visitor-insights` | API Key | ۱۰۰ req/min/key | ۱۰s | `admin-visitor-insights.ts` |
| ۱۶ | `GET` | `/api/admin/technology-pulse/sources` | API Key | ۳۰ req/min/key | ۱۰s | `admin-pulse-sources.ts` |

---

## 5. مدل‌های داده — ۱۱ TypeScript Interface

### 5.1 نمودار وابستگی مدل‌ها

```
                    ┌─────────────────┐
                    │   Enums (base)  │
                    │  ConsentTier    │
                    │  TrustTier      │
                    │  MemoryDomain   │
                    │  IntentType     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ GeoContext    │    │ VisitorContext│    │ DetectedSignals│
│ (coarse geo)  │◄───│ (passive)     │◄───│ (browser)     │
└───────┬───────┘    └───────┬───────┘    └───────────────┘
        │                    │
        │         ┌──────────┼──────────┐
        │         │          │          │
        │         ▼          ▼          ▼
        │    ┌─────────┐ ┌──────────┐ ┌─────────────┐
        │    │VisitorConsent│ │VisitorPreference│ │ VisitorMemory │
        │    │ (state machine)│ │ (显式 prefs)  │ │ (vector+text) │
        │    └────┬────┘ └──────────┘ └──────┬──────┘
        │         │                            │
        │         └────────────┬───────────────┘
        │                      │
        ▼                      ▼
   ┌─────────┐           ┌──────────────┐
   │TechnologySignal│     │ SuggestionOption│
   │(pulse signals) │     │ (dynamic chips) │
   └────┬────┘           └──────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────┐
   │        AlphabetRequest<T> / AlphabetResponse<T>       │
   │        TokenBudget / StreamingConfig            │
   └──────────────────────────────────────────────┘
```

### 5.2 لیست کامل مدل‌ها با interface

#### مدل ۱: `VisitorContext` — زمینه بازدیدکننده

```typescript
export interface VisitorContext {
  readonly visitorId: string;           // anonymous visitor ID (rotating)
  readonly sessionId: string;            // session ephemeral
  readonly geo: GeoContext;
  readonly signals: DetectedSignals;
  readonly detectedAt: string;           // ISO timestamp
}
```

#### مدل ۲: `VisitorConsent` — ماشین حالت رضایت

```typescript
export interface VisitorConsent {
  readonly visitorId: string;
  readonly consentTier: ConsentTier;    // 'NO_MEMORY' | 'ANONYMOUS' | 'CONSENTED' | 'ENRICHED'
  readonly state: 'pending' | 'granted' | 'revoked';
  readonly grantedAt?: string;           // ISO timestamp
  readonly purposes: ConsentPurpose[];
  readonly expiresAt?: string;
  readonly revokedAt?: string;
}
```

#### مدل ۳: `VisitorPreference` — ترجیحات显式

```typescript
export interface VisitorPreference {
  readonly visitorId: string;
  readonly language: string;            // e.g., "fa", "en", "bg"
  readonly topics: string[];
  readonly contentDepth: 'overview' | 'deep' | 'expert';
  readonly notificationPrefs: 'none' | 'session' | 'persistent';
  readonly theme: 'auto' | 'light' | 'dark';
}
```

#### مدل ۴: `VisitorMemory` — حافظه بازدیدکننده

```typescript
export interface VisitorMemory {
  readonly memoryId: string;
  readonly visitorId: string;
  readonly domain: MemoryDomain;       // ۶ دامنه semantic
  readonly content: string;
  readonly vectorEmbedding?: number[];  // 768-d float array
  readonly consentTierRequired: ConsentTier;
  readonly privacyLabel: 'correlation_allowed' | 'isolated' | 'governance_required';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt?: string;
}
```

#### مدل ۵: `GeoContext` — موقعیت جغرافیایی coarse

```typescript
export interface GeoContext {
  readonly country: string;             // ISO 3166-1 alpha-2 (e.g., "IR", "BG", "US")
  readonly city: string;                // City name (coarse)
  readonly timezone: string;            // IANA timezone (e.g., "Asia/Tehran")
  readonly coarseLatitude: number;      // ~city precision, rounded to 2 decimals
  readonly coarseLongitude: number;
}
```

#### مدل ۶: `TechnologySignal` — سیگنال Technology Pulse

```typescript
export interface TechnologySignal {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly category: string;           // "AI", "biotech", "energy", ...
  readonly trustTier: TrustTier;        // 'T1' | 'T2' | 'T3'
  readonly provenanceChain: ProvenanceLink[];
  readonly rawText: string;
  readonly url: string;
  readonly publishedAt: string;
  readonly ingestedAt: string;
}
```

#### مدل ۷: `SuggestionOption` — گزینه پیشنهادی پویا

```typescript
export interface SuggestionOption {
  readonly id: string;
  readonly label: string;
  readonly intentType: IntentType;
  readonly confidence: number;         // 0.0 - 1.0
  readonly icon?: string;
  readonly action: 'navigate' | 'interact' | 'consent_prompt';
  readonly requiresConsent: boolean;
}
```

#### مدل ۸: `AlphabetRequest<T>` — درخواست یکپارچه

```typescript
export interface AlphabetRequest<T = unknown> {
  readonly protocol: ProtocolType;      // 'MCP' | 'A2A' | 'QR' | 'API'
  readonly endpoint: string;
  readonly visitorId: string;
  readonly sessionId: string;
  readonly consentTier: ConsentTier;
  readonly payload: T;
  readonly timestamp: string;
  readonly requestId: string;           // UUID برای tracing
}
```

#### مدل ۹: `AlphabetResponse<T>` — پاسخ یکپارچه

```typescript
export interface AlphabetResponse<T = unknown> {
  readonly requestId: string;
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AlphabetError;
  readonly meta: ResponseMeta;
}
```

#### مدل ۱۰: `TokenBudget` — بودجه توکن

```typescript
export interface TokenBudget {
  readonly tier: TokenTier;             // 'ANONYMOUS' | 'CONSENTED' | 'ADMIN'
  readonly maxTokensPerSession: number;
  readonly tokensUsed: number;
  readonly tokensRemaining: number;
  readonly resetAt: string;             // ISO timestamp
}
```

#### مدل ۱۱: `IntentSession` — session intent

```typescript
export interface IntentSession {
  readonly intentId: string;
  readonly visitorId: string;
  readonly sessionId: string;
  readonly intentType: IntentType;
  readonly confidence: number;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly pagesVisited: string[];
  readonly interactions: number;
}
```

---

## 6. نمودار وابستگی Packageها (Package Dependency Graph)

```
                    ┌─────────────┐
                    │  @alphabet/demo │
                    │  (apps/demo)│
                    └──────┬──────┘
                           │ depends on all
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐      ┌──────────────┐
   │@alphabet/ui  │     │@alphabet/api │      │ @alphabet/protocols│
   │(Layer 7) │     │(Layer 4) │      │  (Layer 6)    │
   └────┬─────┘     └────┬─────┘      └───────┬───────┘
        │                │                    │
        │         ┌──────┘                    │
        │         │                           │
        ▼         ▼                           ▼
   ┌───────────────┐                   ┌──────────────┐
   │  @alphabet/core   │◄──────────────────│ @alphabet/security│
   │  (Layer 1-3)  │                   │  (Layer 5)   │
   │  types, config│                   └──────────────┘
   │  logger, events│
   │  memory, handshake│
   └───────────────┘
          │
          │ (no internal dependencies — foundation)
          ▼
   ┌──────────────┐
   │  TypeScript  │
   │  Vite (build)│
   │  Vitest (test)│
   └──────────────┘
```

### 6.1 ترتیب وابستگی Build

```
@alphabet/core      ← هیچ وابستگی داخلی ندارد (پایه‌ترین — build اول)
@alphabet/api       ← @alphabet/core
@alphabet/security  ← @alphabet/core
@alphabet/protocols ← @alphabet/core + @alphabet/api
@alphabet/ui        ← @alphabet/core + @alphabet/api
@alphabet/demo      ← همه packageها (build آخر)
```

### 6.2 جدول Exports هر Package

| Package | Exports اصلی | مسیر dist |
|---------|-------------|-----------|
| `@alphabet/core` | types, brands, result, config, logger, events | `packages/core/dist/` |
| `@alphabet/api` | ۱۶ endpoint client + SSE streaming | `packages/api/dist/` |
| `@alphabet/ui` | ۵ لایه degradation + hooks + components | `packages/ui/dist/` |
| `@alphabet/protocols` | MCP, A2A, QR, API adapters | `packages/protocols/dist/` |
| `@alphabet/security` | threat mitigations, sanitizers, audit | `packages/security/dist/` |
| `@alphabet/demo` | اپلیکیشن نمونه (Vite app) | `apps/demo/dist/` |

---

## 7. خط لوله ساخت (Build Pipeline)

### 7.1 Turborepo Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "**/tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

### 7.2 نمودار Pipeline ساخت

```
┌──────────────────────────────────────────────────────────────┐
│                    pnpm install                              │
│         نصب وابستگی‌ها (frozen-lockfile در CI)               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: typecheck (parallel across packages)               │
│  ├─ packages/core:   tsc --noEmit                          │
│  ├─ packages/api:     tsc --noEmit                          │
│  ├─ packages/ui:      tsc --noEmit                          │
│  ├─ packages/protocols: tsc --noEmit                        │
│  └─ packages/security:  tsc --noEmit                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 2: build (topological order)                          │
│  ├─ Step 1: @alphabet/core    → vite build + tsc --emitDeclarationOnly │
│  ├─ Step 2: @alphabet/api     → vite build + tsc (after core)   │
│  ├─ Step 3: @alphabet/security → vite build + tsc (after core)  │
│  ├─ Step 4: @alphabet/protocols → vite build (after core+api) │
│  ├─ Step 5: @alphabet/ui      → vite build (after core+api)     │
│  └─ Step 6: @alphabet/demo     → vite build (after all packages)│
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 3: test (after build)                                │
│  ├─ vitest run unit (packages/*)                            │
│  ├─ vitest run integration (packages/api)                   │
│  └─ playwright test e2e (apps/demo)                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 4: changeset version + publish (main branch only)  │
│  ├─ pnpm changeset version                                  │
│  ├─ pnpm build (rebuild with new versions)                  │
│  └─ pnpm changeset publish                                  │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Changesets Configuration

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["@alphabet/*"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@alphabet/demo"]
}
```

### 7.4 Vite Library Mode — خروجی Dual ESM + CJS

هر package با Vite Library Mode خروجی dual-format تولید می‌کند:

| Format | Extension | استفاده |
|--------|-----------|---------|
| ESM | `.js` | Modern bundlers (Vite, Rollup, esbuild) |
| CJS | `.cjs` | Node.js, Jest, legacy tools |
| Types | `.d.ts` + `.d.ts.map` | IDE autocomplete, tsc |
| Source Map | `.js.map` / `.cjs.map` | Debugging |

---

## 8. ماشین حالت Handshake (Handshake State Machine)

```
┌─────────┐    detect     ┌─────────┐    enrich+decide    ┌─────────┐
│  idle   │──────────────▶│ detect  │──────────────────────▶│ enrich  │
└─────────┘               └─────────┘                       └─────────┘
                                                              │
                          ┌─────────┐    display+consent      │
                          │  error  │◄───────────────────────┘
                          └────▲────┘    (on failure)
                               │
                          ┌────┴────┐
                          │  morph  │◄────────────────────────┐
                          └────┬────┘                         │
                               │                              │
                               │ morphUI()                      │
                               ▼                              │
                          ┌─────────┐    enterRuntimeLoop     │
                          │ runtime │─────────────────────────┘
                          └─────────┘
                               │
                               ▼
                          ┌─────────┐
                          │  loop   │  ◄── Runtime Loop اصلی
                          └─────────┘
```

### 8.1 فازهای Handshake

| فاز | نام | کلید/تابع | خروجی |
|-----|-----|-----------|-------|
| ۰ | `idle` | قبل از شروع | — |
| ۱ | `detect` | `SignalCollector.collect()` | `PassiveSignals` |
| ۲ | `enrich` | `BaseEdgeAdapter.enrich()` | `EnrichedContext` |
| ۳ | `decide` | `HandshakeDecisionEngine.decide()` | `HandshakeDecision` |
| ۴ | `display` | `UIConfigGenerator.generate()` | `UIConfig` |
| ۵ | `consent` | `awaitConsentDecision()` | `boolean` |
| ۶ | `morph` | `morphUI()` | DOM mutated |
| ۷ | `runtime` | `enterRuntimeLoop()` | `CustomEvent` dispatched |
| ❌ | `error` | هر فاز | `HandshakeResult` with `success=false` |

---

## 9. نردبان Consent (Consent Ladder) — ۴ Tier

```
Tier 3: ENRICHED        ┌─────────────────────────────────────────┐
 (Vector Embedding,    │  Tier3EnrichedStore                     │
  Behavioral Learning)  │  • 768-dim vector embeddings            │
                        │  • Semantic similarity search           │
                        │  • Selective retrieval (93% token save) │
                        │  • Anomaly detection pre-persist        │
                        │  • TTL: 90 days                         │
                        └─────────────────────────────────────────┘
                                   ▲
                                   │ upgrade (grant tier=3)
Tier 2: CONSENTED       ┌─────────────────────────────────────────┐
 (Cross-Session         │  Tier2ProfileStore                      │
  Preferences)          │  • Explicit user preferences            │
                        │  • localStorage sync (optional)         │
                        │  • Transparency report                  │
                        │  • Source: 'manual'                     │
                        │  • TTL: cross-session                   │
                        └─────────────────────────────────────────┘
                                   ▲
                                   │ upgrade (grant tier=2)
Tier 1: ANONYMOUS       ┌─────────────────────────────────────────┐
 (Session-Only,        │  Tier1SessionStore                      │
  Server Cache)         │  • Anonymous ID (anon-UUID)            │
                        │  • UI state tracking                    │
                        │  • No client storage (no cookie/LS)     │
                        │  • Garbage collection every 6h          │
                        │  • TTL: 24 hours                        │
                        └─────────────────────────────────────────┘
                                   ▲
                                   │ implicit (first visit)
Tier 0: NO MEMORY       ┌─────────────────────────────────────────┐
 (Nothing Stored)       │  Tier0PassiveHandler                   │
                        │  • Pure passive signals                 │
                        │  • Zero persistence                      │
                        │  • DNT/GPC auto-downgrade here         │
                        │  • No PII collection                    │
                        └─────────────────────────────────────────┘
```

---

## 10. isolation دامنه در Memory Mesh (Domain Isolation)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DomainFirewall                                  │
│  Principle: Cross-domain write = NEVER. Cross-domain read = gate-based.│
├──────────────┬──────────┬────────┬───────────┬─────────────┬────────────┤
│   Domain     │ TrustLvl │  TTL   │  WriteSrc │  CrossRead  │ Collection │
├──────────────┼──────────┼────────┼───────────┼─────────────┼────────────┤
│ general      │ T1       │ 365d   │ admin     │ site, ideas │ general_mem│
│ site_specific│ T1       │ 180d   │ site_owner│ general     │ site_mem   │
│ visitor      │ T2       │ 90d    │ visitor   │ — (self)    │ visitor_mem│
│ class_notes  │ T1       │ 365d   │ instructor│ visitor*    │ class_mem  │
│ ideas        │ T1       │ 365d   │ dual-sign │ general     │ ideas_mem  │
│ social       │ T3       │ 30d    │ scraper   │ — (none)    │ social_mem │
│ tech_pulse   │ T1-T2    │ 14d    │ curator   │ site, gen   │ tech_pulse │
└──────────────┴──────────┴────────┴───────────┴─────────────┴────────────┘
* با consent
```

---

## 11. پروتکل‌های LLM (LLM Protocols)

| پروتکل | مسیر در `packages/protocols/` | هدف |
|--------|------------------------------|-----|
| **MCP** | `src/mcp/` | Model Context Protocol — context sharing بین LLMها |
| **A2A** | `src/a2a/` | Agent-to-Agent — ارتباط مستقل agentها |
| **QR** | `src/qr/` | QR-Code Handoff — انتقال session بین deviceها |
| **API** | `src/api/` | Direct RESTful — fallback برای همه پروتکل‌ها |

---

## 12. نکات عملیاتی (Operational Notes)

### 12.1 Prompt Caching
سیستم prompt caching دو سطح دارد:
1. **Prefix Cache** — system instruction + schema definition (cacheable در تمام درخواست‌ها)
2. **Semantic Cache** — پاسخ کامل برای contextهای مشابه (TTL پیش‌فرض ۵ دقیقه)

### 12.2 Streaming Strategy
- **Non-streaming** (`postInteract`): برای پاسخ‌های کوتاه (< ۵۱۲ توکن)
- **SSE Streaming** (`streamInteract`): برای پاسخ‌های طولانی با callbacks real-time

### 12.3 UI Degradation Triggers
| شرایط | Downgrade Target | Rationale |
|-------|-----------------|-----------|
| WebGL context lost | CSS 3D | Recovery graceful |
| fps < 15 برای ۳ ثانیه | Canvas 2D | PerformanceMonitor flipflops |
| Network offline | Static HTML | `navigator.onLine === false` |
| Battery save mode | Text-only | `level < 0.2 && !charging` |
| `prefers-reduced-motion` | CSS 3D | Accessibility |

---

## 13. نگاشت مسیرها (Path Mapping Summary)

| Package | Path Alias | مسیر فیزیکی |
|---------|-----------|------------|
| `@alphabet/core` | `@alphabet/core/*` | `packages/core/src/*` |
| `@alphabet/api` | `@alphabet/api/*` | `packages/api/src/*` |
| `@alphabet/ui` | `@alphabet/ui/*` | `packages/ui/src/*` |
| `@alphabet/protocols` | `@alphabet/protocols/*` | `packages/protocols/src/*` |
| `@alphabet/security` | `@alphabet/security/*` | `packages/security/src/*` |

---

## 14. خلاصه اجرا برای Kimi Code (AI Agent Execution Summary)

```
[فاز ۱: Core] ────────────────────────────────────────
  ├── بخش ۱: زیرساخت (monorepo, TS config, Vite)
  ├── بخش ۲: Handshake (SignalCollector → Enrichment → DecisionEngine)
  ├── بخش ۳: API Client (۱۶ endpoint)
  └── بخش ۴: Data Models (۱۱ interface)

[فاز ۲: Protocol] ───────────────────────────────────
  ├── بخش ۵: Memory Mesh (Consent ladder, Domain isolation, OpenClaw)
  ├── بخش ۶: Frontend & UI (۵ لایه degradation, Runtime Loop)
  └── بخش ۷: LLM Protocols (MCP, A2A, QR, API adapters)

[فاز ۳: Experience] ──────────────────────────────────
  ├── بخش ۸: Security (Defense in depth, ۸ threats, NIST AI 100-1)
  ├── بخش ۹: Technology Pulse (Signal ingestion, Trust scoring)
  └── بخش ۱۰: Testing & DX (Unit/Integration/E2E, CLI, Demo App)
```

---

*این سند بخشی از مستندات SDK Alphabet است. برای جزئیات بیشتر به فایل‌های DEVELOPMENT.md، API_REFERENCE.md، CONTRIBUTING.md، SECURITY.md و CODING_CONVENTIONS.md مراجعه کنید.*
