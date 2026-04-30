/**
 * @file Hero.tsx
 * @description
 * CLI-themed hero section with Alphabet SDK context awareness.
 */

import { useAlphabetContext } from '@alphabet/ui';
import type { Profile } from '../data/profile.js';

const BILINGUAL = {
  askAssistant: { en: './ask-assistant', fa: 'پرسش از دستیار' },
  email: { en: 'mail', fa: 'ایمیل' },
  github: { en: 'github', fa: 'گیت‌هاب' },
  scholar: { en: 'scholar', fa: 'اسکالر' },
  renderLayer: { en: 'Render Layer', fa: 'لایه رندر' },
} as const;

export interface HeroProps {
  readonly profile: Profile;
  readonly onAskAssistant: () => void;
}

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
  
  const t = (key: keyof typeof BILINGUAL): string => BILINGUAL[key][isRTL ? 'fa' : 'en'];

  return (
    <section 
      className="ds-hero" 
      aria-labelledby="ds-hero-name"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={isRTL ? 'fa' : 'en'}
    >
      <div className="cli-output">
        {/* System info style display */}
        <p style={{ margin: 0 }}>
          <span style={{ color: 'var(--cli-cyan)' }}>user</span>
          <span style={{ color: 'var(--cli-muted)' }}>@</span>
          <span style={{ color: 'var(--cli-purple)' }}>danial.ai</span>
        </p>
        <p style={{ margin: '0.25rem 0', color: 'var(--cli-border)' }}>{'─'.repeat(30)}</p>
        
        <p style={{ margin: '0.25rem 0' }}>
          <span style={{ color: 'var(--cli-accent)' }}>Name:</span>{' '}
          <span className="ds-hero-name">{profile.name}</span>
        </p>
        
        <p style={{ margin: '0.25rem 0' }}>
          <span style={{ color: 'var(--cli-accent)' }}>Title:</span>{' '}
          <span className="ds-hero-title">{profile.title}</span>
        </p>
        
        <p style={{ margin: '0.25rem 0' }}>
          <span style={{ color: 'var(--cli-accent)' }}>Affiliation:</span>{' '}
          <span className="ds-hero-affiliation">{profile.affiliation}</span>
        </p>
        
        <p style={{ margin: '0.25rem 0', color: 'var(--cli-border)' }}>{'─'.repeat(30)}</p>
        
        <p className="ds-hero-tagline">{profile.tagline}</p>
        
        {/* Adaptive copy from Alphabet SDK */}
        {decision?.uiConfig?.heroCopy !== undefined && decision.uiConfig.heroCopy !== profile.tagline && (
          <p className="ds-hero-adaptive-copy" dir={isRTL ? 'rtl' : 'ltr'}>
            {decision.uiConfig.heroCopy}
          </p>
        )}
      </div>
      
      {/* Action buttons styled as CLI commands */}
      <div className="ds-hero-cta">
        <button type="button" className="ds-btn ds-btn-primary" onClick={onAskAssistant}>
          <span style={{ color: 'var(--cli-bg)' }}>$</span> {t('askAssistant')}
        </button>
        <a className="ds-btn" href={`mailto:${profile.email}`}>
          <span style={{ color: 'var(--cli-yellow)' }}>@</span> {t('email')}
        </a>
        <a className="ds-btn" href={profile.githubUrl} rel="noopener noreferrer" target="_blank">
          <span style={{ color: 'var(--cli-purple)' }}>&gt;</span> {t('github')}
        </a>
        {profile.scholarUrl !== undefined && (
          <a className="ds-btn" href={profile.scholarUrl} rel="noopener noreferrer" target="_blank">
            <span style={{ color: 'var(--cli-cyan)' }}>#</span> {t('scholar')}
          </a>
        )}
      </div>

      {/* Render layer indicator */}
      {decision?.selectedLayer !== undefined && (
        <div className="ds-hero-layer-indicator" aria-hidden="true">
          <span className="ds-hero-layer-badge" data-layer={decision.selectedLayer}>
            {t('renderLayer')}: <code>{decision.selectedLayer}</code>
          </span>
        </div>
      )}
    </section>
  );
}
