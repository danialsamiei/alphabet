/**
 * @file github-models.ts
 * @description
 * Thin client for the GitHub Models inference API
 * (`https://models.github.ai/inference/chat/completions`).
 *
 * In production this module is called from the browser against a
 * server-side proxy (`/api/assistant`) that injects the
 * `Authorization: Bearer $GITHUB_TOKEN` header — the token must
 * never be shipped to the client. The proxy implementation lives
 * in `server.mjs` at the app root.
 *
 * The same module also runs server-side from `server.mjs` against
 * the real GitHub Models endpoint when `directEndpoint` is set.
 * 
 * Supports both standard and streaming responses.
 */

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatRequest {
  /** GitHub Models model id, e.g. `openai/gpt-4o-mini`. */
  readonly model: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  /** 0..2 — defaults to 0.4 for grounded, factual answers. */
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Enable streaming response. */
  readonly stream?: boolean;
}

export interface ChatResponse {
  readonly content: string;
  readonly model: string;
  readonly finishReason: string | null;
}

export interface ChatClientOptions {
  /**
   * Where to POST chat requests. Defaults to the same-origin proxy
   * at `/api/assistant` (used from the browser). Set this to
   * `https://models.github.ai/inference/chat/completions` from the
   * server side.
   */
  readonly endpoint?: string;
  /**
   * Bearer token. ONLY pass this server-side. The browser path uses
   * a same-origin proxy that injects the token securely.
   */
  readonly token?: string;
  /** Optional fetch override (for tests). */
  readonly fetchImpl?: typeof fetch;
  /** AbortSignal forwarded to fetch. */
  readonly signal?: AbortSignal;
}

const DEFAULT_PROXY_PATH = '/api/assistant';
export const GITHUB_MODELS_ENDPOINT =
  'https://models.github.ai/inference/chat/completions';
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

/**
 * Send a chat-completion request and return the assistant message.
 *
 * @throws {Error} if the HTTP response is not ok or the payload is malformed.
 *
 * @example
 * const reply = await chat({
 *   model: DEFAULT_MODEL,
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hi!' },
 *   ],
 * });
 * console.log(reply.content);
 */
export async function chat(
  request: ChatRequest,
  options: ChatClientOptions = {}
): Promise<ChatResponse> {
  const endpoint = options.endpoint ?? DEFAULT_PROXY_PATH;
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (options.token !== undefined && options.token !== '') {
    headers.authorization = `Bearer ${options.token}`;
  }

  const body = JSON.stringify({
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxTokens ?? 512,
  });

  const init: RequestInit = { method: 'POST', headers, body };
  if (options.signal !== undefined) init.signal = options.signal;

  const res = await fetchImpl(endpoint, init);

  if (!res.ok) {
    const detail = await safeReadText(res);
    throw new Error(
      `GitHub Models request failed: ${res.status} ${res.statusText}${
        detail !== '' ? ` — ${detail}` : ''
      }`
    );
  }

  const json = (await res.json()) as unknown;
  return parseChatResponse(json);
}

/**
 * Send a streaming chat-completion request and invoke callback for each chunk.
 *
 * @param request - The chat request configuration
 * @param onChunk - Callback invoked with each text chunk as it arrives
 * @param options - Optional client configuration
 * @returns Promise that resolves when streaming is complete
 *
 * @example
 * await chatStream(
 *   { model: DEFAULT_MODEL, messages: [...] },
 *   (chunk) => console.log(chunk)
 * );
 */
export async function chatStream(
  request: ChatRequest,
  onChunk: (chunk: string) => void,
  options: ChatClientOptions = {}
): Promise<void> {
  const endpoint = options.endpoint ?? DEFAULT_PROXY_PATH;
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
  };
  if (options.token !== undefined && options.token !== '') {
    headers.authorization = `Bearer ${options.token}`;
  }

  const body = JSON.stringify({
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxTokens ?? 512,
    stream: true,
  });

  const init: RequestInit = { method: 'POST', headers, body };
  if (options.signal !== undefined) init.signal = options.signal;

  const res = await fetchImpl(endpoint, init);

  if (!res.ok) {
    const detail = await safeReadText(res);
    throw new Error(
      `GitHub Models request failed: ${res.status} ${res.statusText}${
        detail !== '' ? ` — ${detail}` : ''
      }`
    );
  }

  // Check if response is actually streaming
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/x-ndjson')) {
    // Fallback to non-streaming response
    const json = (await res.json()) as unknown;
    const response = parseChatResponse(json);
    onChunk(response.content);
    return;
  }

  if (res.body === null) {
    throw new Error('Response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as unknown;
            const content = extractStreamContent(parsed);
            if (content !== '') {
              onChunk(content);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extract content from a streaming chunk response.
 */
function extractStreamContent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  
  const obj = payload as Record<string, unknown>;
  const choices = obj['choices'];
  if (!Array.isArray(choices) || choices.length === 0) return '';
  
  const choice = choices[0] as Record<string, unknown>;
  const delta = choice['delta'] as Record<string, unknown> | undefined;
  
  if (delta !== undefined && typeof delta['content'] === 'string') {
    return delta['content'] as string;
  }
  
  return '';
}

function parseChatResponse(payload: unknown): ChatResponse {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('GitHub Models response: expected JSON object');
  }
  const obj = payload as Record<string, unknown>;
  const choices = obj['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('GitHub Models response: missing choices[]');
  }
  const choice = choices[0] as Record<string, unknown>;
  const message = choice['message'] as Record<string, unknown> | undefined;
  const content =
    message !== undefined && typeof message['content'] === 'string'
      ? (message['content'] as string)
      : '';
  const finishReason =
    typeof choice['finish_reason'] === 'string'
      ? (choice['finish_reason'] as string)
      : null;
  const model = typeof obj['model'] === 'string' ? (obj['model'] as string) : 'unknown';
  return { content, model, finishReason };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}
