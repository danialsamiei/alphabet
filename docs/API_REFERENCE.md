# مرجع کامل API — AWAF SDK
# AWAF SDK API Reference

> **نسخه:** 1.0.0 | **تاریخ:** 2026-04-27
> **Base URL:** `$AWAF_API_BASE_URL` (default: `http://localhost:3000/api`)
> **پروتکل:** HTTPS در production، HTTP در development
> **فرمت:** JSON با Content-Type: application/json
> **زبان:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## فهرست Endpointها

| # | گروه | Endpoint | Method | مسیر |
|---|------|----------|--------|------|
| ۱ | **Context Handshake** | Handshake | `POST` | `/api/context/handshake` |
| ۲ | **Context Handshake** | Consent | `POST` | `/api/context/consent` |
| ۳ | **Context Handshake** | Preference | `POST` | `/api/context/preference` |
| ۴ | **Visitor Interaction** | Interact | `POST` | `/api/interact` |
| ۵ | **Visitor Interaction** | Voice Transcribe | `POST` | `/api/voice/transcribe` |
| ۶ | **Visitor Interaction** | Suggestions | `GET` | `/api/suggestions` |
| ۷ | **Technology Pulse** | Technology Pulse List | `GET` | `/api/technology-pulse` |
| ۸ | **Technology Pulse** | Technology Pulse Brief | `POST` | `/api/technology-pulse/brief` |
| ۹ | **Memory** | Store Memory | `POST` | `/api/visitor/memory` |
| ۱۰ | **Memory** | Retrieve Memory | `GET` | `/api/visitor/memory` |
| ۱۱ | **Memory** | Erase Memory | `DELETE` | `/api/visitor/memory` |
| ۱۲ | **OpenClaw Mesh** | Query | `POST` | `/api/claw/query` |
| ۱۳ | **OpenClaw Mesh** | Ingest | `POST` | `/api/claw/ingest` |
| ۱۴ | **OpenClaw Mesh** | Admin Audit | `POST` | `/api/claw/admin/audit` |
| ۱۵ | **Admin** | Visitor Insights | `GET` | `/api/admin/visitor-insights` |
| ۱۶ | **Admin** | Pulse Sources | `GET` | `/api/admin/technology-pulse/sources` |

---

## پاسخ‌های خطای مشترک (Common Error Responses)

### ساختار خطا

```typescript
interface AWAFError {
  code: string;              // کد خطای machine-readable
  message: string;           // پیام خطای human-readable
  details?: Record<string, unknown>;
}
```

### کدهای خطای عمومی

| کد | HTTP Status | توضیح | راه‌حل |
|----|-------------|-------|--------|
| `RATE_LIMIT_EXCEEDED` | `429` | Rate limit رد شده | exponential backoff اجرا کنید |
| `UNAUTHORIZED` | `401` | Token نامعتبر یا منقضی | refresh token یا re-authenticate |
| `FORBIDDEN` | `403` | دسترسی ممنوع (tier پایین) | consent tier ارتقا دهید |
| `TIMEOUT` | `408` | Request timeout | retry با timeout بیشتر |
| `VALIDATION_ERROR` | `422` | داده نامعتبر | فیلدها را بررسی کنید |
| `SERVICE_UNAVAILABLE` | `503` | سرویس موقتاً unavailable | circuit breaker فعال است |
| `CONSENT_REQUIRED` | `403` | عملیات نیاز به consent دارد | prompt consent به کاربر |

### هدرهای Rate Limit

