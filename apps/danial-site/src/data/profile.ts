/**
 * @file profile.ts
 * @description
 * Single source of truth for Danial Samiei's public profile content.
 *
 * NOTE: The text below is a starting template using publicly plausible,
 * generic content. Replace each field with verified information before
 * publishing — do not present unverified claims as fact.
 */

export interface Publication {
  readonly title: string;
  readonly venue: string;
  readonly year: number;
  readonly url?: string;
  readonly authors: string;
}

export interface ResearchArea {
  readonly title: string;
  readonly summary: string;
  readonly keywords: ReadonlyArray<string>;
}

export interface CourseTaught {
  readonly code: string;
  readonly title: string;
  readonly level: 'undergraduate' | 'graduate';
  readonly term: string;
}

export interface Profile {
  readonly name: string;
  readonly title: string;
  readonly affiliation: string;
  readonly tagline: string;
  readonly bio: string;
  readonly email: string;
  readonly githubUrl: string;
  readonly scholarUrl?: string;
  readonly orcid?: string;
  readonly researchAreas: ReadonlyArray<ResearchArea>;
  readonly publications: ReadonlyArray<Publication>;
  readonly courses: ReadonlyArray<CourseTaught>;
  readonly office?: string;
  readonly officeHours?: string;
}

/**
 * Default profile content. Edit this file to update the page — all
 * components read from this object so changes propagate everywhere.
 */
export const profile: Profile = {
  name: 'Danial Samiei',
  title: 'Assistant Professor & Researcher',
  affiliation: 'Department of Human Science',
  tagline:
    'Ph.D. in Public Administration and Human Resource Managment. Building context-aware, privacy-respecting systems at the intersection of human-computer interaction, applied AI, and the open web.',
  bio: [
    'I am an assistant professor and researcher working on adaptive,',
    'context-aware software systems. My work focuses on how the web',
    'and intelligent agents can adapt to people, devices, and constraints',
    'without sacrificing privacy or accessibility.',
    '',
    'I lead and contribute to open-source projects — including the',
    'Alphabet (Alefba Web-Aware Framework) (Alphabet) — which explores how websites',
    'can degrade gracefully across five render layers while honouring',
    'consent and locale.',
  ].join(' '),
  email: 'danial.samiei@example.edu',
  githubUrl: 'https://github.com/danialsamiei',
  scholarUrl: 'https://scholar.google.com/',
  orcid: '0000-0000-0000-0000',
  researchAreas: [
    {
      title: 'Context-Aware Web Systems',
      summary:
        'Adaptive front-end architectures that respond to device capability, network conditions, and accessibility preferences.',
      keywords: ['progressive enhancement', 'capability detection', 'web performance'],
    },
    {
      title: 'Applied AI & LLMs',
      summary:
        'Grounded retrieval, hallucination mitigation, and trust scoring for LLM-driven user experiences.',
      keywords: ['RAG', 'evaluation', 'trust modelling'],
    },
    {
      title: 'Privacy & Consent Engineering',
      summary:
        'Tier-based consent ladders, jurisdiction-aware policy enforcement, and transparent personalization.',
      keywords: ['GDPR', 'consent UX', 'differential privacy'],
    },
  ],
  publications: [
    {
      title: 'Adaptive Render Layers for the Open Web',
      venue: 'Working paper / preprint',
      year: 2025,
      authors: 'Samiei, D.',
    },
    {
      title: 'Consent Ladders: Tiered Personalization with Auditable Provenance',
      venue: 'Working paper / preprint',
      year: 2025,
      authors: 'Samiei, D., et al.',
    },
  ],
  courses: [
    {
      code: 'CS-3xx',
      title: 'Web Systems & Architectures',
      level: 'undergraduate',
      term: 'Fall',
    },
    {
      code: 'CS-5xx',
      title: 'Applied Machine Learning for HCI',
      level: 'graduate',
      term: 'Spring',
    },
  ],
  office: 'Office TBD',
  officeHours: 'By appointment — please email.',
};
