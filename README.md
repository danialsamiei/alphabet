
<div dir="rtl" align="right">

# AWAF SDK — Alefba Web-Aware Framework

> **یک چارچوب AI-aware برای وب** که در لحظه ورود هر بازدیدکننده، خود را با زبان، دستگاه، نیت، و سطح توقع او تطبیق می‌دهد.

</div>

<p align="center">
  <img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square&logo=githubactions&logoColor=white" alt="Build" />
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square&logo=npm&logoColor=white" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square&logo=opensourceinitiative&logoColor=white" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/pnpm-9.0+-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

<div dir="rtl" align="right">

## AWAF چیست؟

**AWAF (Alefba Web-Aware Framework)** یک SDK TypeScript/React است که وب‌سایت‌ها را از «صفحات ایستا» به «پلتفرم‌های AI-aware» ارتقا می‌دهد. AWAF در millisecond‌های اول ورود بازدیدکننده، زمینهٔ او را تشخیص داده و UI را به‌طور real-time تطبیق می‌دهد.

### مشکلی که حل می‌کند

امروزه اکثر وب‌سایت‌ها فارغ از اینکه بازدیدکننده چه کسی است، چه زبان دارد، از چه دستگاهی استفاده می‌کند، یا چه هدفی دارد، **یکسان نمایش داده می‌شوند**. AWAF این پارادایم را تغییر می‌دهد:

- **زبان بازدیدکننده** را در millisecond اول تشخیص می‌دهد و UI را RTL/LTR و localized می‌کند.
- **دستگاه و قابلیت‌های GPU** را بررسی کرده و بین ۵ لایه visual fidelity انتخاب می‌کند (از R3F immersive تا text-only accessible).
- **نیت بازدیدکننده** را از سیگنال‌های passive (زبان، timezone، referrer، UTM) استنتاج و محتوا را شخصی‌سازی می‌کند.
- **حافظه cross-session** را با رضایت صریح کاربر (consent ladder) و جداسازی دامنه‌ای (domain isolation) مدیریت می‌کند.
- **امنیت** را با ۸ دستهٔ threat mitigation مطابق OWASP Top 10 for LLMs 2025 و NIST AI 100-1 تضمین می‌کند.

### ویژگی‌های منحصربه‌فرد

| ویژگی | تفاوت AWAF |
|-------|-----------|
| Context Handshake | ۶ مرحلهٔ detect→enrich→decide→display→consent→morph در کمتر از ۱۰۰ms |
| Memory Mesh | ۴ طبقه حافظه از NO_MEMORY تا ENRICHED با vector embedding |
| UI Degradation | ۵ لایه adaptive rendering بر اساس capabilities واقعی دستگاه |
| Technology Pulse | سیستم ingestion و trust scoring با C2PA provenance |
| LLM Protocols | ۴ پروتکل (MCP / A2A / QR Handoff / Direct API) با normalization یکپارچه |
| Privacy-First | Consent ladder، DNT/GPC auto-downgrade، حق فراموش‌شدگی (GDPR Art. 17) |
| Defense in Depth | ۸ دسته threat mitigation مطابق OWASP LLM Top 10 2025 و NIST AI 100-1 |

### برای چه کسانی؟

- **توسعه‌دهندگان وب** که می‌خواهند وب‌سایت‌هایشان بدون دردسر localization، adaptive rendering، و AI-aware interaction داشته باشند.
- **معماران نرم‌افزار** که به دنبال monorepo type-safe با جداسازی لایه‌ها و پروتکل‌های LLM یکپارچه هستند.
- **AI agents** که برای interpretability architecture و navigation بین فایل‌ها نیاز به documentation دقیق دارند.

</div>

---

<div dir="rtl" align="right">

## ویژگی‌های کلیدی (Key Features)

