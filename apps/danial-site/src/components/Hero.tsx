/**
 * @file Hero.tsx
 * @description
 * Top-of-page hero — name, title, tagline, primary CTAs.
 * Enhanced with Alphabet SDK context awareness for RTL/locale support.
 */

import { useAlphabetContext } from '@alphabet/ui';
import type { Profile } from '../data/profile.js';

/** محتوای دوزبانه برای Hero */
const BILINGUAL_CONTENT = {
  askAssistant: {
    en: 'Ask the assistant',
    fa: 'از دستیار بپرسید',
  },
  email: {
    en: 'Email',
    fa: 'ایمیل',
  },
  github: {
    en: 'GitHub',
    fa: 'گیت‌هاب',
  },
  scholar: {
    en: 'Google Scholar',
    fa: 'گوگل اسکالر',
  },
} as const;

export interface HeroProps {
  readonly profile: Profile;
  readonly onAskAssistant: () => void;
}

/**
 * تشخیص زبان فارسی از locale
 */
function isPersian(locale: string | null): boolean {
  if (locale === null) return false;
  return locale.startsWith('fa') || locale.startsWith('ar');
}

export function Hero({ profile, onAskAssistant }: HeroProps): JSX.Element {
  const ctx = useAlphabetContext();
  const decision = ctx?.handshake?.decision;
  
  const locale = decision?.uiConfig?.locale ?? null;
  const direction = decision?.uiConfig?.direction ?? 'ltr';
  const isRTL = direction === 'rtl' || isPersian(locale);
  
  // انتخاب متن بر اساس زبان
  const t = (key: keyof typeof BILINGUAL_CONTENT): string => {
    return BILINGUAL_CONTENT[key][isRTL ? 'fa' : 'en'];
  };

  return (
    <section 
      className="ds-hero" 
      aria-labelledby="ds-hero-name"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={isRTL ? 'fa' : 'en'}
    >
      <p className="ds-hero-eyebrow">{profile.title}</p>
      <h1 id="ds-hero-name">{profile.name}</h1>
      <p className="ds-hero-affiliation">{profile.affiliation}</p>
      <p className="ds-hero-tagline">{profile.tagline}</p>
      
      {/* نمایش heroCopy از Alphabet SDK اگر موجود باشد */}
      {decision?.uiConfig?.heroCopy !== undefined && decision.uiConfig.heroCopy !== profile.tagline && (
        <p className="ds-hero-adaptive-copy" dir={isRTL ? 'rtl' : 'ltr'}>
          {decision.uiConfig.heroCopy}
        </p>
      )}
      
      <div className="ds-hero-cta">
        <button type="button" className="ds-btn ds-btn-primary" onClick={onAskAssistant}>
          {t('askAssistant')}
        </button>
        <a className="ds-btn" href={`mailto:${profile.email}`}>
          {t('email')}
        </a>
        <a className="ds-btn" href={profile.githubUrl} rel="noopener noreferrer" target="_blank">
          {t('github')}
        </a>
        {profile.scholarUrl !== undefined ? (
          <a className="ds-btn" href={profile.scholarUrl} rel="noopener noreferrer" target="_blank">
            {t('scholar')}
          </a>
        ) : null}
      </div>

      {/* نشانگر لایه رندر فعلی */}
      {decision?.selectedLayer !== undefined && (
        <div className="ds-hero-layer-indicator" aria-hidden="true">
          <span className="ds-hero-layer-badge" data-layer={decision.selectedLayer}>
            {isRTL ? 'لایه رندر: ' : 'Render Layer: '}
            <code>{decision.selectedLayer}</code>
          </span>
        </div>
      )}
    </section>
  );
}
