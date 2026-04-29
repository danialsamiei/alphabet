/**
 * @module @alphabet/protocols/v2/providers/openai-compat
 * @description
 * Generic adapter for OpenAI-compatible Chat Completions endpoints.
 * Used directly by the OpenAI provider and re-targeted (via base URL)
 * by Grok (xAI), Mistral, and Fireworks.
 *
 * Translates the normalized AlphabetProtocol v2 request into the OpenAI
 * Chat Completions wire format and parses streaming SSE chunks back
 * into normalized `AlphabetStreamChunk` values.
 */

import type {
  AlphabetChatMessage,
  AlphabetGenerationRequest,
  AlphabetGenerationResponse,
  AlphabetProviderAdapter,
  AlphabetStreamChunk,
  AlphabetToolDefinition,
} from '../types.js';
import type { Result } from '@alphabet/core';
import {
  collapseStream,
  getFetch,
  parseSSE,
  responseError,
  withTimeoutSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type ProviderClientOptions,
} from './shared.js';
import { protocolError, type AlphabetProtocolError } from '../../errors/index.js';

// ─── Wire types ──────────────────────────────────────────────────────────────

interface OpenAiToolMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content?: string | null;
  readonly name?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: Array<{
    readonly id: string;
    readonly type: 'function';
    readonly function: { readonly name: string; readonly arguments: string };
  }>;
}

interface OpenAiBody {
  readonly model: string;
  readonly messages: readonly OpenAiToolMessage[];
  readonly stream: boolean;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_tokens?: number;
  readonly stop?: readonly string[];
  readonly tools?: readonly {
    readonly type: 'function';
    readonly function: AlphabetToolDefinition;
  }[];
  readonly tool_choice?: unknown;
  readonly response_format?: { readonly type: 'json_object' | 'json_schema'; readonly json_schema?: unknown };
}

// ─── Translation ─────────────────────────────────────────────────────────────

function toOpenAiMessage(m: AlphabetChatMessage): OpenAiToolMessage {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      content: m.content,
      ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {}),
    };
  }
  if (m.role === 'assistant' && m.toolCalls !== undefined && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

function buildBody(req: AlphabetGenerationRequest, stream: boolean): OpenAiBody {
  const body: OpenAiBody = {
    model: req.model,
    messages: req.messages.map(toOpenAiMessage),
    stream,
    ...(req.sampling?.temperature !== undefined ? { temperature: req.sampling.temperature } : {}),
    ...(req.sampling?.topP !== undefined ? { top_p: req.sampling.topP } : {}),
    ...(req.sampling?.maxTokens !== undefined ? { max_tokens: req.sampling.maxTokens } : {}),
    ...(req.sampling?.stopSequences !== undefined && req.sampling.stopSequences.length > 0
      ? { stop: req.sampling.stopSequences }
      : {}),
    ...(req.tools !== undefined && req.tools.length > 0
      ? {
          tools: req.tools.map((t) => ({ type: 'function' as const, function: t })),
          ...(req.toolChoice !== undefined
            ? {
                tool_choice:
                  typeof req.toolChoice === 'string'
                    ? req.toolChoice
                    : { type: 'function', function: { name: req.toolChoice.name } },
              }
            : {}),
        }
      : {}),
    ...(req.structuredOutput !== undefined
      ? {
          response_format:
            req.structuredOutput.mode === 'json_schema' && req.structuredOutput.schema !== undefined
              ? {
                  type: 'json_schema' as const,
                  json_schema: {
                    name: req.structuredOutput.name ?? 'alphabet_structured',
                    schema: req.structuredOutput.schema,
                    strict: true,
                  },
                }
              : { type: 'json_object' as const },
        }
      : {}),
  };
  return body;
}

// ─── SSE chunk decoder ───────────────────────────────────────────────────────

interface SseDelta {
  readonly choices?: Array<{
    readonly delta?: {
      readonly content?: string | null;
      readonly tool_calls?: Array<{
        readonly index?: number;
        readonly id?: string;
        readonly type?: string;
        readonly function?: { readonly name?: string; readonly arguments?: string };
      }>;
    };
    readonly finish_reason?: string | null;
  }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number; readonly total_tokens?: number };
}

function mapFinish(reason: string | null | undefined): AlphabetStreamChunk | null {
  if (reason === null || reason === undefined) return null;
  const map: Record<string, AlphabetStreamChunk['type']> = {
    stop: 'finish',
    length: 'finish',
    tool_calls: 'finish',
    content_filter: 'finish',
  };
  if (!(reason in map)) return null;
  const r =
    reason === 'tool_calls'
      ? 'tool_call'
      : reason === 'content_filter'
        ? 'content_filter'
        : reason === 'length'
          ? 'length'
          : 'stop';
  return { type: 'finish', reason: r as 'stop' | 'length' | 'tool_call' | 'content_filter' };
}