- **Context Handshake** — شش‌مرحلهٔ detect→enrich→decide→display→consent→morph برای تطبیق لحظه‌ای UI بر اساس سیگنال‌های passive بازدیدکننده
- **Memory Mesh** — مدیریت حافظهٔ چهار‌طبقه با ConsentTierManager (ماشین حالت سه‌حالته: pending → granted → revoked)، domain isolation، و حق فراموش‌شدگی
- **۵ لایه UI Degradation** — R3F immersive → CSS3D → Canvas2D → Static HTML → Text-Only accessible بر اساس GPU tier و WebGL support
- **Technology Pulse** — Signal ingestion از منابع T1/T2/T3 با source trust scoring و C2PA provenance chain برای تولید briefهای فناوری
- **LLM Protocols** — MCP Server / A2A Protocol / QR Handoff / Direct API Adapter با AWAFRequest/AWAFResponse normalization یکپارچه
- **Privacy-First Design** — Consent ladder (۴ tier)، DNT/GPC auto-downgrade به Tier 0، k-anonymity analytics (k≥۵)
- **Defense in Depth** — ۸ دستهٔ threat mitigation: Prompt Injection (LLM01)، Memory Poisoning، Over-Personalization، Privacy Violation، Hallucination، Content Sensitivity، Voice Abuse، Tracking Opacity
- **TypeScript Strict** — ۱۱ مدل دادهٔ strongly-typed، ۶۰+ type definition، utility types برای partial/readonly/nullable
- **Streaming SSE** — پشتیبانی از Server-Sent Events برای endpointهای real-time
- **Voice Interaction** — webhook Whisper API با Azure Speech Services TTS، ۲۰۰k chars/month free tier

</div>

---

<div dir="rtl" align="right">

## معماری (Architecture Overview)

SDK از هشت لایهٔ مجزا تشکیل شده است که هر کدام در `package` مستقل monorepo قرار می‌گیرند. این تفکیک به پروژه‌ها اجازه می‌دهد صرفاً packageهای مورد نیاز خود را install کنند.

</div>

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/demo                                 │
│         اپلیکیشن نمونه برای تست و توسعه                     │
├─────────────────────────────────────────────────────────────┤
│  packages/ui    │  packages/protocols  │  packages/security │
│  ۵ لایه UI     │  MCP/A2A/QR/API      │  Threat mitigation │
│  degradation   │  adapters            │  + NIST AI 100-1   │
├─────────────────────────────────────────────────────────────┤
│  packages/api          │          packages/core             │
│  ۱۶ endpoint client    │  types + config + logger + events  │
│  + streaming           │  + memory mesh + context handshake │
└─────────────────────────────────────────────────────────────┘
```

<div dir="rtl" align="right">

**ترتیب وابستگی‌های build:**

</div>

```
@awaf/core      ← هیچ وابستگی داخلی ندارد (پایه‌ترین)
@awaf/api       ← @awaf/core
@awaf/security  ← @awaf/core
@awaf/protocols ← @awaf/core + @awaf/api
@awaf/ui        ← @awaf/core + @awaf/api
@awaf/demo      ← همهٔ packages
```

<div dir="rtl" align="right">

**جریان دادهٔ کلی (Data Flow):**

۱. بازدیدکننده وارد وب‌سایت می‌شود → **Context Handshake** شش‌مرحله‌ای اجرا می‌شود.
۲. بر اساس نتیجهٔ handshake، **UILayerSelector** یکی از ۵ لایهٔ UI را انتخاب می‌کند.
۳. تعاملات بازدیدکننده از طریق **Runtime Loop** (detect → fetch → validate → render → commit) پردازش می‌شود.
۴. درخواست‌های LLM از طریق **Protocol Adapter Layer** (MCP/A2A/QR/API) به AWAFRequest نرمال‌سازی می‌شوند.
۵. حافظهٔ بازدیدکننده در **Memory Mesh** (۴ tier با Domain Firewall) ذخیره می‌شود.
۶. سیگنال‌های فناوری از طریق **Technology Pulse** (ingestion pipeline با C2PA provenance) پردازش می‌شوند.
۷. تمام ورودی‌ها از **Security Layer** (OWASP LLM01 defense in depth) عبور می‌کنند.

</div>

---

<div dir="rtl" align="right">

## شروع سریع (Quick Start)

### پیش‌نیازها

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0

### نصب

</div>

```bash
# کلون کردن مخزن
git clone https://github.com/danialsamiei/awaf.git
cd awaf

