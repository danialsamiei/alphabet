# AWAF — AI Agent Onboarding Guide

> **نام فایل:** `AGENTS.md`
> **هدف:** اولین و مهم‌ترین فایلی که هر AI Agent (Kimi، GitHub Copilot Pro+، Codex، Claude Code، KiloCode) هنگام باز کردن repository می‌خواند.
> **زبان:** فارسی (Farsi) با حفظ اصطلاحات فنی انگلیسی.
> **نسخه:** 1.0.0
> **آخرین بروزرسانی:** 2025-06-15
> **مخاطب:** تمام AI Agents — این سند single source of truth پروژه AWAF است.
> **منبع:** AWAF SDK Prompt Suite (بخش‌های ۰ تا ۱۰)

---

## Project Identity

**AWAF (Alefba Web-Aware Framework)** یک چارچوب نرم‌افزاری TypeScript مبتنی بر React است که وب‌سایت‌ها را از «صفحات ایستا» به «تجربیات آگاه از بافتار» (context-aware experiences) تبدیل می‌کند. AWAF به جای تلاش برای «خواندن ذهن» کاربر، سیگنال‌های عینی و قابل مشاهده مرورگر را جمع‌آوری کرده و از آن‌ها برای سفارشی‌سازی شفاف، قابل حسابرسی و قابل revoked تجربه کاربری استفاده می‌نماید.

**Vision:** وب آگاه (web-aware) — وب‌سایتی که زبان کاربر را می‌شناسد، timezone او را می‌داند، دستگاه او را درک می‌کند، و بدون نقض حریم خصوصی، تجربه‌ای شخصی‌سازی‌شده ارائه می‌دهد.

**Mission:** ایجاد SDK و demonstration کاملی از اصول World-Aware Web در قالب یک framework تولیدی (generative) با ۵ لایه UI degradation، ۶ دامنه حافظه consent-tiered، و ۴ پروتکل ارتباطی.

**Problem it solves:** وب‌سایت‌های امروزی یا کاملاً ایستا هستند (one-size-fits-all) یا به tracking invasive متکی‌اند (cookies third-party، fingerprinting). AWAF راه سوم را ارائه می‌دهد: adaptation بر اساس سیگنال‌های passive مرورگر با رضایت صریح کاربر (explicit consent) و isolation دامنه‌ای (domain isolation).

---

## Architecture at a Glance

AWAF یک معماری ۸ لایه‌ای دارد که از ingestion سیگنال در لبه (edge) آغاز شده و تا تولید Technology Brief با RAG grounding ادامه می‌یابد. هر لایه autonomous است اما از طریق مدل‌های داده مشترک (shared data models) با هم در ارتباط‌اند.

