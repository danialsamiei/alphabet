/**
 * @file VisitorContext.tsx
 * @description
 * Visitor Context Dashboard — نمایش وضعیت تشخیص شده از مرورگر بازدیدکننده
 * با استفاده از Alphabet SDK Context Handshake.
 *
 * این کامپوننت اطلاعات زیر را نمایش می‌دهد:
 * - زبان و جهت متن (LTR/RTL)
 * - قابلیت‌های دستگاه (GPU tier، motion، network)
 * - سیگنال‌های حریم خصوصی (DNT/GPC)
 * - لایه رندر انتخاب‌شده
 */

import { useAlphabetContext, useAlphabetHandshake, TransparencyNotice } from '@alphabet/ui';
import type { CapabilityLayer } from '@alphabet/core';

/** نقشه نام لایه‌ها به فارسی و انگلیسی */
const LAYER_LABELS: Record<CapabilityLayer, { en: string; fa: string }> = {
  R3F: { en: 'Immersive 3D (WebGL)', fa: 'سه‌بعدی غوطه‌ورانه (WebGL)' },
  CSS3D: { en: 'CSS 3D Transforms', fa: 'تبدیلات سه‌بعدی CSS' },
  CANVAS2D: { en: 'Canvas 2D', fa: 'بوم دوبعدی' },
  STATIC_HTML: { en: 'Static HTML', fa: 'HTML ایستا' },
  TEXT_ONLY: { en: 'Text Only', fa: 'فقط متن' },
};

/** Props برای کامپوننت */
export interface VisitorContextProps {
  /** نمایش نسخه کامل یا فشرده */
  readonly compact?: boolean;
  /** className اختیاری */
  readonly className?: string;
}

/**
 * داشبورد زمینه بازدیدکننده
 *
 * @example
 * <VisitorContext />
 * <VisitorContext compact />
 */
