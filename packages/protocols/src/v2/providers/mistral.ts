/**
 * @module @alphabet/protocols/v2/providers/mistral
 * @description
 * Mistral provider adapter — OpenAI-compatible chat completions on
 * `https://api.mistral.ai/v1`.
 */

import type { AlphabetProviderAdapter } from '../types.js';
import {
  createOpenAiCompatAdapter,
  type OpenAiCompatAdapterOptions,
} from './openai-compat.js';

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';

export type MistralProviderOptions = Omit<OpenAiCompatAdapterOptions, 'id' | 'name' | 'baseUrl'> & {
  readonly baseUrl?: string;
};

/** Create a Mistral provider adapter. */
export function createMistralProvider(options: MistralProviderOptions): AlphabetProviderAdapter {
  return createOpenAiCompatAdapter({
    id: 'mistral',
    name: 'Mistral',
    baseUrl: options.baseUrl ?? MISTRAL_BASE_URL,
    ...options,
  });
}
