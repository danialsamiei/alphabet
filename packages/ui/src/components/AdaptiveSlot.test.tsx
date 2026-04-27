/**
 * AdaptiveSlot — fallback chain selection (sync layers only — R3F lazy
 * loading is exercised separately).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdaptiveSlot } from './AdaptiveSlot.js';

describe('AdaptiveSlot', () => {
  it('renders the renderer for the selected layer', () => {
    render(
      <AdaptiveSlot
        forceLayer="STATIC_HTML"
        staticHtml={(ctx) => <div data-testid="static">layer={ctx.layer}</div>}
        textOnly={() => <div data-testid="text">text</div>}
      />
    );
    expect(screen.getByTestId('static')).toHaveTextContent('layer=STATIC_HTML');
    expect(screen.queryByTestId('text')).toBeNull();
  });

  it('falls back down the chain when the selected renderer is missing', () => {
    // Force CSS_3D but only provide TEXT_ONLY renderer — should walk the
    // chain CSS_3D → CANVAS_2D → STATIC_HTML → TEXT_ONLY.
    render(
      <AdaptiveSlot
        forceLayer="CSS_3D"
        textOnly={(ctx) => <div data-testid="picked">picked={ctx.layer}</div>}
      />
    );
    expect(screen.getByTestId('picked')).toHaveTextContent('picked=TEXT_ONLY');
  });

  it('returns null when no renderer matches the chain', () => {
    const { container } = render(<AdaptiveSlot forceLayer="STATIC_HTML" />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes RTL direction when handshake decision says so', () => {
    const fakeHandshake = {
      status: 'ready' as const,
      decision: {
        visitorId: 'v-test' as never,
        sessionId: 'sess-test' as never,
        consentTier: 'NO_MEMORY' as const,
        layer: 'STATIC_HTML' as const,
        uiConfig: {
          locale: 'fa-IR',
          direction: 'rtl' as const,
          intent: 'explore' as const,
          enableAnimations: false,
          theme: 'auto' as const,
        },
        privacyMode: { restricted: false, dnt: false, gpc: false },
        reasoning: [],
        decidedAt: new Date().toISOString(),
      },
      signals: null,
      enriched: null,
      error: null,
      refresh: vi.fn(),
    };
    render(
      <AdaptiveSlot
        handshake={fakeHandshake}
        staticHtml={(ctx) => (
          <div data-testid="dir-host" data-dir={ctx.direction} data-locale={ctx.locale ?? 'none'}>
            ok
          </div>
        )}
      />
    );
    const host = screen.getByTestId('dir-host');
    expect(host.getAttribute('data-dir')).toBe('rtl');
    expect(host.getAttribute('data-locale')).toBe('fa-IR');
  });
});
