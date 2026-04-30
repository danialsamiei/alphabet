/**
 * @file Hero.tsx
 * @description
 * CLI-styled hero section mimicking neofetch output.
 * Displays profile information in authentic terminal format.
 */

import { useAlphabetContext } from '@alphabet/ui';
import type { Profile } from '../data/profile.js';

const BILINGUAL = {
  askAssistant: { en: './ask --help', fa: 'راهنما' },
  email: { en: 'mail -s', fa: 'ایمیل' },
  github: { en: 'git clone', fa: 'گیت‌هاب' },
  scholar: { en: 'curl scholar', fa: 'اسکالر' },
  renderLayer: { en: 'Render', fa: 'رندر' },
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

  // Generate uptime-like string
  const getUptime = (): string => {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();
    return `${hours}h ${mins}m`;
  };

  return (
    <section 
      className="ds-hero" 
      aria-labelledby="ds-hero-name"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={isRTL ? 'fa' : 'en'}
    >
      {/* Neofetch-style system info */}
      <div className="ds-hero-info">
        <span className="ds-hero-label">user@host</span>
        <span className="ds-hero-value">
          <span className="ds-hero-name" id="ds-hero-name" style={{ color: 'var(--cli-green-bright)' }}>
            danial
          </span>
          <span style={{ color: 'var(--cli-fg-muted)' }}>@</span>
          <span style={{ color: 'var(--cli-purple)' }}>portfolio</span>
        </span>

        <span className="ds-hero-separator">{'─'.repeat(35)}</span>

        <span className="ds-hero-label">Name</span>
        <span className="ds-hero-value ds-hero-name">{profile.name}</span>

        <span className="ds-hero-label">Title</span>
        <span className="ds-hero-value ds-hero-title">{profile.title}</span>

        <span className="ds-hero-label">Affiliation</span>
        <span className="ds-hero-value ds-hero-affiliation">{profile.affiliation}</span>

        <span className="ds-hero-label">Email</span>
        <span className="ds-hero-value">
          <a href={`mailto:${profile.email}`} style={{ color: 'var(--cli-blue)' }}>
            {profile.email}
          </a>
        </span>

        <span className="ds-hero-label">GitHub</span>
        <span className="ds-hero-value">
          <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cli-blue)' }}>
            github.com/danialsamiei
          </a>
        </span>

        {profile.orcid !== undefined && (
          <>
            <span className="ds-hero-label">ORCID</span>
            <span className="ds-hero-value" style={{ color: 'var(--cli-cyan)' }}>
              {profile.orcid}
            </span>
          </>
        )}

        <span className="ds-hero-separator">{'─'.repeat(35)}</span>

        <span className="ds-hero-label">Uptime</span>
        <span className="ds-hero-value" style={{ color: 'var(--cli-fg-muted)' }}>{getUptime()}</span>

        <span className="ds-hero-label">Shell</span>
        <span className="ds-hero-value" style={{ color: 'var(--cli-fg-muted)' }}>zsh 5.9</span>

        <span className="ds-hero-label">Terminal</span>
        <span className="ds-hero-value" style={{ color: 'var(--cli-fg-muted)' }}>Alphabet SDK v2.0</span>

        {decision?.selectedLayer !== undefined && (
          <>
            <span className="ds-hero-label">{t('renderLayer')}</span>
            <span 
              className="ds-hero-value" 
              style={{ 
                color: decision.selectedLayer === 'STATIC_HTML' 
                  ? 'var(--cli-fg)' 
                  : decision.selectedLayer === 'R3F' 
                    ? 'var(--cli-green-bright)' 
                    : 'var(--cli-yellow)' 
              }}
            >
              {decision.selectedLayer}
            </span>
          </>
        )}
      </div>
      
      {/* Tagline */}
      <p className="ds-hero-tagline">
        <span style={{ color: 'var(--cli-fg-subtle)' }}>// </span>
        {profile.tagline}
      </p>
      
      {/* Adaptive copy from Alphabet SDK */}
      {decision?.uiConfig?.heroCopy !== undefined && decision.uiConfig.heroCopy !== profile.tagline && (
        <p className="ds-hero-adaptive-copy" dir={isRTL ? 'rtl' : 'ltr'}>
          {decision.uiConfig.heroCopy}
        </p>
      )}

      {/* Color palette display — like neofetch */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginTop: '1rem',
        marginBottom: '1.5rem'
      }}>
        {['var(--cli-red)', 'var(--cli-orange)', 'var(--cli-yellow)', 'var(--cli-green)', 
          'var(--cli-cyan)', 'var(--cli-blue)', 'var(--cli-purple)', 'var(--cli-pink)'].map((color, i) => (
          <span 
            key={i}
            style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '4px',
              background: color,
              display: 'inline-block'
            }} 
            aria-hidden="true"
          />
        ))}
      </div>
      
      {/* Action buttons styled as CLI commands */}
      <div className="ds-hero-cta">
        <button type="button" className="ds-btn ds-btn-primary" onClick={onAskAssistant}>
          <span className="ds-btn-icon">$</span> {t('askAssistant')}
        </button>
        <a className="ds-btn" href={`mailto:${profile.email}`}>
          <span className="ds-btn-icon" style={{ color: 'var(--cli-yellow)' }}>@</span> {t('email')}
        </a>
        <a className="ds-btn" href={profile.githubUrl} rel="noopener noreferrer" target="_blank">
          <span className="ds-btn-icon" style={{ color: 'var(--cli-purple)' }}>&gt;</span> {t('github')}
        </a>
        {profile.scholarUrl !== undefined && (
          <a className="ds-btn" href={profile.scholarUrl} rel="noopener noreferrer" target="_blank">
            <span className="ds-btn-icon" style={{ color: 'var(--cli-cyan)' }}>#</span> {t('scholar')}
          </a>
        )}
      </div>
    </section>
  );
}
