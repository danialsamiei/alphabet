/**
 * @module handshake/decision-engine
 * @description
 * HandshakeDecisionEngine — فاز تصمیم‌گیری handshake.
 * Determines the final UI configuration (locale, direction, theme, layer,
 * hero copy, and consent requirement) from enriched visitor context.
 *
 * **Privacy contract:** DNT/GPC restrict storage, profiling, tracking,
 * analytics, and personalization (privacy mode → Tier 0). They do **not**
 * force the visual layer down to STATIC_HTML — render layer is selected
 * purely from device capability and accessibility preferences (e.g.
 * `prefers-reduced-motion`).
 */

import type { CapabilityLayer } from '../types/base.js';
import type { EnrichedContext } from '../types/visitor.js';
import type { HandshakeDecision, PrivacyMode, UIConfig } from '../types/api.js';
import { SignalCollector } from './signal-collector.js';
import { EnrichmentPipeline } from './enrichment-pipeline.js';
import {
  canPersonalize,
  canStoreMemory,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
} from '../privacy/policy.js';

// ─── RTL Languages ────────────────────────────────────────────────────────────

/** زبان‌هایی که از راست به چپ نوشته می‌شوند */
const RTL_LANGUAGES = new Set(['fa', 'ar', 'he', 'ur', 'yi', 'ku', 'ps', 'sd']);

// ─── Locale Resolution ────────────────────────────────────────────────────────

/** نگاشت (زبان + کشور) → locale استاندارد */
const LOCALE_MAP: Readonly<Record<string, string>> = {
  'fa-IR': 'fa-IR',
  'fa-AF': 'fa-AF',
  'ar-AE': 'ar-AE',
  'ar-SA': 'ar-SA',
  'ar-EG': 'ar-EG',
  'bg-BG': 'bg-BG',
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'en-AU': 'en-AU',
  'en-CA': 'en-CA',
  'en-IN': 'en-IN',
  'en-SG': 'en-SG',
  'de-DE': 'de-DE',
  'fr-FR': 'fr-FR',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  'it-IT': 'it-IT',
  'nl-NL': 'nl-NL',
  'pl-PL': 'pl-PL',
  'pt-BR': 'pt-BR',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ru-RU': 'ru-RU',
} as const;

// ─── Hero Copy Templates ──────────────────────────────────────────────────────

/** متن‌های hero پیش‌فرض به ازای locale */
const HERO_COPY: Readonly<Record<string, string>> = {
  'fa-IR': 'به دنیای وب‌آگاه خوش آمدید',
  'fa-AF': 'به دنیای وب‌آگاه خوش آمدید',
  'ar-AE': 'مرحباً بك في عالم الويب الواعي',
  'ar-SA': 'مرحباً بك في عالم الويب الواعي',
  'ar-EG': 'مرحباً بك في عالم الويب الواعي',
  'bg-BG': 'Добре дошли в съзнателния уеб',
  'en-US': 'Welcome to the context-aware web',
  'en-GB': 'Welcome to the context-aware web',
  'en-AU': 'Welcome to the context-aware web',
  'en-CA': 'Welcome to the context-aware web',
  'en-IN': 'Welcome to the context-aware web',
  'en-SG': 'Welcome to the context-aware web',
  'de-DE': 'Willkommen im kontextbewussten Web',
  'fr-FR': 'Bienvenue dans le web contextuel',
  'es-ES': 'Bienvenido a la web con contexto',
  'es-MX': 'Bienvenido a la web con contexto',
  'it-IT': 'Benvenuto nel web consapevole',
  'nl-NL': 'Welkom in het contextbewuste web',
  'pl-PL': 'Witaj w kontekstowej sieci',
  'pt-BR': 'Bem-vindo à web com consciência de contexto',
  'ja-JP': 'コンテキスト対応Webへようこそ',
  'ko-KR': '맥락 인식 웹에 오신 것을 환영합니다',
  'zh-CN': '欢迎来到情境感知网页',
  'zh-TW': '歡迎來到情境感知網頁',
  'ru-RU': 'Добро пожаловать в контекстно-зависимый веб',
} as const;

// ─── Country → Language Fallback ─────────────────────────────────────────────

/** نگاشت کشور → زبان پیش‌فرض (وقتی language از signals موجود نیست) */
const COUNTRY_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  IR: 'fa', AF: 'fa', AE: 'ar', SA: 'ar', EG: 'ar',
  BG: 'bg', DE: 'de', FR: 'fr', IT: 'it', ES: 'es',
  NL: 'nl', PL: 'pl', BR: 'pt', JP: 'ja', KR: 'ko',
  CN: 'zh', TW: 'zh', RU: 'ru', MX: 'es', CA: 'en',
  GB: 'en', AU: 'en', SG: 'en', IN: 'en',
} as const;

// ─── Language → First Locale Index (pre-computed) ────────────────────────────

/** index معکوس از زبان → اولین locale در LOCALE_MAP — برای fallback سریع */
const LANGUAGE_FIRST_LOCALE: Readonly<Record<string, string>> = (() => {
  const index: Record<string, string> = {};
  for (const key of Object.keys(LOCALE_MAP)) {
    const lang = key.split('-')[0];
    if (lang !== undefined && !(lang in index)) {
      index[lang] = key;
    }
  }
  return index;
})();

// ─── HandshakeDecisionEngine Class ───────────────────────────────────────────

