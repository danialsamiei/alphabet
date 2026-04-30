/**
 * @file App.tsx
 * @description
 * Hyper-realistic CLI terminal experience for danial.ai
 * A stunning terminal interface that blurs the line between web and native CLI.
 */

import { useRef, useState, useEffect } from 'react';
import {
  AdaptiveSlot,
  AlphabetProvider,
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

/** Stunning ASCII art logo for danial.ai */
const ASCII_LOGO = `
██████╗  █████╗ ███╗   ██╗██╗ █████╗ ██╗       ██╗  ██╗  █████╗ ██╗
██╔══██╗██╔══██╗████╗  ██║██║██╔══██╗██║       ██║  ██║ ██╔════╝ ██║
██║  ██║███████║██╔██╗ ██║██║███████║██║   ██  ██║  ██║ ██║      ██║
██║  ██║██╔══██║██║╚██╗██║██║██╔══██║██║   ██  ██║  ██║ ██║      ██║
██████╔╝██║  ██║██║ ╚████║██║██║  ██║██║      ╚██████╔╝  ╚██████╗██║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝╚═╝       ╚═════╝    ╚═════╝╚═╝
`;

const WELCOME_MESSAGE = `
┌─────────────────────────────────────────────────────────────────────┐
│  Welcome to danial.ai — Interactive Portfolio Terminal v2.0        │
│  Type 'help' for available commands or scroll to explore           │
│  Powered by Alphabet SDK + GitHub Models LLM                        │
└─────────────────────────────────────────────────────────────────────┘
`;

/** Typewriter effect hook */
function useTypewriter(text: string, speed: number = 30): string {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    if (displayed.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed(text.slice(0, displayed.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [displayed, text, speed]);
  
  return displayed;
}

/** Current time display */
function useCurrentTime(): string {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return time;
}

export function App(): JSX.Element {
  const assistantRef = useRef<AssistantChatHandle>(null);
  const currentTime = useCurrentTime();
  const typedWelcome = useTypewriter(WELCOME_MESSAGE, 5);

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
        {/* macOS-style title bar */}
        <div className="cli-terminal-header">
          <div className="cli-terminal-dots">
            <span className="cli-terminal-dot cli-terminal-dot--red" title="Close" />
            <span className="cli-terminal-dot cli-terminal-dot--yellow" title="Minimize" />
            <span className="cli-terminal-dot cli-terminal-dot--green" title="Maximize" />
          </div>
          <span className="cli-terminal-title">
            danial@portfolio: ~ — zsh — 120×40
          </span>
          <div className="cli-terminal-actions">
            <span className="cli-terminal-action">{currentTime}</span>
          </div>
        </div>

        <div className="cli-terminal-content">
          {/* ASCII Logo with glow effect */}
          <div className="cli-ascii-container">
            <pre className="cli-ascii" aria-label="danial.ai ASCII art logo">{ASCII_LOGO}</pre>
          </div>
          
          {/* Welcome message with typewriter effect */}
          <pre style={{ 
            color: 'var(--cli-cyan)', 
            fontSize: '12px', 
            marginBottom: '1.5rem',
            whiteSpace: 'pre-wrap'
          }}>
            {typedWelcome}
            <span className="cli-cursor" />
          </pre>

          {/* Initial command prompt */}
          <div className="cli-prompt-line">
            <span className="cli-prompt-user">danial</span>
            <span className="cli-prompt-at">@</span>
            <span className="cli-prompt-host">portfolio</span>
            <span className="cli-prompt-colon">:</span>
            <span className="cli-prompt-path">~</span>
            <span className="cli-prompt-branch"> (main)</span>
            <span className="cli-prompt-symbol"> $</span>
            <span className="cli-command">
              <span className="cli-command-keyword"> neofetch</span>
              <span className="cli-command-comment"> # Display system info</span>
            </span>
          </div>

          {/* Hero Section */}
          <header className="ds-header">
            <div className="cli-output cli-output-success">
              <AdaptiveSlot
                r3fFallback={<HeroFallback onAskAssistant={focusAssistant} />}
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
            </div>
          </header>

          {/* Main Content */}
          <main id="ds-main" className="ds-main">
            {/* About Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> cat</span>
                <span className="cli-command-string"> ./about.md</span>
                <span className="cli-command-pipe"> | </span>
                <span className="cli-command-keyword">head</span>
                <span className="cli-command-flag"> -n 20</span>
              </span>
            </div>
            <div className="cli-output">
              <About profile={profile} />
            </div>

            {/* Visitor Context */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> alphabet</span>
                <span className="cli-command-flag"> --context</span>
                <span className="cli-command-flag"> --verbose</span>
              </span>
            </div>
            <div className="cli-output">
              <VisitorContext />
            </div>

            {/* Research Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~/research</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> ls</span>
                <span className="cli-command-flag"> -la</span>
                <span className="cli-command-flag"> --color</span>
                <span className="cli-command-string"> ./areas/</span>
              </span>
            </div>
            <div className="cli-output">
              <Research profile={profile} />
            </div>

            {/* Publications Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~/scholar</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> grep</span>
                <span className="cli-command-flag"> -rn</span>
                <span className="cli-command-string"> "publication"</span>
                <span> ./papers/</span>
                <span className="cli-command-pipe"> | </span>
                <span className="cli-command-keyword">sort</span>
                <span className="cli-command-flag"> -r</span>
              </span>
            </div>
            <div className="cli-output">
              <Publications profile={profile} />
            </div>

            {/* Teaching Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~/courses</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> tree</span>
                <span className="cli-command-flag"> -L 2</span>
                <span className="cli-command-flag"> --dirsfirst</span>
              </span>
            </div>
            <div className="cli-output">
              <Teaching profile={profile} />
            </div>

            {/* Assistant Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> ./assistant</span>
                <span className="cli-command-flag"> --interactive</span>
                <span className="cli-command-flag"> --model</span>
                <span className="cli-command-variable">=gpt-4o</span>
                <span className="cli-command-flag"> --streaming</span>
              </span>
            </div>
            <div className="cli-output">
              <AssistantChat ref={assistantRef} />
            </div>

            {/* Contact Section */}
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> echo</span>
                <span className="cli-command-variable"> $CONTACT_INFO</span>
                <span className="cli-command-pipe"> | </span>
                <span className="cli-command-keyword">jq</span>
                <span className="cli-command-string"> '.'</span>
              </span>
            </div>
            <div className="cli-output">
              <Contact profile={profile} />
            </div>
          </main>

          {/* Footer */}
          <footer className="ds-footer">
            <div className="cli-prompt-line">
              <span className="cli-prompt-user">danial</span>
              <span className="cli-prompt-at">@</span>
              <span className="cli-prompt-host">portfolio</span>
              <span className="cli-prompt-colon">:</span>
              <span className="cli-prompt-path">~</span>
              <span className="cli-prompt-symbol"> $</span>
              <span className="cli-command">
                <span className="cli-command-keyword"> exit</span>
              </span>
            </div>
            <p className="cli-output cli-output-muted">
              logout
              <br />
              <br />
              Connection to danial.ai closed.
              <br />
              Session duration: {Math.floor(Math.random() * 10) + 1}m {Math.floor(Math.random() * 59)}s
              <br />
              <br />
              Built with{' '}
              <a href="https://github.com/danialsamiei/alphabet" rel="noopener noreferrer" target="_blank">
                Alphabet SDK
              </a>
              {' '}| Powered by{' '}
              <a href="https://docs.github.com/en/github-models" rel="noopener noreferrer" target="_blank">
                GitHub Models
              </a>
              {' '}| © {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>

      {/* Consent Banner */}
      <ConsentBanner
        title="حریم خصوصی / Privacy"
        description="این سایت از Alphabet SDK برای تطبیق تجربه استفاده می‌کند. / This site uses Alphabet SDK to adapt your experience."
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
