/**
 * @file to-ai-sdk.ts
 * @description
 * Bridge an `AsyncIterable<AlphabetStreamChunk>` produced by
 * `AlphabetAiClient.stream()` into a `ReadableStream<Uint8Array>` that the
 * Vercel AI SDK can consume natively (`useChat`, `useCompletion`,
 * `streamText`).
 *
 * The Vercel AI SDK accepts any standard SSE response, so this helper
 * intentionally avoids importing `ai` — it has zero runtime
 * dependencies and stays in the example app instead of the package.
 *
 * Two formats are emitted:
 *   • `data: <chunk-json>\n\n` for every Alphabet chunk (round-tripped
 *     verbatim so client code may surface `tool-call`, `structured-delta`,
 *     redaction reports, etc).
 *   • A trailing `data: [DONE]\n\n` so legacy clients terminate cleanly.
 *
 * If you only need the assistant text (for `useChat`'s default body
 * shape), pass `mode: 'text-only'` to receive the simpler
 * `0:"<delta>"\n` Vercel AI Stream protocol.
 */

import type { AlphabetStreamChunk } from '@alphabet/protocols/v2';

/** Output format for the bridge. */
export type ToAiSdkMode = 'sse' | 'text-only';

export interface ToAiSdkOptions {
  /** Output protocol — defaults to `sse`. */
  readonly mode?: ToAiSdkMode;
  /**
   * If true, the bridge collapses tool-call / structured-delta chunks
   * into nothing in `text-only` mode. They are always preserved in
   * `sse` mode.
   */
  readonly stripNonTextInTextMode?: boolean;
}

/** Convert the iterable to a `ReadableStream<Uint8Array>`. */
export function toAiSdkStream(
  iterable: AsyncIterable<AlphabetStreamChunk>,
  options: ToAiSdkOptions = {},
): ReadableStream<Uint8Array> {
  const mode: ToAiSdkMode = options.mode ?? 'sse';
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          const payload = encodeChunk(chunk, mode);
          if (payload !== undefined) controller.enqueue(encoder.encode(payload));
          if (chunk.type === 'finish' || chunk.type === 'error') break;
        }
        controller.enqueue(encoder.encode(mode === 'sse' ? 'data: [DONE]\n\n' : ''));
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (mode === 'sse') {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: { code: 'STREAM_FAILURE', message } })}\n\n`,
            ),
          );
        } else {
          controller.enqueue(encoder.encode(`3:${JSON.stringify(message)}\n`));
        }
        controller.close();
      }
    },
  });
}

/** Wrap the stream in a `Response` ready for a Next.js route. */
export function toAiSdkResponse(
  iterable: AsyncIterable<AlphabetStreamChunk>,
  options: ToAiSdkOptions = {},
): Response {
  const stream = toAiSdkStream(iterable, options);
  const headers: Record<string, string> = {
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
  };
  headers['content-type'] =
    options.mode === 'text-only'
      ? 'text/plain; charset=utf-8'
      : 'text/event-stream; charset=utf-8';
  return new Response(stream, { headers });
}

// ─── Encoders ────────────────────────────────────────────────────────────────

function encodeChunk(chunk: AlphabetStreamChunk, mode: ToAiSdkMode): string | undefined {
  if (mode === 'sse') {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }
  // Vercel AI Stream protocol minimal subset:
  //   `0:"<text>"\n` — text delta
  //   `3:"<error>"\n` — error
  //   `d:{"finishReason":"stop","usage":{...}}\n` — finish (data block)
  switch (chunk.type) {
    case 'text-delta':
      return `0:${JSON.stringify(chunk.text)}\n`;
    case 'error':
      return `3:${JSON.stringify(chunk.error.message)}\n`;
    case 'finish':
      return `d:${JSON.stringify({ finishReason: chunk.reason, usage: chunk.usage ?? {} })}\n`;
    default:
      return undefined;
  }
}