export function VisitorContext({ compact = false, className }: VisitorContextProps): JSX.Element {
  const ctx = useAlphabetContext();
  const { decision, signals, status, error } = useAlphabetHandshake();

  const isRTL = decision?.uiConfig.direction === 'rtl';
  const locale = decision?.uiConfig.locale ?? 'en';
  const layer = decision?.selectedLayer ?? 'STATIC_HTML';
  const privacyMode = decision?.privacyMode;

  // اگر هنوز handshake در حال اجراست
  if (status === 'running') {
    return (
      <aside className={`ds-visitor-context ds-visitor-context--loading ${className ?? ''}`}>
        <div className="ds-visitor-context__header">
          <span className="ds-visitor-context__icon" aria-hidden="true">⏳</span>
          <span className="ds-visitor-context__title">
            {isRTL ? 'در حال تشخیص...' : 'Detecting...'}
          </span>
        </div>
      </aside>
    );
  }

  // اگر خطایی رخ داده
  if (status === 'error') {
    return (
      <aside className={`ds-visitor-context ds-visitor-context--error ${className ?? ''}`}>
        <div className="ds-visitor-context__header">
          <span className="ds-visitor-context__icon" aria-hidden="true">⚠️</span>
          <span className="ds-visitor-context__title">
            {isRTL ? 'خطا در تشخیص' : 'Detection Error'}
          </span>
        </div>
        {error !== null && <p className="ds-visitor-context__error">{error}</p>}
      </aside>
    );
  }

  // نسخه فشرده
  if (compact) {
    return (
      <aside
        className={`ds-visitor-context ds-visitor-context--compact ${className ?? ''}`}
        dir={isRTL ? 'rtl' : 'ltr'}
        lang={locale}
      >
        <span className="ds-visitor-context__badge" data-layer={layer}>
          {LAYER_LABELS[layer]?.[isRTL ? 'fa' : 'en'] ?? layer}
        </span>
        <span className="ds-visitor-context__separator">•</span>
        <span className="ds-visitor-context__locale">{locale.toUpperCase()}</span>
        <span className="ds-visitor-context__separator">•</span>
        <span className="ds-visitor-context__direction">{isRTL ? 'راست‌به‌چپ' : 'LTR'}</span>
        {privacyMode?.canStoreMemory === false && (
          <>
            <span className="ds-visitor-context__separator">•</span>
            <span className="ds-visitor-context__privacy" title={isRTL ? 'سیگنال حریم خصوصی فعال' : 'Privacy signal active'}>
              🔒
            </span>
          </>
        )}
      </aside>
    );
  }

  // نسخه کامل
  return (
    <section
      className={`ds-visitor-context ds-visitor-context--full ${className ?? ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={locale}
      aria-labelledby="ds-visitor-context-title"
    >
      <h3 id="ds-visitor-context-title" className="ds-visitor-context__title">
        {isRTL ? 'زمینه بازدیدکننده' : 'Visitor Context'}
      </h3>

      <div className="ds-visitor-context__grid">
        {/* زبان و جهت */}
        <div className="ds-visitor-context__item">
          <span className="ds-visitor-context__label">
            {isRTL ? 'زبان' : 'Language'}
          </span>
          <span className="ds-visitor-context__value">{locale}</span>
        </div>

        <div className="ds-visitor-context__item">
          <span className="ds-visitor-context__label">
            {isRTL ? 'جهت' : 'Direction'}
          </span>
          <span className="ds-visitor-context__value">
            {isRTL ? 'راست‌به‌چپ (RTL)' : 'Left-to-Right (LTR)'}
          </span>
        </div>

        {/* لایه رندر */}
        <div className="ds-visitor-context__item ds-visitor-context__item--highlight">
          <span className="ds-visitor-context__label">
            {isRTL ? 'لایه رندر' : 'Render Layer'}
          </span>
          <span className="ds-visitor-context__value" data-layer={layer}>
            {LAYER_LABELS[layer]?.[isRTL ? 'fa' : 'en'] ?? layer}
          </span>
        </div>

        {/* سیگنال‌های تشخیص داده شده */}
        {signals !== null && (
          <>
            <div className="ds-visitor-context__item">
              <span className="ds-visitor-context__label">
                {isRTL ? 'منطقه زمانی' : 'Timezone'}
              </span>
              <span className="ds-visitor-context__value">{signals.timezone}</span>
            </div>

            <div className="ds-visitor-context__item">
              <span className="ds-visitor-context__label">
                {isRTL ? 'کاهش حرکت' : 'Reduced Motion'}
              </span>
              <span className="ds-visitor-context__value">
                {signals.prefersReducedMotion
                  ? (isRTL ? 'بله' : 'Yes')
                  : (isRTL ? 'خیر' : 'No')}
              </span>
            </div>

            <div className="ds-visitor-context__item">
              <span className="ds-visitor-context__label">
                {isRTL ? 'تم ترجیحی' : 'Color Scheme'}
              </span>
              <span className="ds-visitor-context__value">
                {signals.prefersColorScheme === 'dark'
                  ? (isRTL ? 'تیره' : 'Dark')
                  : (isRTL ? 'روشن' : 'Light')}
              </span>
            </div>
          </>
        )}

        {/* حریم خصوصی */}
        {privacyMode !== null && privacyMode !== undefined && (
          <div className="ds-visitor-context__item ds-visitor-context__item--privacy">
            <span className="ds-visitor-context__label">
              {isRTL ? 'حالت حریم خصوصی' : 'Privacy Mode'}
            </span>
            <ul className="ds-visitor-context__privacy-list">
              <li data-allowed={privacyMode.canStoreMemory}>
                {isRTL ? 'ذخیره حافظه' : 'Store Memory'}:{' '}
                {privacyMode.canStoreMemory ? '✓' : '✗'}
              </li>
              <li data-allowed={privacyMode.canPersonalize}>
                {isRTL ? 'شخصی‌سازی' : 'Personalize'}:{' '}
                {privacyMode.canPersonalize ? '✓' : '✗'}
              </li>
              <li data-allowed={privacyMode.canUseAnalytics}>
                {isRTL ? 'تحلیل' : 'Analytics'}:{' '}
                {privacyMode.canUseAnalytics ? '✓' : '✗'}
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* TransparencyNotice از SDK */}
      <TransparencyNotice
        title={isRTL ? 'چرا این لایه انتخاب شد...' : 'Why this layer was selected...'}
        className="ds-visitor-context__transparency"
      />
    </section>
  );
}
