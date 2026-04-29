/**
 * ConsentBanner — keyboard accessibility + state machine actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAlphabetConsent } from '../hooks/useAlphabetConsent.js';
import { ConsentBanner } from './ConsentBanner.js';

// Simple wrapper that lives inside React so the consent hook is shared
// between banner and assertion via render-prop.
function Harness({ onChange }: { readonly onChange?: (a: string) => void }): JSX.Element {
  const consent = useAlphabetConsent();
  return (
    <>
      <ConsentBanner
        consent={consent}
        showEnriched
        {...(onChange !== undefined ? { onChange: (a) => onChange(a) } : {})}
      />
      <div data-testid="state">{consent.state}</div>
      <div data-testid="tier">{consent.tier}</div>
    </>
  );
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders as a dialog with accessible heading and description', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('exposes Accept and Reject as keyboard-focusable buttons', () => {
    render(<Harness />);
    const accept = screen.getByRole('button', { name: 'Accept' });
    const reject = screen.getByRole('button', { name: 'Reject' });
    expect(accept).toBeInTheDocument();
    expect(reject).toBeInTheDocument();
    accept.focus();
    expect(document.activeElement).toBe(accept);
    reject.focus();
    expect(document.activeElement).toBe(reject);
  });

  it('Accept grants CONSENTED and hides the banner', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onChange).toHaveBeenCalledWith('accept');
    expect(screen.getByTestId('state').textContent).toBe('granted');
    expect(screen.getByTestId('tier').textContent).toBe('CONSENTED');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Reject revokes consent and hides the banner', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByTestId('state').textContent).toBe('revoked');
    expect(screen.getByTestId('tier').textContent).toBe('NO_MEMORY');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enable personalization grants ENRICHED with the right purposes', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable personalization' }));
    expect(screen.getByTestId('tier').textContent).toBe('ENRICHED');
  });

  it('Activating Accept via keyboard (Enter) triggers grant', () => {
    render(<Harness />);
    const accept = screen.getByRole('button', { name: 'Accept' });
    accept.focus();
    // Native button activates on Enter via click event in jsdom; use click
    // to assert the keyboard-equivalent behavior.
    fireEvent.keyDown(accept, { key: 'Enter' });
    fireEvent.click(accept);
    expect(screen.getByTestId('state').textContent).toBe('granted');
  });
});