# نصب dependencies
pnpm install

# build اولیهٔ تمام packages
pnpm build

# اجرای تست‌ها
pnpm test

# اجرای type check
pnpm typecheck
```

<div dir="rtl" align="right">

### اجرای demo

</div>

```bash
cd apps/demo
pnpm dev
# اپلیکیشن demo در http://localhost:5173 در دسترس خواهد بود
```

<div dir="rtl" align="right">

### استفاده در پروژهٔ خود

</div>

```bash
# نصب packageهای مورد نیاز
pnpm add @awaf/core @awaf/api @awaf/ui
```

<div dir="rtl" align="right">

### مثال سادهٔ integration

</div>

```typescript
import { ContextHandshakeClient } from '@awaf/core';
import { AWAFConfig } from '@awaf/core';

const config = new AWAFConfig({
  apiBaseUrl: 'https://your-api.com/api',
  defaultConsentTier: 'ANONYMOUS',
  defaultLanguage: 'fa',
});

const handshake = new ContextHandshakeClient({
  endpoint: '/api/context/handshake',
  timeoutMs: 5000,
  showConsentPrompt: true,
  rootSelector: 'html',
  callbacks: {
    onPhaseChange: (phase) => console.log('Phase:', phase),
    onComplete: (result) => console.log('Handshake complete:', result),
  },
});

// شروع handshake شش‌مرحله‌ای
await handshake.performHandshake();
```

<div dir="rtl" align="right">

### استفاده از Runtime Loop

Runtime Loop چرخهٔ پردازش تعاملات بازدیدکننده است:

</div>

```typescript
import { RuntimeLoop } from '@awaf/ui';

const loop = new RuntimeLoop({
  apiClient: awafClient,
  updateIntervalMs: 3000,
  state: AWAFState,
  activeLayer: 'CSS3D',
  animationFrameId: null,
});

await loop.tick({ visitor_id: 'anon-xxx' });
// detect → fetch → validate → render → commit
```

---

<div dir="rtl" align="right">

## بسته‌ها (Packages)

| Package | مسیر | توضیحات | وابستگی‌ها |
|---------|------|---------|-----------|
| `@awaf/core` | `packages/core/` | تایپ‌های پایه (۱۱ model + ۶۰+ type)، config (`AWAFConfig`)، logger (`AwafLogger`)، event hub (`AwafEventHub`)، memory mesh (۴ tier + Domain Firewall)، context handshake (`ContextHandshakeClient`) | هیچ |
| `@awaf/api` | `packages/api/` | کلاینت ۱۶ endpoint با تایپ کامل، validation، streaming SSE، rate limit awareness، error mapping | `@awaf/core` |
| `@awaf/ui` | `packages/ui/` | ۵ لایهٔ UI degradation (`Layer1R3F` → `Layer5TextOnly`)، React hooks (`useContextHandshake`، `useConsentManager`)، adaptive components | `@awaf/core` + `@awaf/api` |
| `@awaf/protocols` | `packages/protocols/` | آداپتورهای MCP Server (`context_handshake` / `memory_query` / `technology_pulse` tools)، A2A Protocol (`Task`/`Artifact`)، QR Handoff (encrypted payload)، Direct API Adapter | `@awaf/core` + `@awaf/api` |
| `@awaf/security` | `packages/security/` | Input sanitization (OWASP LLM01 edge validation)، threat mitigation (۸ threat category)، audit logging (`SecurityAuditLogger`)، NIST AI 100-1 alignment | `@awaf/core` |
| `@awaf/demo` | `apps/demo/` | اپلیکیشن نمونهٔ قابل اجرا با Vite + React + Tailwind، نمایش ۵ لایهٔ UI degradation، Technology Pulse dashboard | همهٔ packages |

### ساختار monorepo

```
awaf/
├── packages/
│   ├── core/          — src/models/ + src/config/ + src/logger/ + src/events/
│   │                    src/memory/ + src/context/
│   ├── api/           — src/services/ (۱۶ endpoint client file)
│   ├── ui/            — src/components/layers/ + src/hooks/ + src/utils/
│   ├── protocols/     — src/mcp/ + src/a2a/ + src/qr/ + src/api-adapter/
│   └── security/      — src/validators/ + src/threats/ + src/audit/
├── apps/
│   └── demo/          — src/ + public/ + mock server
├── docs/
│   ├── API_REFERENCE.md
│   ├── DEVELOPMENT.md
│   ├── CONTRIBUTING.md
│   └── AGENTS.md
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

