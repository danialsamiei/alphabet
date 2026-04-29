/**
 * @module @alphabet/protocols/v2/providers/shared
 * @description
 * Shared helpers used by every built-in provider adapter — fetch
 * wrapper, SSE parser, OpenAI-compatible streaming chunk decoder, and
 * tiny utilities that should not be duplicated across providers.
 */

import type {
  AlphabetGenerationRequest,
  AlphabetGenerationResponse,
  AlphabetProviderAdapter,
  AlphabetStreamChunk,
  AlphabetToolCall,
  AlphabetFinishReason,
  AlphabetUsage,
} from '../types.js';
import type { Result } from '@alphabet/core';
import { ok, err } from '@alphabet/core';
import { protocolError, type AlphabetProtocolError } from '../../errors/index.js';

// ─── Fetch wiring ────────────────────────────────────────────────────────────

/** Subset of the global `fetch` we depend on. Allows DI in tests. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Common options every built-in provider accepts. */
export interface ProviderClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetch?: FetchLike;
  /** Default request timeout (ms). */
  readonly timeoutMs?: number;
  /** Optional default headers. */
  readonly headers?: Readonly<Record<string, string>>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Compose an `AbortSignal` that aborts on either the consumer's signal
 * or a timeout. Returns the merged signal and a cleanup function.
 */
export function withTimeoutSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { readonly signal: AbortSignal; readonly cancel: () => void } {
  const ctl = new AbortController();
  const onAbort = (): void => ctl.abort((signal as AbortSignal & { reason?: unknown })?.reason);
  if (signal !== undefined) {
    if (signal.aborted) ctl.abort((signal as AbortSignal & { reason?: unknown }).reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => ctl.abort(new Error('Provider request timed out')), timeoutMs);
  return {
    signal: ctl.signal,
    cancel: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Resolve `fetch` from options or the global. */
export function getFetch(options: ProviderClientOptions): FetchLike {
  if (options.fetch !== undefined) return options.fetch;
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('No fetch implementation found; provide options.fetch');
  }
  return globalThis.fetch.bind(globalThis);
}

/** Convert a non-2xx Response to a typed AlphabetProtocolError. */
export async function responseError(
  res: Response,
  providerId: string,
): Promise<AlphabetProtocolError> {
  let body: string;
  try {
    body = await res.text();
  } catch {
    body = '';
  }
  return protocolError('ADAPTER_NOT_CONFIGURED', `${providerId} HTTP ${res.status}`, {
    status: res.status,
    body: body.slice(0, 512),
  });
}

// ─── SSE parser ──────────────────────────────────────────────────────────────

/**
 * Async generator that parses Server-Sent Events from a `ReadableStream<Uint8Array>`.
 * Yields `{ event, data }` records. Lines starting with `data:` are
 * concatenated until a blank line terminates the event. Comments
 * (`:`) and unknown fields are ignored.
 */
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string | null; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const ev = parseSseEvent(raw);
        if (ev !== null) yield ev;
      }
    }
    if (buffer.trim().length > 0) {
      const ev = parseSseEvent(buffer);
      if (ev !== null) yield ev;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(block: string): { event: string | null; data: string } | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const lineRaw of block.split('\n')) {
    const line = lineRaw.replace(/\r$/, '');
    if (line.length === 0 || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

// ─── Stream collapse ─────────────────────────────────────────────────────────

/**
 * Collapse a stream of `AlphabetStreamChunk` into an `AlphabetGenerationResponse`.
 * Used by every provider's default `generate()` implementation.
 */
export async function collapseStream(
  providerId: string,
  model: string,
  iter: AsyncIterable<AlphabetStreamChunk>,
  structured: boolean,
): Promise<Result<AlphabetGenerationResponse, AlphabetProtocolError>> {
  let text = '';
  let structuredText = '';
  const toolCalls: AlphabetToolCall[] = [];
  const partial = new Map<string, { name?: string; argsBuf: string }>();
  let usage: AlphabetUsage | undefined;
  let finishReason: AlphabetFinishReason = 'stop';
  let lastError: AlphabetProtocolError | undefined;

  for await (const c of iter) {
    switch (c.type) {
      case 'text-delta':
        text += c.text;
        break;
      case 'structured-delta':
        structuredText += c.text;
        break;
      case 'tool-call':
        toolCalls.push(c.toolCall);
        break;
      case 'tool-call-delta': {
        const cur = partial.get(c.id) ?? { argsBuf: '' };
        cur.argsBuf += c.argumentsDelta;
        if (typeof c.name === 'string') cur.name = c.name;
        partial.set(c.id, cur);
        break;
      }
      case 'usage':
        usage = c.usage;
        break;
      case 'finish':
        finishReason = c.reason;
        if (c.usage !== undefined) usage = c.usage;
        break;
      case 'error':
        lastError = c.error;
        finishReason = 'error';
        break;
    }
  }

  for (const [id, p] of partial) {
    toolCalls.push({ id, name: p.name ?? '', arguments: p.argsBuf });
  }

  if (lastError !== undefined) return err(lastError);

  let parsed: unknown | undefined;
  if (structured && structuredText.length > 0) {
    try {
      parsed = JSON.parse(structuredText);
    } catch {
      // fall through; consumer can still inspect raw text
    }
  } else if (structured && text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore
    }
  }

  return ok({
    text,
    toolCalls,
    ...(parsed !== undefined ? { structured: parsed } : {}),
    finishReason,
    ...(usage !== undefined ? { usage } : {}),
    model,
    providerId,
  });
}

/**
 * Default `generate` implementation derived from `stream`. Providers
 * may override if they prefer their non-streaming endpoint.
 */
export function defaultGenerate(
  adapter: Pick<AlphabetProviderAdapter, 'id' | 'stream'>,
): (
  request: AlphabetGenerationRequest,
) => Promise<Result<AlphabetGenerationResponse, AlphabetProtocolError>> {
  return async (request) =>
    collapseStream(
      adapter.id,
      request.model,
      adapter.stream(request),
      request.structuredOutput !== undefined,
    );
}

/** Default request timeout. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
