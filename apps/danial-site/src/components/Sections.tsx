/**
 * @file Sections.tsx
 * @description
 * CLI-themed content sections with RTL/locale support via Alphabet SDK.
 */

import { useAlphabetContext } from '@alphabet/ui';
import type { Profile } from '../data/profile.js';

const LABELS = {
  about: { en: 'About', fa: 'درباره' },
  research: { en: 'Research', fa: 'پژوهش' },
  publications: { en: 'Publications', fa: 'انتشارات' },
  teaching: { en: 'Teaching', fa: 'تدریس' },
  contact: { en: 'Contact', fa: 'تماس' },
  email: { en: 'Email', fa: 'ایمیل' },
  office: { en: 'Office', fa: 'دفتر' },
  officeHours: { en: 'Office Hours', fa: 'ساعات ملاقات' },
  orcid: { en: 'ORCID', fa: 'شناسه ORCID' },
  undergraduate: { en: 'undergraduate', fa: 'کارشناسی' },
  graduate: { en: 'graduate', fa: 'تحصیلات تکمیلی' },
} as const;

function useLocaleInfo(): { isRTL: boolean; lang: 'en' | 'fa' } {
  const ctx = useAlphabetContext();
  const decision = ctx?.handshake?.decision;
  const locale = decision?.uiConfig?.locale ?? null;
  const direction = decision?.uiConfig?.direction ?? 'ltr';
  
  const isRTL = direction === 'rtl' || 
    (locale !== null && (locale.startsWith('fa') || locale.startsWith('ar')));
  
  return { isRTL, lang: isRTL ? 'fa' : 'en' };
}

export function About({ profile }: { readonly profile: Profile }): JSX.Element {
  const { isRTL, lang } = useLocaleInfo();
  
  return (
    <section 
      className="ds-section" 
      aria-labelledby="ds-about"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="cli-section-header">
        <span className="cli-section-icon">#</span>
        <h2 id="ds-about">{LABELS.about[lang]}</h2>
      </div>
      <p className="ds-muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {profile.bio}
      </p>
    </section>
  );
}

export function Research({ profile }: { readonly profile: Profile }): JSX.Element {
  const { isRTL, lang } = useLocaleInfo();
  
  return (
    <section 
      className="ds-section" 
      aria-labelledby="ds-research"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="cli-section-header">
        <span className="cli-section-icon">~</span>
        <h2 id="ds-research">{LABELS.research[lang]}</h2>
      </div>
      <ul className="ds-cards">
        {profile.researchAreas.map((area) => (
          <li key={area.title} className="ds-card">
            <h3>{area.title}</h3>
            <p>{area.summary}</p>
            <p className="ds-keywords">
              {area.keywords.map((k) => (
                <span key={k} className="ds-keyword">{k}</span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Publications({ profile }: { readonly profile: Profile }): JSX.Element {
  const { isRTL, lang } = useLocaleInfo();
  
  return (
    <section 
      className="ds-section" 
      aria-labelledby="ds-pubs"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="cli-section-header">
        <span className="cli-section-icon">&gt;</span>
        <h2 id="ds-pubs">{LABELS.publications[lang]}</h2>
      </div>
      <ol className="ds-pub-list">
        {profile.publications.map((p) => (
          <li key={`${p.year}-${p.title}`}>
            <span className="ds-pub-authors">{p.authors}</span>{' '}
            <span className="ds-pub-year">({p.year}).</span>{' '}
            {p.url !== undefined ? (
              <a href={p.url} rel="noopener noreferrer" target="_blank">
                {p.title}
              </a>
            ) : (
              <em>{p.title}</em>
            )}
            . <span className="ds-pub-venue">{p.venue}</span>.
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Teaching({ profile }: { readonly profile: Profile }): JSX.Element {
  const { isRTL, lang } = useLocaleInfo();
  
  return (
    <section 
      className="ds-section" 
      aria-labelledby="ds-teaching"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="cli-section-header">
        <span className="cli-section-icon">$</span>
        <h2 id="ds-teaching">{LABELS.teaching[lang]}</h2>
      </div>
      <ul className="ds-course-list">
        {profile.courses.map((c) => (
          <li key={c.code}>
            <strong style={{ color: 'var(--cli-green)' }}>{c.code}</strong>
            <span>{c.title}</span>
            <span className="ds-muted">
              ({LABELS[c.level][lang]}, {c.term})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Contact({ profile }: { readonly profile: Profile }): JSX.Element {
  const { isRTL, lang } = useLocaleInfo();
  
  return (
    <section 
      className="ds-section" 
      aria-labelledby="ds-contact"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="cli-section-header">
        <span className="cli-section-icon">@</span>
        <h2 id="ds-contact">{LABELS.contact[lang]}</h2>
      </div>
      <ul className="ds-contact-list">
        <li>
          <strong style={{ color: 'var(--cli-yellow)' }}>{LABELS.email[lang]}:</strong>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </li>
        {profile.contactEmail !== undefined && (
          <li>
            <strong style={{ color: 'var(--cli-yellow)' }}>{LABELS.email[lang]} (2):</strong>
            <a href={`mailto:${profile.contactEmail}`}>{profile.contactEmail}</a>
          </li>
        )}
        {profile.office !== undefined && (
          <li>
            <strong style={{ color: 'var(--cli-cyan)' }}>{LABELS.office[lang]}:</strong>
            <span>{profile.office}</span>
          </li>
        )}
        {profile.officeHours !== undefined && (
          <li>
            <strong style={{ color: 'var(--cli-purple)' }}>{LABELS.officeHours[lang]}:</strong>
            <span>{profile.officeHours}</span>
          </li>
        )}
        {profile.orcid !== undefined && (
          <li>
            <strong style={{ color: 'var(--cli-green)' }}>{LABELS.orcid[lang]}:</strong>
            <span>{profile.orcid}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
