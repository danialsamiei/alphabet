/**
 * ErrorBoundary — captures errors thrown by descendants, renders a
 * fallback, supports `onError` and `resetKeys` resets.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.js';

function Boom({ message = 'kaboom' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  // Silence React's noisy "componentDidCatch" stderr for these tests.
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p data-testid="ok">healthy</p>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('ok')).toHaveTextContent('healthy');
  });

  it('renders a static fallback ReactNode when a child throws', () => {
    render(
      <ErrorBoundary fallback={<p role="alert">oops</p>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
  });

  it('renders a render-prop fallback receiving error + reset', () => {
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <button onClick={reset} data-testid="retry">
            {error.message}
          </button>
        )}
      >
        <Boom message="rp-err" />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('retry')).toHaveTextContent('rp-err');
  });

  it('renders the default fallback when none is provided', () => {
    render(
      <ErrorBoundary>
        <Boom message="default-msg" />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('default-msg');
  });

  it('invokes onError exactly once with the captured error', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError} fallback={<span>fb</span>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err, info] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('kaboom');
    expect(info).toHaveProperty('componentStack');
  });

  it('swallows errors thrown by the onError sink itself', () => {
    const onError = vi.fn(() => {
      throw new Error('sink-broken');
    });
    expect(() =>
      render(
        <ErrorBoundary onError={onError} fallback={<span>fb</span>}>
          <Boom />
        </ErrorBoundary>
      )
    ).not.toThrow();
  });

  it('resets when a value in resetKeys changes', () => {
    function Harness(): JSX.Element {
      const [shouldThrow, setShouldThrow] = useState(true);
      const [k, setK] = useState(0);
      return (
        <>
          <button data-testid="next" onClick={() => { setShouldThrow(false); setK(k + 1); }}>next</button>
          <ErrorBoundary resetKeys={[k]} fallback={<span data-testid="fb">err</span>}>
            {shouldThrow ? <Boom /> : <span data-testid="ok">recovered</span>}
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('next'));
    expect(screen.getByTestId('ok')).toHaveTextContent('recovered');
  });
});
