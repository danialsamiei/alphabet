/**
 * Beta LLM access for Alphabet.
 *
 * The default mode uses Alefba's bounded public gateway. BYOK talks directly
 * to an OpenAI-compatible endpoint. Premium is intentionally unavailable
 * during the public beta.
 */

export const ALPHABET_FREE_LLM_ENDPOINT =
  'https://alef.ba/api/alphabet/chat';

export type AlphabetLlmRole = 'system' | 'user' | 'assistant';
export type AlphabetLlmAccessMode = 'free' | 'byok' | 'premium';

export interface AlphabetLlmMessage {
  readonly role: AlphabetLlmRole;
  readonly content: string;
}

export interface AlphabetLlmReceipt {
  readonly requestId: string;
  readonly access: 'free' | 'byok' | 'sponsored-premium';
  readonly providerClass: 'managed' | 'user-supplied';
  readonly beta: true;
  readonly storage: 'none';
  readonly gateway?: string;
}

export interface AlphabetLlmResponse {
  readonly text: string;
  readonly receipt: AlphabetLlmReceipt;
}

export interface AlphabetLlmClientOptions {
  /** `free` is the default. `premium` fails closed during beta. */
  readonly mode?: AlphabetLlmAccessMode;
  /** Override for sovereign or self-hosted managed gateways. */
  readonly endpoint?: string;
  /** Required for BYOK. Must be an OpenAI-compatible `/v1` base URL. */
  readonly providerBaseUrl?: string;
  /**
   * Required for BYOK. Held in a private field and never returned in errors
   * or receipts. Prefer configuring it in application-owned server code.
   */
  readonly apiKey?: string;
  /** Required for BYOK. */
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
}

export interface AlphabetLlmCompleteOptions {
  readonly maxTokens?: number;
}

export type AlphabetLlmErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'PREMIUM_DISABLED'
  | 'RATE_LIMITED'
  | 'GATEWAY_UNAVAILABLE'
  | 'PROVIDER_REJECTED'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR';

export class AlphabetLlmError extends Error {
  readonly code: AlphabetLlmErrorCode;
  readonly status?: number;

  constructor(
    code: AlphabetLlmErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'AlphabetLlmError';
    this.code = code;
    this.status = status;
  }
}

type GatewayBody = {
  readonly text?: unknown;
  readonly receipt?: {
    readonly requestId?: unknown;
    readonly access?: unknown;
  };
  readonly error?: {
    readonly message?: unknown;
  };
};

type OpenAiBody = {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: unknown;
    };
  }[];
};

function requestId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `alphabet-${Date.now().toString(36)}`;
}

