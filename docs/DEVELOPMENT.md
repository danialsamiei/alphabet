# راهنمای توسعه Alphabet SDK
# Alphabet SDK Development Guide

> **نسخه:** 1.0.0 | **مخزن:** `github.com/danialsamiei/alphabet`
> **زبان:** فارسی با اصطلاحات انگلیسی (Farsi with English terms)

---

## فهرست مطالب

1. [پیش‌نیازهای محیط توسعه](#1-پیش‌نیازهای-محیط-توسعه)
2. [ساختار Monorepo](#2-ساختار-monorepo)
3. [راه‌اندازی اولیه](#3-راه‌اندازی-اولیه)
4. [دستورات ساخت (Build Commands)](#4-دستورات-ساخت-build-commands)
5. [پیکربندی TypeScript Strict Mode](#5-پیکربندی-typescript-strict-mode)
6. [Path Mapping بین Packageها](#6-path-mapping-بین-packageها)
7. [پیکربندی Vite Library Mode](#7-پیکربندی-vite-library-mode)
8. [استراتژی تست (Testing Strategy)](#8-استراتژی-تست-testing-strategy)
9. [گردش کار Changeset (Versioning)](#9-گردش-کار-changeset-versioning)
10. [دستورالعمل‌های عامل AI (AI Agent Guidelines)](#10-دستورالعمل‌های-عامل-ai-ai-agent-guidelines)
11. [عیب‌یابی متداول (Troubleshooting)](#11-عیب‌یابی-متداول-troubleshooting)

---

## 1. پیش‌نیازهای محیط توسعه

### 1.1 حداقل نسخه‌های مورد نیاز

| ابزار | حداقل نسخه | توصیه‌شده | بررسی نسخه |
|-------|-----------|-----------|------------|
| **Node.js** | 20.0.0 LTS | 20.12.0+ | `node --version` |
| **pnpm** | 9.0.0 | 9.1.0+ | `pnpm --version` |
| **Git** | 2.40.0 | 2.43.0+ | `git --version` |

> **⚠️ هشدار مهم:** استفاده از npm یا yarn پشتیبانی نمی‌شود. Monorepo صرفاً با pnpm workspace و Turborepo پیکربندی شده است.

### 1.2 نصب پیش‌نیازها

```bash
# نصب Node.js 20+ (با nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20

# نصب pnpm 9+
npm install -g pnpm@9.1.0

# فعال‌سازی Corepack (alternative)
corepack enable
corepack prepare pnpm@9.1.0 --activate
```

### 1.3 متغیرهای محیطی (Environment Variables)

فایل `.env.local` در root پروژه:

```bash
# API
ALPHABET_API_BASE_URL=http://localhost:3000/api
ALPHABET_TIMEOUT_MS=5000
ALPHABET_MAX_RETRIES=3

# Consent
ALPHABET_DEFAULT_CONSENT_TIER=NO_MEMORY

# Logging
ALPHABET_LOG_LEVEL=debug          # debug | info | warn | error
ALPHABET_ENABLE_TELEMETRY=false

# Token Budget
ALPHABET_TOKEN_TIER=ANONYMOUS

# Locale
ALPHABET_DEFAULT_COUNTRY=IR
ALPHABET_DEFAULT_LANGUAGE=fa

# Development
ALPHABET_FORCE_UI_LAYER=          # R3F | CSS3D | CANVAS2D | STATIC_HTML | TEXT_ONLY
```

---

## 2. ساختار Monorepo

### 2.1 درخت دایرکتوری

```
alphabet/
├── package.json                    # Root package.json
├── pnpm-workspace.yaml             # تعریف workspace
├── turbo.json                       # Turborepo pipeline
├── tsconfig.json                    # Root TypeScript config
├── .changeset/                      # Changesets config
│   └── config.json
├── packages/                        # 📦 Packageهای SDK
│   ├── core/                        # 🏗️ Foundation (types, config, logger, events)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── index.ts             # exports اصلی
│   │       ├── types/
│   │       │   ├── index.ts         # re-exports
│   │       │   ├── base.ts          # ConsentTier, MemoryDomain, UILayer, ...
│   │       │   ├── visitor.ts       # VisitorContext, VisitorConsent, VisitorPreference
│   │       │   ├── api.ts           # AlphabetRequest, AlphabetResponse, TokenBudget
│   │       │   ├── memory.ts        # VisitorMemory, TechnologySignal
│   │       │   ├── brands.ts        # VisitorId, SessionId, MemoryId (brand types)
│   │       │   └── result.ts        # Result<T,E> pattern
│   │       ├── config/
│   │       │   └── alphabet-config.ts   # کلاس AlphabetConfig
│   │       ├── logger/
│   │       │   └── alphabet-logger.ts   # AlphabetLogger با ۴ سطح
│   │       ├── events/
│   │       │   └── alphabet-events.ts   # AlphabetEventEmitter با typed events
│   │       ├── signals/             # SignalCollector + PassiveSignals
│   │       ├── enrichment/          # EnrichmentPipeline + GeoIP + Referrer
│   │       ├── decision/            # HandshakeDecisionEngine + UIConfigGenerator
│   │       ├── handshake/           # ContextHandshakeClient + morph.ts
│   │       └── memory/              # Memory Mesh (Tier0-3, DomainFirewall)
│   │
│   ├── api/                         # 🌐 ۱۶ Endpoint Client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── index.ts             # re-exports همه endpointها
│   │       ├── client/
│   │       │   └── http-client.ts   # HTTP client پایه (fetch wrapper)
│   │       ├── endpoints/           # ۱۶ فایل endpoint
│   │       │   ├── handshake.ts
│   │       │   ├── consent.ts
│   │       │   ├── preference.ts
│   │       │   ├── interact.ts
│   │       │   ├── voice-transcribe.ts
│   │       │   ├── suggestions.ts
│   │       │   ├── technology-pulse.ts
│   │       │   ├── technology-pulse-brief.ts
│   │       │   ├── visitor-memory-post.ts
│   │       │   ├── visitor-memory-get.ts
│   │       │   ├── visitor-memory-delete.ts
│   │       │   ├── claw-query.ts
│   │       │   ├── claw-ingest.ts
│   │       │   ├── claw-admin-audit.ts
│   │       │   ├── admin-visitor-insights.ts
│   │       │   └── admin-pulse-sources.ts
│   │       └── streaming/
│   │           └── sse-handler.ts   # SSE streaming handler
│   │
│   ├── ui/                          # 🎨 ۵ لایه UI Degradation
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── layers/              # ۵ لایه degradation
│   │       │   ├── r3f/             # Layer 1: React Three Fiber
│   │       │   ├── css3d/           # Layer 2: CSS 3D
│   │       │   ├── canvas2d/        # Layer 3: Canvas 2D
│   │       │   ├── static/          # Layer 4: Static HTML
│   │       │   └── textonly/        # Layer 5: Text-only
│   │       ├── components/          # کامپوننت‌های مشترک
│   │       └── hooks/               # React hooks
│   │
│   ├── protocols/                   # 🔌 Protocol Adapters
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── mcp/                 # Model Context Protocol
│   │       ├── a2a/                 # Agent-to-Agent
│   │       ├── qr/                  # QR-Code Handoff
│   │       └── api/                 # API Adapter (fallback)
│   │
│   └── security/                    # 🛡️ Security Layer
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── index.ts
│           ├── threats/             # ۸ دسته threat
│           ├── sanitizers/          # Input sanitization
│           └── audit/               # Audit logging
│
└── apps/
    └── demo/                        # 🖥️ اپلیکیشن نمونه
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── main.tsx             # entry point
            └── App.tsx              # root component
```

### 2.2 تعریف Workspace (pnpm-workspace.yaml)

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 2.3 Root package.json

```json
{
  "name": "@alphabet/sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

## 3. راه‌اندازی اولیه

### 3.1 مراحل Clone تا اجرا

```bash
# 1. Clone مخزن
git clone https://github.com/danialsamiei/alphabet.git
cd alphabet

# 2. نصب وابستگی‌ها
pnpm install

# 3. بررسی سلامت TypeScript
pnpm typecheck

# 4. اجرای تست‌ها
pnpm test

# 5. ساخت همه packages
pnpm build

# 6. اجرای demo در محیط development
pnpm dev
```

### 3.2 ساختار package.json هر Package

الگوی یکسان برای تمام packageها:

```json
{
  "name": "@alphabet/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "require": "./dist/types/index.cjs",
      "types": "./dist/types/index.d.ts"
    }
  },
  "scripts": {
    "build": "vite build && tsc --emitDeclarationOnly",
    "dev": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 4. دستورات ساخت (Build Commands)

### 4.1 Turborepo Pipeline

> **Note (Turborepo 2.x):** The top-level key in `turbo.json` is `tasks` (not `pipeline`, which was the 1.x name). The example below uses the current schema.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "**/tsconfig.json"],
  "tasks": {
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

> **Required build order:** Every workspace package's tsconfig maps `@alphabet/core` and `@alphabet/api` to their built `dist/index.d.ts`. As a result, `tsc` (and `tsc --emitDeclarationOnly`) only succeeds after the dependency packages have been built. The `dependsOn: ["^build"]` rule on the `build` and `typecheck` tasks above is what guarantees this order — always run `pnpm build` (or `pnpm typecheck`) at the workspace root rather than calling `tsc` directly inside a package whose dependencies are not yet built.

### 4.2 شرح pipeline

| Task | dependsOn | outputs | cache | توضیح |
|------|-----------|---------|-------|-------|
| `build` | `[^build]` | `dist/**` | ✅ cached | ساخت topological — هر package پس از وابستگی‌ها |
| `dev` | — | — | ❌ no cache | Watch mode برای development |
| `lint` | — | — | ✅ cached | ESLint روی src |
| `test` | `[build]` | — | ✅ cached | Vitest — پس از build |
| `typecheck` | `[^build]` | — | ✅ cached | tsc --noEmit — پس از build وابستگی‌ها |

### 4.3 دستورات پرکاربرد

```bash
# ساخت همه packages
pnpm build

# ساخت یک package خاص
pnpm --filter @alphabet/core build

# typecheck یک package خاص
pnpm --filter @alphabet/api typecheck

# dev mode (watch + HMR)
pnpm dev

# اجرای تست همه
pnpm test

# اجرای تست یک package
pnpm --filter @alphabet/core test

# اجرای تست با watch mode
pnpm --filter @alphabet/core test -- --watch

# lint همه
pnpm lint

# lint یک package
pnpm --filter @alphabet/ui lint
```

---

## 5. پیکربندی TypeScript Strict Mode

### 5.1 Root tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" },
    { "path": "./packages/ui" },
    { "path": "./packages/protocols" },
    { "path": "./packages/security" }
  ]
}
```

### 5.2 جدول الزامات Strict Mode

| گزینه | مقدار | هدف | پیامد عدم رعایت |
|--------|-------|-----|-----------------|
| `strict` | `true` | فعال‌سازی تمام چک‌های strict | کامپایل TypeScript غیرقابل قبول |
| `noUnusedLocals` | `true` | جلوگیری از متغیرهای بلااستفاده | error کامپایل |
| `noUnusedParameters` | `true` | جلوگیری از پارامترهای بلااستفاده | error کامپایل (با `_` prefix مجاز) |
| `exactOptionalPropertyTypes` | `true` | تفاوت `undefined` و `?` | `field?: string` فقط `string | undefined` |
| `noUncheckedIndexedAccess` | `true` | `T \| undefined` برای index access | `arr[i]` همیشه `T \| undefined` |
| `noImplicitReturns` | `true` | همه مسیرهای تابع باید return داشته باشند | error اگر مسیر without return وجود داشته باشد |
| `noFallthroughCasesInSwitch` | `true` | جلوگیری از fallthrough ناخواسته | error بدون `break` یا `return` |
| `forceConsistentCasingInFileNames` | `true` | حساسیت به بزرگی/کوچکی حروف | error در case mismatch import |

### 5.3 پیکربندی tsconfig هر Package

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@alphabet/core/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

---

## 6. Path Mapping بین Packageها

### 6.1 نحوه کار Path Mapping

Alphabet از دو سطح path resolution استفاده می‌کند:

1. **TypeScript paths** (`tsconfig.json`) — برای `tsc` و IDE autocomplete
2. **Vite resolve.alias** (`vite.config.ts`) — برای bundler در build time

### 6.2 TypeScript Path Mapping (tsconfig)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@alphabet/core/*": ["packages/core/src/*"],
      "@alphabet/api/*": ["packages/api/src/*"],
      "@alphabet/ui/*": ["packages/ui/src/*"]
    }
  }
}
```

### 6.3 Vite Resolve Alias (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@alphabet/core': resolve(__dirname, '../core/src'),
      '@alphabet/api': resolve(__dirname, '../api/src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@alphabet/core', '@alphabet/api'],
    },
    sourcemap: true,
    minify: false,
  },
});
```

### 6.4 جدول وابستگی‌های بین Packageها

| Package | Import از | مسیر Vite Alias |
|---------|-----------|----------------|
| `@alphabet/api` | `@alphabet/core` | `resolve(__dirname, '../core/src')` |
| `@alphabet/security` | `@alphabet/core` | `resolve(__dirname, '../core/src')` |
| `@alphabet/protocols` | `@alphabet/core`, `@alphabet/api` | هر دو alias تعریف شوند |
| `@alphabet/ui` | `@alphabet/core`, `@alphabet/api` | هر دو alias تعریف شوند |
| `@alphabet/danial-demo` | همه packages | تمام aliasها تعریف شوند |

---

## 7. پیکربندی Vite Library Mode

### 7.1 الگوی کلی vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@alphabet/core',
        '@alphabet/api',
        '@alphabet/security',
        '@alphabet/protocols',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
      ],
      output: {
        preserveModules: false,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          three: 'THREE',
        },
      },
    },
    sourcemap: true,
    minify: false, // برای library development
  },
  resolve: {
    alias: {
      '@alphabet/core': resolve(__dirname, '../core/src'),
    },
  },
});
```

### 7.2 خروجی Build

پس از `pnpm build` در هر package:

```
packages/core/dist/
├── index.js              # ESM build
├── index.js.map          # ESM source map
├── index.cjs             # CJS build
├── index.cjs.map         # CJS source map
├── index.d.ts            # Type declarations
├── index.d.ts.map        # Declaration map
└── .tsbuildinfo          # TS incremental build info
```

---

## 8. استراتژی تست (Testing Strategy)

### 8.1 هرم تست Alphabet

```
                    ▲
                   /│\
                  / │ \        E2E Tests (Playwright)
                 /  │  \       ~۵% coverage — user journeys
                /   │   \      apps/danial-demo/e2e/
               /────┼────\
              /     │     \    Integration Tests (Vitest)
             /      │      \   ~۱۵% coverage — endpoint + handshake
            /───────┼───────\  packages/*/src/**/*.integration.test.ts
           /        │        \ Unit Tests (Vitest)
          /         │         \ ~۸۰% coverage — pure functions, types
         /──────────┼──────────\ packages/*/src/**/*.test.ts
        ─────────────────────────
```

### 8.2 پیکربندی Vitest (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',  // برای تست‌های DOM/browser
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@alphabet/core': resolve(__dirname, '../core/src'),
    },
  },
});
```

### 8.3 ساختار فایل‌های تست

```
packages/core/src/
├── types/
│   ├── base.ts
│   ├── base.test.ts                    # Unit test
│   ├── visitor.ts
│   └── visitor.test.ts                 # Unit test
├── signals/
│   ├── SignalCollector.ts
│   ├── SignalCollector.test.ts         # Unit test
│   ├── deviceClass.ts
│   └── deviceClass.test.ts             # Unit test
├── handshake/
│   ├── ContextHandshakeClient.ts
│   └── ContextHandshakeClient.integration.test.ts  # Integration
```

### 8.4 الگوی Unit Test (Arrange-Act-Assert)

```typescript
import { describe, it, expect } from 'vitest';
import { detectDeviceClass } from './deviceClass';
import type { UALowEntropyHints } from './types';

describe('detectDeviceClass', () => {
  // Arrange-Act-Assert pattern
  it('should return "tablet" when formFactor is tablet', () => {
    // Arrange
    const hints: UALowEntropyHints = { platform: 'Android', mobile: true, formFactor: 'tablet' };
    // Act
    const result = detectDeviceClass(hints);
    // Assert
    expect(result).toBe('tablet');
  });

  it('should return "mobile" when mobile=true and no formFactor', () => {
    const hints: UALowEntropyHints = { platform: 'iOS', mobile: true, formFactor: null };
    expect(detectDeviceClass(hints)).toBe('mobile');
  });

  it('should return "desktop" when mobile=false and no formFactor', () => {
    const hints: UALowEntropyHints = { platform: 'Windows', mobile: false, formFactor: null };
    expect(detectDeviceClass(hints)).toBe('desktop');
  });

  it('should return "unknown" when all hints are null', () => {
    const hints: UALowEntropyHints = { platform: null, mobile: null, formFactor: null };
    expect(detectDeviceClass(hints)).toBe('unknown');
  });
});
```

### 8.5 الگوی Integration Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextHandshakeClient } from './ContextHandshakeClient';

describe('ContextHandshakeClient Integration', () => {
  let client: ContextHandshakeClient;

  beforeEach(() => {
    client = new ContextHandshakeClient({
      endpoint: 'http://localhost:3000/api/context/handshake',
      timeoutMs: 5000,
      showConsentPrompt: false,
      rootSelector: 'html',
    });
  });

  it('should complete handshake without errors', async () => {
    const result = await client.performHandshake();
    expect(result.success).toBe(true);
    expect(result.sessionId).toBeTruthy();
    expect(result.uiConfig).not.toBeNull();
  });

  it('should skip consent prompt when DNT is enabled', async () => {
    // Mock DNT signal
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const result = await client.performHandshake();
    expect(result.consentGranted).toBeNull();
  });
});
```

### 8.6 تست E2E (Playwright)

```typescript
// apps/danial-demo/e2e/handshake.spec.ts
import { test, expect } from '@playwright/test';

test('full handshake flow', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for handshake completion
  await page.waitForEvent('alphabet:handshake-complete');

  // Verify locale applied
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);

  // Verify directionality
  const dir = await page.evaluate(() => document.documentElement.dir);
  expect(['ltr', 'rtl']).toContain(dir);
});
```

### 8.7 جدول Coverage Targets

| سطح | ابزار | Coverage Target | مسیر |
|-----|-------|----------------|------|
| Unit | Vitest | ۸۰%+ | `packages/*/src/**/*.test.ts` |
| Integration | Vitest | ۶۰%+ | `packages/*/src/**/*.integration.test.ts` |
| E2E | Playwright | Journey-based | `apps/danial-demo/e2e/*.spec.ts` |

---

## 9. گردش کار Changeset (Versioning)

### 9.1 نحوه کار Changesets

Alphabet از `@changesets/cli` برای مدیریت semantic versioning استفاده می‌کند.

### 9.2 مراحل ایجاد Changeset

```bash
# ۱. ایجاد changeset جدید پس از تغییرات
pnpm changeset

# ۲. انتخاب packageهای affected
# ۳. نوشتن summary تغییرات
# ۴. فایل changeset در .changeset/ ایجاد می‌شود

# ۵. version bump (قبل از release)
pnpm version-packages

# ۶. ساخت و تست مجدد
pnpm build
pnpm test

# ۷. publish به npm
pnpm release
```

### 9.3 قوانین Semantic Versioning

| نوع تغییر | Changeset Type | نمونه |
|-----------|---------------|-------|
| Breaking change | `major` | حذف API، تغییر signature تابع |
| Feature جدید | `minor` | endpoint جدید، قابلیت جدید |
| Bug fix | `patch` | رفع باگ، بهبود performance |

### 9.4 GitHub Actions Release Workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, registry-url: 'https://registry.npmjs.org' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - name: Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 10. دستورالعمل‌های عامل AI (AI Agent Guidelines)

### 10.1 قوانین طلایی برای عامل‌های AI

> **هر عامل AI باید پیش از هر commit موارد زیر را اجرا کند:**

```bash
# ۱. typecheck — باید صفر error داشته باشد
pnpm typecheck

# ۲. build — باید بدون error کامل شود
pnpm build

# ۳. تست — همه تست‌ها باید pass شوند
pnpm test
```

### 10.2 چک‌لیست قبل از Commit (Pre-Commit Checklist)

- [ ] فایل‌های ویرایش‌شده با `read_file` خوانده شده‌اند
- [ ] typecheck صفر error
- [ ] build موفق
- [ ] تست‌های مرتبط pass
- [ ] هیچ `any` در کد جدید وجود ندارد
- [ ] Brand types برای شناسه‌ها استفاده شده
- [ ] `Result<T,E>` برای عملیات public API
- [ ] JSDoc برای توابع public نوشته شده
- [ ] Changeset ایجاد شده (در صورت تغییر API)

### 10.3 ترتیب ایجاد فایل‌ها (File Creation Order)

عامل AI باید فایل‌ها را به ترتیب وابستگی ایجاد کند:

```
فاز ۱: Foundation
├── ۱. types/base.ts          (Enums — هیچ وابستگی)
├── ۲. types/brands.ts        (Brand Types — به base.ts وابسته)
├── ۳. types/result.ts        (Result<T,E> — به base.ts وابسته)
├── ۴. types/visitor.ts       (Visitor models — به base.ts وابسته)
├── ۵. types/api.ts           (Request/Response — به base.ts وابسته)
├── ۶. types/memory.ts        (Memory models — به base.ts وابسته)
├── ۷. types/index.ts         (Re-exports)
├── ۸. config/alphabet-config.ts  (Config class — به types وابسته)
├── ۹. logger/alphabet-logger.ts  (Logger — مستقل)
└── ۱۰. events/alphabet-events.ts (EventEmitter — به types وابسته)

فاز ۲: Handshake
├── ۱۱. signals/types.ts      (Signal interfaces)
├── ۱۲. signals/time.ts       (getLocalHour — مستقل)
├── ۱۳. signals/deviceClass.ts (detectDeviceClass — به types)
├── ۱۴. signals/utm.ts        (extractUTM — به types)
├── ۱۵. signals/SignalCollector.ts (کلاس — به همه signalها)
├── ۱۶. enrichment/types.ts   (Enrichment interfaces)
├── ۱۷. enrichment/referrer.ts (categorizeReferrer)
├── ۱۸. enrichment/utm.ts     (mapUTMCampaign)
├── ۱۹. enrichment/geo.ts     (GeoResolver interface)
├── ۲۰. enrichment/edgeAdapter.ts (BaseEdgeAdapter)
├── ۲۱. decision/types.ts     (Decision interfaces)
├── ۲۲. decision/promptTemplate.ts (buildPrompt)
├── ۲۳. decision/schema.ts    (HANDSHAKE_OUTPUT_SCHEMA)
├── ۲۴. decision/HandshakeDecisionEngine.ts (کلاس)
├── ۲۵. decision/UIConfigGenerator.ts (کلاس)
├── ۲۶. decision/promptCache.ts (PromptCache)
├── ۲۷. handshake/types.ts    (Handshake interfaces)
├── ۲۸. handshake/morph.ts    (morphUI)
└── ۲۹. handshake/ContextHandshakeClient.ts (کلاس اصلی)

فاز ۳: API Client
├── ۳۰. client/types.ts       (Base client types)
├── ۳۱-۴۶. endpoints/*.ts     (۱۶ endpoint — هر کدام به client/types)
└── ۴۷. client/index.ts       (Re-exports)
```

### 10.4 مدیریت Context Window

- هر فایل حداکثر ۵۰۰ خط — در صورت بزرگ‌تر، `split to multiple files`
- هر بخش (section) به صورت مستقل قابل اجراست
- فایل‌های بزرگ‌تر از ۳۰۰ خط با `<split_point>` مشخص شوند
- فایل‌های root (package.json, tsconfig) در ابتدای هر session لود شوند

---

## 11. عیب‌یابی متداول (Troubleshooting)

### 11.1 خطاهای متداول

| خطا | علت | راه‌حل |
|-----|-----|--------|
| `Cannot find module '@alphabet/core'` | Path alias تنظیم نشده | بررسی `vite.config.ts` resolve.alias |
| `TS2307: Cannot find module` | Package build نشده | `pnpm --filter @alphabet/core build` |
| `Composite projects may not disable declaration emit` | `composite: true` بدون `declaration` | هر دو `true` باشند |
| `ENOENT: .tsbuildinfo` | `tsBuildInfoFile` directory وجود ندارد | `mkdir -p dist/` یا build اجرا شود |
| `Rate limit exceeded` | تست‌های متعدد endpoint | `beforeEach` با `vi.waitFor` و delay |
| `WebGL context lost` | GPU memory در تست | Mock `HTMLCanvasElement.getContext` |

### 11.2 دستورات پاک‌سازی (Clean Build)

```bash
# حذف dist و node_modules و rebuild کامل
rm -rf packages/*/dist packages/*/node_modules
rm -rf apps/*/dist apps/*/node_modules
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

### 11.3 دیباگ TypeScript

```bash
# بررسی incremental build info
cat packages/core/dist/.tsbuildinfo | jq '.program.fileNames[:10]'

# بررسی resolution path
pnpm exec tsc --traceResolution 2>&1 | grep "@alphabet/core" | head -20

# بررسی خروجی declaration
ls -la packages/core/dist/*.d.ts
```

---

*این سند بخشی از مستندات SDK Alphabet است. برای معماری کلی به ARCHITECTURE.md و برای قراردادهای کدنویسی به CODING_CONVENTIONS.md مراجعه کنید.*