### ASCII Diagram — 8 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 8: Technology Pulse        │ Signal Ingestion → Trust Scoring →      │
│ (Intellectual Fabric)            │ Brief Generation (RAG) → Verification   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 7: Security & Privacy      │ OWASP LLM01 Defense → NIST AI RMF →     │
│ (Defense in Depth)               │ Consent Manager → Differential Privacy  │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 6: Protocol Adaptation     │ MCP Adapter → A2A Adapter → QR Handoff  │
│ (Multi-Protocol Bridge)          │ → REST API Adapter                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 5: UI Degradation          │ Layer 1: R3F Immersive                  │
│ (5-Layer Progressive Enhancement)│ Layer 2: CSS 3D Transforms              │
│                                  │ Layer 3: Canvas 2D Particles            │
│                                  │ Layer 4: Static Semantic HTML           │
│                                  │ Layer 5: Text-Only / ARIA Landmarks     │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4: Memory Mesh             │ Tier 0: Passive (no storage)            │
│ (Consent-Tiered Memory)          │ Tier 1: Session (sessionStorage)        │
│   6 Domains × 4 Tiers            │ Tier 2: Profile (localStorage)          │
│                                  │ Tier 3: Learning (vector DB)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3: Intent Detection        │ 6 Intents: technology, collaboration,   │
│ (Probabilistic Intent Engine)    │ class_notes, philosophy, personal,      │
│                                  │ explore                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: Context Handshake       │ Phase 1: Signal Collection              │
│ (6-Phase Handshake Pipeline)     │ Phase 2: Signal Classification          │
│                                  │ Phase 3: Visitor Identification       │
│                                  │ Phase 4: Intent Detection               │
│                                  │ Phase 5: Language Negotiation           │
│                                  │ Phase 6: Layer Selection                │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 1: Signal Ingestion        │ Accept-Language, Timezone, User-Agent,  │
│ (Passive Browser Signals)        │ DNT/GPC, Screen Metrics, WebGL Support  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    Technology Pulse (Layer 8)                     │
│         ┌─────────────┐    ┌─────────────┐    ┌─────────┐        │
│         │ Ingestor    │───▶│ TrustScorer│───▶│ BriefGen│        │
│         └─────────────┘    └─────────────┘    └─────────┘        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  Security & Privacy (Layer 7)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │PromptInjection│ │MemoryIntegrity│ │VisitorConsentManager │  │
│  │   Defense     │ │    Guard      │ │   + RightToErasure    │  │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │  CostGuardian │ │Differential  │ │  NIST AI 100-1 Mapping  │  │
│  │  + CircuitBr  │ │  Privacy     │ │   (GOVERN/MAP/MEASURE/  │  │
│  │               │ │              │ │       MANAGE)           │  │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                 Protocol Adaptation (Layer 6)                     │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│    │  MCP     │   │   A2A    │   │  QR      │   │  REST    │    │
│    │ Adapter  │   │ Adapter  │   │ Handoff  │   │ Adapter  │    │
│    └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   UI Degradation (Layer 5)                      │
│  Layer 1: R3F ──▶ Layer 2: CSS3D ──▶ Layer 3: Canvas2D         │
│       │                │                  │                    │
│       └────────────────┬──────────────────┘                    │
│                        ▼                                        │
│              Layer 4: Static HTML ──▶ Layer 5: Text-Only        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    Memory Mesh (Layer 4)                          │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│   │general │ │site_   │ │visitor │ │class_  │ │ ideas  │  ...   │
│   │        │ │specific│ │        │ │notes   │ │        │         │
│   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │
│                        ▲                                        │
│   Consent Tiers: 0 (passive) → 1 (session) → 2 (profile) → 3    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  Intent Detection (Layer 3)                     │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│     │technology│ │collaborat│ │class_note│ │philosophy│         │
│     └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│     ┌──────────┐ ┌──────────┐                                   │
│     │ personal │ │ explore │                                   │
│     └──────────┘ └──────────┘                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  Context Handshake (Layer 2)                      │
│   Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5     │
│   Collect     Classify     Identify    Detect      Negotiate     │
│        │                                              │          │
│        └──────────────────┬──────────────────────────┘          │
│                           ▼                                     │
│                        Phase 6: Layer Selection                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  Signal Ingestion (Layer 1)                       │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
│   │ Accept-Lang │ │  Timezone   │ │ User-Agent  │ │ DNT/GPC  │  │
│   └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘  │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│   │Screen Metrics│ │ WebGL Supp. │ │Network Info │              │
│   └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Build Dependency Graph (Package Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                         apps/demo                                 │
│                    (Vite + React + R3F Demo)                      │
└────────────┬──────────────────────────────────────────────────────┘
             │ depends on
┌────────────▼──────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ @awaf/core   │  │  @awaf/api   │  │  @awaf/ui    │  │@awaf/cli│ │
│  │ (models +  │  │ (client +  │  │ (react     │  │ (scaffold│ │
│  │  handshake) │  │  server)    │  │  hooks)    │  │ + mock)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬───┘ │
│         │                │                │               │     │
│         └────────────────┴────────────────┴───────────────┘     │
│                                    │                              │
│                         ┌──────────▼──────────┐                  │
│                         │   @awaf/protocols   │                  │
│                         │  (MCP + A2A + QR)   │                  │
│                         └──────────┬──────────┘                  │
│                                    │                              │
│                         ┌──────────▼──────────┐                  │
│                         │   @awaf/security    │                  │
│                         │(consent + defense +  │                  │
│                         │    privacy + NIST)   │                  │
│                         └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

این پروژه یک monorepo مبتنی بر pnpm workspaces و Turborepo است.

```
awaf/
├── packages/
│   ├── core/                    # @awaf/core — مدل‌ها، handshake، context
│   │   ├── src/
│   │   │   ├── models/
│   │   │   │   ├── handshake.ts        # HandshakeRequest, HandshakeResponse
│   │   │   │   ├── visitor.ts          # VisitorContext, VisitorProfile
│   │   │   │   ├── consent.ts          # ConsentRecord, ConsentTier
│   │   │   │   ├── memory.ts           # MemoryEntry, MemoryDomain
│   │   │   │   ├── pulse.ts            # TechnologySignal, TrustTier
│   │   │   │   ├── intent.ts           # IntentType, IntentProbability
│   │   │   │   ├── language.ts         # LanguageNegotiationResult
│   │   │   │   ├── suggestion.ts       # Suggestion, SuggestionAction
│   │   │   │   ├── runtime.ts          # RuntimeConfig, RuntimeHealth
│   │   │   │   └── index.ts            # Barrel export همه مدل‌ها
│   │   │   ├── handshake/
│   │   │   │   └── HandshakeManager.ts  # 6-phase context handshake
│   │   │   ├── intent/
│   │   │   │   └── IntentDetector.ts    # Probabilistic intent engine
│   │   │   ├── language/
│   │   │   │   └── LanguageNegotiator.ts# 3-locale negotiation
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                     # @awaf/api — client HTTP + mock server
│   │   ├── src/
│   │   │   ├── client/
│   │   │   │   └── AwafClient.ts        # HTTP client برای ۱۶ endpoint
│   │   │   ├── server/
│   │   │   │   └── mock/                # MSW handlers + json-server
│   │   │   ├── test/
│   │   │   │   ├── server.ts            # MSW setupServer
│   │   │   │   ├── handlers.ts          # Aggregator handlerها
│   │   │   │   └── handlers/
│   │   │   │       ├── handshake.ts     # POST /api/v1/handshake
│   │   │   │       ├── visitor.ts       # GET/POST/PATCH visitor
│   │   │   │       ├── pulse.ts         # GET /api/v1/technology-pulse
│   │   │   │       ├── suggestion.ts    # POST /api/v1/suggestion/rank
│   │   │   │       ├── intent.ts        # GET /api/v1/intent/:type
│   │   │   │       ├── language.ts      # POST /api/v1/language/negotiate
│   │   │   │       ├── admin.ts         # GET/PATCH admin endpoints
│   │   │   │       └── auth.ts          # POST /api/v1/auth/session
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                      # @awaf/ui — React hooks + components
│   │   ├── src/
│   │   │   ├── hooks/
│   │   │   │   ├── useHandshake.ts      # 6-phase handshake hook
│   │   │   │   ├── useVisitorMemory.ts  # Consent-tiered memory hook
│   │   │   │   ├── useTechnologyPulse.ts# Pulse data hook
│   │   │   │   ├── useRuntimeLoop.ts    # Runtime heartbeat hook
│   │   │   │   ├── useLayerDetection.ts # 5-layer capability detection
│   │   │   │   ├── useConsent.ts        # Consent management UI hook
│   │   │   │   └── index.ts             # Barrel export
│   │   │   ├── components/
│   │   │   │   ├── LayerRouter.tsx      # 5-layer progressive router
│   │   │   │   ├── FloatingChipsGroup.tsx # 6 intent chips
│   │   │   │   ├── ConsentBanner.tsx    # GDPR-compliant consent UI
│   │   │   │   ├── LanguageNegotiationModal.tsx # Language selection
│   │   │   │   └── InputHub.tsx         # Voice/text input hub
│   │   │   ├── layers/
│   │   │   │   ├── Layer1R3F.tsx        # React Three Fiber immersive
│   │   │   │   ├── Layer2CSS3D.tsx      # CSS 3D transforms
│   │   │   │   ├── Layer3Canvas2D.tsx   # Canvas 2D particles
│   │   │   │   ├── Layer4StaticHTML.tsx # Semantic HTML static
│   │   │   │   └── Layer5TextOnly.tsx   # ARIA landmarks text-only
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── protocols/               # @awaf/protocols — protocol adapters
│   │   ├── src/
│   │   │   ├── mcp/
│   │   │   │   └── MCPAdapter.ts        # Model Context Protocol
│   │   │   ├── a2a/
│   │   │   │   └── A2AAdapter.ts        # Agent-to-Agent Protocol
│   │   │   ├── qr/
│   │   │   │   └── QRHandoffAdapter.ts  # QR Code Handoff
│   │   │   ├── api/
│   │   │   │   └── RESTAdapter.ts       # REST API Adapter
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── security/                # @awaf/security — defense & privacy
│   │   ├── src/
│   │   │   ├── consent/
│   │   │   │   ├── VisitorConsentManager.ts   # Jurisdiction-aware consent
│   │   │   │   ├── jurisdiction-rules.ts      # GDPR/CCPA/LGPD rules
│   │   │   │   ├── GoogleConsentAdapter.ts    # GCMv2 integration
│   │   │   │   └── RightToErasure.ts          # GDPR Article 17
│   │   │   ├── privacy/
│   │   │   │   └── DifferentialPrivacy.ts   # ε-DP for analytics
│   │   │   ├── security/
│   │   │   │   ├── PromptInjectionDefense.ts  # OWASP LLM01 defense
│   │   │   │   ├── MemoryIntegrityGuard.ts    # Domain isolation + audit
│   │   │   │   ├── CostGuardian.ts            # Circuit breaker + budget
│   │   │   │   └── NISTAIMapping.ts           # NIST AI RMF 1.0 mapping
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                     # @awaf/cli — tooling
│       ├── src/
│       │   ├── commands/
│       │   │   ├── create.ts            # Scaffold پروژه جدید
│       │   │   ├── generate.ts          # Generate component/hook
│       │   │   └── mock.ts              # Run mock server
│       │   ├── templates/
│       │   │   └── project/             # Template files for create
│       │   └── index.ts
│       ├── bin/
│       │   └── awaf.js                  # Entry point
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── demo/                    # Demo App v0 — implementation کامل ۵ لایه
│       ├── public/
│       │   └── mock/
│       │       ├── technology-pulse.json
│       │       ├── visitor-context.json
│       │       └── suggestions.json
│       ├── src/
│       │   ├── components/
│       │   │   ├── App.tsx
│       │   │   ├── LayerRouter.tsx
│       │   │   ├── FloatingChipsGroup.tsx
│       │   │   ├── InputHub.tsx
│       │   │   ├── LanguageNegotiationModal.tsx
│       │   │   ├── TechnologyPulse.tsx
│       │   │   ├── ConsentBanner.tsx
│       │   │   └── Footer.tsx
│       │   ├── layers/
│       │   │   ├── Layer1R3F.tsx
│       │   │   ├── Layer2CSS3D.tsx
│       │   │   ├── Layer3Canvas2D.tsx
│       │   │   ├── Layer4StaticHTML.tsx
│       │   │   └── Layer5TextOnly.tsx
│       │   ├── styles/
│       │   │   ├── breakpoints.css
│       │   │   ├── layers.css
│       │   │   ├── accessibility.css
│       │   │   ├── rtl.css
│       │   │   └── chips.css
│       │   └── index.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── mock-server/                 # json-server + faker.js برای توسعه
│   ├── server.js
│   ├── db.js
│   └── routes.json
│
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── API_REFERENCE.md
│   ├── SECURITY.md
│   ├── CONTRIBUTING.md
│   └── CODING_CONVENTIONS.md
│
├── e2e/                         # Playwright E2E tests
│   ├── layer-detection.spec.ts
│   ├── intent-chips.spec.ts
│   ├── language-negotiation.spec.ts
│   ├── consent-flow.spec.ts
│   └── accessibility.spec.ts
│
├── vitest.config.ts             # Vitest config (frontend unit tests)
├── jest.config.js               # Jest config (backend-style tests)
├── typedoc.config.js            # TypeDoc API docs generation
├── playwright.config.ts         # Playwright E2E config
├── turbo.json                   # Turborepo pipeline config
├── pnpm-workspace.yaml          # pnpm workspaces definition
├── package.json                 # Root package.json
├── tsconfig.json                # Root TypeScript config
└── README.md                    # Project overview
```

---

## Technology Stack

| لایه | تکنولوژی | هدف | نسخه |
|:-----|:---------|:----|:-----|
| زبان | TypeScript | تایپ‌گذاری قوی و safety | ≥ 5.4 |
| runtime | Node.js | backend و build | ≥ 18 |
| package manager | pnpm | workspaces + monorepo | ≥ 8 |
| build system | Turborepo | caching و parallel builds | ≥ 2 |
| bundler (demo) | Vite | fast HMR برای Demo App | ≥ 5 |
| UI framework | React | component-based UI | ≥ 18 |
| 3D rendering | React Three Fiber (R3F) | Layer 1 immersive | ≥ 8 |
| validation | Zod / Valibot | runtime schema validation | — |
| styling | CSS Variables + Container Queries | responsive design | native |
| RTL | Vazirmatn + CSS Logical Properties | Persian/Arabic support | — |
| تست unit | Vitest + Jest | dual runner برای speed/compatibility | — |
| تست integration | MSW (Mock Service Worker) | HTTP intercept بدون backend | ≥ 2 |
| تست E2E | Playwright | ۵ لایه UI + accessibility | ≥ 1.40 |
| mock data | json-server + @faker-js/faker | development بدون backend | — |
| documentation | TypeDoc + Docusaurus | API docs + guides | — |
| CLI | Commander + chalk + inquirer | interactive scaffolding | — |
| privacy | crypto.subtle (Web Crypto API) | hashing + encryption | native |
| vector DB | stub — Phase 2 | semantic search | — |
| immutable storage | AWS QLDB / append-only fs | provenance chain | Phase 2 |

---
## AI Agent Instructions

> **این مهم‌ترین بخش AGENTS.md است.** هر AI Agent (Kimi، GitHub Copilot Pro+، Codex، Claude Code، KiloCode) باید قبل از نوشتن هر خط کد، این بخش را به‌طور کامل بخواند. مغایرت با این دستورالعمل‌ها یک regression تلقی می‌شود.

### Before You Write Any Code

قبل از هرگونه تغییر در codebase، این فایل‌ها و این ترتیب را رعایت کنید:

| ترتیب | فایل | چرا باید خوانده شود |
|:-----|:-----|:--------------------|
| ۱ | `AGENTS.md` (همین فایل) | single source of truth برای معماری، قراردادها، و دستورالعمل‌ها |
| ۲ | `README.md` | overview پروژه، نحوه راه‌اندازی، و links به docs |
| ۳ | `docs/ARCHITECTURE.md` | جزئیات معماری و تصمیمات design |
| ۴ | `docs/DEVELOPMENT.md` | workflow توسعه، branching strategy، و environment setup |
| ۵ | `docs/CODING_CONVENTIONS.md` | قراردادهای نام‌گذاری، formatting، و code style |
| ۶ | `docs/SECURITY.md` | threat model، mitigation strategies، و privacy rules |
| ۷ | `package.json` | dependencies، scripts، و workspace config |
| ۸ | `turbo.json` | pipeline build و task dependencies |

**قانون طلایی:** اگر تسک شما به package دیگری وابسته است (مثلاً `@awaf/ui` به `@awaf/core` وابسته است)، ابتدا interfaceهای مورد نیاز را در `@awaf/core` پیاده‌سازی یا بررسی کنید، سپس به package بالادست بروید.

### Coding Standards

#### TypeScript Strict Mode
- `strict: true` در تمام `tsconfig.json`ها الزامی است.
- **هیچ استفاده‌ای از `any` مجاز نیست.** به جای آن از `unknown` + type narrowing یا `z.infer<typeof Schema>` استفاده کنید.
- تمام توابع عمومی (public) باید return type صریح داشته باشند.
- استفاده از `as` type assertion فقط در تست‌ها مجاز است.

#### Result<T, E> Pattern — Functional Error Handling
- به جای `throw` در منطق business، از الگوی `Result<T, E>` استفاده کنید:

```typescript
// ✅ صحیح
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: 'Division by zero' };
  return { ok: true, value: a / b };
}

// استفاده
const result = divide(10, 0);
if (!result.ok) {
  // handle error
}
```

- خطاهای `throw` فقط در موارد exceptional مجازند: corruption حافظه، failure زیرساخت، یا violation امنیتی.

#### Brand Types — Preventing Primitive Obsession
- از Brand Types برای جلوگیری از اشتباه گذاشتن stringهای هم‌شکل استفاده کنید:

```typescript
// ✅ صحیح
declare const __VisitorId: unique symbol;
export type VisitorId = string & { readonly [__VisitorId]: true };

export function createVisitorId(raw: string): VisitorId {
  if (!raw.startsWith('vst_')) throw new Error('Invalid visitor id');
  return raw as VisitorId;
}

// حالا امضای تابع زیر self-documenting است
function getVisitorProfile(id: VisitorId): VisitorProfile;
// getVisitorProfile('random_string') // ❌ compile error
```

#### JSDoc Docstrings
- هر interface، type alias، enum، تابع عمومی، و class باید JSDoc کامل داشته باشد.
- docstring باید شامل: هدف (what)، پارامترها (@param)، return value (@returns)، و مثال (@example) باشد.

```typescript
/**
 * Execute the 5-stage Technology Pulse ingestion pipeline.
 * Each stage appends one ProvenanceEntry to the chain.
 *
 * @param input — Raw signal input from RSS, webhook, or manual entry
 * @returns TechnologySignal with computed trust_score and provenance chain
 *
 * @example
 * const signal = await ingestor.ingest({
 *   channel: 'rss',
 *   sourceDomain: 'arxiv.org',
 *   rawHtml: '<article>...</article>',
 *   url: 'https://arxiv.org/abs/2501.00001',
 *   publishedAt: '2025-01-01T00:00:00Z',
 * });
 */
```

#### File Size Rule
- هیچ فایلی نباید از **۳۰۰ خط** فراتر رود.
- اگر یک فایل به ۳۰۰ خط نزدیک می‌شود، آن را به چند فایل کوچک‌تر split کنید.
- مثال: `brief-generator.ts` بزرگ شد → `brief-generator-helpers.ts` برای `verifyClaims` و `buildLocalizedInstruction`.
- مثال: `ingestor.ts` بزرگ شد → `pipeline/stage-1.ts` تا `pipeline/stage-5.ts`.

### File Creation Order

پروژه AWAF از سه Phase ساخت تشکیل می‌شود. هر Phase به Phase پیشین وابسته است. **هرگز** نباید Phase ۳ را قبل از تکمیل Phase ۱ شروع کرد.

#### Phase 1: Foundation (Sprint 1 — MVP Core)
| ترتیب | فایل | بسته | وابستگی |
|:---:|:-----|:-----|:--------|
| ۱ | `packages/core/src/models/*.ts` | @awaf/core | هیچ — foundation types |
| ۲ | `packages/core/src/handshake/HandshakeManager.ts` | @awaf/core | models |
| ۳ | `packages/core/src/intent/IntentDetector.ts` | @awaf/core | models |
| ۴ | `packages/core/src/language/LanguageNegotiator.ts` | @awaf/core | models |
| ۵ | `packages/security/src/consent/jurisdiction-rules.ts` | @awaf/security | هیچ |
| ۶ | `packages/security/src/consent/VisitorConsentManager.ts` | @awaf/security | jurisdiction-rules |
| ۷ | `packages/security/src/consent/GoogleConsentAdapter.ts` | @awaf/security | VisitorConsentManager |
| ۸ | `packages/api/src/client/AwafClient.ts` | @awaf/api | @awaf/core |
| ۹ | `packages/api/src/test/handlers/*.ts` | @awaf/api | @awaf/core |
| ۱۰ | `packages/ui/src/hooks/useHandshake.ts` | @awaf/ui | @awaf/api, @awaf/core |
| ۱۱ | `packages/ui/src/hooks/useConsent.ts` | @awaf/ui | @awaf/security |
| ۱۲ | `packages/ui/src/layers/Layer4StaticHTML.tsx` | @awaf/ui | @awaf/core |
| ۱۳ | `mock-server/server.js` | mock-server | هیچ |

#### Phase 2: Integration (Sprint 2 — Memory + Pulse + Protocols)
| ترتیب | فایل | بسته | وابستگی |
|:---:|:-----|:-----|:--------|
| ۱۴ | `packages/core/src/models/pulse.ts` | @awaf/core | types.ts |
| ۱۵ | `packages/core/src/pulse/types.ts` | @awaf/core | هیچ (foundation) |
| ۱۶ | `packages/core/src/pulse/provenance.ts` | @awaf/core | types.ts |
| ۱۷ | `packages/core/src/pulse/trust-scorer.ts` | @awaf/core | types.ts |
| ۱۸ | `packages/core/src/pulse/extractor.ts` | @awaf/core | types.ts |
| ۱۹ | `packages/core/src/pulse/ingestor.ts` | @awaf/core | types.ts, provenance.ts, trust-scorer.ts, extractor.ts |
| ۲۰ | `packages/core/src/pulse/brief-types.ts` | @awaf/core | types.ts |
| ۲۱ | `packages/core/src/pulse/verification.ts` | @awaf/core | brief-types.ts, types.ts |
| ۲۲ | `packages/core/src/pulse/brief-generator.ts` | @awaf/core | brief-types.ts, types.ts, verification.ts |
| ۲۳ | `packages/protocols/src/mcp/MCPAdapter.ts` | @awaf/protocols | @awaf/core |
| ۲۴ | `packages/protocols/src/a2a/A2AAdapter.ts` | @awaf/protocols | @awaf/core |
| ۲۵ | `packages/protocols/src/qr/QRHandoffAdapter.ts` | @awaf/protocols | @awaf/core |
| ۲۶ | `packages/ui/src/hooks/useVisitorMemory.ts` | @awaf/ui | @awaf/core |
| ۲۷ | `packages/ui/src/hooks/useTechnologyPulse.ts` | @awaf/ui | @awaf/core, @awaf/api |
| ۲۸ | `packages/ui/src/hooks/useRuntimeLoop.ts` | @awaf/ui | @awaf/api |
| ۲۹ | `packages/ui/src/hooks/useLayerDetection.ts` | @awaf/ui | @awaf/core |
| ۳۰ | `packages/ui/src/layers/Layer1R3F.tsx` | @awaf/ui | React Three Fiber |
| ۳۱ | `packages/ui/src/layers/Layer2CSS3D.tsx` | @awaf/ui | CSS transforms |
| ۳۲ | `packages/ui/src/layers/Layer3Canvas2D.tsx` | @awaf/ui | Canvas API |
| ۳۳ | `apps/demo/src/components/App.tsx` | apps/demo | @awaf/ui, @awaf/core |

#### Phase 3: Security + Admin + Optimization (Sprint 3+)
| ترتیب | فایل | بسته | وابستگی |
|:---:|:-----|:-----|:--------|
| ۳۴ | `packages/security/src/security/PromptInjectionDefense.ts` | @awaf/security | InputSanitizer, PromptSandbox, OutputFilter, AuditLogger |
| ۳۵ | `packages/security/src/security/MemoryIntegrityGuard.ts` | @awaf/security | vector DB interface |
| ۳۶ | `packages/security/src/security/CostGuardian.ts` | @awaf/security | CircuitBreaker, AuditLogger |
| ۳۷ | `packages/security/src/security/NISTAIMapping.ts` | @awaf/security | هیچ (mapping table) |
| ۳۸ | `packages/security/src/privacy/DifferentialPrivacy.ts` | @awaf/security | هیچ |
| ۳۹ | `packages/security/src/consent/RightToErasure.ts` | @awaf/security | AuditLogger |
| ۴۰ | `packages/core/src/pulse/admin/source-manager.ts` | @awaf/core | types.ts |
| ۴۱ | `packages/core/src/pulse/admin/monitor.ts` | @awaf/core | types.ts |
| ۴۲ | `packages/cli/src/commands/*.ts` | @awaf/cli | fs-extra, commander |
| ۴۳ | `e2e/*.spec.ts` | e2e | Playwright |

### Testing Requirements

**هر module باید test companion داشته باشد.** Coverage حداقلی:

| نوع تست | runner | coverage حداقل | کجا |
|:--------|:-------|:---------------|:----|
| Unit Tests | Vitest | ۸۰٪ lines، ۸۰٪ functions، ۷۵٪ branches | `src/**/*.test.ts` |
| Backend Tests | Jest | ۸۰٪ lines، ۸۰٪ functions، ۷۵٪ branches | `src/**/*.test.ts` |
| Integration Tests | Vitest + MSW | تمام ۱۶ endpoint یک happy path + یک error path | `src/**/*.integration.test.ts` |
| E2E Tests | Playwright | تمام ۵ لایه + ۶ intent chip + ۳ locale | `e2e/*.spec.ts` |

**قوانین تست:**
- هر class باید `.test.ts` همرنگ در همان دایرکتوری داشته باشد.
- `TrustScorer` و `ClaimFlagger` بیشترین منطق شرطی را دارند و باید ۱۰۰٪ coverage داشته باشند.
- تست‌های `ProvenanceTracker` باید integrity check chain reconstruction و audit trail را پوشش دهند.
- MSW با `onUnhandledRequest: 'error'` راه‌اندازی شود — هیچ درخواستی بدون handler نباید رها شود.
- E2E تست‌ها باید `prefers-reduced-motion` و `prefers-contrast: high` را پوشش دهند.

### Context Window Management

هنگام کار با AI Agents دارای context window محدود (مانند Claude Code با ۲۰۰K tokens یا GPT-4o با ۱۲۸K tokens):

**قوانین split کردن فایل‌ها:**
- فایل‌های بزرگ‌تر از ۳۰۰ خط باید split شوند.
- constantها و type definitions همیشه در priority بالاتری قرار می‌گیرند زیرا سایر فایل‌ها به آن‌ها وابسته‌اند.
- کلاس‌های بزرگ مانند `NISTAIMapping.ts` و `VisitorConsentManager.ts` هر کدام در یک context window جداگانه پیاده‌سازی شوند.
- فایل `brief-generator.ts` بزرگ‌ترین فایل MVP است؛ اگر در یک context جا نشد، متدهای `verifyClaims` و `buildLocalizedInstruction` به فایل `brief-generator-helpers.ts` منتقل شوند.
- فایل `ingestor.ts` نیز در صورت نیاز می‌تواند به `pipeline/stage-1.ts` تا `pipeline/stage-5.ts` split شود.

**ترتیب priority در یک context window:**
1. Type definitions / interfaces / enums (foundation)
2. Utility functions (dependency-free)
3. Domain classes (depend on 1 and 2)
4. Orchestrator classes (depend on everything)

### Cross-Package Imports

برای import بین packageها، همیشه از نام package استفاده کنید، نه از path نسبی:

```typescript
// ✅ صحیح
import { TechnologySignal, TrustTier } from '@awaf/core';
import { useConsent } from '@awaf/ui';
import { MCPAdapter } from '@awaf/protocols';

// ❌ غلط — path نسبی بین packages
import { TechnologySignal } from '../../packages/core/src/models/pulse';
```

**نقشه aliasها:**

| Alias | Target | استفاده در |
|:------|:-------|:-----------|
| `@awaf/core` | `packages/core/src/index.ts` | همه packages |
| `@awaf/api` | `packages/api/src/index.ts` | UI, Demo |
| `@awaf/ui` | `packages/ui/src/index.ts` | Demo |
| `@awaf/protocols` | `packages/protocols/src/index.ts` | API, Demo |
| `@awaf/security` | `packages/security/src/index.ts` | Core, API, UI |
| `@awaf/cli` | `packages/cli/src/index.ts` | standalone |

**قانون:** اگر یک package به package دیگر import می‌کند، باید در `package.json` آن package به عنوان `dependency` یا `peerDependency` ثبت شده باشد.

---

## Core Concepts Every Agent Must Know

### ۱. Context Handshake — ۶ فاز

Context Handshake قلب تپنده AWAF است. این pipeline شش‌فازی، سیگنال‌های passive مرورگر را به یک پروفایل آگاه از بافتار تبدیل می‌کند.

```
Phase 1: Signal Collection        Phase 2: Signal Classification
┌─────────────────────┐           ┌─────────────────────┐
│ Accept-Language     │──────────▶│ Language Priority   │
│ Timezone            │──────────▶│ Region Detection    │
│ User-Agent          │──────────▶│ Device Class          │
│ DNT/GPC             │──────────▶│ Privacy Preference    │
│ Screen Metrics      │──────────▶│ Viewport Classification│
│ WebGL Support       │──────────▶│ GPU Tier              │
└─────────────────────┘           └─────────────────────┘
           │                                  │
           ▼                                  ▼
Phase 3: Visitor Identification     Phase 4: Intent Detection
┌─────────────────────┐           ┌─────────────────────┐
│ Visitor ID (vst_*)  │──────────▶│ Probabilistic Intent│
│ Fingerprint Hash      │           │ technology: 0.35    │
│ Session Count       │           │ collaboration: 0.15 │
│ First/Last Seen     │           │ class_notes: 0.10   │
└─────────────────────┘           │ philosophy: 0.05    │
           │                      │ personal: 0.20      │
           ▼                      │ explore: 0.15       │
Phase 5: Language Negotiation     └─────────────────────┘
┌─────────────────────┘                      │
│ Detected: en-US     │                      ▼
│ Suggested: bg-BG    │         Phase 6: Layer Selection
│ Confidence: 0.90    │         ┌─────────────────────┐
│ Alternatives: [fa-IR│────────▶│ GPU × Network Matrix│
└─────────────────────┘         │ WebGL fps ≥ 30 + 4g  │
                                │   → Layer 1 (R3F)   │
                                │ WebGL fps ≥ 15       │
                                │   → Layer 2 (CSS 3D) │
                                │ No WebGL             │
                                │   → Layer 3 (Canvas) │
                                │ No Canvas            │
                                │   → Layer 4 (HTML)   │
                                │ Screen reader        │
                                │   → Layer 5 (Text)   │
                                └─────────────────────┘
```

**خروجی Handshake:**
- `visitorId`: UUID با prefix `vst_`
- `detectedLanguage`: زبان شناسایی‌شده از Accept-Language
- `suggestedLocale`: locale پیشنهادی (مثلاً `bg-BG` برای IP از بلغارستان)
- `intentProbabilities`: شش intent با score احتمالی
- `consentTier`: ۰ (pending) — تا زمانی که کاربر consent ندهد
- `deviceClass`: mobile | tablet | desktop
- `layer`: ۱ تا ۵ — بر اساس GPU × Network decision matrix
- `processingTimeMs`: زمان پردازش (هدف: < ۱۰۰ms)

### ۲. Memory Mesh — ۶ دامنه + Consent Ladder

Memory Mesh سیستم حافظه چنددامنه‌ای AWAF است که با ladder consent چهارپله‌ای محافظت می‌شود.

#### شش دامنه حافظه

| دامنه | شاخصه | tier مورد نیاز | قابل read توسط |
|:------|:------|:--------------|:--------------|
| `general` | اطلاعات عمومی cross-visitor | ۰ | همه |
| `site_specific` | تنظیمات مخصوص سایت فعلی | ۱ | general, visitor |
| `visitor` | ترجیحات فردی visitor | ۱ | — (isolated) |
| `class_notes` | یادداشت‌های آموزشی | ۲ | general (read-only) |
| `ideas` | ایده‌ها و نوشته‌ها | ۲ | general (read-only) |
| `social` | تعاملات اجتماعی | ۲ | general (read-only) |
| `tech_pulse` | سیگنال‌های Technology Pulse | ۱ | general, visitor |

#### Consent Ladder — ۴ پله

| tier | نام | storage | چه داده‌هایی persist می‌شود | دامنه‌های доступ |
|:-----|:----|:--------|:----------------------------|:---------------|
| ۰ | No Memory | هیچ | هیچ — فقط سیگنال session | general |
| ۱ | Anonymous Session | sessionStorage | زبان، timezone، device class | general, site_specific, visitor, tech_pulse |
| ۲ | Personalized Profile | localStorage | ترجیحات، تاریخچه بازدید، علاقه‌مندی‌ها | همه به جز class_notes admin-only |
| ۳ | Enriched Experience | localStorage + vector DB | الگوهای رفتاری، semantic interests، embeddings | تمام ۶ دامنه |

**قوانین consent:**
- فقط upgrade مجاز است — downgrade از tier ۲ به ۱ ممنوع (برای جلوگیری از data loss).
- revoke consent → تمام داده‌ها حذف می‌شوند (GDPR Article 17).
- DNT/GPC فعال → auto-downgrade به tier ۰.
- consent expired → auto-downgrade به tier پایین‌تر.

**VisitorConsentManager — ماشین حالت سه‌حالته:**
```
┌─────────┐    grant()     ┌──────────┐    revoke()    ┌─────────┐
│ pending │───────────────▶│ granted  │──────────────▶│ revoked │
└─────────┘                └──────────┘               └─────────┘
     │                          │ grant(tier)                 │
     │ dismiss()                 │ (upgrade only)              │ reset()
     ▼                          ▼                             ▼
┌─────────┐              ┌──────────┐                   ┌─────────┐
│ dismissed│              │ tier: 1-3│                   │ pending │
└─────────┘              └──────────┘                   └─────────┘
```

### ۳. UI Degradation — ۵ لایه

AWAF «degradation» را «progressive enhancement معکوس» می‌داند. هر لایه یک UI کامل و functional است، نه یک نسخه «خراب» از لایه بالاتر.

| لایه | نام | تکنولوژی | GPU نیاز | Network نیاز | JS نیاز | viewport |
|:-----|:----|:---------|:---------|:-------------|:--------|:---------|
| ۱ | R3F Immersive | React Three Fiber + WebGL 2.0 | fps ≥ 30 | 4g | بله | ≥ 768px |
| ۲ | CSS 3D | CSS transforms + perspective | fps ≥ 15 | 3g+ | بله | — |
| ۳ | Canvas 2D | Canvas API particle systems | WebGL یا Canvas | 2g+ | بله | — |
| ۴ | Static HTML | Semantic HTML + CSS Grid | هیچ | slow-2g | خیر | — |
| ۵ | Text-Only | ARIA landmarks + screen reader | هیچ | بدون تصویر | خیر | — |

**Decision Matrix GPU × Network:**

```
                    Network
              4g    │   3g    │  2g/slow-2g
         ┌──────────┼─────────┼─────────────┐
    high │ Layer 1  │ Layer 1 │   Layer 3   │
GPU  fps≥30│  (R3F)   │ (R3F)    │  (Canvas)   │
         ├──────────┼─────────┼─────────────┤
   medium│ Layer 2  │ Layer 2 │   Layer 3   │
    fps≥15│ (CSS 3D) │ (CSS 3D)│  (Canvas)   │
         ├──────────┼─────────┼─────────────┤
    low  │ Layer 3  │ Layer 3 │   Layer 4   │
   fps<15│ (Canvas) │ (Canvas)│  (Static)   │
         ├──────────┼─────────┼─────────────┤
   none  │ Layer 3  │ Layer 4 │   Layer 4   │
(no WebGL)│ (Canvas) │ (Static) │  (Static)   │
         └──────────┴─────────┴─────────────┘
```

**تعدیل‌کننده‌ها (Modifiers):**
- battery < ۲۰٪ + not charging → یک tier degrade
- prefers-reduced-motion → disable animations در لایه ۱ و ۲
- DNT/GPC → disable personalization (اما UI کامل render شود)
- screen < ۳۲۰px → لایه ۴ یا ۵

### ۴. Technology Pulse — Trust Scoring + RAG Grounding

Technology Pulse لایه هوشمندی جهانی AWAF است. صرفاً یک news aggregator نیست، بلکه یک «بافتار فکری» (intellectual fabric) ایجاد می‌کند که هر پیشرفت فناوری را در قالب اثرات بلندمدت بر هشت حوزه قرار می‌دهد.

#### Pipeline Ingestion پنج‌مرحله‌ای

| مرحله | نام | ورودی | خروجی | key action |
|:------|:----|:------|:------|:-----------|
| ۱ | Ingestion | RSS / Webhook / Manual | raw entry + provenance | SHA-256 hash از محتوای خام |
| ۲ | Extraction | HTML/article | raw_text + bibliographic metadata | DOI, author list, affiliations |
| ۳ | Trust Scoring | source domain + pattern | trust_tier (T1/T2/T3) + trust_score | blacklisted domains → auto-reject |
| ۴ | Hallucination Firewall | extracted claims | verified / single-source / unverified | cross-reference با knowledge base |
| ۵ | Embedding & Storage | verified text | semantic vector + PostgreSQL | immutable provenance log |

#### Trust Scoring Algorithm

```
score = (baseCoefficient × 0.60) + (crossRefBonus × 0.30) + (freshnessBonus × 0.10)

baseCoefficient:
  T1 (peer-reviewed) = 0.95
  T2 (established journalism) = 0.75
  T3 (social/aggregation) = 0.40

crossRefBonus = min(count × 0.05, 0.30)
freshnessBonus = max(0, 1 − ageHours / 168)  # 7-day half-life
```

**قوانین RAG Brief Generation:**
- هر claim باید حداقل به یک منبع T1 یا T2 linked باشد.
- claimهای T3 بدون cross-reference در متن main قرار نمی‌گیرند و در appendix به عنوان «rumour tracker» فهرست می‌شوند.
- system instruction از طریق prompt caching cache می‌شود (۴۵–۸۰٪ کاهش cost، ۱۳–۳۱٪ بهبود time-to-first-token).
- Cloudflare Workers AI برای inference non-critical استفاده می‌شود (قیمت: ۰.۰۰۰۰۳ دلار/request).

#### Five-State Claim Flagging

| وضعیت Claim | Flag | Action |
|:------------|:-----|:-------|
| منبع T1 با DOI/URL | ✅ Verified | Include in brief |
| T2 با cross-reference T1 | ✅ Verified | Include in brief |
| T2 بدون cross-reference | ⚠️ Single-Source | Include با tag `[SINGLE-SOURCE]` |
| T3 با cross-reference T1/T2 | ⚠️ Derivative | Include با tag `[DERIVED]` |
| T3 بدون cross-reference | ❌ Unverified | Exclude؛ log برای admin |
| بدون منبع | ❌ Hallucination Risk | Exclude + alert logging |

#### هشت حوزه اثرگذاری (Affected Domains)

هشت حوزه‌ای که هر Technology Signal بر آن‌ها اثر می‌گذارد:
1. **economy** — اقتصاد
2. **education** — آموزش
3. **medicine** — پزشکی
4. **war** — جنگ
5. **ethics** — اخلاق
6. **governance** — حکمرانی
7. **civilization** — تمدن
8. **daily_life** — زندگی روزمره

### ۵. Protocols — ۴ پروتکل ارتباطی

AWAF چهار پروتکل استاندارد industry را برای ارتباط با agentها و سیستم‌های خارجی پشتیبانی می‌کند:

| پروتکل | استاندارد | کاربرد در AWAF | adapter location |
|:-------|:---------|:---------------|:-----------------|
| **MCP** | Model Context Protocol (Anthropic) | context sharing بین LLMها | `packages/protocols/src/mcp/MCPAdapter.ts` |
| **A2A** | Agent-to-Agent Protocol (Google) | communication بین agentهای autonomous | `packages/protocols/src/a2a/A2AAdapter.ts` |
| **QR Handoff** | QR Code + Deep Link | handoff از موبایل به desktop و بالعکس | `packages/protocols/src/qr/QRHandoffAdapter.ts` |
| **REST API** | OpenAPI 3.1 | HTTP endpoints برای clientها | `packages/protocols/src/api/RESTAdapter.ts` |

**MCP Adapter:**
- resource discovery: `/mcp/resources`
- tool invocation: `/mcp/tools/{tool_name}`
- prompt templates: `/mcp/prompts`
- sampling: `/mcp/sampling`

**A2A Adapter:**
- agent card discovery: `/.well-known/agent.json`
- task creation: `/a2a/tasks`
- message exchange: `/a2a/tasks/{taskId}/messages`
- streaming: SSE connection برای real-time updates

**QR Handoff Adapter:**
- QR code generation: `/qr/generate?session={sessionId}`
- deep link parsing: `/qr/decode?payload={base64}`
- session transfer: atomic handoff با validation

### ۶. Security — Defense in Depth + ۸ Threat Category + NIST AI 100-1

AWAF از معماری defense in depth (دفاع در عمق) استفاده می‌کند: چهار لایه دفاع، هر کدام مستقل و redundant.

#### ۸ تهدید AWAF + Risk Score

| # | تهدید | Risk Score | OWASP Ref | لایه دفاع |
|:--|:------|:----------:|:---------:|:----------|
| ۱ | **Prompt Injection** (LLM01) | ۲۰ | LLM01 | Input Sanitizer → Sandbox → Output Filter |
| ۲ | **Memory Poisoning** | ۱۵ | — | Domain Isolation + Integrity Audit + Provenance |
| ۳ | **Over-Personalization** (Filter Bubble) | ۱۲ | — | Diversity Quota + Exposure Counter |
| ۴ | **Privacy Violation** | ۱۲ | — | PII Sanitizer + Coarse Geo + Consent Enforcement |
| ۵ | **Hallucination** | ۱۲ | — | C2PA Provenance + Multi-Source Verification |
| ۶ | **Content Sensitivity** | ۱۵ | — | Alibaba Guardrails / Llama Guard + Human Review |
| ۷ | **Voice Abuse** | ۸ | — | Rate Limiting (۲۰ req/hour) + Local Processing |
| ۸ | **Tracking Opacity** | ۱۲ | — | Context Handshake UI + DNT/GPC Respect |

#### نگاشت NIST AI RMF 1.0 — چهار تابع

| تهدید | GOVERN | MAP | MEASURE | MANAGE |
|:------|:-------|:----|:--------|:-------|
| Prompt Injection | سیاست prompt review فصلی؛ red team | شناسایی ۱۰ vector OWASP | نرخ injection/ساعت؛ آستانه ۵ | LLM Firewall + sandbox + circuit breaker |
| Memory Poisoning | Mandatory human review Tier-3 | anomaly detection writes | نرخ شکست auth؛ ۰.۱٪ | integrity audit + C2PA + vector prune |
| Over-Personalization | diversity quota؛ editorial oversight | شناسایی filter bubble | diversity score > ۷۰٪ skew → alarm | diversity injection + exposure counter |
| Privacy Violation | PIA سالانه؛ DPO mandatory | data minimization | درصد explicit consent | edge-first + auto-downgrade DNT/GPC |
| Hallucination | C2PA provenance mandatory | RAG grounding T1/T2 | نرخ hallucination < ۲٪ | flagging + human review + disclaimer |
| Content Sensitivity | Content policy annual؛ takedown ۴h | Alibaba/Llama Guard pipeline | نرخ flag moderation | AI guardrails + human review queue |
| Voice Abuse | Voice logging؛ retention ۳۰ روز | local processing؛ no storage | تعداد request/session؛ آستانه ۲۰ | rate limit ۲۰ req/h + HTTP ۴۲۹ |
| Tracking Opacity | Annual transparency report | Context Handshake UI signals | تعداد violation consent tier | DNT/GPC respect + zero-memory mode |

**Differential Privacy:**
- ε-DP با ε = ۱.۰ برای analytics aggregative.
- noise Laplace به query results اضافه می‌شود.
- Privacy budget سالانه: ۱۰.۰ (per user cohort).
- k-anonymity check قبل از DP: k = ۵.

**Domain Isolation (Memory Integrity Guard):**
- هر دامنه memory در vector DB جداگانه ذخیره می‌شود.
- ACL دامنه تعیین می‌کند کدام دامنه‌ها می‌توانند از هم cross-read کنند.
- Entropy check: threshold ۰.۹۵ برای شناسایی anomaly.
- Provenance validation: C2PA-style metadata با hash SHA-256.

**VisitorConsentManager — Jurisdiction-Aware:**
- GDPR: explicit opt-in mandatory؛ pre-ticked غیرمجاز؛ right to erasure؛ data portability.
- CCPA: opt-out؛ show_reject_button؛ do-not-sell banner.
- LGPD: explicit opt-in؛ مشابه GDPR.
- other: simple notice؛ ۱۸۰ روز lifetime.

---

## Data Models

این بخش تمام ۱۱ interface اصلی AWAF را با توضیحات کامل فهرست می‌کند. هر interface باید در `packages/core/src/models/` پیاده‌سازی شده باشد.

### ۱. HandshakeRequest / HandshakeResponse

```typescript
export interface HandshakeRequest {
  browserLang: string;        // از Accept-Language header
  timezone: string;           // از Intl.DateTimeFormat().resolvedOptions()
  deviceClass: 'mobile' | 'tablet' | 'desktop';
  platform: string;           // navigator.platform
  screenWidth: number;
  screenHeight: number;
  dpr: number;                // devicePixelRatio
  webglSupported: boolean;    // از WebGL 2.0 context detection
  networkType?: string;       // از Network Information API
}

export interface HandshakeResponse {
  visitorId: string;          // UUID با prefix vst_
  detectedLanguage: string;   // زبان شناسایی‌شده
  suggestedLocale: string;    // locale پیشنهادی
  intentProbabilities: Record<string, number>; // ۶ intent با score
  consentTier: number;        // ۰ (pending) تا ۳
  deviceClass: string;
  layer: number;              // ۱ تا ۵
  processingTimeMs: number;   // هدف: < ۱۰۰ms
}
```

### ۲. VisitorContext / VisitorProfile

```typescript
export interface VisitorContext {
  visitorId: string;
  detectedSignals: {
    browserLang: string;
    timezone: string;
    deviceClass: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
    dpr: number;
    webglSupported: boolean;
    networkType?: string;
  };
  sessionHistory: Array<{
    sessionId: string;
    startedAt: string;
    intents: string[];
    durationMs: number;
  }>;
}

export interface VisitorProfile {
  visitorId: string;
  consentTier: number;
  consentState: 'pending' | 'granted' | 'revoked';
  detectedSignals: VisitorContext['detectedSignals'];
  sessionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  memoryDomains: Record<string, boolean>;
}
```

### ۳. ConsentRecord

```typescript
export type Jurisdiction = 'GDPR' | 'CCPA' | 'LGPD' | 'other';
export type ConsentState = 'pending' | 'granted' | 'revoked';

export interface ConsentRecord {
  visitor_id: string;
  consent_tier: 0 | 1 | 2 | 3;
  state: ConsentState;
  granted_at?: string;
  granted_by?: 'banner_click' | 'settings_panel' | 'implicit_continue' | 'api_call';
  purposes: Array<'personalization' | 'behavioral_learning' | 'notification'>;
  expires_at: string;
  last_renewed_at: string;
  revoked_at?: string;
  jurisdiction: Jurisdiction;
  version: string;            // Privacy policy version accepted
}
```

### ۴. MemoryEntry

```typescript
export type MemoryDomain = 'general' | 'site_specific' | 'visitor' | 'class_notes' | 'ideas' | 'social' | 'tech_pulse';
export type ConsentTier = 0 | 1 | 2 | 3;

export interface MemoryEntry<T = unknown> {
  key: string;
  value: T;
  domain: MemoryDomain;
  tier: ConsentTier;
  timestamp: number;
}
```

### ۵. TechnologySignal

```typescript
export enum SignalCategory {
  AI = 'AI',
  Biotech = 'Biotech',
  Energy = 'Energy',
  Space = 'Space',
  Quantum = 'Quantum',
  Robotics = 'Robotics',
  Neuroscience = 'Neuroscience',
  Materials = 'Materials',
}

export enum TrustTier {
  T1 = 'T1',
  T2 = 'T2',
  T3 = 'T3',
}

export interface ProvenanceEntry {
  action: 'extract' | 'translate' | 'summarize' | 'verify' | 'ingest';
  actor: string;
  timestamp: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

export interface TechnologySignal {
  id: string;                 // UUID v4
  source: string;             // e.g., "arXiv", "Nature", "Reuters"
  title: string;
  category: SignalCategory;
  trust_tier: TrustTier;
  provenance_chain: ProvenanceEntry[];
  raw_text: string;
  url: string;
  published_at: string;       // ISO 8601
  ingested_at: string;        // ISO 8601
  embedding: number[] | null; // null تا Stage ۵
  affected_domains: string[];
  trust_score: number;        // ۰.۰ تا ۱.۰
  trust_indicators: {
    process_quality: TrustTier;
    cross_reference_status: 'verified' | 'single-source' | 'unverified';
    cross_reference_count: number;
  };
}
```

### ۶. TechnologyBrief

```typescript
export type BriefDepth = 'summary' | 'analytical' | 'deep-dive';
export type BriefTimeRange = 'daily' | 'weekly' | 'monthly';
export type BriefFormat = 'markdown' | 'json';

export interface BriefRequest {
  locale: string;             // e.g., "fa-IR", "en-SG", "en-US", "pt-BR"
  depth: BriefDepth;
  categories: SignalCategory[];
  affectedDomains: string[];
  timeRange: BriefTimeRange;
  trustThreshold: TrustTier;
  includeRumours: boolean;
  format: BriefFormat;
}

export interface BriefCitation {
  marker: string;             // e.g., "[T1:Nature2025-001]"
  tier: TrustTier;
  source: string;
  title: string;
  url: string;
}

export interface BriefClaim {
  text: string;
  citations: BriefCitation[];
  verificationStatus: 'verified' | 'single-source' | 'derivative' | 'unverified' | 'hallucination-risk';
  affectedDomains: string[];
}

export interface TechnologyBrief {
  id: string;
  locale: string;
  generatedAt: string;
  claims: BriefClaim[];       // claimهای تاییدشده (در متن main)
  rumours: BriefClaim[];      // claimهای ردشده (در appendix)
  wordCount: number;
  coverageScore: number;      // ۰-۱: ratio دامنه‌های پوشش داده‌شده
}
```

### ۷. IntentProbability

```typescript
export type IntentType = 'technology' | 'collaboration' | 'class_notes' | 'philosophy' | 'personal' | 'explore';

export interface IntentProbability {
  intent: IntentType;
  score: number;              // ۰.۰ تا ۱.۰
  reason: string;           // explanation برای score
  actions: Array<{
    type: 'navigate' | 'filter' | 'open' | 'interactive';
    target: string;
    label: string;
  }>;
}
```

### ۸. LanguageNegotiationResult

```typescript
export interface LocaleOption {
  code: string;             // e.g., "en-US", "bg-BG", "fa-IR"
  name: string;             // "English", "Bulgarian", "Persian"
  nameLocal: string;        // "English", "Български", "فارسی"
  rtl: boolean;
}

export interface LanguageNegotiationResult {
  detected: {
    language: string;
    country: string;
  };
  primary: string;          // locale انتخاب‌شده
  suggestions: Array<{
    locale: string;
    reason: string;
    confidence: number;
  }>;
  availableLocales: LocaleOption[];
  negotiationComplete: boolean;
}
```

### ۹. Suggestion

```typescript
export interface Suggestion {
  id: string;
  intent: IntentType;
  score: number;
  reason: string;           // explanation برای rank
  actions: Array<{
    type: string;
    target: string;
    label: string;
  }>;
}

export interface SuggestionRankRequest {
  signals: {
    timeOfDay: string;
    referrer: string;
    browserLang: string;
  };
  intentHistory: string[];
}
```

### ۱۰. RuntimeConfig / RuntimeHealth

```typescript
export interface RuntimeConfig {
  apiVersion: string;
  features: Record<string, boolean>;
  supportedLocales: string[];
  maxConsentTier: number;
  featureFlags: Record<string, boolean>;
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  lastHeartbeatAt: number;
  consecutiveFailures: number;
}
```

### ۱۱. AuditLogEntry

```typescript
export interface AuditLogEntry {
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  visitor_id_hash: string;    // SHA-256 hashed
  session_id_hash: string;    // SHA-256 hashed
  event_data: Record<string, unknown>;
  action_taken: string;
  jurisdiction: string;
  timestamp: string;
}

export interface ErasureResult {
  erased: {
    visitor_context: number;
    visitor_preferences: number;
    visitor_memory_entries: number;
    vector_embeddings: number;
    consent_state: string;
  };
  audit_log_id: string;
  completed_at: string;
}
```

---

## API Endpoints

جدول زیر تمام ۱۶ endpoint AWAF را فهرست می‌کند. هر endpoint باید در `packages/api/src/test/handlers/` یک MSW handler داشته باشد و در `packages/api/src/client/AwafClient.ts` یک متد client-side.

| # | Method | Path | Purpose | Package | Priority |
|:--|:-------|:-----|:--------|:--------|:---------|
| ۱ | POST | `/api/v1/handshake` | ۶-phase context handshake — تولید visitorId و detection | @awaf/api | MVP |
| ۲ | GET | `/api/v1/visitor/:id` | Anonymous visitor profile — tier ۱ memory | @awaf/api | MVP |
| ۳ | POST | `/api/v1/visitor/consent` | Update consent — grant/revoke با tier | @awaf/api | MVP |
| ۴ | PATCH | `/api/v1/visitor/:id/profile` | Update visitor profile — tier ۲+ | @awaf/api | MVP |
| ۵ | GET | `/api/v1/technology-pulse` | Technology signals — با filter category/trust_tier | @awaf/api | MVP |
| ۶ | POST | `/api/v1/suggestion/rank` | Rank intent suggestions بر اساس context | @awaf/api | MVP |
| ۷ | GET | `/api/v1/intent/:type` | Get content برای یک intent مشخص | @awaf/api | MVP |
| ۸ | POST | `/api/v1/language/negotiate` | ۳-locale language negotiation | @awaf/api | MVP |
| ۹ | GET | `/api/v1/memory/domain/:domain` | Read memory entries برای یک دامنه | @awaf/api | Sprint 2 |
| ۱۰ | POST | `/api/v1/memory/ingest` | Ingest memory entry (OpenClaw) | @awaf/api | Sprint 2 |
| ۱۱ | GET | `/api/v1/runtime/config` | Runtime configuration + feature flags | @awaf/api | MVP |
| ۱۲ | POST | `/api/v1/auth/session` | Session creation — HttpOnly cookie | @awaf/api | MVP |
| ۱۳ | GET | `/api/v1/admin/stats` | Dashboard stats — نیاز به Bearer auth | @awaf/api | Sprint 2 |
| ۱۴ | PATCH | `/api/v1/admin/suggestion-weights` | Update suggestion weights — admin only | @awaf/api | Sprint 2 |
| ۱۵ | GET | `/api/v1/admin/pulse-sources` | List Technology Pulse sources — admin | @awaf/api | Sprint 2 |
| ۱۶ | POST | `/api/v1/feedback/intent` | Record intent feedback — positive/negative | @awaf/api | MVP |

**قوانین endpointها:**
- تمام endpointها باید Content-Type: application/json را accept و return کنند.
- خطاها باید با ساختار `{ error: string, message: string }` و HTTP status مناسب return شوند.
- endpointهای admin (۱۳–۱۵) نیاز به `Authorization: Bearer {token}` دارند.
- `/api/v1/auth/session` باید `Set-Cookie` با `HttpOnly; Secure; SameSite=Strict` return کند.
- تمام endpointها باید CORS headers مناسب برای development داشته باشند.

---

## UI Layers

جدول زیر ۵ لایه UI AWAF را با قوانین capability detection فهرست می‌کند.

| لایه | نام | Renderer | Capability Detection Rules | Fallback از لایه |
|:-----|:----|:---------|:---------------------------|:----------------|
| ۱ | R3F Immersive | React Three Fiber + WebGL 2.0 | `webgl2` supported + `fps >= 30` + `network == 4g` + `!batteryConstraint` + `viewport >= 768px` + `!prefersReducedMotion` | لایه ۲ |
| ۲ | CSS 3D | CSS `transform-style: preserve-3d` + CSS animations | `webgl` supported + `fps >= 15` + `network >= 3g` + `!prefersReducedMotion` | لایه ۳ |
| ۳ | Canvas 2D | HTML5 Canvas 2D context + particle systems | `canvas` supported + `network >= 2g` + `!prefersReducedMotion` | لایه ۴ |
| ۴ | Static HTML | Semantic HTML5 + CSS Grid + zero JS animation | همیشه available — default fallback | لایه ۵ |
| ۵ | Text-Only | ARIA landmarks + screen reader optimized + no images | `prefersReducedMotion` + screen reader active | هیچ (minimum viable) |

**قوانین capability detection:**
- Detection فقط یکبار در ابتدای session اجرا می‌شود و نتیجه در `sessionStorage.setItem('awaf_layer', layer)` cache می‌شود.
- در navigation بعدی، مقدار cache شده خوانده می‌شود (avoid repeated detection overhead).
- `prefers-reduced-motion: reduce` → disable تمام animations در لایه ۱ و ۲ و ۳.
- `prefers-contrast: high` → borderهای اضافی به interactive elements.
- `battery.level < 0.2 && !battery.charging` → یک tier degrade.
- `navigator.connection.effectiveType` در { 'slow-2g', '2g' } → cap در لایه ۳.
- `window.innerWidth < 768 && layer == 1` → downgrade به لایه ۲ (R3F روی موبایل disable).

**ساختار Lazy Loading:**
```typescript
const Layer1R3F = React.lazy(() => import('../layers/Layer1R3F'));
const Layer2CSS3D = React.lazy(() => import('../layers/Layer2CSS3D'));
const Layer3Canvas2D = React.lazy(() => import('../layers/Layer3Canvas2D'));
const Layer4StaticHTML = React.lazy(() => import('../layers/Layer4StaticHTML'));
const Layer5TextOnly = React.lazy(() => import('../layers/Layer5TextOnly'));
```

---

## Protocol Reference

### MCP (Model Context Protocol)

MCP پروتکل Anthropic برای sharing context بین LLMها است. AWAF از MCP برای ارائه visitor context، memory entries، و Technology Briefs به agentهای خارجی استفاده می‌کند.

| capability | endpoint | description |
|:-----------|:---------|:------------|
| resources | `GET /mcp/resources` | فهرست resourceهای موجود (visitor context, pulse signals) |
| resource read | `GET /mcp/resources/{uri}` | خواندن یک resource مشخص |
| tools | `GET /mcp/tools` | فهرست toolهای قابل فراخوانی |
| tool call | `POST /mcp/tools/{name}` | فراخوانی یک tool |
| prompts | `GET /mcp/prompts` | فهرست prompt templates |
| prompt get | `GET /mcp/prompts/{name}` | دریافت یک prompt template |

**resources AWAF:**
- `awaf://visitor/{visitorId}/context` — visitor context کامل
- `awaf://visitor/{visitorId}/memory/{domain}` — memory entries یک دامنه
- `awaf://pulse/signals?category={cat}` — Technology signals
- `awaf://pulse/brief?locale={loc}` — Technology brief محلی‌سازی‌شده

### A2A (Agent-to-Agent Protocol)

A2A پروتکل Google برای communication بین agentهای autonomous است. AWAF از A2A برای coordination بین multi-agent systems استفاده می‌کند.

| capability | endpoint | description |
|:-----------|:---------|:------------|
| agent card | `GET /.well-known/agent.json` | discovery card این agent |
| tasks | `POST /a2a/tasks` | ایجاد task جدید |
| task read | `GET /a2a/tasks/{taskId}` | وضعیت task |
| messages | `POST /a2a/tasks/{taskId}/messages` | ارسال message |
| stream | `GET /a2a/tasks/{taskId}/stream` | SSE stream برای updates |

**task types AWAF:**
- `context_handshake` — اجرای handshake برای visitor جدید
- `intent_detection` — detection intent از روی signals
- `brief_generation` — تولید Technology Brief
- `memory_query` — query memory mesh

### QR Handoff

QR Handoff برای transfer session بین devices استفاده می‌شود (مثلاً از موبایل به desktop).

| capability | endpoint | description |
|:-----------|:---------|:------------|
| generate | `POST /qr/generate` | تولید QR code برای session فعلی |
| decode | `POST /qr/decode` | decode payload QR و استخراج sessionId |
| transfer | `POST /qr/transfer` | atomic handoff session از device A به B |

**flow handoff:**
1. Device A: `POST /qr/generate` → دریافت QR code image + deep link URL.
2. Device B: scan QR → `POST /qr/decode` → استخراج sessionId.
3. Device B: `POST /qr/transfer` → validation + atomic transfer.
4. Device A: invalidation session قدیمی + notification.

### REST API Adapter

REST API Adapter bridge بین internal AWAF services و external HTTP clients است.

| feature | implementation |
|:--------|:---------------|
| authentication | Bearer token + cookie-based session |
| rate limiting | ۱۰۰ req/min برای anonymous، ۱۰۰۰ req/min برای authenticated |
| caching | ETag + Cache-Control برای read endpoints |
| versioning | URL path versioning (`/api/v1/`) |
| content negotiation | JSON default؛ Markdown برای brief requests |
| error format | `{ error: string, message: string, code?: string }` |

---

## Security & Privacy Rules for Agents

> **این بخش الزامات امنیتی و حریم خصوصی را برای AI Agents تعریف می‌کند. هرگونه مغایرت یک security regression است.**

### ۱. No PII in Logs
- هیچ Personal Identifiable Information (PII) نباید در لاگ‌ها، error traces، یا telemetry ذخیره شود.
- visitor_id باید SHA-256 hashed شود قبل از اینکه در audit log یا error report قرار گیرد.
- email، phone number، IP address، و name هرگز نباید logged شوند.
- Exception messages نباید شامل user data باشند.

### ۲. Coarse Geo Only
- فقط coarse geo (country level) ذخیره می‌شود — city level یا lat/long هرگز.
- IP address برای detection timezone و language استفاده می‌شود و بلافاصله discard می‌شود.
- ذخیره IP در任何形式 ممنوع است.

### ۳. Consent State Machine
- VisitorConsentManager باید ماشین حالت `pending → granted → revoked` را دقیقاً اجرا کند.
- `grant(tier, by, purposes)` تحت GDPR: اگر `requires_explicit_opt_in == true` و `by == 'implicit_continue'` و `tier >= 2` → `ConsentError`.
- `revoke()` باید consent_tier را به ۰ reset کند و purposes را clear کند (اگر `auto_downgrade_on_revoke == true`).
- نیاز renewal: ۳۰ روز قبل از expiry، banner renewal نمایش داده شود.

### ۴. Right to Erasure (GDPR Article 17)
- `DELETE /api/visitor/memory` باید تمام data tierها را حذف کند.
- vector embeddings باید prune شوند.
- audit log کامل تولید شود.
- consent state به `pending` reset شود.
- verification methods: magic_link | oauth | session_token.

### ۵. DNT/GPC Respect
- `DNT: 1` یا `Sec-GPC: 1` → auto-downgrade به tier ۰.
- zero-memory mode: هیچ داده‌ای persist نشود.
- context-only mode: فقط passive signals استفاده شوند.
- personalization کاملاً disable شود.

### ۶. Domain Isolation
- هر دامنه memory در storage جداگانه ذخیره شود.
- cross-read فقط از طریق ACL مجاز است.
- `class_notes` و `tech_pulse` فقط `admin_only` write.
- `general` و `site_specific` `authenticated` write.
- `visitor` domain isolated — هیچ دامنه‌ای نمی‌تواند از آن read کند.

### ۷. Prompt Injection Defense (OWASP LLM01)
- سه لایه defense: Input Sanitizer → Prompt Sandbox → Output Filter.
- risk score threshold: ۰.۳ برای block، ۰.۱۵ برای flag.
- delimiter strategy: XML tags (`<user_input>`) برای جدا کردن user input از system prompt.
- max_output_tokens: ۲۰۴۸.
- هر injection attempt باید audit log شود (severity: critical).

### ۸. Cost Exhaustion Protection
- Circuit breaker: failure_threshold = ۵، recovery_timeout = ۶۰ ثانیه.
- Token budget: daily limit + per-session limit + per-request limit.
- اگر daily_spent > ۱۵۰٪ budget → switch به emergency model (مثلاً gpt-4.1-nano).
- CostGuardian باید تمام chargeها را audit log کند.

### ۹. Content Moderation
- Alibaba Cloud Guardrails / Llama Guard pipeline.
- سه لایه: AI guardrails (edge) → flagging → human review queue.
- takedown SLA: ۴ ساعت برای content high-severity.
- content policy annual update.

### ۱۰. Immutable Provenance
- provenance chain در append-only storage نگهداری شود.
- hash SHA-256 برای هر entry.
- حتی adminها نمی‌توانند provenance را پس از commit دستکاری کنند.
- AWS QLDB یا append-only filesystem برای storage.

---

## Reference Documents

| فایل | هدف | کجا استفاده می‌شود |
|:-----|:----|:-------------------|
| `README.md` | overview پروژه، setup instructions، quick start | landing page repository |
| `docs/ARCHITECTURE.md` | ADRها (Architecture Decision Records)، trade-off analysis، design patterns | قبل از تغییر معماری |
| `docs/DEVELOPMENT.md` | environment setup، branching strategy (`main` → `dev` → `feature/*`)، CI/CD pipeline | onboarding توسعه‌دهنده جدید |
| `docs/API_REFERENCE.md` | OpenAPI 3.1 spec، example requests/responses، error codes | integration با API |
| `docs/SECURITY.md` | threat model، vulnerability disclosure، incident response | security audit |
| `docs/CONTRIBUTING.md` | PR guidelines، code review checklist، commit message format (`type(scope): subject`) | قبل از ارسال PR |
| `docs/CODING_CONVENTIONS.md` | naming conventions، file organization، JSDoc style، test patterns | قبل از نوشتن کد جدید |

---

## Agent Checklist

> **قبل از اینکه هر task را تکمیل کنید، این چک‌لیست را بررسی کنید. هیچ استثنایی مجاز نیست.**

### تست و کیفیت کد
- [ ] **Types compile:** `pnpm typecheck` یا `tsc --noEmit` بدون error اجرا شود.
- [ ] **Tests pass:** `pnpm test:unit` و `pnpm test:backend` بدون failure.
- [ ] **No `any`:** هیچ استفاده از `any` در کد production وجود ندارد (استثنا: `gtag` declaration).
- [ ] **Error paths handled:** تمام توابع public یک path error مشخص دارند (Result<T,E> یا try/catch documented).
- [ ] **JSDoc complete:** تمام interfaces، types، enums، و functions public docstring کامل دارند.

### معماری و وابستگی
- [ ] **File size ≤ ۳۰۰ lines:** اگر فایل بزرگ‌تر شد، split شده است.
- [ ] **Cross-package imports correct:** فقط از package name (مثلاً `@awaf/core`) import شده، نه از path نسبی.
- [ ] **No circular dependencies:** `madge --circular src/` بدون cycle باشد.
- [ ] **Barrel exports:** هر package یک `index.ts` barrel export دارد.

### امنیت و حریم خصوصی
- [ ] **Consent respected:** هیچ persist داده‌ای بدون consent معتبر انجام نمی‌شود.
- [ ] **No PII in logs:** هیچ PII در error messages، logs، یا telemetry وجود ندارد.
- [ ] **Visitor ID hashed:** visitor_id در audit logs SHA-256 hashed است.
- [ ] **DNT/GPC respected:** اگر DNT/GPC فعال است، auto-downgrade به tier ۰.
- [ ] **Coarse geo only:** فقط country level geo ذخیره شده — city/IP هرگز.

### UI و accessibility
- [ ] **RTL support:** کامپوننت‌های جدید با `html[dir="rtl"]` test شده‌اند.
- [ ] **Keyboard accessible:** تمام interactive elements با Tab focusable هستند.
- [ ] **ARIA labels:** تمام دکمه‌ها، لینک‌ها، و landmarkها label ARIA دارند.
- [ ] **prefers-reduced-motion:** animations در لایه‌های ۱-۳ با این preference disable می‌شوند.
- [ ] **Color contrast:** حداقل AA (۴.۵:۱ برای normal text، ۳:۱ برای large text).

### performance
- [ ] **Lazy loading:** کامپوننت‌های layer با `React.lazy` و `Suspense` load می‌شوند.
- [ ] **sessionStorage cache:** نتیجه layer detection در `awaf_layer` cache شده است.
- [ ] **Bundle size:** importها tree-shakeable هستند (no barrel import از libraryهای بزرگ).
- [ ] **No memory leaks:** event listeners و intervals در `useEffect` cleanup می‌شوند.

### documentation
- [ ] **CHANGELOG updated:** تغییرات در `CHANGELOG.md` ثبت شده است.
- [ ] **README updated:** اگر setup یا usage تغییر کرده، README بروز شده است.
- [ ] **TypeDoc updated:** `pnpm docs:api` بدون error اجرا شود.

---

## Quick Reference Cards

### Card 1: Layer Detection Decision Matrix

```
webgl2? ──No──▶ canvas? ──No──▶ Layer 4 (Static HTML)
  │              │
  Yes            Yes
  │              │
  ▼              ▼
fps >= 30?    fps >= 15?
  │              │
  Yes            Yes
  │              │
  ▼              ▼
net == 4g?    net >= 3g?
  │              │
  Yes            Yes
  │              │
  ▼              ▼
!battery?     !battery?
  │              │
  Yes            Yes
  │              │
  ▼              ▼
vw >= 768?    !reducedMotion?
  │              │
  Yes            Yes
  │              │
  ▼              ▼
Layer 1       Layer 2
(R3F)         (CSS 3D)

Modifiers:
- battery < 20% + !charging → degrade 1 tier
- reducedMotion → disable animations
- DNT/GPC → disable personalization (not layer)
- vw < 768 → cap at Layer 2
```

### Card 2: Consent Tier → Domain Access

```
Tier 0 (No Memory):
  ✓ general
  ✗ site_specific, visitor, class_notes, ideas, social, tech_pulse

Tier 1 (Anonymous Session):
  ✓ general, site_specific, visitor, tech_pulse
  ✗ class_notes, ideas, social

Tier 2 (Personalized Profile):
  ✓ general, site_specific, visitor, tech_pulse
  ✓ class_notes (if not admin-only), ideas, social
  ✗ class_notes admin write

Tier 3 (Enriched Experience):
  ✓ ALL domains
  ✓ vector embeddings
  ✓ behavioral learning
```

### Card 3: Technology Pulse — Trust Tiers

```
T1 (peer-reviewed / institutional):
  arXiv, Nature, Science, IEEE, ACM, Google Research
  Base coefficient: 0.95
  Weight in RAG: 1.0

T2 (established journalism):
  MIT Technology Review, Wired, The Verge, TechCrunch
  Base coefficient: 0.75
  Weight in RAG: 0.6

T3 (social / aggregation / early warning):
  X/Twitter, Reddit, Hacker News, personal blogs
  Base coefficient: 0.40
  Weight in RAG: 0.2
  Require cross-reference for inclusion in brief
```

### Card 4: MSW Handler Pattern

```typescript
// Template برای هر endpoint جدید:
import { http, HttpResponse } from 'msw';

export const newHandlers = [
  http.post('/api/v1/endpoint', async ({ request }) => {
    const body = await request.json();

    // Validation
    if (!body.requiredField) {
      return HttpResponse.json(
        { error: 'MISSING_FIELD', message: 'requiredField is required' },
        { status: 400 }
      );
    }

    // Business logic
    const result = processRequest(body);

    return HttpResponse.json(result, { status: 200 });
  }),
];
```

### Card 5: React Hook Pattern

```typescript
// Template برای hook جدید:
import { useState, useEffect, useCallback } from 'react';

export interface UseNewFeatureReturn {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useNewFeature(options: { apiBaseUrl: string }): UseNewFeatureReturn {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${options.apiBaseUrl}/endpoint`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown'));
    } finally {
      setIsLoading(false);
    }
  }, [options.apiBaseUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
```

---

## Glossary of Terms

| اصطلاح انگلیسی | معادل فارسی | توضیح |
|:---------------|:-----------|:------|
| Context Handshake | دست‌دهی بافتار | ۶-phase pipeline برای شناسایی visitor context |
| Memory Mesh | شبکه حافظه | ۶ دامنه memory با isolation دامنه‌ای |
| Consent Tier | پله رضایت | ۴ سطح: ۰ No Memory → ۳ Enriched Experience |
| UI Degradation | تخریب تدریجی UI | ۵ لایه progressive enhancement معکوس |
| Technology Pulse | نبض فناوری | intelligence layer برای ردیابی پیشرفت‌های فناوری |
| Trust Scoring | امتیازدهی اعتماد | T1/T2/T3 با coefficient ۰.۹۵/۰.۷۵/۰.۴۰ |
| RAG Grounding | grounding RAG | Retrieval-Augmented Generation برای کاهش hallucination |
| Domain Isolation | isolation دامنه | جداسازی memory domains در vector DB |
| Differential Privacy | حریم خصوصی تفاضلی | ε-DP با noise Laplace برای analytics |
| Provenance Chain | زنجیره منشأ | C2PA-style metadata برای ردیابی محتوا |
| Hallucination Firewall | firewall hallucination | flag کردن claimهای تک‌منبع یا T3 |
| Intent Detection | تشخیص intent | ۶ intent با probabilistic scoring |
| Language Negotiation | مذاکره زبان | ۳-locale با cultural sensitivity |
| Layer Detection | تشخیص لایه | GPU × Network decision matrix |
| Mock Service Worker | کارگر سرویس mock | MSW برای intercept درخواست‌های HTTP در تست |
| Barrel Export | export بشکه‌ای | `index.ts` که exports را aggregate می‌کند |

---

*End of AGENTS.md — AWAF AI Agent Onboarding Guide v1.0.0*

*هرگونه تغییر در این سند باید از طریق PR با review حداقل یک human reviewer انجام شود. AI Agents نباید این فایل را بدون approval انسانی تغییر دهند.*