/**
 * موتور تصمیم‌گیری Context Handshake — فاز decide.
 * Decision engine for the Context Handshake — the decide phase.
 *
 * Receives an EnrichedContext and returns a HandshakeDecision with:
 * - selectedLayer: CapabilityLayer
 * - uiConfig: UIConfig (locale, direction, theme, heroCopy, consentRequired)
 *
 * @example
 * const engine = new HandshakeDecisionEngine();
 * const decision = engine.decide(enriched);
 * console.log(decision.uiConfig.locale);     // "fa-IR"
 * console.log(decision.uiConfig.direction);  // "rtl"
 * console.log(decision.selectedLayer);       // "CSS_3D"
 */
export class HandshakeDecisionEngine {
  /**
   * اجرای تصمیم‌گیری بر اساس زمینه غنی‌شده.
   * Executes decision logic based on enriched visitor context.
   *
   * @param enriched - EnrichedContext از EnrichmentPipeline.enrich()
   * @returns HandshakeDecision
   *
   * @example
   * const decision = engine.decide(enriched);
   * const { selectedLayer, uiConfig } = decision;
   */
  decide(enriched: EnrichedContext): HandshakeDecision {
    const { signals, geo } = enriched.visitor;

    // Render layer is selected purely from device capability and a11y
    // preferences. DNT/GPC must NOT downgrade the visual layer — they
    // only restrict storage, profiling, and personalization.
    const selectedLayer: CapabilityLayer = SignalCollector.detectLayer(signals);

    const privacyMode = this.derivePrivacyMode(signals.dntEnabled, signals.gpcEnabled);

    const language = this.resolveLanguage(signals.language, geo.country);
    const locale = this.resolveLocale(language, geo.country);
    const direction = this.resolveDirection(language);
    const consentRequired = this.requiresConsent(geo.country, signals.dntEnabled, signals.gpcEnabled);
    const heroCopy = this.resolveHeroCopy(locale);
    const cssVariables = this.buildCSSVariables(selectedLayer, direction);

    const uiConfig: UIConfig = {
      locale,
      direction,
      theme: 'auto',
      heroCopy,
      consentRequired,
      cssVariables,
    };

    return {
      selectedLayer,
      uiConfig,
      privacyMode,
      decidedAt: new Date().toISOString(),
    };
  }

  // ─── Private Resolvers ────────────────────────────────────────────────────

  /**
   * تولید PrivacyMode از سیگنال‌های DNT/GPC.
   * Builds the PrivacyMode object using the canonical privacy policy helpers.
   * When DNT or GPC is active, enforced consent tier drops to NO_MEMORY and
   * memory/personalization/analytics/precise-geo are all denied.
   */
  private derivePrivacyMode(dntEnabled: boolean, gpcEnabled: boolean): PrivacyMode {
    const privacySignals = { dntEnabled, gpcEnabled };
    const restricted = hasPrivacySignal(privacySignals);
    const enforcedConsentTier = restricted ? 'NO_MEMORY' : 'ANONYMOUS';
    return {
      restricted,
      dntEnabled,
      gpcEnabled,
      enforcedConsentTier,
      memoryAllowed: canStoreMemory(enforcedConsentTier),
      personalizationAllowed: canPersonalize(enforcedConsentTier, privacySignals),
      // Analytics gate uses k-anonymity at runtime; here we report the
      // tier-level capability only (cohort size is per-query).
      analyticsAllowed: !restricted && canUseAnalytics(enforcedConsentTier, Number.POSITIVE_INFINITY),
      preciseGeoAllowed: canUsePreciseGeo(enforcedConsentTier, privacySignals),
    };
  }

  private resolveLanguage(signalLang: string, country: string): string {
    if (signalLang && signalLang !== 'unknown' && signalLang.length >= 2) {
      return signalLang;
    }
    return COUNTRY_LANGUAGE_MAP[country.toUpperCase()] ?? 'en';
  }

  private resolveLocale(language: string, country: string): string {
    const key = `${language}-${country.toUpperCase()}`;
    const mapped = LOCALE_MAP[key];
    if (mapped !== undefined) return mapped;

    // fallback: اولین locale با همان زبان از index معکوس O(1)
    const fallback = LANGUAGE_FIRST_LOCALE[language];
    if (fallback !== undefined) return fallback;

    return 'en-US';
  }

  private resolveDirection(language: string): 'ltr' | 'rtl' {
    return RTL_LANGUAGES.has(language.toLowerCase()) ? 'rtl' : 'ltr';
  }

  private requiresConsent(country: string, dnt: boolean, gpc: boolean): boolean {
    if (dnt || gpc) return false; // حریم خصوصی محافظت‌شده — نیازی به نمایش بنر نیست
    return EnrichmentPipeline.requiresGDPRConsent(country);
  }

  private resolveHeroCopy(locale: string): string {
    return HERO_COPY[locale] ?? HERO_COPY['en-US'] ?? 'Welcome';
  }

  private buildCSSVariables(
    layer: CapabilityLayer,
    direction: 'ltr' | 'rtl'
  ): Record<string, string> {
    return {
      '--awaf-layer': layer,
      '--awaf-direction': direction,
      '--awaf-font-family': direction === 'rtl'
        ? "'Vazirmatn', 'Tahoma', sans-serif"
        : "'Inter', 'Segoe UI', sans-serif",
    };
  }
}
