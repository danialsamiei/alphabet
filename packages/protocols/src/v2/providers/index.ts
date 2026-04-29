/**
 * @module @alphabet/protocols/v2/providers
 * @description
 * Barrel export for built-in AlphabetProtocol v2 providers.
 *
 * Provider list:
 *   • OpenAI       (`createOpenAiProvider`)
 *   • Anthropic    (`createAnthropicProvider`)
 *   • xAI Grok     (`createGrokProvider`)
 *   • Google Gemini (`createGeminiProvider`)
 *   • Mistral      (`createMistralProvider`)
 *   • Fireworks AI (`createFireworksProvider`)
 *   • Fallback chain composed of any of the above
 *
 * All adapters share the contract from `../types.ts` (`AlphabetProviderAdapter`)
 * and never bundle a vendor SDK as a dep — they rely on `globalThis.fetch`.
 */

export { createOpenAiProvider } from './openai.js';
export type { OpenAiProviderOptions } from './openai.js';

export { createAnthropicProvider } from './anthropic.js';
export type { AnthropicProviderOptions } from './anthropic.js';

export { createGrokProvider } from './grok.js';
export type { GrokProviderOptions } from './grok.js';

export { createGeminiProvider } from './gemini.js';

export { createMistralProvider } from './mistral.js';
export type { MistralProviderOptions } from './mistral.js';

export { createFireworksProvider } from './fireworks.js';
export type { FireworksProviderOptions } from './fireworks.js';

export {
  createFallbackChain,
} from './fallback-chain.js';
export type { FallbackChainOptions } from './fallback-chain.js';

export {
  createOpenAiCompatAdapter,
} from './openai-compat.js';
export type { OpenAiCompatAdapterOptions } from './openai-compat.js';

export type { ProviderClientOptions, FetchLike } from './shared.js';
