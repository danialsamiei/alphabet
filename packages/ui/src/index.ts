/**
 * @module @alphabet/ui
 * @description
 * `@alphabet/ui` — Adaptive Render Layers SDK for React.
 *
 * یک SDK سبک React برای رندر تطبیقی (Adaptive Render Layers) که بر اساس
 * قابلیت دستگاه، تنظیمات دسترسی‌پذیری، رضایت کاربر، و محدودیت‌های SSR
 * تجربه را به‌صورت progressive enhance می‌کند.
 *
 * **Naming:** the public concept is now "Adaptive Render Layers"
 * (renamed from "UI Degradation"). The five layers themselves keep
 * their stable enum values from `@alphabet/core` for compatibility.
 *
 * **Bundle:** the base entrypoint is intentionally lightweight and
 * does *not* import React Three Fiber. R3F is loaded lazily by
 * `AdaptiveSlot` from the `./layers/r3f` subpath when (and only when)
 * the R3F layer is selected. See `package.json#exports` for the
 * subpath exports (`./hooks`, `./layers`, `./layers/r3f`, `./runtime`).
 */

// ─── Hooks ────────────────────────────────────────────────────────────────────
export * from './hooks/index.js';

// ─── Components ───────────────────────────────────────────────────────────────
export * from './components/index.js';

// ─── Layers (lightweight; R3F lazy entry not re-exported) ────────────────────
export * from './layers/index.js';

// ─── Runtime helpers ──────────────────────────────────────────────────────────
export * from './runtime/index.js';

// ─── Re-exported types from @alphabet/core ────────────────────────────────────────
export type {
  CapabilityLayer,
  ConsentTier,
  ConsentPurpose,
  HandshakeDecision,
  UIConfig,
  PrivacyMode,
} from '@alphabet/core';

