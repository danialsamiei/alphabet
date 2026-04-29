/**
 * @module @awaf/protocols/v2/providers/openai
 * @description
 * OpenAI provider adapter — wraps the shared OpenAI-compatible adapter
 * with OpenAI's defaults.
 */

import type { AwafProviderAdapter } from '../types.js';
import {
  createOpenAiCompatAdapter,
  type OpenAiCompatAdapterOptions,
} from './openai-compat.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export type OpenAiProviderOptions = Omit<OpenAiCompatAdapterOptions, 'id' | 'name' | 'baseUrl'> & {
  readonly baseUrl?: string;
};

/** Create an OpenAI provider adapter. */
export function createOpenAiProvider(options: OpenAiProviderOptions): AwafProviderAdapter {
  return createOpenAiCompatAdapter({
    id: 'openai',
    name: 'OpenAI',
    baseUrl: options.baseUrl ?? OPENAI_BASE_URL,
    ...options,
  });
}