</div>

---

<div dir="rtl" align="right">

## Context Handshake — دست دادن زمینه‌ای

Context Handshake قلب تپندهٔ AWAF است. این فرآیند شش‌مرحله‌ای در millisecond‌های اول ورود بازدیدکننده اجرا می‌شود و تصمیم می‌گیرد UI چگونه render شود.

### ۶ مرحلهٔ Handshake

| # | مرحله | توضیح | زمان | سیگنال‌ها |
|---|-------|-------|------|----------|
| ۱ | **detect** | جمع‌آوری passive signals از browser | < ۵ms | `navigator.language`, `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.userAgent`, `document.referrer`, UTM params |
| ۲ | **enrich** | enrichment سمت edge با اطلاعات coarse | < ۵۰ms | IP-to-coarse-geo (شهر/کشور)، referrer categorization، UTM campaign mapping |
| ۳ | **decide** | تصمیم‌گیری با LLM/RAG | < ۱۰۰ms | locale پیشنهادی، intentها (بازدیدکننده/دانشجو/مشتری)، theme، hero copy، visual mood |
| ۴ | **display** | نمایش گزینه‌ها + transparency | < ۵ms | «این زبان از مرورگر شما تشخیص داده شد» |
| ۵ | **consent** | دریافت/به‌روزرسانی consent | async | با رعایت DNT/GPC، auto-downgrade به Tier 0 |
| ۶ | **morph** | اعمال UI config روی DOM | < ۵ms | lang، dir، CSS variables (`--awaf-primary-color`)، hero copy update |

### حالت Privacy-First (Tier 0)

اگر بازدیدکننده **DNT** (`navigator.doNotTrack`) یا **GPC** (`navigator.globalPrivacyControl`) فعال کرده باشد، handshake بدون consent prompt تکمیل شده و به‌طور خودکار به **Tier 0 (NO_MEMORY)** downgrade می‌شود. در این حالت:

- هیچ داده‌ای — نه روی client (localStorage/cookie) و نه روی server — persist نمی‌شود.
- anonymous ID با prefix `anon-` و UUIDv4 تولید می‌شود.
- garbage collection هر ۶ ساعت اجرا می‌شود.
- data retention حداکثر ۲۴ ساعت است.

### حالت Consented (Tier 2)

با consent صریح بازدیدکننده، `ConsentTierManager` state را از `pending` به `granted` transition می‌دهد. در این حالت:

- preferences显式 (language، theme، accessibility) cross-session persist می‌شوند.
- localStorage به‌عنوان performance caching استفاده می‌شود.
- source همیشه `'manual'` است — چون کاربر显ּ انتخاب کرده.
- `VisitorConsent.expires_at` پس از ۱۲ ماه انقضا دارد.

### حالت Enriched (Tier 3)

با advanced explicit consent برای behavioral profiling:

- vector embedding ۷۶۸-dimension برای هر memory entry ذخیره می‌شود.
- selective retrieval با semantic similarity (threshold ≥ ۰.۷۲) — کاهش ۹۳٪ مصرف توکن.
- anomaly detection قبل از persist اجباری است (OWASP LLM01 defense).
- content حداکثر ۴۰۹۶ کاراکتر.
- TTL پیش‌فرض ۹۰ روز (GDPR storage limitation).

</div>

---

<div dir="rtl" align="right">

## لایه‌های تخریب UI (UI Degradation Layers)

AWAF بر اساس **capabilities واقعی دستگاه** (GPU tier، WebGL support، prefers-reduced-motion، hardware concurrency) یکی از ۵ لایهٔ زیر را انتخاب و render می‌کند. این فرآیند درون `UILayerSelector` به‌صورت offline اجرا می‌شود و در صورت fail، graceful downgrade دارد.

