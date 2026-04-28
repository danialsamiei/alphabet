/**
 * @file experiences/ProtocolPlaygroundExperience.tsx
 * @description
 * AI Protocol Playground — a small form that issues requests against
 * the in-process `@awaf/api` mock server (which fulfils the canonical
 * 16 AWAF endpoints with deterministic, seeded responses). All work is
 * 100 % offline — no network round-trips, no external dependencies.
 *
 * The playground is intentionally schema-agnostic: it emits the typed
 * route paths from `AWAF_ROUTES` and a JSON body chosen by the user.
 * Mock responses are pretty-printed alongside metadata so visitors can
 * see request/response correlation in real time.
 */

import { useMemo, useState } from 'react';
import { createMockServer, type MockServerHandle } from '@awaf/api/mock';
import { AWAF_ROUTES, API_VERSION_PREFIX } from '@awaf/core';

interface PresetOperation {
  readonly id: string;
  readonly label: string;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
  readonly bodyTemplate: string;
}

const PRESETS: ReadonlyArray<PresetOperation> = [
  {
    id: 'handshake',
    label: 'Context handshake',
    method: 'POST',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.contextHandshake}`,
    bodyTemplate: JSON.stringify(
      { language: 'en-US', timezone: 'Europe/London' },
      null,
      2,
    ),
  },
  {
    id: 'consent',
    label: 'Update consent',
    method: 'POST',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.contextConsent}`,
    bodyTemplate: JSON.stringify(
      { tier: 'CONSENTED', purposes: ['personalization'] },
      null,
      2,
    ),
  },
  {
    id: 'suggestions',
    label: 'Ranked suggestions',
    method: 'GET',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.suggestions}`,
    bodyTemplate: '',
  },
  {
    id: 'pulse',
    label: 'AWAF Pulse list',
    method: 'GET',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.technologyPulse}`,
    bodyTemplate: '',
  },
  {
    id: 'pulse-brief',
    label: 'AWAF Pulse brief',
    method: 'POST',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.technologyPulseBrief}`,
    bodyTemplate: JSON.stringify(
      { topic: 'small language models', length: 'short' },
      null,
      2,
    ),
  },
  {
    id: 'memory-store',
    label: 'Store memory',
    method: 'POST',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.visitorMemoryStore}`,
    bodyTemplate: JSON.stringify(
      { domain: 'preferences', key: 'theme', value: 'dark' },
      null,
      2,
    ),
  },
  {
    id: 'memory-erase',
    label: 'Erase memory (GDPR)',
    method: 'DELETE',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.visitorMemoryDelete}`,
    bodyTemplate: '',
  },
  {
    id: 'claw-query',
    label: 'OpenClaw query',
    method: 'POST',
    path: `${API_VERSION_PREFIX}${AWAF_ROUTES.clawQuery}`,
    bodyTemplate: JSON.stringify(
      { query: 'how should I configure consent?', topK: 3 },
      null,
      2,
    ),
  },
];

interface RequestLogEntry {
  readonly id: number;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
  readonly correlationId?: string;
  readonly body: string;
}

export function ProtocolPlaygroundExperience(): JSX.Element {
  const server = useMemo<MockServerHandle>(
    () => createMockServer({ seed: 7, latencyMs: 12 }),
    [],
  );

  const [presetId, setPresetId] = useState<string>(PRESETS[0]!.id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;
  const [body, setBody] = useState<string>(preset.bodyTemplate);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<boolean>(false);
  const [log, setLog] = useState<ReadonlyArray<RequestLogEntry>>([]);

  const handlePresetChange = (id: string): void => {
    setPresetId(id);
    const next = PRESETS.find((p) => p.id === id);
    if (next !== undefined) {
      setBody(next.bodyTemplate);
      setError(null);
    }
  };

  const handleSend = async (): Promise<void> => {
    setError(null);
    setPending(true);

    const init: RequestInit = { method: preset.method };
    if (preset.method !== 'GET' && body.trim().length > 0) {
      try {
        // Validate JSON before dispatching. The parsed value is not used —
        // we forward the original `body` string so users see the exact
        // payload they typed in the response log.
        JSON.parse(body);
        init.body = body;
        init.headers = { 'Content-Type': 'application/json' };
      } catch (e) {
        setError(`Body is not valid JSON: ${(e as Error).message}`);
        setPending(false);
        return;
      }
    }

    const t0 = performance.now();
    try {
      const res = await server.request(preset.path, init);
      const durationMs = performance.now() - t0;
      const text = await res.text();
      let pretty = text;
      let correlationId: string | undefined;
      try {
        const parsed: unknown = JSON.parse(text);
        pretty = JSON.stringify(parsed, null, 2);
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'requestId' in parsed &&
          typeof (parsed as { requestId: unknown }).requestId === 'string'
        ) {
          correlationId = (parsed as { requestId: string }).requestId;
        }
      } catch {
        /* leave as text */
      }
      setLog((prev) =>
        [
          {
            id: prev.length + 1,
            method: preset.method,
            path: preset.path,
            status: res.status,
            durationMs,
            ...(correlationId !== undefined ? { correlationId } : {}),
            body: pretty,
          },
          ...prev,
        ].slice(0, 12),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="awaf-experience awaf-grid-2">
      <div className="awaf-card">
        <h3 className="awaf-card-heading">Compose request</h3>
        <p className="awaf-muted-text">
          Issued against an in-process <code>createMockServer</code>{' '}
          (deterministic, seeded). No network calls are made.
        </p>

        <label className="awaf-field">
          <span>Preset</span>
          <select
            value={presetId}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.method} {p.path}
              </option>
            ))}
          </select>
        </label>

        <label className="awaf-field">
          <span>Body (JSON)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            disabled={preset.method === 'GET' || preset.method === 'DELETE'}
            spellCheck={false}
            placeholder={
              preset.method === 'GET' || preset.method === 'DELETE'
                ? '(no body)'
                : '{}'
            }
          />
        </label>

        <div className="awaf-button-row">
          <button
            type="button"
            className="awaf-primary-btn"
            disabled={pending}
            onClick={() => {
              void handleSend();
            }}
          >
            {pending ? 'Sending…' : `Send ${preset.method}`}
          </button>
          <button
            type="button"
            className="awaf-pill-btn"
            onClick={() => setLog([])}
          >
            Clear log
          </button>
        </div>

        {error !== null ? (
          <p className="awaf-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <aside className="awaf-card" aria-label="Response log">
        <h3 className="awaf-card-heading">Response log</h3>
        {log.length === 0 ? (
          <p className="awaf-muted-text awaf-empty">
            No requests yet — pick a preset and send.
          </p>
        ) : (
          <ol className="awaf-log awaf-log-stacked">
            {log.map((entry) => (
              <li key={entry.id}>
                <header>
                  <span className="awaf-pill" data-status="ready">
                    {entry.method} · {entry.status}
                  </span>
                  <span className="awaf-muted-text">
                    {entry.durationMs.toFixed(1)} ms
                  </span>
                  {entry.correlationId !== undefined ? (
                    <code className="awaf-correlation">
                      {entry.correlationId}
                    </code>
                  ) : null}
                </header>
                <code className="awaf-muted-text">{entry.path}</code>
                <pre className="awaf-pre">{entry.body}</pre>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
