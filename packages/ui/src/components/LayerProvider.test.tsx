/**
 * LayerProvider — context plumbing + manual override channel.
 */

import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LayerProvider, useLayer, useLayerOptional } from './LayerProvider.js';

function Probe(): JSX.Element {
  const { layer, override, setOverride } = useLayer();
  return (
    <>
      <output data-testid="layer">{layer}</output>
      <output data-testid="override">{override ?? 'none'}</output>
      <button onClick={() => setOverride('TEXT_ONLY')}>force text</button>
      <button onClick={() => setOverride(undefined)}>clear</button>
    </>
  );
}

describe('LayerProvider', () => {
  it('exposes a useLayer context value', () => {
    render(
      <LayerProvider reducedMotionOverride>
        <Probe />
      </LayerProvider>,
    );
    expect(screen.getByTestId('layer').textContent).not.toBe('');
    expect(screen.getByTestId('override').textContent).toBe('none');
  });

  it('honors imperative override and can clear it', () => {
    render(
      <LayerProvider>
        <Probe />
      </LayerProvider>,
    );
    act(() => {
      screen.getByText('force text').click();
    });
    expect(screen.getByTestId('layer').textContent).toBe('TEXT_ONLY');
    expect(screen.getByTestId('override').textContent).toBe('TEXT_ONLY');
    act(() => {
      screen.getByText('clear').click();
    });
    expect(screen.getByTestId('override').textContent).toBe('none');
  });

  it('useLayerOptional returns null without a provider', () => {
    function Optional(): JSX.Element {
      const ctx = useLayerOptional();
      return <output data-testid="ctx">{ctx === null ? 'null' : 'set'}</output>;
    }
    render(<Optional />);
    expect(screen.getByTestId('ctx').textContent).toBe('null');
  });

  it('useLayer throws outside a provider', () => {
    function Boom(): JSX.Element {
      useLayer();
      return <span />;
    }
    // Suppress React's error log noise by wrapping in a try/catch.
    expect(() => render(<Boom />)).toThrow(/LayerProvider/);
  });
});
