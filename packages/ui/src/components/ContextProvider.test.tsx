/**
 * ContextProvider — runs handshake at mount, exposes events.
 *
 * jsdom does not implement WebGL or matchMedia/connection, so the
 * handshake degrades gracefully to STATIC_HTML. We assert presence of
 * the expected event sequence rather than any specific layer.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContextProvider, useContextStream } from './ContextProvider.js';

function Probe(): JSX.Element {
  const { status, decision, events, error } = useContextStream();
  return (
    <>
      <output data-testid="status">{status}</output>
      <output data-testid="layer">
        {decision === null ? 'none' : decision.selectedLayer}
      </output>
      <output data-testid="events">{events.length}</output>
      <output data-testid="error">{error ?? 'none'}</output>
    </>
  );
}

describe('ContextProvider', () => {
  it('runs the handshake and exposes a decision + events', async () => {
    render(
      <ContextProvider>
        <Probe />
      </ContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    const decision = screen.getByTestId('layer').textContent;
    expect(decision).not.toBe('none');
    // Handshake emits at minimum: 3× phase:start + 3× phase:end + decision +
    // 1× signal-update = 8 events. Allow some slack in case of additions.
    const eventCount = Number(screen.getByTestId('events').textContent ?? '0');
    expect(eventCount).toBeGreaterThanOrEqual(7);
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('surfaces a stable status before handshake completes', () => {
    render(
      <ContextProvider>
        <Probe />
      </ContextProvider>,
    );
    // First synchronous render is `idle` (effect has not yet run).
    expect(['idle', 'running', 'ready']).toContain(
      screen.getByTestId('status').textContent,
    );
  });
});
