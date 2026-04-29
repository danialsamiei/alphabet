/**
 * @file App.tsx
 * @description
 * Top-level shell for Danial Samiei's personal site.
 *
 * Showcases the Alphabet SDK: the page is wrapped in {@link AlphabetProvider}
 * and the hero section adapts via {@link AdaptiveSlot} — the same
 * five-layer fallback chain the framework uses everywhere else in
 * this monorepo. The interactive assistant is powered by the
 * GitHub Models LLM API.
 */

import { useRef } from 'react';
import {
  AdaptiveSlot,
  AlphabetProvider,
  Canvas2DLayer,
  Css3DLayer,
  StaticHtmlLayer,
  TextOnlyLayer,
} from '@alphabet/ui';

import { profile } from './data/profile.js';
import { Hero } from './components/Hero.js';
import { About, Contact, Publications, Research, Teaching } from './components/Sections.js';
import { AssistantChat, type AssistantChatHandle } from './components/AssistantChat.js';

/**
 * Delay before stealing focus after a smooth-scroll. Most browsers
 * cancel an in-flight smooth-scroll if focus moves immediately, so
 * we wait roughly one scroll-animation frame.
 */
const SCROLL_FOCUS_DELAY_MS = 350;

export function App(): JSX.Element {
  const assistantRef = useRef<AssistantChatHandle>(null);

  const focusAssistant = (): void => {
    document.getElementById('ds-assistant')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => assistantRef.current?.focus(), SCROLL_FOCUS_DELAY_MS);
  };

  return (
    <AlphabetProvider>
      <a href="#ds-main" className="ds-skip-link">
        Skip to main content
      </a>

      {/*
        The hero is rendered through Alphabet's AdaptiveSlot so on a
        capable, motion-friendly device the user gets a richer
        background, while reduced-motion / low-capability / SSR users
        fall through to a clean static HTML hero. All variants render
        the same content semantics.
      */}
      <header className="ds-header">
        <AdaptiveSlot
          r3fFallback={<HeroFallback onAskAssistant={focusAssistant} />}
          css3d={(ctx) => (
            <div className="ds-adaptive ds-adaptive-css3d" dir={ctx.direction}>
              <Css3DLayer
                heading={profile.name}
                description={profile.tagline}
                direction={ctx.direction}
                {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
              />
              <Hero profile={profile} onAskAssistant={focusAssistant} />
            </div>
          )}
          canvas2d={(ctx) => (
            <div className="ds-adaptive ds-adaptive-canvas" dir={ctx.direction}>
              <Canvas2DLayer
                heading={profile.name}
                description={profile.tagline}
                direction={ctx.direction}
                {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
              />
              <Hero profile={profile} onAskAssistant={focusAssistant} />
            </div>
          )}
          staticHtml={() => (
            <div className="ds-adaptive ds-adaptive-static">
              <StaticHtmlLayer
                heading={profile.name}
                description={profile.tagline}
              />
              <Hero profile={profile} onAskAssistant={focusAssistant} />
            </div>
          )}
          textOnly={() => (
            <div className="ds-adaptive ds-adaptive-text">
              <TextOnlyLayer heading={profile.name} description={profile.tagline} />
              <Hero profile={profile} onAskAssistant={focusAssistant} />
            </div>
          )}
        />
      </header>

      <main id="ds-main" className="ds-main">
        <About profile={profile} />
        <Research profile={profile} />
        <Publications profile={profile} />
        <Teaching profile={profile} />
        <AssistantChat ref={assistantRef} />
        <Contact profile={profile} />
      </main>

      <footer className="ds-footer">
        <p>
          © {new Date().getFullYear()} {profile.name}. Built with the{' '}
          <a href="https://github.com/danialsamiei/awaf" rel="noopener noreferrer" target="_blank">
            Alphabet
          </a>{' '}
          SDK. Assistant powered by{' '}
          <a
            href="https://docs.github.com/en/github-models"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub Models
          </a>
          .
        </p>
      </footer>
    </AlphabetProvider>
  );
}

function HeroFallback({ onAskAssistant }: { readonly onAskAssistant: () => void }): JSX.Element {
  return (
    <div className="ds-adaptive ds-adaptive-fallback">
      <Hero profile={profile} onAskAssistant={onAskAssistant} />
    </div>
  );
}
