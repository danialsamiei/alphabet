/**
 * @file Sections.tsx
 * @description About / Research / Publications / Teaching / Contact —
 * grouped together because each is small and they share styling.
 */

import type { Profile } from '../data/profile.js';

export function About({ profile }: { readonly profile: Profile }): JSX.Element {
  return (
    <section className="ds-section" aria-labelledby="ds-about">
      <h2 id="ds-about">About</h2>
      <p>{profile.bio}</p>
    </section>
  );
}

export function Research({ profile }: { readonly profile: Profile }): JSX.Element {
  return (
    <section className="ds-section" aria-labelledby="ds-research">
      <h2 id="ds-research">Research</h2>
      <ul className="ds-cards">
        {profile.researchAreas.map((area) => (
          <li key={area.title} className="ds-card">
            <h3>{area.title}</h3>
            <p>{area.summary}</p>
            <p className="ds-keywords">
              {area.keywords.map((k) => (
                <span key={k} className="ds-keyword">
                  {k}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Publications({ profile }: { readonly profile: Profile }): JSX.Element {
  return (
    <section className="ds-section" aria-labelledby="ds-pubs">
      <h2 id="ds-pubs">Selected publications</h2>
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
  return (
    <section className="ds-section" aria-labelledby="ds-teaching">
      <h2 id="ds-teaching">Teaching</h2>
      <ul className="ds-course-list">
        {profile.courses.map((c) => (
          <li key={c.code}>
            <strong>{c.code}</strong> — {c.title}{' '}
            <span className="ds-muted">
              ({c.level}, {c.term})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Contact({ profile }: { readonly profile: Profile }): JSX.Element {
  return (
    <section className="ds-section" aria-labelledby="ds-contact">
      <h2 id="ds-contact">Contact</h2>
      <ul className="ds-contact-list">
        <li>
          <strong>Email:</strong>{' '}
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </li>
        {profile.office !== undefined ? (
          <li>
            <strong>Office:</strong> {profile.office}
          </li>
        ) : null}
        {profile.officeHours !== undefined ? (
          <li>
            <strong>Office hours:</strong> {profile.officeHours}
          </li>
        ) : null}
        {profile.orcid !== undefined ? (
          <li>
            <strong>ORCID:</strong> {profile.orcid}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
