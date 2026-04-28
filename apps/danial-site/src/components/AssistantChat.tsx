/**
 * @file AssistantChat.tsx
 * @description
 * Interactive chat panel powered by the GitHub Models LLM API
 * (proxied through `/api/assistant` so the token stays server-side).
 *
 * The system prompt is grounded on Danial's public profile — see
 * {@link buildSystemPrompt}. The component is fully accessible:
 * messages live in an `aria-live="polite"` region, the input is
 * labelled, and the send button is disabled while a request is in
 * flight.
 */

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { profile } from '../data/profile.js';
import { buildSystemPrompt } from '../lib/build-system-prompt.js';
import {
  chat,
  DEFAULT_MODEL,
  type ChatMessage,
} from '../lib/github-models.js';

interface UiMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant' | 'system' | 'error';
  readonly content: string;
}

export interface AssistantChatHandle {
  focus: () => void;
}

export const AssistantChat = forwardRef<AssistantChatHandle>(function AssistantChat(
  _props,
  ref
): JSX.Element {
  const [messages, setMessages] = useState<ReadonlyArray<UiMessage>>([
    {
      id: 0,
      role: 'assistant',
      content: `Hi — I’m a small assistant grounded on ${profile.name}'s public profile. Ask me about his research, courses, or how to get in touch.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useImperativeHandle(ref, () => ({
    focus: (): void => inputRef.current?.focus(),
  }));

  const send = useCallback(async (): Promise<void> => {
    const trimmed = input.trim();
    if (trimmed === '' || pending) return;

    const userMsg: UiMessage = { id: nextId.current++, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPending(true);

    // Build the chat history we send to the model. We only include
    // user/assistant turns — never the local "error" UI rows.
    const history: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(profile) },
      ...messages
        .filter((m): m is UiMessage & { role: 'user' | 'assistant' } =>
          m.role === 'user' || m.role === 'assistant'
        )
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ];

    try {
      const reply = await chat({
        model: DEFAULT_MODEL,
        messages: history,
        temperature: 0.3,
        maxTokens: 400,
      });
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'assistant', content: reply.content },
      ]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'error',
          content: `Couldn’t reach the assistant. ${detail}. Make sure the proxy is running (\`pnpm --filter @awaf/danial-site dev:proxy\`) and \`GITHUB_TOKEN\` is set.`,
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, messages, pending]);

  return (
    <section
      id="ds-assistant"
      className="ds-section ds-assistant"
      aria-labelledby="ds-assistant-h"
    >
      <h2 id="ds-assistant-h">Ask the assistant</h2>
      <p className="ds-muted">
        Powered by GitHub Models. The assistant is grounded on this page — it does not
        invent facts. For anything else, please email{' '}
        <a href={`mailto:${profile.email}`}>{profile.email}</a>.
      </p>

      <ol className="ds-chat-log" aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <li key={m.id} className={`ds-chat-msg ds-chat-${m.role}`}>
            <span className="ds-chat-role">{m.role}</span>
            <span className="ds-chat-content">{m.content}</span>
          </li>
        ))}
      </ol>

      <form
        className="ds-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="ds-chat-input" className="ds-visually-hidden">
          Your question
        </label>
        <input
          id="ds-chat-input"
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What does Danial work on?"
          disabled={pending}
          autoComplete="off"
        />
        <button
          type="submit"
          className="ds-btn ds-btn-primary"
          disabled={pending || input.trim() === ''}
        >
          {pending ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </section>
  );
});
