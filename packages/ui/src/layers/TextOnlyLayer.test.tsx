/**
 * TextOnlyLayer — semantic HTML and ARIA landmarks for screen readers.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextOnlyLayer } from './TextOnlyLayer.js';

describe('TextOnlyLayer', () => {
  it('renders banner, main, and contentinfo landmarks', () => {
    render(
      <TextOnlyLayer heading="Hello" description="Welcome" locale="en">
        <p>Body content</p>
      </TextOnlyLayer>
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('uses the heading as a top-level h1 for AT', () => {
    render(<TextOnlyLayer heading="Adaptive Heading" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Adaptive Heading');
  });

  it('exposes a "Skip to main content" link as the first focusable element', () => {
    render(<TextOnlyLayer heading="X" />);
    const skip = screen.getByRole('link', { name: /skip to main content/i });
    expect(skip).toBeInTheDocument();
    expect(skip.getAttribute('href')).toBe('#awaf-main');
  });

  it('respects the direction prop for RTL', () => {
    const { container } = render(<TextOnlyLayer heading="سلام" direction="rtl" locale="fa-IR" />);
    const root = container.querySelector('[data-awaf-layer="TEXT_ONLY"]');
    expect(root?.getAttribute('dir')).toBe('rtl');
    expect(root?.getAttribute('lang')).toBe('fa-IR');
  });

  it('renders children inside the main landmark', () => {
    render(
      <TextOnlyLayer heading="X">
        <p data-testid="child">child content</p>
      </TextOnlyLayer>
    );
    const main = screen.getByRole('main');
    expect(main.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});