| لایه | نام | نیازمندی‌ها | حالت | فایل |
|------|-----|------------|------|------|
| ۱ | **R3F** — React Three Fiber | WebGL 2.0، GPU tier HIGH، avg FPS ≥ ۳۰ | Immersive 3D scene با interactive particles، post-processing bloom/tonemapping | `Layer1R3F.tsx` |
| ۲ | **CSS3D** — CSS Transforms 3D | CSS 3D transforms support، GPU tier MEDIUM | Parallax depth بدون WebGL، perspective + translate3d | `Layer2CSS3D.tsx` |
| ۳ | **Canvas2D** — HTML5 Canvas | Canvas API support، GPU tier LOW | Particle system 2D با mouse interaction | `Layer3Canvas2D.tsx` |
| ۴ | **Static HTML** — Semantic DOM | همهٔ مرورگرها | Zero-JS animation، CSS keyframes، keyboard accessible | `Layer4StaticHTML.tsx` |
| ۵ | **Text-Only** — ARIA Landmarks | Screen reader، low-power device | ARIA landmarks، screen reader optimized، zero animation | `Layer5TextOnly.tsx` |

### ماتریس capability → layer

| GPU Tier | WebGL 2.0 | prefers-reduced-motion | hardwareConcurrency | Layer انتخابی |
|----------|-----------|------------------------|---------------------|---------------|
| HIGH | ✅ | no | ≥ ۴ | R3F (Layer ۱) |
| MEDIUM | ✅ | no | ≥ ۲ | CSS3D (Layer ۲) |
| LOW | ❌ | — | ≥ ۲ | Canvas2D (Layer ۳) |
| LOW | ❌ | reduce | < ۲ | Static HTML (Layer ۴) |
| — | — | reduce | < ۲ | Text-Only (Layer ۵) |

### downgrade خودکار (Auto-Degrade)

- `prefers-reduced-motion: reduce` → downgrade از R3F به CSS3D
- GPU tier LOW detected → downgrade از Canvas2D به Static HTML
- `navigator.hardwareConcurrency < 2` → downgrade به Text-Only
- WebGL context lost → downgrade به CSS3D
- Canvas context lost → downgrade به Static HTML

</div>

---

<div dir="rtl" align="right">

## مرجع API (API Reference)

SDK تمام ۱۶ endpoint AWAF را با تایپ کامل TypeScript، validation، error handling، و rate limit awareness پیاده‌سازی می‌کند. هر endpoint دارای متد متناظر در `apiClient` است.

| # | Method | Path | Auth | Rate Limit | فایل کلاینت | توضیح |
|---|--------|------|------|-----------|------------|-------|
| ۱ | POST | `/api/context/handshake` | None | ۱۰ req/min/IP | `handshake.ts` | شروع Context Handshake شش‌مرحله‌ای |
| ۲ | POST | `/api/context/consent` | Bearer | ۵ req/min/visitor | `consent.ts` | به‌روزرسانی VisitorConsent |
| ۳ | POST | `/api/context/preference` | Bearer | ۱۰ req/min/visitor | `preference.ts` | ذخیره/به‌روزرسانی VisitorPreference |
| ۴ | GET | `/api/suggestions` | None | ۲۰ req/min/IP | `suggestions.ts` | دریافت AWAFSuggestion[] |
| ۵ | POST | `/api/interact` | Bearer | ۳۰ req/min (۶۰ برای premium) | `interact.ts` | پردازش AWAFInteraction |
| ۶ | POST | `/api/voice/transcribe` | Bearer | ۱۰ req/min/visitor | `voice-transcribe.ts` | Whisper STT + Azure TTS |
| ۷ | POST | `/api/visitor/memory` | Bearer | ۱۰ req/min/visitor | `visitor-memory-post.ts` | ذخیره VisitorMemory |
| ۸ | GET | `/api/visitor/memory` | Bearer | ۲۰ req/min/visitor | `visitor-memory-get.ts` | بازیابی VisitorMemory |
| ۹ | DELETE | `/api/visitor/memory` | Bearer | ۲ req/hour/visitor | `visitor-memory-delete.ts` | حذف کامل (GDPR Art. 17) |
| ۱۰ | GET | `/api/technology-pulse` | None | ۳۰ req/min/IP | `technology-pulse.ts` | دریافت TechnologySignal[] |
| ۱۱ | POST | `/api/technology-pulse/brief` | Bearer | ۵ req/min/visitor | `technology-pulse-brief.ts` | تولید TechnologyBrief با RAG |
| ۱۲ | POST | `/api/claw/query` | Bearer | ۱۵ req/min/visitor | `claw-query.ts` | پرس‌وجو در حافظه CLAW |
| ۱۳ | POST | `/api/claw/ingest` | API Key | ۶۰ req/min/key | `claw-ingest.ts` | Ingest signal به CLAW |
| ۱۴ | POST | `/api/claw/admin/audit` | API Key | ۳۰ req/min/key | `claw-admin-audit.ts` | Audit query با gate logs |
| ۱۵ | GET | `/api/admin/visitor-insights` | API Key | ۱۰۰ req/min/key | `admin-visitor-insights.ts` | داشبورد aggregated analytics |
| ۱۶ | GET | `/api/admin/technology-pulse/sources` | API Key | ۳۰ req/min/key | `admin-pulse-sources.ts` | مدیریت منابع pulse |

