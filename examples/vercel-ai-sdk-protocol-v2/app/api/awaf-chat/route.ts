/**
 * @file route.ts
 * @description
 * Next.js App Router edge route that bridges AwafProtocol v2 streaming
 * to a Server-Sent Events response that the Vercel AI SDK can consume
 * via `useChat({ api: '/api/awaf-chat' })`.
 *
 * Lifecycle:
 *   1. Read the consent proof from the `x-awaf-consent-proof` header.
 *   2. Build a fallback chain (OpenAI → Anthropic → Gemini).
 *   3. Wrap the chain in an `AwafAiClient` so consent verification, PII
 *      redaction, consent-aware prelude, and context compression all
 *      run *before* any provider call.
 *   4. Stream `AwafStreamChunk` events as SSE — one `data:` line per
 *      chunk, terminated by a `data: [DONE]` line.
 *
 * Drop this file into `app/api/awaf-chat/route.ts` of any Next.js
 * project that depends on `ai`, `@ai-sdk/react`, and `@awaf/protocols`.
 */

import {
  AwafAiClient,
  createFallbackChain,
  createOpenAiProvider,
  createAnthropicProvider,
  createGeminiProvider,
  type AwafGenerationRequest,
  type AwafStreamChunk,
} from '@awaf/protocols/v2';

export const runtime = 'edge';

// ─── Lazy provider construction ──────────────────────────────────────────────

function buildClient(): AwafAiClient {
  const providers = [
    createOpenAiProvider({ apiKey: process.env.OPENAI_API_KEY ?? '' }),
    createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' }),
    createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY ?? '' }),
  ];
  const chain = createFallbackChain({
    providers,
    modelByProvider: {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-haiku-latest',
      gemini: 'gemini-1.5-flash',
    },
  });
  return new AwafAiClient({
    provider: chain,
    defaultPrivacy: { dntEnabled: false, gpcEnabled: false },
    defaultTokenBudget: 4_000,
  });
}

const client = buildClient();

// ─── Consent proof verification key ──────────────────────────────────────────

let consentPublicKeyPromise: Promise<CryptoKey> | undefined;

async function loadConsentPublicKey(): Promise<CryptoKey | undefined> {
  const jwk = process.env.AWAF_CONSENT_PROOF_PUBLIC_KEY_JWK;
  if (jwk === undefined || jwk.length === 0) return undefined;
  if (consentPublicKeyPromise === undefined) {
    consentPublicKeyPromise = crypto.subtle.importKey(
      'jwk',
      JSON.parse(jwk) as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  }
  return consentPublicKeyPromise;
}

// ─── Wire AwafChatMessage ↔ Vercel useChat messages ──────────────────────────

interface VercelChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

interface VercelChatBody {
  readonly messages: readonly VercelChatMessage[];
  readonly visitorId: string;
  readonly sessionId: string;
  readonly locale?: string;
  readonly country?: string;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as VercelChatBody;
  const proofToken = req.headers.get('x-awaf-consent-proof');
  const expectedAudience = req.headers.get('x-awaf-audience') ?? 'awaf:demo';

  const generationRequest: AwafGenerationRequest = {
    model: 'gpt-4o-mini', // overridden per-provider by the chain
    messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    context: {
      visitorId: body.visitorId,
      sessionId: body.sessionId,
      consentTier: 'CONSENTED',
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      privacyRestricted: false,
    },
  };

  const callOptions: Parameters<AwafAiClient['stream']>[1] = {};
  const publicKey = await loadConsentPublicKey();
  if (proofToken !== null && publicKey !== undefined) {
    callOptions.consentProof = {
      token: proofToken,
      publicKey,
      expectedAudience,
    };
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of client.stream(generationRequest, callOptions)) {
          controller.enqueue(encoder.encode(`data: ${serializeChunk(chunk)}\n\n`));
          if (chunk.type === 'finish' || chunk.type === 'error') break;
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: { code: 'ADAPTER_NOT_CONFIGURED', message: (e as Error).message } })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

function serializeChunk(chunk: AwafStreamChunk): string {
  return JSON.stringify(chunk);
}
