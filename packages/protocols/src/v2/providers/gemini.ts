/**
 * @module @alphabet/protocols/v2/providers/gemini
 * @description
 * Google Gemini provider adapter — uses the Generative Language API
 * (`https://generativelanguage.googleapis.com/v1beta`) with
 * `streamGenerateContent?alt=sse` for streaming.
 *
 * Authentication: `?key=<API_KEY>` query string (matches Google's
 * documented surface). For Vertex AI deployments, supply a custom
 * `baseUrl` and Bearer header via `headers` and pass `apiKey: ''`.
 */

import type {
  AlphabetChatMessage,
  AlphabetGenerationRequest,
  AlphabetProviderAdapter,
  AlphabetStreamChunk,
  AlphabetFinishReason,
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

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  readonly text?: string;
  readonly functionCall?: { readonly name: string; readonly args: unknown };
  readonly functionResponse?: { readonly name: string; readonly response: unknown };
}

interface GeminiContent {
  readonly role: 'user' | 'model';
  readonly parts: readonly GeminiPart[];
}

interface GeminiBody {
  readonly contents: readonly GeminiContent[];
  readonly systemInstruction?: { readonly parts: readonly GeminiPart[] };
  readonly generationConfig?: Record<string, unknown>;
  readonly tools?: ReadonlyArray<{
    readonly functionDeclarations: ReadonlyArray<{
      readonly name: string;
      readonly description: string;
      readonly parameters: unknown;
    }>;
  }>;
}

function toGeminiContents(messages: readonly AlphabetChatMessage[]): {
  systemInstruction: GeminiBody['systemInstruction'] | undefined;
  contents: GeminiContent[];
} {
  const sys: string[] = [];
  const out: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      sys.push(m.content);
      continue;
    }
    if (m.role === 'tool') {
      out.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.name ?? m.toolCallId ?? 'tool',
              response: safeParse(m.content),
            },
          },
        ],
      });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls !== undefined && m.toolCalls.length > 0) {
      const parts: GeminiPart[] = [
        ...(m.content.length > 0 ? [{ text: m.content }] : []),
        ...m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: safeParse(tc.arguments) },
        })),
      ];
      out.push({ role: 'model', parts });
      continue;
    }
    out.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return {
    systemInstruction:
      sys.length === 0 ? undefined : { parts: [{ text: sys.join('\n') }] },
    contents: out,
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

function buildBody(req: AlphabetGenerationRequest): GeminiBody {
  const { systemInstruction, contents } = toGeminiContents(req.messages);
  const generationConfig: Record<string, unknown> = {};
  if (req.sampling?.temperature !== undefined) generationConfig.temperature = req.sampling.temperature;
  if (req.sampling?.topP !== undefined) generationConfig.topP = req.sampling.topP;
  if (req.sampling?.maxTokens !== undefined) generationConfig.maxOutputTokens = req.sampling.maxTokens;
  if (req.sampling?.stopSequences !== undefined && req.sampling.stopSequences.length > 0) {
    generationConfig.stopSequences = req.sampling.stopSequences;
  }
  if (req.structuredOutput !== undefined) {
    generationConfig.responseMimeType = 'application/json';
    if (req.structuredOutput.mode === 'json_schema' && req.structuredOutput.schema !== undefined) {
      generationConfig.responseSchema = req.structuredOutput.schema;
    }
  }
  return {
    contents,
    ...(systemInstruction !== undefined ? { systemInstruction } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    ...(req.tools !== undefined && req.tools.length > 0
      ? {
          tools: [
            {
              functionDeclarations: req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ],
        }
      : {}),
  };
}

interface GeminiStreamEvent {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: readonly GeminiPart[] };
    readonly finishReason?: string;
  }>;
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly totalTokenCount?: number;
  };
}

function mapFinish(reason: string | undefined): AlphabetFinishReason {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'stop';
  }
}

async function* decode(
  res: Response,
  structured: boolean,
): AsyncIterable<AlphabetStreamChunk> {
  if (res.body === null) {
    yield { type: 'error', error: protocolError('ADAPTER_NOT_CONFIGURED', 'Response body is null') };
    return;
  }
  let toolIdx = 0;

  for await (const ev of parseSSE(res.body)) {
    let data: GeminiStreamEvent;
    try {
      data = JSON.parse(ev.data) as GeminiStreamEvent;
    } catch {
      continue;
    }
    const cand = data.candidates?.[0];
    for (const p of cand?.content?.parts ?? []) {
      if (typeof p.text === 'string') {
        yield structured
          ? { type: 'structured-delta', text: p.text }
          : { type: 'text-delta', text: p.text };
      }
      if (p.functionCall !== undefined) {
        toolIdx += 1;
        yield {
          type: 'tool-call',
          toolCall: {
            id: `call_${toolIdx}`,
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args ?? {}),
          },
        };
      }
    }
    if (cand?.finishReason !== undefined) {
      const usage =
        data.usageMetadata !== undefined
          ? {
              ...(data.usageMetadata.promptTokenCount !== undefined ? { promptTokens: data.usageMetadata.promptTokenCount } : {}),
              ...(data.usageMetadata.candidatesTokenCount !== undefined ? { completionTokens: data.usageMetadata.candidatesTokenCount } : {}),
              ...(data.usageMetadata.totalTokenCount !== undefined ? { totalTokens: data.usageMetadata.totalTokenCount } : {}),
            }
          : undefined;
      yield {
        type: 'finish',
        reason: mapFinish(cand.finishReason),
        ...(usage !== undefined ? { usage } : {}),
      };
    }
  }
}

/** Create a Gemini provider adapter. */
export function createGeminiProvider(options: ProviderClientOptions): AlphabetProviderAdapter {
  const fetchImpl = getFetch(options);
  const baseUrl = options.baseUrl ?? GEMINI_BASE_URL;
  const timeout = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const id = 'gemini';

  async function* stream(req: AlphabetGenerationRequest): AsyncIterable<AlphabetStreamChunk> {
    const { signal, cancel } = withTimeoutSignal(req.signal, timeout);
    const sep = options.apiKey.length > 0 ? `?alt=sse&key=${encodeURIComponent(options.apiKey)}` : '?alt=sse';
    const url = `${baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(req.model)}:streamGenerateContent${sep}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...options.headers,
        },
        body: JSON.stringify(buildBody(req)),
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
    name: 'Google Gemini',
    stream,
    generate: async (req) =>
      collapseStream(id, req.model, stream(req), req.structuredOutput !== undefined),
  };
}