async function* decodeSse(
  res: Response,
  structured: boolean,
): AsyncIterable<AlphabetStreamChunk> {
  if (res.body === null) {
    yield { type: 'error', error: protocolError('ADAPTER_NOT_CONFIGURED', 'Response body is null') };
    return;
  }
  // Track partial tool calls keyed by index so deltas can accumulate.
  const partialIds = new Map<number, string>();

  for await (const ev of parseSSE(res.body)) {
    if (ev.data === '[DONE]') {
      yield { type: 'finish', reason: 'stop' };
      return;
    }
    let delta: SseDelta;
    try {
      delta = JSON.parse(ev.data) as SseDelta;
    } catch {
      continue;
    }
    const choice = delta.choices?.[0];
    if (choice?.delta?.content !== undefined && choice.delta.content !== null) {
      yield structured
        ? { type: 'structured-delta', text: choice.delta.content }
        : { type: 'text-delta', text: choice.delta.content };
    }
    if (choice?.delta?.tool_calls !== undefined) {
      for (const tc of choice.delta.tool_calls) {
        const idx = tc.index ?? 0;
        const id = tc.id ?? partialIds.get(idx) ?? `call_${idx}`;
        partialIds.set(idx, id);
        yield {
          type: 'tool-call-delta',
          id,
          ...(tc.function?.name !== undefined ? { name: tc.function.name } : {}),
          argumentsDelta: tc.function?.arguments ?? '',
        };
      }
    }
    const finish = mapFinish(choice?.finish_reason);
    if (finish !== null) {
      const usage =
        delta.usage !== undefined
          ? {
              ...(delta.usage.prompt_tokens !== undefined ? { promptTokens: delta.usage.prompt_tokens } : {}),
              ...(delta.usage.completion_tokens !== undefined ? { completionTokens: delta.usage.completion_tokens } : {}),
              ...(delta.usage.total_tokens !== undefined ? { totalTokens: delta.usage.total_tokens } : {}),
            }
          : undefined;
      yield { ...finish, ...(usage !== undefined ? { usage } : {}) } as AlphabetStreamChunk;
    } else if (delta.usage !== undefined) {
      yield {
        type: 'usage',
        usage: {
          ...(delta.usage.prompt_tokens !== undefined ? { promptTokens: delta.usage.prompt_tokens } : {}),
          ...(delta.usage.completion_tokens !== undefined ? { completionTokens: delta.usage.completion_tokens } : {}),
          ...(delta.usage.total_tokens !== undefined ? { totalTokens: delta.usage.total_tokens } : {}),
        },
      };
    }
  }
}

// ─── Adapter factory ─────────────────────────────────────────────────────────

export interface OpenAiCompatAdapterOptions extends ProviderClientOptions {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
}

/**
 * Build a provider adapter for any OpenAI-compatible chat-completions
 * endpoint. The OpenAI / Grok / Mistral / Fireworks adapters are thin
 * wrappers around this factory that supply the right base URL and id.
 */
export function createOpenAiCompatAdapter(
  options: OpenAiCompatAdapterOptions,
): AlphabetProviderAdapter {
  const fetchImpl = getFetch(options);
  const timeout = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  async function* stream(req: AlphabetGenerationRequest): AsyncIterable<AlphabetStreamChunk> {
    const { signal, cancel } = withTimeoutSignal(req.signal, timeout);
    let res: Response;
    try {
      res = await fetchImpl(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.apiKey}`,
          accept: 'text/event-stream',
          ...options.headers,
        },
        body: JSON.stringify(buildBody(req, true)),
        signal,
      });
    } catch (e) {
      cancel();
      yield {
        type: 'error',
        error: protocolError('ADAPTER_NOT_CONFIGURED', `${options.id} fetch failed`, {
          cause: (e as Error).message,
        }),
      };
      return;
    }
    if (!res.ok) {
      const errObj = await responseError(res, options.id);
      cancel();
      yield { type: 'error', error: errObj };
      return;
    }
    try {
      yield* decodeSse(res, req.structuredOutput !== undefined);
    } finally {
      cancel();
    }
  }

  const adapter: AlphabetProviderAdapter = {
    id: options.id,
    name: options.name,
    stream,
    generate: async (
      req: AlphabetGenerationRequest,
    ): Promise<Result<AlphabetGenerationResponse, AlphabetProtocolError>> =>
      collapseStream(options.id, req.model, stream(req), req.structuredOutput !== undefined),
  };
  return adapter;
}
