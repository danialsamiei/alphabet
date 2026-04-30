/**
 * @file App.tsx
 * @description
 * Top-level shell for danial.ai — CLI-themed personal site.
 * Terminal aesthetic with full Alphabet SDK integration.
 */

import { useRef } from 'react';
import {
  AdaptiveSlot,
  AlphabetProvider,
  Canvas2DLayer,
  ConsentBanner,
  StaticHtmlLayer,
  TextOnlyLayer,
} from '@alphabet/ui';

import { profile } from './data/profile.js';
import { Hero } from './components/Hero.js';
import { About, Contact, Publications, Research, Teaching } from './components/Sections.js';
import { AssistantChat, type AssistantChatHandle } from './components/AssistantChat.js';
import { VisitorContext } from './components/VisitorContext.js';

const SCROLL_FOCUS_DELAY_MS = 350;

/** ASCII art logo for danial.ai */
const ASCII_LOGO = `
     _             _       _             _ 
    | |           (_)     | |           (_)
  __| | __ _ _ __  _  __ _| |   __ _ _   _ 
 / _\` |/ _\` | '_ \\| |/ _\` | |  / _\` | | | |
| (_| | (_| | | | | | (_| | | | (_| | |_| |
 \\__,_|\\__,_|_| |_|_|\\__,_|_|  \\__,_|\\__,_|
                                           
`;

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

      {/* Main Terminal Window */}
      <div className="cli-terminal">
        <div className="cli-terminal-header">
          <div className="cli-terminal-dots">
            <span className="cli-terminal-dot cli-terminal-dot--red" />
            <span className="cli-terminal-dot cli-terminal-dot--yellow" />
            <span className="cli-terminal-dot cli-terminal-dot--green" />
          </div>
          <span className="cli-terminal-title">danial@ai: ~/portfolio</span>
        </div>

        <div className="cli-terminal-content">
          {/* ASCII Logo */}
          <pre className="cli-ascii" aria-hidden="true">{ASCII_LOGO}</pre>

          {/* System Info Prompt */}
          <div className="cli-prompt">
            <span className="cli-prompt-symbol">$</span>
            <span className="cli-command">
              <span className="cli-command-keyword">neofetch</span>
              <span className="cli-command-comment"> # Welcome to danial.ai</span>
            </span>
          </div>

          {/* Hero Section */}
          <header className="ds-header">
            <AdaptiveSlot
              r3fFallback={<HeroFallback onAskAssistant={focusAssistant} />}
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

          {/* Main Content */}
          <main id="ds-main" className="ds-main">
            {/* About Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">cat</span>
                <span className="cli-command-string"> ~/about.md</span>
              </span>
            </div>
            <div className="cli-output">
              <About profile={profile} />
            </div>

            {/* Visitor Context */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">alphabet</span>
                <span className="cli-command-flag"> --context</span>
              </span>
            </div>
            <div className="cli-output">
              <VisitorContext />
            </div>

            {/* Research Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">ls</span>
                <span className="cli-command-string"> -la ~/research/</span>
              </span>
            </div>
            <div className="cli-output">
              <Research profile={profile} />
            </div>

            {/* Publications Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">grep</span>
                <span className="cli-command-flag"> -r </span>
                <span className="cli-command-string">"publications"</span>
                <span> ~/scholar/</span>
              </span>
            </div>
            <div className="cli-output">
              <Publications profile={profile} />
            </div>

            {/* Teaching Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">tree</span>
                <span className="cli-command-string"> ~/courses/</span>
              </span>
            </div>
            <div className="cli-output">
              <Teaching profile={profile} />
            </div>

            {/* Assistant Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">./assistant</span>
                <span className="cli-command-flag"> --interactive</span>
                <span className="cli-command-flag"> --model</span>
                <span className="cli-command-string">=gpt-4o</span>
              </span>
            </div>
            <div className="cli-output">
              <AssistantChat ref={assistantRef} />
            </div>

            {/* Contact Section */}
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">echo</span>
                <span className="cli-command-string"> $CONTACT_INFO</span>
              </span>
            </div>
            <div className="cli-output">
              <Contact profile={profile} />
            </div>
          </main>

          {/* Footer */}
          <footer className="ds-footer">
            <div className="cli-prompt">
              <span className="cli-prompt-symbol">$</span>
              <span className="cli-command">
                <span className="cli-command-keyword">exit</span>
                <span className="cli-command-comment">
                  {' '}# Built with{' '}
                  <a href="https://github.com/danialsamiei/alphabet" rel="noopener noreferrer" target="_blank">
                    Alphabet SDK
                  </a>
                  {' '}| Powered by{' '}
                  <a href="https://docs.github.com/en/github-models" rel="noopener noreferrer" target="_blank">
                    GitHub Models
                  </a>
                </span>
              </span>
            </div>
            <p className="cli-output cli-output-muted">
              Connection closed. Session ended {new Date().getFullYear()}.
            </p>
          </footer>
        </div>
      </div>

      {/* Consent Banner */}
      <ConsentBanner
        title="حریم خصوصی / Privacy"
        description="این سایت از Alphabet SDK استفاده می‌کند. / This site uses Alphabet SDK."
        acceptLabel="پذیرش / Accept"
        rejectLabel="رد / Reject"
        showEnriched
        enrichedLabel="تنظیمات / Settings"
      />
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