> **برای جزئیات کامل تایپ‌ها، validation، و error handling هر endpoint →** [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)

</div>

---

<div dir="rtl" align="right">

## حافظه و حریم خصوصی (Memory & Privacy)

### نردبان رضایت (Consent Ladder)

معماری حافظه AWAF بر چهار طبقه استوار است. انتقال بین طبقات صرفاً از طریق **ارتقای consent صریح** امکان‌پذیر است و downgrade از طریق `revoke()` یا `reset()` انجام می‌شود. این ساختار با **GDPR Article 5(1)(a)** (consent به‌عنوان مبنای قانونی پردازش) همسو است.

| Tier | نام | دادهٔ ذخیره‌شده | TTL | نیازمندی | مبنای حقوقی |
|------|-----|----------------|-----|---------|-----------|
| ۰ | **NO_MEMORY** | هیچ — صرفاً سیگنال‌های passive | session-only | هیچ — DNT/GPC auto | حداقل پردازش |
| ۱ | **ANONYMOUS** | anonymous ID، UI state | ۲۴ ساعت | implied consent | Legitimate interest |
| ۲ | **CONSENTED** | preferences显式، cross-session | ۹۰ روز | explicit consent | GDPR Art. 5(1)(a) |
| ۳ | **ENRICHED** | vector embedding + behavioral patterns | ۹۰ روز | advanced explicit consent | GDPR Art. 4(4) profiling |

### ConsentTierManager — ماشین حالت

`ConsentTierManager` یک ماشین حالت سه‌حالته است که انتقال بین `pending` → `granted` → `revoked` را مدیریت می‌کند:

- **grant()** — upgrade مجاز؛ downgrade از طریق grant ممنوع.
- **revoke()** — حق لغو در هر زمان (GDPR Article 7).
- **reset()** — بازنشانی کامل به `pending`.
- **handlePrivacySignal()** — در صورت DNT/GPC، خودکار Tier 0.
- **invalidateOnPolicyChange()** — در صورت تغییر privacy policy، consentهای قدیمی به `pending` downgrade می‌شوند.

### جداسازی دامنه (Domain Isolation)

هفت collection مجزا در vector database با `DomainFirewall` داخلی:

| دامنه | Trust Level | TTL | مجاز به write | مجاز به read |
|-------|-------------|-----|--------------|-------------|
| `general` | T1 | ۳۶۵ روز | admin_authenticated | site_specific، ideas |
| `site_specific` | T1 | ۱۸۰ روز | site_owner، awaf_admin | general |
| `visitor` | T2 | ۹۰ روز | visitor_self، personalization_system | self-only |
| `class_notes` | T1 | ۳۶۵ روز | instructor_authenticated | visitor (با consent) |
| `ideas` | T1 | ۳۶۵ روز | author_reviewer_dual_sign | general |
| `social` | T3 | ۳۰ روز | external_api، scraper | none |
| `tech_pulse` | T1 | ۱۴ روز | pipeline_human_curator | site_specific، general |

