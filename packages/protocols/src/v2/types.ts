/**
 * @module @alphabet/protocols/v2/types
 * @description
 * AlphabetProtocol v2 — normalized types for streaming AI generation, tool
 * calling, and structured output. Provider-agnostic: every built-in
 * provider adapter (OpenAI, Anthropic, Grok, Gemini, Mistral, Fireworks)
 * converts its native wire format to/from these shapes.
 *
 * Design rules:
 *   • Zero runtime deps on any provider SDK.
 *   • All requests carry an `AlphabetToolContext` so providers can honour
 *     consent + privacy without re-implementing the ladder.
 *   • Streaming uses `AsyncIterable<AlphabetStreamChunk>` so consumers can
 *     `for await` chunks without prescribing a transport.
 *   • Tool calls and structured output use JSON Schema (subset).
 */

import type { Result } from '@alphabet/core';
import type { AlphabetToolContext } from '../contract.js';
import type { AlphabetProtocolError } from '../errors/index.js';
import type { JsonSchema } from '../mcp/index.js';

// ─── Messages ────────────────────────────────────────────────────────────────

/** Role of a chat message in the AlphabetProtocol v2 conversation. */
export type AlphabetChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A single chat message in the normalized AlphabetProtocol v2 form.
 * `toolCallId` is required for `tool` role messages (the response of a
 * tool the model invoked).
 */
export interface AlphabetChatMessage {
  readonly role: AlphabetChatRole;
  readonly content: string;
  /** Required when `role === 'tool'`. */
  readonly toolCallId?: string;
  /** Free-form name (assistant tool name or tool author). */
  readonly name?: string;
  /** Tool calls produced by an assistant message (if any). */
  readonly toolCalls?: readonly AlphabetToolCall[];
  /**
   * Optional priority hint for context compression. Lower priority
   * messages are dropped first when the budget is exceeded.
   * Default: 0 (highest pinned priority is reserved for system).
   */
  readonly priority?: number;
}

// ─── Tool calling ────────────────────────────────────────────────────────────

/**
 * Tool descriptor surfaced to the model. The tool's `parameters` field
 * is a JSON Schema document; providers translate as needed.
 */
export interface AlphabetToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
}

/**
 * A model-emitted tool call. `arguments` is the raw JSON string the
 * model produced; consumers MUST validate it against the tool's
 * `parameters` schema before execution.
 */
export interface AlphabetToolCall {
  readonly id: string;
  readonly name: string;
  /** JSON-encoded argument string. */
  readonly arguments: string;
}

// ─── Structured output ───────────────────────────────────────────────────────

/**
 * Structured output mode. Providers that don't natively support
 * structured output fall back to "system prompt scaffolding + JSON
 * parse" semantics; the SDK validates the parsed value at the boundary.
 */
export type AlphabetStructuredOutputMode = 'json' | 'json_schema';

export interface AlphabetStructuredOutputSpec {
  readonly mode: AlphabetStructuredOutputMode;
  /** Required when mode === 'json_schema'. */
  readonly schema?: JsonSchema;
  /** Human-readable schema name surfaced to providers that need it. */
  readonly name?: string;
}

// ─── Generation request ──────────────────────────────────────────────────────

/**
 * Sampling parameters. Each provider clamps to its own valid range.
 */
export interface AlphabetSampling {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: readonly string[];
  /**
   * Hard token budget for prompt + completion. The compression layer
   * uses this to evict low-priority history before dispatch.
   */
  readonly tokenBudget?: number;
}

/**
 * Normalized generation request. Producers fill it in once; the
 * provider adapter converts to its native wire format.
 */
export interface AlphabetGenerationRequest {
  /** Model identifier (provider-specific, e.g. 'gpt-4o-mini'). */
  readonly model: string;
  /** Conversation history + new user turn, oldest first. */
  readonly messages: readonly AlphabetChatMessage[];
  /** Optional tools available to the model. */
  readonly tools?: readonly AlphabetToolDefinition[];
  /** Force a specific tool call by name; provider-best-effort. */
  readonly toolChoice?: 'auto' | 'none' | 'required' | { readonly name: string };
  readonly structuredOutput?: AlphabetStructuredOutputSpec;
  readonly sampling?: AlphabetSampling;
  /**
   * Alphabet tool context — used for consent-aware injection and PII
   * redaction. Every request must carry one.
   */
  readonly context: AlphabetToolContext;
  /** Correlation id for tracing. */
  readonly correlationId?: string;
  /** Abort signal honoured by provider adapters. */
  readonly signal?: AbortSignal;
}

// ─── Streaming chunks ────────────────────────────────────────────────────────

/** Reason a generation finished. */
export type AlphabetFinishReason =
  | 'stop'
  | 'length'
  | 'tool_call'
  | 'content_filter'
  | 'error'
  | 'aborted';

/** Token usage reported by the provider, if known. */
export interface AlphabetUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
}

/**
 * One discrete event in a streamed generation.
 *
 * Streaming is normalized so a single consumer can `for await` over the
 * iterable regardless of which provider is in use. The terminal event
 * is always either `finish` or `error`.
 */
export type AlphabetStreamChunk =
  | { readonly type: 'text-delta'; readonly text: string }
  | {
      readonly type: 'tool-call';
      readonly toolCall: AlphabetToolCall;
    }
  | {
      readonly type: 'tool-call-delta';
      readonly id: string;
      readonly name?: string;
      readonly argumentsDelta: string;
    }
  | { readonly type: 'structured-delta'; readonly text: string }
  | { readonly type: 'usage'; readonly usage: AlphabetUsage }
  | {
      readonly type: 'finish';
      readonly reason: AlphabetFinishReason;
      readonly usage?: AlphabetUsage;
    }
  | { readonly type: 'error'; readonly error: AlphabetProtocolError };

// ─── Non-streaming response ──────────────────────────────────────────────────

/**
 * Aggregated response for non-streaming calls. The SDK builds it by
 * collapsing a stream of chunks; providers may also short-circuit by
 * calling their non-streaming endpoint directly.
 */
export interface AlphabetGenerationResponse {
  readonly text: string;
  readonly toolCalls: readonly AlphabetToolCall[];
  /** Parsed structured value if `structuredOutput` was requested. */
  readonly structured?: unknown;
  readonly finishReason: AlphabetFinishReason;
  readonly usage?: AlphabetUsage;
  readonly model: string;
  readonly providerId: string;
}

// ─── Provider adapter contract ───────────────────────────────────────────────

/**
 * Provider-agnostic adapter. Every built-in provider exports an
 * implementation that satisfies this interface — including the ones
 * that ship with this package (OpenAI, Anthropic, Grok, Gemini,
 * Mistral, Fireworks).
 *
 * Error model:
 *   • `stream()` returns an iterable that yields a terminal `error`
 *     chunk on transport / model failure (never throws past the first
 *     chunk).
 *   • `generate()` returns `Result<AlphabetGenerationResponse, AlphabetProtocolError>`.
 */
export interface AlphabetProviderAdapter {
  /** Stable provider identifier — e.g. "openai", "anthropic". */
  readonly id: string;
  /** Friendly display name. */
  readonly name: string;
  /**
   * Stream a generation. Implementations MUST honour `request.signal`
   * and SHOULD emit a `usage` chunk when the provider exposes it.
   */
  stream(request: AlphabetGenerationRequest): AsyncIterable<AlphabetStreamChunk>;
  /** Non-streaming generation. Default implementation collapses `stream`. */
  generate(
    request: AlphabetGenerationRequest,
  ): Promise<Result<AlphabetGenerationResponse, AlphabetProtocolError>>;
}
