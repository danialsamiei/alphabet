/**
 * @module @awaf/protocols/v2/providers/anthropic
 * @description
 * Anthropic provider adapter — uses the Messages API on
 * https://api.anthropic.com/v1/messages with `anthropic-version` set
 * to `2023-06-01`. Streaming events are normalized into `AwafStreamChunk`.
 */

import type {
  AwafChatMessage,
  AwafGenerationRequest,
  AwafProviderAdapter,
  AwafStreamChunk,
  AwafToolDefinition,
  AwafFinishReason,
} from '../types.js';
import {
  collapseStream,
  getFetch,
  parseSSE,
  responseError,
  withTimeoutSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  type ProviderClientOptions,
} from './shared.js';
import { protocolError } from '../../errors/index.js';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export type AnthropicProviderOptions = ProviderClientOptions & {
  readonly anthropicVersion?: string;
};

interface AnthropicMessage {
  readonly role: 'user' | 'assistant';
  readonly content: ReadonlyArray<
    | { readonly type: 'text'; readonly text: string }
    | {
        readonly type: 'tool_use';
        readonly id: string;
        readonly name: string;
        readonly input: unknown;
      }
    | {
        readonly type: 'tool_result';
        readonly tool_use_id: string;
        readonly content: string;
      }
  >;
}

interface AnthropicBody {
  readonly model: string;
  readonly messages: readonly AnthropicMessage[];
  readonly system?: string;
  readonly max_tokens: number;
  readonly stream: boolean;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly stop_sequences?: readonly string[];
  readonly tools?: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly input_schema: unknown;
  }>;
}

function toAnthropicMessages(
  messages: readonly AwafChatMessage[],
): { system: string | undefined; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
      continue;
    }
    if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId ?? '',
            content: m.content,
          },
        ],
      });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls !== undefined && m.toolCalls.length > 0) {
      const blocks: AnthropicMessage['content'] = [
        ...(m.content.length > 0
          ? [{ type: 'text' as const, text: m.content }]
          : []),
        ...m.toolCalls.map((tc) => {
          let input: unknown = {};
          try {
            input = JSON.parse(tc.arguments);
          } catch {
            input = { _raw: tc.arguments };
          }
          return { type: 'tool_use' as const, id: tc.id, name: tc.name, input };
        }),
      ];
      out.push({ role: 'assistant', content: blocks });
      continue;
    }
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: m.content }],
    });
  }
  return { system: systemParts.length === 0 ? undefined : systemParts.join('\n'), messages: out };
}

function buildBody(req: AwafGenerationRequest, stream: boolean): AnthropicBody {
  const { system, messages } = toAnthropicMessages(req.messages);
  const tools: AnthropicBody['tools'] | undefined =
    req.tools !== undefined && req.tools.length > 0
      ? req.tools.map((t: AwafToolDefinition) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        }))
      : undefined;
  return {
    model: req.model,
    messages,
    ...(system !== undefined ? { system } : {}),
    max_tokens: req.sampling?.maxTokens ?? 1024,
    stream,
    ...(req.sampling?.temperature !== undefined ? { temperature: req.sampling.temperature } : {}),
    ...(req.sampling?.topP !== undefined ? { top_p: req.sampling.topP } : {}),
    ...(req.sampling?.stopSequences !== undefined && req.sampling.stopSequences.length > 0
      ? { stop_sequences: req.sampling.stopSequences }
      : {}),
    ...(tools !== undefined ? { tools } : {}),
  };
}

interface AnthropicEvent {
  readonly type: string;
  readonly index?: number;
  readonly content_block?: {
    readonly type?: string;
    readonly id?: string;
    readonly name?: string;
    readonly text?: string;
  };
  readonly delta?: {
    readonly type?: string;
    readonly text?: string;
    readonly partial_json?: string;
    readonly stop_reason?: string;
  };
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
  readonly message?: { readonly stop_reason?: string };
}

function mapStop(reason: string | undefined): AwafFinishReason {
  switch (reason) {
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_call';
    case 'stop_sequence':
      return 'stop';
    default:
      return 'stop';
  }
}

async function* decode(
  res: Response,
  structured: boolean,
): AsyncIterable<AwafStreamChunk> {
  if (res.body === null) {
    yield { type: 'error', error: protocolError('CRYPTO_FAILURE', 'Response body is null') };
    return;
  }
  const blockKinds = new Map<number, 'text' | 'tool_use'>();
  const blockIds = new Map<number, string>();
  const blockNames = new Map<number, string>();

  for await (const ev of parseSSE(res.body)) {
    let data: AnthropicEvent;
    try {
      data = JSON.parse(ev.data) as AnthropicEvent;
    } catch {
      continue;
    }
    if (data.type === 'content_block_start' && data.index !== undefined && data.content_block) {
      const kind = data.content_block.type === 'tool_use' ? 'tool_use' : 'text';
      blockKinds.set(data.index, kind);
      if (kind === 'tool_use') {
        blockIds.set(data.index, data.content_block.id ?? `call_${data.index}`);
        blockNames.set(data.index, data.content_block.name ?? '');
      }
    } else if (data.type === 'content_block_delta' && data.index !== undefined && data.delta) {
      const kind = blockKinds.get(data.index);
      if (kind === 'text' && typeof data.delta.text === 'string') {
        yield structured
          ? { type: 'structured-delta', text: data.delta.text }
          : { type: 'text-delta', text: data.delta.text };
      } else if (kind === 'tool_use' && typeof data.delta.partial_json === 'string') {
        yield {
          type: 'tool-call-delta',
          id: blockIds.get(data.index) ?? `call_${data.index}`,
          name: blockNames.get(data.index) ?? '',
          argumentsDelta: data.delta.partial_json,
        };
      }
    } else if (data.type === 'message_delta' && data.delta?.stop_reason !== undefined) {
      const reason = mapStop(data.delta.stop_reason);
      const usage =
        data.usage !== undefined
          ? {
              ...(data.usage.input_tokens !== undefined ? { promptTokens: data.usage.input_tokens } : {}),
              ...(data.usage.output_tokens !== undefined ? { completionTokens: data.usage.output_tokens } : {}),
            }
          : undefined;
      yield { type: 'finish', reason, ...(usage !== undefined ? { usage } : {}) };
    } else if (data.type === 'message_stop') {
      // emitted after message_delta; nothing to forward.
    }
  }
}

/** Create an Anthropic provider adapter. */
export function createAnthropicProvider(
  options: AnthropicProviderOptions,
): AwafProviderAdapter {
  const fetchImpl = getFetch(options);
  const baseUrl = options.baseUrl ?? ANTHROPIC_BASE_URL;
  const timeout = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const version = options.anthropicVersion ?? '2023-06-01';
  const id = 'anthropic';

  async function* stream(req: AwafGenerationRequest): AsyncIterable<AwafStreamChunk> {
    const { signal, cancel } = withTimeoutSignal(req.signal, timeout);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': version,
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
        error: protocolError('ADAPTER_NOT_CONFIGURED', `${id} fetch failed`, {
          cause: (e as Error).message,
        }),
      };
      return;
    }
    if (!res.ok) {
      const errObj = await responseError(res, id);
      cancel();
      yield { type: 'error', error: errObj };
      return;
    }
    try {
      yield* decode(res, req.structuredOutput !== undefined);
    } finally {
      cancel();
    }
  }

  return {
    id,
    name: 'Anthropic',
    stream,
    generate: async (req) =>
      collapseStream(id, req.model, stream(req), req.structuredOutput !== undefined),
  };
}
