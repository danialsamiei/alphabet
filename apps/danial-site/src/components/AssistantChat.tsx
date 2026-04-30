/**
 * @file AssistantChat.tsx
 * @description
 * Interactive chat panel powered by the GitHub Models LLM API
 * (proxied through `/api/assistant` so the token stays server-side).
 *
 * Features:
 * - Streaming responses with typewriter effect
 * - Quick action buttons for common queries
 * - Session memory with localStorage persistence
 * - RTL/Persian language support with auto-detection
 * - Full accessibility with aria-live regions
 *
 * The system prompt is grounded on Danial's public profile — see
 * {@link buildSystemPrompt}. The component is fully accessible:
 * messages live in an `aria-live="polite"` region, the input is
 * labelled, and the send button is disabled while a request is in
 * flight.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { profile } from '../data/profile.js';
import { buildSystemPrompt } from '../lib/build-system-prompt.js';
import {
  chatStream,
  DEFAULT_MODEL,
  type ChatMessage,
} from '../lib/github-models.js';

interface UiMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant' | 'system' | 'error';
  readonly content: string;
  readonly isStreaming?: boolean;
}

export interface AssistantChatHandle {
  focus: () => void;
}

const STORAGE_KEY = 'ds-assistant-history';
const MAX_STORED_MESSAGES = 20;

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: 'Research Areas', labelFa: 'حوزه‌های تحقیقاتی', query: 'What are Danial\'s main research areas?' },
  { label: 'Publications', labelFa: 'انتشارات', query: 'Tell me about Danial\'s recent publications.' },
  { label: 'Courses', labelFa: 'دوره‌ها', query: 'What courses does Danial teach?' },
  { label: 'Contact', labelFa: 'تماس', query: 'How can I contact Danial?' },
] as const;

// Detect RTL text (Persian, Arabic, Hebrew)
function isRtlText(text: string): boolean {
  const rtlPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlPattern.test(text);
}

// Get stored messages from localStorage
function getStoredMessages(): UiMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UiMessage[];
      return parsed.slice(-MAX_STORED_MESSAGES);
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

// Save messages to localStorage
function saveMessages(messages: readonly UiMessage[]): void {
  try {
    const toStore = messages
      .filter((m) => m.role !== 'error' && !m.isStreaming)
      .slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

export const AssistantChat = forwardRef<AssistantChatHandle>(function AssistantChat(
  _props,
  ref
): JSX.Element {
  const initialMessage: UiMessage = {
    id: 0,
    role: 'assistant',
    content: `Hi — I'm a small assistant grounded on ${profile.name}'s public profile. Ask me about his research, courses, or how to get in touch.\n\nسلام — من یک دستیار کوچک هستم که بر اساس پروفایل عمومی ${profile.name} پاسخ می‌دهم. درباره تحقیقات، دوره‌ها یا نحوه تماس با ایشان بپرسید.`,
  };

  const [messages, setMessages] = useState<ReadonlyArray<UiMessage>>(() => {
    const stored = getStoredMessages();
    return stored.length > 0 ? stored : [initialMessage];
  });
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [isRtl, setIsRtl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatLogRef = useRef<HTMLOListElement>(null);
  const nextId = useRef(messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 1);
  const abortControllerRef = useRef<AbortController | null>(null);

  useImperativeHandle(ref, () => ({
    focus: (): void => inputRef.current?.focus(),
  }));

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  // Save messages to localStorage when they change (excluding streaming)
  useEffect(() => {
    if (!pending) {
      saveMessages(messages);
    }
  }, [messages, pending]);

  // Detect RTL from input
  useEffect(() => {
    if (input.length > 0) {
      setIsRtl(isRtlText(input));
    }
  }, [input]);

  const send = useCallback(async (queryOverride?: string): Promise<void> => {
    const trimmed = (queryOverride ?? input).trim();
    if (trimmed === '' || pending) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMsg: UiMessage = { id: nextId.current++, role: 'user', content: trimmed };
    const streamingMsgId = nextId.current++;
    
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: streamingMsgId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setInput('');
    setPending(true);

    // Build the chat history we send to the model
    const turns: ChatMessage[] = [];
    for (const m of messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        turns.push({ role: m.role, content: m.content });
      }
    }
    const history: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(profile) },
      ...turns,
      { role: 'user', content: trimmed },
    ];

    try {
      let fullContent = '';
      
      await chatStream(
        {
          model: DEFAULT_MODEL,
          messages: history,
          temperature: 0.3,
          maxTokens: 400,
        },
        (chunk) => {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMsgId
                ? { ...m, content: fullContent }
                : m
            )
          );
        },
        { signal: abortControllerRef.current?.signal }
      );

      // Mark as complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgId
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, remove the streaming message
        setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
        return;
      }
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== streamingMsgId),
        {
          id: nextId.current++,
          role: 'error',
          content: `Couldn't reach the assistant. ${detail}. Make sure the proxy is running (\`pnpm --filter @alphabet/danial-site dev:proxy\`) and \`GITHUB_TOKEN\` is set.`,
        },
      ]);
    } finally {
      setPending(false);
      abortControllerRef.current = null;
    }
  }, [input, messages, pending]);

  const handleQuickAction = useCallback((query: string): void => {
    void send(query);
  }, [send]);

  const clearHistory = useCallback((): void => {
    setMessages([initialMessage]);
    localStorage.removeItem(STORAGE_KEY);
    nextId.current = 1;
  }, []);

  return (
    <section
      id="ds-assistant"
      className="ds-section ds-assistant"
      aria-labelledby="ds-assistant-h"
    >
      <div className="ds-assistant-header">
        <h2 id="ds-assistant-h">Ask the assistant / از دستیار بپرسید</h2>
        {messages.length > 1 && (
          <button
            type="button"
            className="ds-btn ds-btn-small ds-btn-ghost"
            onClick={clearHistory}
            aria-label="Clear conversation history"
          >
            Clear history
          </button>
        )}
      </div>
      <p className="ds-muted">
        Powered by GitHub Models. The assistant is grounded on this page — it does not
        invent facts. For anything else, please email{' '}
        <a href={`mailto:${profile.email}`}>{profile.email}</a>.
      </p>

      {/* Quick Actions */}
      <div className="ds-quick-actions" role="group" aria-label="Quick actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="ds-btn ds-btn-small ds-quick-action"
            onClick={() => handleQuickAction(action.query)}
            disabled={pending}
          >
            <span className="ds-quick-action-en">{action.label}</span>
            <span className="ds-quick-action-fa">{action.labelFa}</span>
          </button>
        ))}
      </div>

      <ol
        ref={chatLogRef}
        className="ds-chat-log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => {
          const messageIsRtl = isRtlText(m.content);
          return (
            <li
              key={m.id}
              className={`ds-chat-msg ds-chat-${m.role}${m.isStreaming ? ' ds-chat-streaming' : ''}`}
              dir={messageIsRtl ? 'rtl' : 'ltr'}
            >
              <span className="ds-chat-role">
                {m.role === 'user' ? 'You / شما' : m.role === 'assistant' ? 'AI' : m.role}
              </span>
              <span className="ds-chat-content">
                {m.content}
                {m.isStreaming && <span className="ds-typing-indicator" aria-label="Typing">▋</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <form
        className="ds-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="ds-chat-input" className="ds-visually-hidden">
          Your question / سوال شما
        </label>
        <input
          id="ds-chat-input"
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question... / سوالی بپرسید..."
          disabled={pending}
          autoComplete="off"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <button
          type="submit"
          className="ds-btn ds-btn-primary"
          disabled={pending || input.trim() === ''}
        >
          {pending ? 'Thinking… / در حال فکر…' : 'Send / ارسال'}
        </button>
      </form>
    </section>
  );
});