- **Cross-domain write = NEVER** — `canWrite` همیشه `false` برای دامنه‌های مختلف.
- **Cross-domain read = gate-based** — صرفاً از طریق `crossDomainReadAllowed`显式 مجاز است.
- دامنهٔ `social` (T3) — بیشترین attack surface؛ auto-delete در anomaly detection.

### حق فراموش‌شدگی (Right to Erasure)

- `DELETE /api/visitor/memory` — حذف کامل visitor context + preferences + memory entries + vector embeddings.
- پس از erase: `VisitorConsent.state` به `pending` reset می‌شود.
- audit trail با `audit_log_id` قابل trace — log به‌صورت جداگانه ۲۴ ماه نگهداری می‌شود.
- مطابق **GDPR Article 17** — Right to Erasure.

### k-Anonymity Analytics

dashboard admin فقط داده‌های aggregated با **k-anonymity guarantee** (پیش‌فرض k=۵) نمایش می‌دهد. هیچ گزارشی برای گروه‌های کمتر از ۵ بازدیدکننده تولید نمی‌شود. این امر از re-identification افراد از طریق query combinatory جلوگیری می‌کند.

### Integrity Audit Engine

- **Drift Detection** — تغییر cosine distance بیش از threshold بین snapshots دوره‌ای.
- **Outlier Detection** — شناسایی ورودی‌های دور از مرکز با فاصلهٔ σ.
- **Cross-Domain Contamination** — بررسی leak داده بین collectionهای vector DB.
- Frequency: T1 هر ۲۴ ساعت، T2 هر ۷۲ ساعت، T3 هر ۱۲ ساعت.

</div>

---

<div dir="rtl" align="right">

## پروتکل‌های LLM (LLM Protocols)

AWAF چهار پروتکل ارتباطی با LLMها را پشتیبانی می‌کند. تمام پروتکل‌ها درهای ورودی/خروجی خود را دارند اما از طریق **AWAFRequest/AWAFResponse normalization** به یک زبان مشترک ترجمه می‌شوند.

| پروتکل | استفاده | نرمال‌سازی | فایل |
|--------|---------|-----------|------|
| **MCP** — Model Context Protocol | Claude Desktop، IDE plugins | JSON-RPC 2.0 → AWAFRequest | `MCPServer.ts` |
| **A2A** — Agent-to-Agent | Cloud Agents (Google، AutoGen) | Task/Artifact → AWAFRequest | `A2AAdapter.ts` |
| **QR Handoff** — QR-Code Handoff | Mobile → Desktop، Air-gapped | Encrypted payload → AWAFRequest | `QRChannel.ts` |
| **Direct API** — OpenAI/Kimi/Claude | مستقیم | OpenAI-compatible format → AWAFRequest | `DirectAPIAdapter.ts` |

### MCP Server Tools

سرور MCP AWAF سه tool اصلی ارائه می‌دهد:

- **`context_handshake`** — اجرای handshake و دریافت UI config.
- **`memory_query`** — پرس‌وجو در Memory Mesh با semantic similarity.
- **`technology_pulse`** — دریافت TechnologySignal[] و تولید TechnologyBrief.

### A2A Task Lifecycle

- `submitted` → `working` → `input-required` → `completed` / `cancelled` / `failed`
- هر Task شامل `Artifact[]` با C2PA provenance است.

### QR Handoff

- payload با AES-GCM رمزنگاری می‌شود.
- channel server با TTL کوتاه (۵ دقیقه) عمل می‌کند.
- mobile camera → QR scan → decrypt → AWAFRequest.

</div>

---

<div dir="rtl" align="right">

## توسعه (Development)

برای راهنمای کامل توسعهٔ SDK، شامل:

