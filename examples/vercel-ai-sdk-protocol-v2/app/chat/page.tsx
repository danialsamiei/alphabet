/**
 * @file page.tsx
 * @description
 * Client-side chat page that uses Vercel AI SDK's `useChat` hook
 * pointed at our AlphabetProtocol v2 edge route. Two Alphabet-specific
 * additions:
 *
 *   • A `x-alphabet-consent-proof` header is attached to every fetch via
 *     `useChat`'s `headers` option. The token is fetched once on mount
 *     from `/api/alphabet-consent/issue` (you implement that route — it
 *     wraps `signConsentProof` from `@alphabet/protocols/v2/consent-proof`
 *     using a private key kept on the server).
 *   • The page surfaces redaction diagnostics that the route can pass
 *     back as a custom SSE event. Alphabet's transparency model requires
 *     that the visitor sees what was redacted.
 */

'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';

interface ConsentProof {
  readonly token: string;
  readonly audience: string;
}

export default function AlphabetChatPage(): JSX.Element {
  const [proof, setProof] = useState<ConsentProof | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch('/api/alphabet-consent/issue', { method: 'POST' });
      if (r.ok) setProof((await r.json()) as ConsentProof);
    })();
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/alphabet-chat',
    headers: proof === null
      ? undefined
      : {
          'x-alphabet-consent-proof': proof.token,
          'x-alphabet-audience': proof.audience,
        },
    body: {
      visitorId: 'vst_demo',
      sessionId: typeof window === 'undefined' ? 'sess' : window.crypto.randomUUID(),
      locale: typeof navigator === 'undefined' ? 'en-US' : navigator.language,
    },
  });

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>AlphabetProtocol v2 × Vercel AI SDK</h1>
      <p>
        Streaming chat with automatic PII redaction, consent-aware system
        prelude, and provider fallback chain (OpenAI → Anthropic → Gemini).
      </p>

      {proof === null && (
        <p style={{ color: '#999' }}>Issuing cryptographic consent proof…</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m) => (
          <li
            key={m.id}
            style={{
              padding: '0.5rem 0.75rem',
              margin: '0.25rem 0',
              background: m.role === 'user' ? '#eef' : '#efe',
              borderRadius: 8,
            }}
          >
            <strong>{m.role}:</strong> {m.content}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything…"
          aria-label="Chat input"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit" disabled={isLoading || proof === null}>
          Send
        </button>
      </form>

      <details style={{ marginTop: '2rem', color: '#444' }}>
        <summary>Privacy &amp; consent (transparency panel)</summary>
        <ul>
          <li>PII redaction: enabled (email, phone, JWT, AWS key, IP).</li>
          <li>Consent-aware system prelude: enabled.</li>
          <li>Consent proof: {proof === null ? 'pending' : 'verified'}.</li>
          <li>Provider fallback chain: OpenAI → Anthropic → Gemini.</li>
        </ul>
      </details>
    </main>
  );
}
