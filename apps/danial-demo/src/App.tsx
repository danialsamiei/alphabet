/**
 * @file App.tsx
 * @description
 * Standalone wrapper for the danial.ai Edition demo. Renders the
 * embeddable `<AlphabetDemo />` — the same component that ships as the
 * public, drop-in surface of Alphabet on danial.ai.
 */

import { AlphabetDemo } from './AlphabetDemo.js';

export function App(): JSX.Element {
  return <AlphabetDemo />;
}
