/**
 * ConsentLadder — accessibility + tier transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAwafConsent } from '../hooks/useAwafConsent.js';
import { ConsentLadder } from './ConsentLadder.js';

function Harness({
  dnt = false,
  onChange,
}: {
  readonly dnt?: boolean;
  readonly onChange?: (tier: string) => void;
}): JSX.Element {
  const consent = useAwafConsent({
    privacySignals: { dntEnabled: dnt },
  });
  return (
    <>
      <ConsentLadder
        consent={consent}
        showReset
        {...(onChange !== undefined ? { onChange: (t) => onChange(t) } : {})}
      />
      <output data-testid="tier">{consent.tier}</output>
      <output data-testid="state">{consent.state}</output>
    </>
  );
}

describe('ConsentLadder', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders all four tiers as buttons in order', () => {
    render(<Harness />);
    const list = screen.getByRole('list', { name: /consent ladder/i });
    const buttons = list.querySelectorAll('button[data-awaf-tier]');
    expect(buttons).toHaveLength(4);
    expect(buttons[0]?.getAttribute('data-awaf-tier')).toBe('NO_MEMORY');
    expect(buttons[3]?.getAttribute('data-awaf-tier')).toBe('ENRICHED');
  });

  it('grants the chosen tier when a rung is clicked', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const consented = document.querySelector(
      'button[data-awaf-tier="CONSENTED"]',
    ) as HTMLButtonElement;
    fireEvent.click(consented);
    expect(onChange).toHaveBeenCalledWith('CONSENTED');
    expect(screen.getByTestId('tier').textContent).toBe('CONSENTED');
    expect(screen.getByTestId('state').textContent).toBe('granted');
    expect(consented).toHaveAttribute('aria-current', 'step');
  });

  it('NO_MEMORY rung revokes consent', () => {
    render(<Harness />);
    fireEvent.click(
      document.querySelector(
        'button[data-awaf-tier="ENRICHED"]',
      ) as HTMLButtonElement,
    );
    expect(screen.getByTestId('tier').textContent).toBe('ENRICHED');
    fireEvent.click(
      document.querySelector(
        'button[data-awaf-tier="NO_MEMORY"]',
      ) as HTMLButtonElement,
    );
    expect(screen.getByTestId('state').textContent).toBe('revoked');
    expect(screen.getByTestId('tier').textContent).toBe('NO_MEMORY');
  });

  it('locks every tier above NO_MEMORY when DNT is active', () => {
    render(<Harness dnt />);
    const consented = document.querySelector(
      'button[data-awaf-tier="CONSENTED"]',
    ) as HTMLButtonElement;
    expect(consented.disabled).toBe(true);
    expect(consented).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(consented);
    // Click is a no-op when locked.
    expect(screen.getByTestId('tier').textContent).toBe('NO_MEMORY');
    const ladder = document.querySelector(
      '[data-awaf-consent-ladder]',
    ) as HTMLElement;
    expect(ladder.querySelector('[role="status"]')?.textContent).toMatch(
      /DNT or GPC/i,
    );
  });

  it('Revoke all button returns to revoked NO_MEMORY', () => {
    render(<Harness />);
    fireEvent.click(
      document.querySelector(
        'button[data-awaf-tier="CONSENTED"]',
      ) as HTMLButtonElement,
    );
    fireEvent.click(screen.getByRole('button', { name: /revoke all/i }));
    expect(screen.getByTestId('state').textContent).toBe('revoked');
  });

  it('Reset button returns to pending state', () => {
    render(<Harness />);
    fireEvent.click(
      document.querySelector(
        'button[data-awaf-tier="ENRICHED"]',
      ) as HTMLButtonElement,
    );
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByTestId('state').textContent).toBe('pending');
  });
});