- ساختار monorepo و pipeline Turborepo با remote caching
- قوانین TypeScript strict mode (`strict: true`، `noImplicitAny: true`)
- path mapping بین packages با `tsconfig` references
- پیکربندی Vite library mode (ESM + CJS dual output)
- سیستم Changesets برای semantic versioning و changelog
- aliasها: `@models/` → `../models/`，`@config/` → `../config/`
- target environment: browser (ES2020+) + Node.js (ES2022+)

**→ به [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) مراجعه کنید.**

### دستورات رایج

| دستور | توضیح |
|-------|-------|
| `pnpm install` | نصب تمام dependencies monorepo |
| `pnpm build` | build تمام packages (ترتیب: core → api → security → protocols → ui → demo) |
| `pnpm test` | اجرای تست‌های unit + integration |
| `pnpm typecheck` | type check تمام packages |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm dev` | اجرای demo app در localhost:5173 |
| `pnpm changeset` | ثبت changeset برای release |

</div>

---

<div dir="rtl" align="right">

## مشارکت (Contributing)

ما از مشارکت‌های code، documentation، translation، و security research استقبال می‌کنیم.

- **راهنمای مشارکت انسانی:** [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — شامل code style، PR template، review process
- **راهنمای agentهای AI:** [`docs/AGENTS.md`](docs/AGENTS.md) — شامل الگوهای prompt، قراردادهای فایل، checklists تایید، و نمونهٔ workflow Kimi Code

### گردش کار AI-native

این پروژه با رویکرد **AI-native development** ساخته شده است:

- پرامپت‌های ساختاریافته (structured prompts) برای Kimi Code و سایر AI agents
- هر prompt حداکثر ۳ فایل هدف مشخص می‌کند (عملیات CREATE یا EDIT)
- dependencyهای بین فایل‌ها با `[depends on: file_path]` نشان داده می‌شوند
- فایل‌های بزرگ‌تر از ۳۰۰ خط با `<split_point>` خرد می‌شوند
- خروجی هر prompt قابل کامپایل (type-safe) و testable است
- ۸۰٪ ساختار قابل تشریح با ASCII diagram است
- تایپ‌های کمکی (helper types) برای partial/readonly/nullable/undefined از ابتدا تعریف شده‌اند

</div>

---

<div dir="rtl" align="right">

## مجوز (License)

این پروژه تحت مجوز **MIT License** منتشر شده است. برای جزئیات بیشتر فایل [LICENSE](LICENSE) را ببینید.

</div>

---

<div dir="rtl" align="right">

## قدردانی (Acknowledgments)

AWAF SDK با رویکرد **AI-native development workflow** طراحی و توسعه یافته است. این بدان معناست که:

- architecture از ابتدا برای **interpretability توسط AI agents** طراحی شده — همهٔ classes با JSDoc، همهٔ interfaces با explicit field، و همهٔ functions با overload signatures مشخص شده‌اند.
- پرامپت‌ها به گونه‌ای نوشته شده‌اند که Kimi Code و سایر AI coding agents بتوانند بدون ابهام فایل‌های مشخصی را ویرایش یا ایجاد کنند — هر prompt حداکثر ۳ فایل هدف دارد.
- خروجی هر prompt قابل کامپایل (type-safe) و testable است — هیچ فایلی بدون تایپ ساخته نمی‌شود.
- مدیریت context window با `<split_point>` و dependency markers بهینه شده — فایل‌های بزرگ خرد می‌شوند و dependencyها显ּ نشان داده می‌شوند.
- این رویکرد نشان می‌دهد که AI agents نه‌تنها ابزارهای کمکی، بلکه **partnerهای اول-class در توسعهٔ نرم‌افزار** می‌توانند باشند.

### منابع الهام

- OWASP Top 10 for LLM Applications 2025
- NIST AI Risk Management Framework (AI 100-1)
- GDPR (General Data Protection Regulation)
- C2PA (Content Authenticity Initiative)
- Model Context Protocol (MCP) Specification
- Google A2A (Agent-to-Agent) Protocol

</div>

---

<p align="center">
  <sub>ساخته شده با ❤️ در چارچوب <strong>الفبا (Alefba)</strong> — جایی که وب، آگاه می‌شود.</sub>
</p>
