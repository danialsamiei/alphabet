/**
 * @file route.ts
 * @description
 * Next.js App Router edge route that bridges AlphabetProtocol v2 streaming
 * to a Server-Sent Events response that the Vercel AI SDK can consume
 * via `useChat({ api: '/api/alphabet-chat' })`.
 *
 * Lifecycle:
 *   1. Read the consent proof from the `x-alphabet-consent-proof` header.
 *   2. Build a fallback chain (OpenAI → Anthropic → Gemini).
 *   3. Wrap the chain in an `AlphabetAiClient` so consent verification, PII
 *      redaction, consent-aware prelude, and context compression all
 *      run *before* any provider call.
 *   4. Stream `AlphabetStreamChunk` events as SSE — one `data:` line per
 *      chunk, terminated by a `data: [DONE]` line.
 *
 * Drop this file into `app/api/alphabet-chat/route.ts` of any Next.js
 * project that depends on `ai`, `@ai-sdk/react`, and `@alphabet/protocols`.
 */

import {
  AlphabetAiClient,
  createFallbackChain,
  createOpenAiProvider,
  createAnthropicProvider,
  createGeminiProvider,
  CrossRealityOrchestrator,
  type AlphabetGenerationRequest,
} from '@alphabet/protocols/v2';
import { toAiSdkResponse } from '../../../lib/to-ai-sdk';
import { decideXrPayload } from '../../../lib/xr-bridge';

export const runtime = 'edge';

// ─── Lazy provider construction ──────────────────────────────────────────────

function buildClient(): AlphabetAiClient {
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
  return new AlphabetAiClient({
    provider: chain,
    defaultPrivacy: { dntEnabled: false, gpcEnabled: false },
    defaultTokenBudget: 4_000,
  });
}

const client = buildClient();

// ─── Consent proof verification key ──────────────────────────────────────────

let consentPublicKeyPromise: Promise<CryptoKey> | undefined;

async function loadConsentPublicKey(): Promise<CryptoKey | undefined> {
  const jwk = process.env.ALPHABET_CONSENT_PROOF_PUBLIC_KEY_JWK;
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

// ─── Wire AlphabetChatMessage ↔ Vercel useChat messages ──────────────────────────

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
  const proofToken = req.headers.get('x-alphabet-consent-proof');
  const expectedAudience = req.headers.get('x-alphabet-audience') ?? 'alphabet:demo';

  const generationRequest: AlphabetGenerationRequest = {
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

  const callOptions: Parameters<AlphabetAiClient['stream']>[1] = {};
  const publicKey = await loadConsentPublicKey();
  if (proofToken !== null && publicKey !== undefined) {
    callOptions.consentProof = {
      token: proofToken,
      publicKey,
      expectedAudience,
    };
  }

  // Ask the Cross-Reality Orchestrator how this response should render.
  // The bridge reads `x-alphabet-xr-snapshot` / `x-alphabet-consent-tier`
  // / DNT / GPC headers from the request. The orchestrator never reaches
  // the network — it's pure capability + privacy bookkeeping.
  const xrOrchestrator = new CrossRealityOrchestrator();
  const xrResult = await decideXrPayload(req, xrOrchestrator);

  // Bridge the AlphabetAiClient stream to a Vercel-AI-SDK-compatible
  // response. SSE is the safest default; switch to mode: 'text-only' if
  // your client uses the Vercel AI Stream protocol instead.
  const response = toAiSdkResponse(client.stream(generationRequest, callOptions), {
    mode: 'sse',
  });

  // Surface the renderer recommendation + downgrade flag so the client
  // transparency UI can show why it received a leaner payload.
  const headers = new Headers(response.headers);
  headers.set('x-alphabet-renderer', xrResult.recommendedRenderer);
  headers.set('x-alphabet-xr-mode', xrResult.decision.mode);
  headers.set('x-alphabet-xr-posture', xrResult.decision.privacyPosture);
  headers.set('x-alphabet-xr-downgraded', String(xrResult.downgraded));

  return new Response(response.body, { status: response.status, headers });
}