function normalizedBaseUrl(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function validateMessages(messages: readonly AlphabetLlmMessage[]): void {
  if (messages.length < 1 || messages.length > 12) {
    throw new AlphabetLlmError(
      'INVALID_REQUEST',
      'Alphabet beta accepts between 1 and 12 messages.',
    );
  }

  let total = 0;
  for (const message of messages) {
    if (
      !['system', 'user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      message.content.trim() === ''
    ) {
      throw new AlphabetLlmError(
        'INVALID_REQUEST',
        'Every message needs a supported role and non-empty content.',
      );
    }
    total += message.content.length;
  }

  if (total > 16_000) {
    throw new AlphabetLlmError(
      'INVALID_REQUEST',
      'Alphabet beta limits message content to 16,000 characters.',
    );
  }
}

/**
 * Provider-neutral client for Alphabet's public-beta LLM access.
 *
 * @example
 * const llm = new AlphabetLlmClient();
 * const result = await llm.complete([
 *   { role: 'user', content: 'Design an accessible adaptive product hero.' },
 * ]);
 */
export class AlphabetLlmClient {
  readonly #mode: AlphabetLlmAccessMode;
  readonly #endpoint: string;
  readonly #providerBaseUrl?: string;
  readonly #model?: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;
  readonly #apiKey?: string;

  constructor(options: AlphabetLlmClientOptions = {}) {
    this.#mode = options.mode ?? 'free';
    this.#endpoint = options.endpoint ?? ALPHABET_FREE_LLM_ENDPOINT;
    this.#providerBaseUrl = options.providerBaseUrl;
    this.#model = options.model;
    this.#timeoutMs = options.timeoutMs ?? 45_000;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#apiKey = options.apiKey;

    if (typeof this.#fetch !== 'function') {
      throw new AlphabetLlmError(
        'INVALID_CONFIGURATION',
        'A Fetch-compatible implementation is required.',
      );
    }

    if (
      this.#mode === 'byok' &&
      (!this.#providerBaseUrl || !this.#apiKey || !this.#model)
    ) {
      throw new AlphabetLlmError(
        'INVALID_CONFIGURATION',
        'BYOK requires providerBaseUrl, apiKey, and model.',
      );
    }
  }

  async complete(
    messages: readonly AlphabetLlmMessage[],
    options: AlphabetLlmCompleteOptions = {},
  ): Promise<AlphabetLlmResponse> {
    validateMessages(messages);

    if (this.#mode === 'premium') {
      throw new AlphabetLlmError(
        'PREMIUM_DISABLED',
        'Alphabet Premium is not available during the public beta.',
      );
    }

    const maxTokens = Math.min(
      Math.max(Math.trunc(options.maxTokens ?? 700), 64),
      1_000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      return this.#mode === 'byok'
        ? await this.#completeByok(messages, maxTokens, controller.signal)
        : await this.#completeFree(messages, maxTokens, controller.signal);
    } catch (error) {
      if (error instanceof AlphabetLlmError) throw error;
      throw new AlphabetLlmError(
        'NETWORK_ERROR',
        error instanceof Error && error.name === 'AbortError'
          ? 'The LLM request timed out.'
          : 'The LLM request could not be completed.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async #completeFree(
    messages: readonly AlphabetLlmMessage[],
    maxTokens: number,
    signal: AbortSignal,
  ): Promise<AlphabetLlmResponse> {
    const response = await this.#fetch(this.#endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-Alphabet-Beta': '1',
      },
      body: JSON.stringify({ messages, maxTokens }),
      signal,
    });

    const body = (await response.json().catch(() => ({}))) as GatewayBody;
    if (!response.ok) {
      const code =
        response.status === 429
          ? 'RATE_LIMITED'
          : response.status === 503
            ? 'GATEWAY_UNAVAILABLE'
            : 'PROVIDER_REJECTED';
      throw new AlphabetLlmError(
        code,
        typeof body.error?.message === 'string'
          ? body.error.message
          : 'The managed beta gateway rejected the request.',
        response.status,
      );
    }

    if (typeof body.text !== 'string' || body.text.trim() === '') {
      throw new AlphabetLlmError(
        'INVALID_RESPONSE',
        'The managed beta gateway returned no usable text.',
      );
    }

    const access =
      body.receipt?.access === 'sponsored-premium'
        ? 'sponsored-premium'
        : 'free';

    return {
      text: body.text,
      receipt: {
        requestId:
          typeof body.receipt?.requestId === 'string'
            ? body.receipt.requestId
            : response.headers.get('x-alphabet-request-id') ?? requestId(),
        access,
        providerClass: 'managed',
        beta: true,
        storage: 'none',
        gateway: new URL(this.#endpoint).origin,
      },
    };
  }

  async #completeByok(
    messages: readonly AlphabetLlmMessage[],
    maxTokens: number,
    signal: AbortSignal,
  ): Promise<AlphabetLlmResponse> {
    const endpoint = new URL(
      'chat/completions',
      normalizedBaseUrl(this.#providerBaseUrl as string),
    );
    const response = await this.#fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${this.#apiKey as string}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#model,
        messages,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      throw new AlphabetLlmError(
        'PROVIDER_REJECTED',
        `The user-supplied provider rejected the request with HTTP ${response.status}.`,
        response.status,
      );
    }

    const body = (await response.json().catch(() => ({}))) as OpenAiBody;
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim() === '') {
      throw new AlphabetLlmError(
        'INVALID_RESPONSE',
        'The user-supplied provider returned no usable text.',
      );
    }

    return {
      text,
      receipt: {
        requestId:
          response.headers.get('x-request-id') ??
          response.headers.get('request-id') ??
          requestId(),
        access: 'byok',
        providerClass: 'user-supplied',
        beta: true,
        storage: 'none',
      },
    };
  }
}