تمام پاسخ‌ها شامل هدرهای زیر هستند:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1714233600
```

---

## گروه ۱: Context Handshake (۳ endpoint)

### Endpoint ۱: POST /api/context/handshake

**هدف:** دریافت سیگنال‌های بازدیدکننده، enrich کردن context، و دریافت UI config.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | None |
| **Rate Limit** | ۱۰ req/min/IP |
| **Timeout** | ۵ ثانیه |
| **Idempotency** | Client-generated requestId |

#### Request TypeScript Interface

```typescript
interface HandshakeRequest {
  requestId: string;           // UUID — برای idempotency
  visitorId: string;           // anonymous visitor ID
  signals: {
    language: string;          // ISO 639-1 (e.g., "fa", "en", "bg")
    timezone: string;          // IANA (e.g., "Asia/Tehran")
    deviceClass: string;       // "mobile" | "tablet" | "desktop" | "wearable"
    localHour: number;         // 0-23
    dnt: boolean;              // Do Not Track signal
    gpc: boolean;              // Global Privacy Control signal
    reducedMotion: boolean;    // prefers-reduced-motion
    formFactor: string | null; // Client Hints
    platform: string | null;   // Client Hints
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  referrer?: string;           // document.referrer
  sessionId?: string;          // session ID موجود (optional)
  consentDecision?: {          // در صورت وجود decision قبلی
    granted: boolean;
    tier: ConsentTier;          // 'NO_MEMORY' | 'ANONYMOUS' | 'CONSENTED' | 'ENRICHED'
  };
  preferences?: {              // preferenceهای قبلی
    language?: string;
    topics?: string[];
    contentDepth?: 'overview' | 'deep' | 'expert';
    theme?: 'auto' | 'light' | 'dark';
  };
}
```

#### Response TypeScript Interface

```typescript
interface HandshakeResponse {
  requestId: string;
  visitorId: string;
  sessionId: string;
  success: boolean;
  uiConfig: {
    locale: string;            // e.g., "fa-IR", "en-US", "bg-BG"
    uiLayer: 'R3F' | 'CSS3D' | 'CANVAS2D' | 'STATIC_HTML' | 'TEXT_ONLY';
    direction: 'ltr' | 'rtl';
    theme: 'light' | 'dark';
    heroCopy: string;          // Localized welcome message
    welcomeVoiceUrl?: string;  // URL فایل TTS (در صورت پشتیبانی)
    timezone: string;
    geo: {
      country: string;
      city: string;
      coarseLatitude: number;
      coarseLongitude: number;
    };
  };
  consentRequired: boolean;    // آیا prompt consent نیاز است؟
  consentTier: ConsentTier;    // Tier پیشنهادی
  trustLevel: 't0' | 't1' | 't2' | 't3';
  timeOfDay: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
  tokenBudget: {
    tier: string;
    maxTokens: number;
    tokensUsed: number;
    tokensRemaining: number;
  };
  promptCache?: {
    cached: boolean;           // آیا از cache استفاده شد؟
    cacheHitRatio: number;     // درصد hit
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۱۰ req/min از یک IP |
| `VALIDATION_ERROR` | `422` | requestId مفقود یا UUID نامعتبر |
| `TIMEOUT` | `408` | Backend enrichment > ۵ ثانیه |
| `SERVICE_UNAVAILABLE` | `503` | GeoIP یا LLM service down |

#### Example Usage

```typescript
import { postHandshake, type HandshakeRequest } from '@awaf/api';

const request: HandshakeRequest = {
  requestId: crypto.randomUUID(),
  visitorId: 'anon-7f8a9b2c',
  signals: {
    language: 'fa',
    timezone: 'Asia/Tehran',
    deviceClass: 'desktop',
    localHour: 14,
    dnt: false,
    gpc: false,
    reducedMotion: false,
    formFactor: null,
    platform: 'Windows',
  },
  referrer: 'https://google.com',
};

const result = await postHandshake(request);
if (result.success) {
  console.log(`Locale: ${result.uiConfig.locale}`);
  console.log(`Direction: ${result.uiConfig.direction}`); // "rtl" for Persian
  console.log(`Consent required: ${result.consentRequired}`);
}
```

---

### Endpoint ۲: POST /api/context/consent

**هدف:** ثبت، به‌روزرسانی، یا revoke کردن رضایت بازدیدکننده.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۵ req/min/visitor |
| **Timeout** | ۳ ثانیه |

#### Request TypeScript Interface

```typescript
interface ConsentRequest {
  visitorId: string;
  sessionId: string;
  action: 'grant' | 'revoke' | 'upgrade' | 'downgrade';
  tier: ConsentTier;             // Target tier
  purposes?: ConsentPurpose[];   // فعال در grant
  duration?: 'session' | '30d' | '90d' | '1y';  // مدت validity
}

interface ConsentPurpose {
  id: string;
  name: string;
  description: string;
  granted: boolean;
}
```

#### Response TypeScript Interface

```typescript
interface ConsentResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  action: string;
  previousTier: ConsentTier;
  currentTier: ConsentTier;
  state: 'pending' | 'granted' | 'revoked';
  grantedAt?: string;
  expiresAt?: string;
  purposes?: ConsentPurpose[];
  transparencyReport?: {
    dataCollected: string[];
    dataShared: string[];
    retentionDays: number;
    rightToErasure: boolean;
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `CONSENT_REQUIRED` | `403` | downgrade بدون احراز هویت |
| `VALIDATION_ERROR` | `422` | action مفقود یا نامعتبر |
| `FORBIDDEN` | `403` | upgrade به ENRICHED بدون auth admin |

#### Example Usage

```typescript
import { postConsent } from '@awaf/api';

// Grant consent to ANONYMOUS tier
const result = await postConsent({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  action: 'grant',
  tier: 'ANONYMOUS',
  purposes: [
    { id: 'session_storage', name: 'Session Storage', description: 'Store session data', granted: true },
    { id: 'language_preference', name: 'Language', description: 'Remember language', granted: true },
  ],
  duration: '30d',
});

if (result.success && result.state === 'granted') {
  console.log(`Consent granted at: ${result.grantedAt}`);
  console.log(`Expires at: ${result.expiresAt}`);
}

// Revoke all consent
const revokeResult = await postConsent({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  action: 'revoke',
  tier: 'NO_MEMORY',
});
```

---

### Endpoint ۳: POST /api/context/preference

**هدف:** ذخیره preferenceهای显式 بازدیدکننده.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۱۰ req/min/visitor |
| **Timeout** | ۳ ثانیه |

#### Request TypeScript Interface

```typescript
interface PreferenceRequest {
  visitorId: string;
  sessionId: string;
  language?: string;              // ISO 639-1
  topics?: string[];
  contentDepth?: 'overview' | 'deep' | 'expert';
  notificationPrefs?: 'none' | 'session' | 'persistent';
  theme?: 'auto' | 'light' | 'dark';
  overrideHandshake?: boolean;    // آیا handshake result را override کند؟
}
```

#### Response TypeScript Interface

```typescript
interface PreferenceResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  preferences: {
    language: string;
    topics: string[];
    contentDepth: string;
    notificationPrefs: string;
    theme: string;
  };
  updatedAt: string;             // ISO timestamp
  effectiveTier: ConsentTier;    // Tier مورد نیاز این preferenceها
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `FORBIDDEN` | `403` | ذخیره preference نیاز به tier >= ANONYMOUS دارد |
| `VALIDATION_ERROR` | `422` | language کد ISO نامعتبر |

#### Example Usage

```typescript
import { postPreference } from '@awaf/api';

const result = await postPreference({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  language: 'fa',
  topics: ['AI', 'blockchain', 'privacy'],
  contentDepth: 'expert',
  theme: 'dark',
  notificationPrefs: 'session',
});

console.log(`Preferences saved. Effective tier: ${result.effectiveTier}`);
```

---

## گروه ۲: Visitor Interaction (۳ endpoint)

### Endpoint ۴: POST /api/interact

**هدف:** نقطه پایانی اصلی تعامل text/voice با AI. از SSE streaming پشتیبانی می‌کند.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۳۰/۶۰ req/min |
| **Timeout** | ۱۵ ثانیه (non-streaming)، ۶۰ ثانیه (streaming) |
| **Streaming** | SSE (Server-Sent Events) |

#### Request TypeScript Interface

```typescript
interface InteractRequest {
  visitorId: string;
  sessionId: string;
  message: string;                // پیام متنی یا متن transcribed voice
  inputMode: 'text' | 'voice';
  context?: {
    previousMessages?: { role: 'user' | 'assistant'; content: string }[];
    pageUrl?: string;
    pageTitle?: string;
    selectedText?: string;
  };
  streaming?: boolean;            // true = SSE streaming
  suggestFollowUps?: boolean;     // آیا follow-up suggestion درخواست شود؟
}
```

#### Response TypeScript Interface (Non-Streaming)

```typescript
interface InteractResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  response: {
    text: string;
    suggestions?: SuggestionOption[];
    references?: { title: string; url: string; trustTier: TrustTier }[];
  };
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  streaming: false;
}
```

#### Response TypeScript Interface (Streaming)

```typescript
interface InteractStreamEvent {
  type: 'token' | 'suggestion' | 'reference' | 'done' | 'error';
  data: string | SuggestionOption | { title: string; url: string } | AWAFError;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۳۰ req در ۶۰ ثانیه |
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `TIMEOUT` | `408` | پاسخ LLM > ۱۵ ثانیه |
| `VALIDATION_ERROR` | `422` | message خالی یا طولانی (> ۱۰K chars) |
| `CONSENT_REQUIRED` | `403` | streaming نیاز به tier >= CONSENTED |

#### Example Usage (Non-Streaming)

```typescript
import { postInteract } from '@awaf/api';

const result = await postInteract({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  message: 'Explain the Web-Aware Framework architecture',
  inputMode: 'text',
  streaming: false,
  suggestFollowUps: true,
});

if (result.success) {
  console.log(result.response.text);
  result.response.suggestions?.forEach(s => console.log(`- ${s.label}`));
}
```

#### Example Usage (Streaming)

```typescript
import { streamInteract } from '@awaf/api';

const stream = streamInteract({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  message: 'Tell me about privacy in AI systems',
  inputMode: 'text',
  streaming: true,
});

for await (const event of stream) {
  switch (event.type) {
    case 'token':
      process.stdout.write(event.data as string);
      break;
    case 'suggestion':
      console.log(`\n[Suggested: ${(event.data as SuggestionOption).label}]`);
      break;
    case 'done':
      console.log('\n[Stream complete]');
      break;
    case 'error':
      console.error('\n[Error:', (event.data as AWAFError).message, ']');
      break;
  }
}
```

---

### Endpoint ۵: POST /api/voice/transcribe

**هدف:** تبدیل فایل audio به text با استفاده از Whisper.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۱۰ req/min/visitor |
| **Timeout** | ۳۰ ثانیه |
| **Content-Type** | `multipart/form-data` |

#### Request TypeScript Interface

```typescript
interface VoiceTranscribeRequest {
  visitorId: string;
  sessionId: string;
  audioFile: File | Blob;         // فایل audio (mp3, wav, ogg)
  language?: string;              // کد زبان (اختیاری — auto-detect)
  model?: 'whisper-1';            // فقط whisper-1 در حال حاضر
}
```

#### Response TypeScript Interface

```typescript
interface VoiceTranscribeResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  transcription: {
    text: string;
    confidence: number;           // 0.0 - 1.0
    language: string;             // زبان detected
    durationMs: number;           // طول audio
    words?: { word: string; start: number; end: number }[];
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `VALIDATION_ERROR` | `422` | فرمت فایل نامعتبر یا بزرگتر از ۲۵MB |
| `TIMEOUT` | `408` | Transcription > ۳۰ ثانیه |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۱۰ req/min |

#### Example Usage

```typescript
import { postVoiceTranscribe } from '@awaf/api';

const audioFile = document.getElementById('audio-input').files[0];

const result = await postVoiceTranscribe({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  audioFile,
  language: 'fa',
});

if (result.success) {
  console.log(`Transcribed: "${result.transcription.text}"`);
  console.log(`Confidence: ${(result.transcription.confidence * 100).toFixed(1)}%`);
}
```

---

### Endpoint ۶: GET /api/suggestions

**هدف:** دریافت suggestionهای پویا بر اساس context.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | None |
| **Rate Limit** | ۲۰ req/min/IP |
| **Timeout** | ۳ ثانیه |

#### Request TypeScript Interface (Query Parameters)

```typescript
interface SuggestionsQuery {
  visitorId: string;
  sessionId?: string;
  pageUrl?: string;
  intentHint?: string;            // intent فعلی کاربر
  limit?: number;                 // default: ۶, max: ۱۰
  includeRequiresConsent?: boolean; // default: false
}
```

#### Response TypeScript Interface

```typescript
interface SuggestionsResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  suggestions: SuggestionOption[];
  generatedAt: string;
}

interface SuggestionOption {
  id: string;
  label: string;
  intentType: 'explore' | 'learn' | 'compare' | 'contact' | 'personalize' | 'language' | 'voice';
  confidence: number;
  icon?: string;
  action: 'navigate' | 'interact' | 'consent_prompt';
  requiresConsent: boolean;
  targetUrl?: string;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `VALIDATION_ERROR` | `422` | visitorId مفقود |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۲۰ req/min |

#### Example Usage

```typescript
import { getSuggestions } from '@awaf/api';

const result = await getSuggestions({
  visitorId: 'anon-7f8a9b2c',
  pageUrl: 'https://alefba.dev/docs',
  intentHint: 'learning',
  limit: ۶,
});

result.suggestions.forEach(s => {
  console.log(`[${s.intentType}] ${s.label} (${(s.confidence * 100).toFixed(0)}%)`);
});
```

---

## گروه ۳: Technology Pulse (۲ endpoint)

### Endpoint ۷: GET /api/technology-pulse

**هدف:** لیست سیگنال‌های technology با فیلتر و صفحه‌بندی.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | None |
| **Rate Limit** | ۳۰ req/min/IP |
| **Timeout** | ۵ ثانیه |

#### Request TypeScript Interface (Query Parameters)

```typescript
interface TechnologyPulseQuery {
  category?: string;              // "AI", "biotech", "energy", "space", "security"
  trustTier?: 'T1' | 'T2' | 'T3';
  source?: string;                // نام source (e.g., "arxiv", "techcrunch")
  dateFrom?: string;              // ISO date
  dateTo?: string;
  search?: string;                // full-text search
  page?: number;                  // default: ۱
  limit?: number;                 // default: ۲۰, max: ۱۰۰
  sortBy?: 'publishedAt' | 'ingestedAt' | 'trustScore';
  sortOrder?: 'asc' | 'desc';
}
```

#### Response TypeScript Interface

```typescript
interface TechnologyPulseResponse {
  requestId: string;
  success: boolean;
  signals: TechnologySignal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  facets: {
    categories: { name: string; count: number }[];
    sources: { name: string; count: number }[];
    trustTiers: { tier: string; count: number }[];
  };
}

interface TechnologySignal {
  id: string;
  source: string;
  title: string;
  category: string;
  trustTier: 'T1' | 'T2' | 'T3';
  provenanceChain: { source: string; url: string; accessedAt: string }[];
  rawText: string;
  url: string;
  publishedAt: string;
  ingestedAt: string;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `VALIDATION_ERROR` | `422` | page یا limit خارج از محدوده |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۳۰ req/min |

#### Example Usage

```typescript
import { getTechnologyPulse } from '@awaf/api';

const result = await getTechnologyPulse({
  category: 'AI',
  trustTier: 'T1',
  dateFrom: '2026-04-01',
  page: 1,
  limit: ۲۰,
  sortBy: 'publishedAt',
  sortOrder: 'desc',
});

console.log(`Found ${result.pagination.total} signals`);
result.signals.forEach(s => {
  console.log(`[${s.trustTier}] ${s.title} (${s.source})`);
});
```

---

### Endpoint ۸: POST /api/technology-pulse/brief

**هدف:** تولید خلاصه daily/weekly از سیگنال‌های technology.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۵ req/min/visitor |
| **Timeout** | ۳۰ ثانیه |

#### Request TypeScript Interface

```typescript
interface TechnologyPulseBriefRequest {
  visitorId: string;
  sessionId: string;
  period: 'daily' | 'weekly';
  categories?: string[];          // فیلتر categoryها
  maxLength?: 'short' | 'medium' | 'long';  // default: medium
  focusTopics?: string[];         // topicهای مورد تمرکز
}
```

#### Response TypeScript Interface

```typescript
interface TechnologyPulseBriefResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  brief: {
    title: string;
    period: string;
    generatedAt: string;
    summary: string;
    highlights: { title: string; description: string; signalId: string }[];
    categoryBreakdown: { category: string; count: number; topSignal: string }[];
    trustDistribution: { tier: string; count: number }[];
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۵ req/min |
| `TIMEOUT` | `408` | تولید brief > ۳۰ ثانیه |

#### Example Usage

```typescript
import { postTechnologyPulseBrief } from '@awaf/api';

const result = await postTechnologyPulseBrief({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  period: 'daily',
  categories: ['AI', 'security'],
  maxLength: 'medium',
});

console.log(`Brief: ${result.brief.title}`);
result.brief.highlights.forEach(h => console.log(`- ${h.title}`));
```

---

## گروه ۴: Memory (۳ endpoint)

### Endpoint ۹: POST /api/visitor/memory

**هدف:** ذخیره حافظه بازدیدکننده با consent validation.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۱۰ req/min/visitor |
| **Timeout** | ۵ ثانیه |
| **Consent Check** | Tier مورد نیاز بررسی می‌شود |

#### Request TypeScript Interface

```typescript
interface StoreMemoryRequest {
  visitorId: string;
  sessionId: string;
  domain: MemoryDomain;           // 'general' | 'site_specific' | 'visitor' | 'class_notes' | 'ideas' | 'social' | 'tech_pulse'
  content: string;                // محتوای حافظه
  vectorEmbedding?: number[];     // 768-d float array (اختیاری — backend می‌تواند generate کند)
  privacyLabel: 'correlation_allowed' | 'isolated' | 'governance_required';
  ttlDays?: number;               // مدت نگهداری (بسته به tier)
  metadata?: Record<string, unknown>;
}
```

#### Response TypeScript Interface

```typescript
interface StoreMemoryResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  memory: {
    memoryId: string;
    domain: MemoryDomain;
    content: string;
    privacyLabel: string;
    createdAt: string;
    expiresAt?: string;
  };
  consentTier: ConsentTier;
  tokensUsed: number;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `CONSENT_REQUIRED` | `403` | tier فعلی کمتر از tier مورد نیاز domain |
| `VALIDATION_ERROR` | `422` | content خالی یا domain نامعتبر |
| `FORBIDDEN` | `403` | write به domain متفاوت (DomainFirewall) |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۱۰ req/min |

#### Example Usage

```typescript
import { postVisitorMemory } from '@awaf/api';

const result = await postVisitorMemory({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  domain: 'visitor',
  content: 'User prefers dark theme and expert-level content about AI safety.',
  privacyLabel: 'isolated',
  ttlDays: 90,
});

if (result.success) {
  console.log(`Memory stored: ${result.memory.memoryId}`);
}
```

---

### Endpoint ۱۰: GET /api/visitor/memory

**هدف:** بازیابی حافظه بازدیدکننده با فیلتر domain.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۲۰ req/min/visitor |
| **Timeout** | ۵ ثانیه |

#### Request TypeScript Interface (Query Parameters)

```typescript
interface GetMemoryQuery {
  visitorId: string;
  sessionId: string;
  domain?: MemoryDomain;          // فیلتر domain (اختیاری)
  search?: string;                // semantic search query
  limit?: number;                 // default: ۵۰, max: ۲۰۰
  includeExpired?: boolean;       // default: false
}
```

#### Response TypeScript Interface

```typescript
interface GetMemoryResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  memories: {
    memoryId: string;
    domain: MemoryDomain;
    content: string;
    vectorEmbedding?: number[];
    privacyLabel: string;
    createdAt: string;
    expiresAt?: string;
  }[];
  total: number;
  consentTier: ConsentTier;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `CONSENT_REQUIRED` | `403` | بازیابی حافظه نیاز به tier >= ANONYMOUS دارد |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۲۰ req/min |

#### Example Usage

```typescript
import { getVisitorMemory } from '@awaf/api';

const result = await getVisitorMemory({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  domain: 'visitor',
  search: 'AI safety preferences',
  limit: ۱۰,
});

console.log(`Found ${result.total} memories`);
result.memories.forEach(m => {
  console.log(`[${m.domain}] ${m.content.substring(0, ۱۰۰)}...`);
});
```

---

### Endpoint ۱۱: DELETE /api/visitor/memory

**هدف:** حذف حافظه بازدیدکننده — Right to Erasure (GDPR Art. 17 / CCPA).

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۲ req/hour/visitor |
| **Timeout** | ۱۰ ثانیه |
| **GDPR** | Art. 17 Right to Erasure |
| **Audit** | تمام درخواست‌ها audit log می‌شوند |

#### Request TypeScript Interface

```typescript
interface EraseMemoryRequest {
  visitorId: string;
  sessionId: string;
  scope: 'all' | 'domain' | 'specific';
  domain?: MemoryDomain;          // فعال در scope='domain'
  memoryIds?: string[];           // فعال در scope='specific'
  reason: 'user_request' | 'expired' | 'gdpr_article_17' | 'ccpa_deletion';
  confirmationToken: string;      // token تأیید از مرحله قبل
}
```

#### Response TypeScript Interface

```typescript
interface EraseMemoryResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  scope: string;
  deletedCount: number;
  deletedIds: string[];
  confirmationId: string;        // ID گزارش حذف برای tracking
  gdprReceipt?: {
    article: string;
    processingDate: string;
    retentionDaysRemaining: number; // ۰ = کامل حذف شد
    thirdPartyNotifications: string[];
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۲ req/hour |
| `VALIDATION_ERROR` | `422` | confirmationToken نامعتبر |
| `FORBIDDEN` | `403` | حذف حافظه سایت (domain='site_specific') بدون احراز هویت admin |

#### Example Usage

```typescript
import { deleteVisitorMemory } from '@awaf/api';

// درخواست confirmation token (مرحله ۱)
const confirmToken = await requestErasureToken({ visitorId: 'anon-7f8a9b2c' });

// حذف کامل حافظه (مرحله ۲)
const result = await deleteVisitorMemory({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  scope: 'all',
  reason: 'gdpr_article_17',
  confirmationToken: confirmToken,
});

if (result.success) {
  console.log(`Deleted ${result.deletedCount} memories`);
  console.log(`Confirmation ID: ${result.confirmationId}`);
}
```

---

## گروه ۵: OpenClaw Mesh (۳ endpoint)

### Endpoint ۱۲: POST /api/claw/query

**هدف:** جستجوی یکپارچه در Memory Mesh با domain filter و similarity search.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | Bearer Token |
| **Rate Limit** | ۱۵ req/min/visitor |
| **Timeout** | ۱۰ ثانیه |

#### Request TypeScript Interface

```typescript
interface ClawQueryRequest {
  visitorId: string;
  sessionId: string;
  query: string;                  // query text (semantic)
  domains?: MemoryDomain[];       // فیلتر domainها (اختیاری)
  minTrustLevel?: 'T1' | 'T2' | 'T3';
  maxResults?: number;            // default: ۱۰, max: ۱۰۰
  recencyBias?: number;           // ۰-۱ (۰ = no bias, ۱ = strong recency)
  includeProvenance?: boolean;    // آیا provenance chain برگردد؟
}
```

#### Response TypeScript Interface

```typescript
interface ClawQueryResponse {
  requestId: string;
  visitorId: string;
  success: boolean;
  results: {
    memoryId: string;
    domain: MemoryDomain;
    content: string;
    similarity: number;           // ۰-۱ (cosine similarity)
    provenance?: { source: string; url: string; accessedAt: string }[];
    createdAt: string;
  }[];
  query: {
    original: string;
    vectorEmbedding: number[];    // 768-dim embedding query
    processingMs: number;
  };
  totalResults: number;
  domainsSearched: MemoryDomain[];
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | Bearer token نامعتبر |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۱۵ req/min |
| `VALIDATION_ERROR` | `422` | query خالی یا بیش از ۱۰۰۰ char |

#### Example Usage

```typescript
import { postClawQuery } from '@awaf/api';

const result = await postClawQuery({
  visitorId: 'anon-7f8a9b2c',
  sessionId: 'sess-abc123',
  query: 'latest developments in quantum computing',
  domains: ['tech_pulse', 'general'],
  minTrustLevel: 'T1',
  maxResults: ۱۰,
  recencyBias: 0.7,
  includeProvenance: true,
});

result.results.forEach(r => {
  console.log(`[${r.domain}] ${r.similarity.toFixed(3)} — ${r.content.substring(0, ۱۰۰)}`);
});
```

---

### Endpoint ۱۳: POST /api/claw/ingest

**هدف:** ingestion محتوا به Memory Mesh با provenance validation.

| مشخصه | مقدار |
|-------|-------|
| **Auth** | API Key |
| **Rate Limit** | ۶۰ req/min/key |
| **Timeout** | ۱۰ ثانیه |
| **Access** | فقط curators و admin |

#### Request TypeScript Interface

```typescript
interface ClawIngestRequest {
  apiKey: string;
  domain: MemoryDomain;
  content: string;
  source: {
    name: string;
    url: string;
    trustTier: 'T1' | 'T2' | 'T3';
  };
  category?: string;
  metadata?: Record<string, unknown>;
  generateVector?: boolean;       // آیا embedding تولید شود؟ default: true
}
```

#### Response TypeScript Interface

```typescript
interface ClawIngestResponse {
  requestId: string;
  success: boolean;
  memoryId: string;
  domain: MemoryDomain;
  provenanceValidated: boolean;   // آیا provenance chain معتبر است؟
  vectorGenerated: boolean;
  tokensUsed: number;
  duplicateCheck: {
    isDuplicate: boolean;
    similarTo?: string[];
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | API Key نامعتبر |
| `FORBIDDEN` | `403` | API Key اجازه ingest ندارد |
| `VALIDATION_ERROR` | `422` | content خالی یا source ناقص |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۶۰ req/min |

#### Example Usage

```typescript
import { postClawIngest } from '@awaf/api';

const result = await postClawIngest({
  apiKey: 'ak_claw_prod_xxx',
  domain: 'tech_pulse',
  content: 'Researchers at MIT announced a breakthrough in quantum error correction...',
  source: {
    name: 'MIT News',
    url: 'https://news.mit.edu/2026/quantum-error-correction',
    trustTier: 'T1',
  },
  category: 'quantum_computing',
  generateVector: true,
});

if (result.success && !result.duplicateCheck.isDuplicate) {
  console.log(`Ingested: ${result.memoryId}`);
}
```

---

### Endpoint ۱۴: POST /api/claw/admin/audit

**هدف:** بازرسی و مدیریت حافظه بازدیدکننده (فقط admin).

| مشخصه | مقدار |
|-------|-------|
| **Auth** | API Key (Admin) |
| **Rate Limit** | ۳۰ req/min/key |
| **Timeout** | ۱۰ ثانیه |
| **Audit** | تمام عملیات audit log می‌شود |

#### Request TypeScript Interface

```typescript
interface ClawAdminAuditRequest {
  apiKey: string;
  action: 'inspect' | 'delete' | 'anonymize' | 'export';
  visitorId: string;
  domain?: MemoryDomain;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    privacyLabel?: string;
  };
}
```

#### Response TypeScript Interface

```typescript
interface ClawAdminAuditResponse {
  requestId: string;
  success: boolean;
  action: string;
  visitorId: string;
  results: {
    memoryId: string;
    domain: MemoryDomain;
    content: string;
    privacyLabel: string;
    createdAt: string;
    consentTier: ConsentTier;
  }[];
  auditLogId: string;            // ID log برای accountability
  gdprCompliant: boolean;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | API Key نامعتبر |
| `FORBIDDEN` | `403` | API Key اجازه admin ندارد |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۳۰ req/min |

#### Example Usage

```typescript
import { postClawAdminAudit } from '@awaf/api';

const result = await postClawAdminAudit({
  apiKey: 'ak_admin_prod_xxx',
  action: 'inspect',
  visitorId: 'anon-7f8a9b2c',
  filters: {
    dateFrom: '2026-04-01',
    privacyLabel: 'governance_required',
  },
});

console.log(`Audit log ID: ${result.auditLogId}`);
console.log(`GDPR compliant: ${result.gdprCompliant}`);
```

---

## گروه ۶: Admin (۲ endpoint)

### Endpoint ۱۵: GET /api/admin/visitor-insights

**هدف:** داشبورد admin با داده‌های aggregate (k-anonymity).

| مشخصه | مقدار |
|-------|-------|
| **Auth** | API Key (Admin) |
| **Rate Limit** | ۱۰۰ req/min/key |
| **Timeout** | ۱۰ ثانیه |
| **Privacy** | k-anonymity aggregate — هیچ visitor فردی قابل شناسایی نیست |

#### Request TypeScript Interface (Query Parameters)

```typescript
interface VisitorInsightsQuery {
  apiKey: string;
  dateFrom?: string;              // ISO date
  dateTo?: string;
  country?: string;               // ISO 3166-1 alpha-2
  granularity?: 'hourly' | 'daily' | 'weekly';
  metrics?: ('visitors' | 'sessions' | 'consentRate' | 'tierDistribution' | 'languageDistribution' | 'deviceDistribution')[];
}
```

#### Response TypeScript Interface

```typescript
interface VisitorInsightsResponse {
  requestId: string;
  success: boolean;
  period: { from: string; to: string };
  summary: {
    totalVisitors: number;
    totalSessions: number;
    avgSessionDuration: number;
    consentRate: number;           // ۰-۱
  };
  timeSeries: {
    timestamp: string;
    visitors: number;
    sessions: number;
    consentRate: number;
  }[];
  distributions: {
    consentTiers: { tier: string; count: number; percentage: number }[];
    languages: { language: string; count: number; percentage: number }[];
    devices: { device: string; count: number; percentage: number }[];
    countries: { country: string; count: number; percentage: number }[];
  };
  kAnonymityCheck: {
    kValue: number;                // حداقل k برای anonymity
    compliant: boolean;
    warnings: string[];
  };
  generatedAt: string;
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | API Key نامعتبر |
| `FORBIDDEN` | `403` | API Key سطح admin ندارد |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۱۰۰ req/min |

#### Example Usage

```typescript
import { getAdminVisitorInsights } from '@awaf/api';

const result = await getAdminVisitorInsights({
  apiKey: 'ak_admin_prod_xxx',
  dateFrom: '2026-04-01',
  dateTo: '2026-04-27',
  granularity: 'daily',
  metrics: ['visitors', 'consentRate', 'tierDistribution'],
});

console.log(`Total visitors: ${result.summary.totalVisitors}`);
console.log(`Consent rate: ${(result.summary.consentRate * 100).toFixed(1)}%`);
console.log(`k-Anonymity compliant: ${result.kAnonymityCheck.compliant}`);
```

---

### Endpoint ۱۶: GET /api/admin/technology-pulse/sources

**هدف:** مدیریت منابع Technology Pulse (T1/T2/T3).

| مشخصه | مقدار |
|-------|-------|
| **Auth** | API Key (Admin) |
| **Rate Limit** | ۳۰ req/min/key |
| **Timeout** | ۱۰ ثانیه |

#### Request TypeScript Interface (Query Parameters)

```typescript
interface PulseSourcesQuery {
  apiKey: string;
  trustTier?: 'T1' | 'T2' | 'T3';
  status?: 'active' | 'paused' | 'deprecated';
  category?: string;
  page?: number;
  limit?: number;
}
```

#### Response TypeScript Interface

```typescript
interface PulseSourcesResponse {
  requestId: string;
  success: boolean;
  sources: {
    id: string;
    name: string;
    url: string;
    trustTier: 'T1' | 'T2' | 'T3';
    category: string;
    status: 'active' | 'paused' | 'deprecated';
    ingestionCount: number;
    lastIngestedAt?: string;
    avgTrustScore: number;
    provenanceValidationRate: number;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  summary: {
    totalSources: number;
    activeSources: number;
    t1Count: number;
    t2Count: number;
    t3Count: number;
  };
}
```

#### Error Codes

| کد | Status | سناریو |
|----|--------|--------|
| `UNAUTHORIZED` | `401` | API Key نامعتبر |
| `FORBIDDEN` | `403` | API Key سطح admin ندارد |
| `RATE_LIMIT_EXCEEDED` | `429` | بیش از ۳۰ req/min |

#### Example Usage

```typescript
import { getAdminPulseSources } from '@awaf/api';

const result = await getAdminPulseSources({
  apiKey: 'ak_admin_prod_xxx',
  trustTier: 'T1',
  status: 'active',
  page: 1,
  limit: ۲۰,
});

console.log(`T1 sources: ${result.summary.t1Count}`);
result.sources.forEach(s => {
  console.log(`[${s.trustTier}] ${s.name} (${s.avgTrustScore.toFixed(2)})`);
});
```

---

## پیوست: نمودار وابستگی Endpointها

```
POST /api/context/handshake          (Auth: None)
         │
         ▼
POST /api/context/consent            (Auth: Bearer)
         │
         ├───▶ POST /api/context/preference    (Auth: Bearer)
         │
         ├───▶ POST /api/interact               (Auth: Bearer)
         │       └───▶ POST /api/voice/transcribe  (Auth: Bearer)
         │       └───▶ GET  /api/suggestions        (Auth: None)
         │
         ├───▶ POST /api/visitor/memory          (Auth: Bearer)
         │       └───▶ GET  /api/visitor/memory
         │       └───▶ DELETE /api/visitor/memory
         │
         ├───▶ POST /api/claw/query              (Auth: Bearer)
         │       └───▶ POST /api/claw/ingest      (Auth: API Key)
         │       └───▶ POST /api/claw/admin/audit (Auth: API Key Admin)
         │
         ├───▶ GET  /api/technology-pulse        (Auth: None)
         │       └───▶ POST /api/technology-pulse/brief  (Auth: Bearer)
         │
         ├───▶ GET  /api/admin/visitor-insights  (Auth: API Key Admin)
         └───▶ GET  /api/admin/technology-pulse/sources (Auth: API Key Admin)
```

---

## پیوست: جدول خلاصه Auth & Rate Limits

| گروه | Endpoint | Auth | Rate Limit | Timeout |
|------|----------|------|------------|---------|
| Handshake | POST /api/context/handshake | None | ۱۰/min/IP | ۵s |
| Handshake | POST /api/context/consent | Bearer | ۵/min/visitor | ۳s |
| Handshake | POST /api/context/preference | Bearer | ۱۰/min/visitor | ۳s |
| Interaction | POST /api/interact | Bearer | ۳۰/۶۰min | ۱۵s |
| Interaction | POST /api/voice/transcribe | Bearer | ۱۰/min/visitor | ۳۰s |
| Interaction | GET /api/suggestions | None | ۲۰/min/IP | ۳s |
| Tech Pulse | GET /api/technology-pulse | None | ۳۰/min/IP | ۵s |
| Tech Pulse | POST /api/technology-pulse/brief | Bearer | ۵/min/visitor | ۳۰s |
| Memory | POST /api/visitor/memory | Bearer | ۱۰/min/visitor | ۵s |
| Memory | GET /api/visitor/memory | Bearer | ۲۰/min/visitor | ۵s |
| Memory | DELETE /api/visitor/memory | Bearer | ۲/hour/visitor | ۱۰s |
| OpenClaw | POST /api/claw/query | Bearer | ۱۵/min/visitor | ۱۰s |
| OpenClaw | POST /api/claw/ingest | API Key | ۶۰/min/key | ۱۰s |
| OpenClaw | POST /api/claw/admin/audit | API Key Admin | ۳۰/min/key | ۱۰s |
| Admin | GET /api/admin/visitor-insights | API Key Admin | ۱۰۰/min/key | ۱۰s |
| Admin | GET /api/admin/technology-pulse/sources | API Key Admin | ۳۰/min/key | ۱۰s |

---

*این سند بخشی از مستندات SDK AWAF است. برای معماری کلی به ARCHITECTURE.md و برای قراردادهای کدنویسی به CODING_CONVENTIONS.md مراجعه کنید.*
