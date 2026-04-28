/**
 * @file Hero.tsx
 * @description Top-of-page hero — name, title, tagline, primary CTAs.
 */

import type { Profile } from '../data/profile.js';

export interface HeroProps {
  readonly profile: Profile;
  readonly onAskAssistant: () => void;
}

export function Hero({ profile, onAskAssistant }: HeroProps): JSX.Element {
  return (
    <section className="ds-hero" aria-labelledby="ds-hero-name">
      <p className="ds-hero-eyebrow">{profile.title}</p>
      <h1 id="ds-hero-name">{profile.name}</h1>
      <p className="ds-hero-affiliation">{profile.affiliation}</p>
      <p className="ds-hero-tagline">{profile.tagline}</p>
      <div className="ds-hero-cta">
        <button type="button" className="ds-btn ds-btn-primary" onClick={onAskAssistant}>
          Ask the assistant
        </button>
        <a className="ds-btn" href={`mailto:${profile.email}`}>
          Email
        </a>
        <a className="ds-btn" href={profile.githubUrl} rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
        {profile.scholarUrl !== undefined ? (
          <a className="ds-btn" href={profile.scholarUrl} rel="noopener noreferrer" target="_blank">
            Google Scholar
          </a>
        ) : null}
      </div>
    </section>
  );
}
