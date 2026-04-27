/**
 * Vitest setup — testing-library + jest-dom matchers + global cleanup.
 *
 * jsdom does not implement HTMLCanvasElement.getContext; we stub it to
 * return `null` so SignalCollector's WebGL probe degrades gracefully
 * during tests instead of spamming "Not implemented" errors.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

if (
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.getContext === 'function'
) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
}

afterEach(() => {
  cleanup();
});

