/**
 * @module @awaf/protocols/v2/providers/grok
 * @description
 * xAI Grok provider adapter — OpenAI-compatible (xAI exposes
 * `/v1/chat/completions` with the same schema). Default base URL:
 * https://api.x.ai/v1.
 */

import type { AwafProviderAdapter } from '../types.js';
import {
  createOpenAiCompatAdapter,
  type OpenAiCompatAdapterOptions,
} from './openai-compat.js';

const GROK_BASE_URL = 'https://api.x.ai/v1';

export type GrokProviderOptions = Omit<OpenAiCompatAdapterOptions, 'id' | 'name' | 'baseUrl'> & {
  readonly baseUrl?: string;
};

/** Create a Grok (xAI) provider adapter. */
export function createGrokProvider(options: GrokProviderOptions): AwafProviderAdapter {
  return createOpenAiCompatAdapter({
    id: 'grok',
    name: 'xAI Grok',
    baseUrl: options.baseUrl ?? GROK_BASE_URL,
    ...options,
  });
}
