/**
 * @module @alphabet/protocols/v2/providers/fireworks
 * @description
 * Fireworks AI provider adapter — OpenAI-compatible chat completions
 * on `https://api.fireworks.ai/inference/v1`.
 */

import type { AlphabetProviderAdapter } from '../types.js';
import {
  createOpenAiCompatAdapter,
  type OpenAiCompatAdapterOptions,
} from './openai-compat.js';

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';

export type FireworksProviderOptions = Omit<OpenAiCompatAdapterOptions, 'id' | 'name' | 'baseUrl'> & {
  readonly baseUrl?: string;
};

/** Create a Fireworks provider adapter. */
export function createFireworksProvider(
  options: FireworksProviderOptions,
): AlphabetProviderAdapter {
  return createOpenAiCompatAdapter({
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: options.baseUrl ?? FIREWORKS_BASE_URL,
    ...options,
  });
}
