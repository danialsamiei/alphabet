/**
 * @module alphabet-client
 * @description
 * AlphabetClient — کلاینت HTTP یکپارچه برای تمام ۱۶ endpoint در Alphabet API.
 * Unified HTTP client for all 16 Alphabet API endpoints with retry and timeout.
 *
 * @example
 * const client = new AlphabetClient({
 *   apiBaseUrl: 'http://localhost:3000/api',
 *   bearerToken: 'sess-abc123',
 * });
 * const result = await client.getSuggestions({ visitorId: 'anon-xyz' });
 * if (result.success) {
 *   result.data.suggestions.forEach(s => console.log(s.label));
 * }
 */

import type { AlphabetError, Result, HandshakeRequestPayload, HandshakeResult } from '@alphabet/core';
import { ok, err, ALPHABET_ROUTES, normalizeApiBaseUrl } from '@alphabet/core';
import type {
  ConsentRequest, ConsentResponse,
  PreferenceRequest, PreferenceResponse,
  InteractRequest, InteractResponse, InteractStreamEvent,
  SuggestionsQuery, SuggestionsResponse,
  VoiceTranscribeResponse,
  TechnologyPulseQuery, TechnologyPulseResponse,
  TechnologyPulseBriefRequest, TechnologyPulseBriefResponse,
  StoreMemoryRequest, StoreMemoryResponse,
  GetMemoryQuery, GetMemoryResponse,
  EraseMemoryRequest, EraseMemoryResponse,
  ClawQueryRequest, ClawQueryResponse,
  ClawIngestRequest, ClawIngestResponse,
  ClawAdminAuditRequest, ClawAdminAuditResponse,
  VisitorInsightsQuery, VisitorInsightsResponse,
  PulseSourcesQuery, PulseSourcesResponse,
} from './types.js';

// ─── Options ──────────────────────────────────────────────────────────────────

/**
 * گزینه‌های AlphabetClient.
 */
export interface AlphabetClientOptions {
  /** آدرس پایه API — مثال: "http://localhost:3000/api" */
  readonly apiBaseUrl: string;
  /** Bearer token برای endpointهای auth'd */
  readonly bearerToken?: string;
  /** API Key برای endpointهای admin/curator */
  readonly apiKey?: string;
  /** timeout هر درخواست (میلی‌ثانیه) — پیش‌فرض: 10000 */
  readonly timeoutMs?: number;
  /** حداکثر retry روی خطاهای ۵xx — پیش‌فرض: 2 */
  readonly maxRetries?: number;
}

// ─── AlphabetClient ───────────────────────────────────────────────────────────────

/**
 * کلاینت HTTP یکپارچه Alphabet — تمام ۱۶ endpoint.
 * Unified Alphabet HTTP client — all 16 endpoints.
 */
export class AlphabetClient {
  private readonly base: string;
  private readonly bearerToken: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: AlphabetClientOptions) {
    this.base = normalizeApiBaseUrl(options.apiBaseUrl);
    this.bearerToken = options.bearerToken;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  // ── Group 1: Context Handshake ─────────────────────────────────────────────

  /**
   * POST /api/context/handshake — دریافت سیگنال‌های بازدیدکننده و دریافت UI config.
   * Auth: None.
   */
  async postHandshake(payload: HandshakeRequestPayload): Promise<Result<HandshakeResult, AlphabetError>> {
    return this.post<HandshakeResult>(ALPHABET_ROUTES.contextHandshake, payload, { noAuth: true });
  }

  /**
   * POST /api/context/consent — ثبت یا revoke کردن رضایت بازدیدکننده.
   * Auth: Bearer.
   */
  async postConsent(payload: ConsentRequest): Promise<Result<ConsentResponse, AlphabetError>> {
    return this.post<ConsentResponse>(ALPHABET_ROUTES.contextConsent, payload);
  }

  /**
   * POST /api/context/preference — ذخیره preferenceهای صریح بازدیدکننده.
   * Auth: Bearer.
   */
  async postPreference(payload: PreferenceRequest): Promise<Result<PreferenceResponse, AlphabetError>> {
    return this.post<PreferenceResponse>(ALPHABET_ROUTES.contextPreference, payload);
  }

  // ── Group 2: Visitor Interaction ──────────────────────────────────────────

  /**
   * POST /api/interact — تعامل text/voice با AI (non-streaming).
   * Auth: Bearer.
   */
  async postInteract(payload: InteractRequest): Promise<Result<InteractResponse, AlphabetError>> {
    return this.post<InteractResponse>(ALPHABET_ROUTES.interact, { ...payload, streaming: false });
  }

  /**
   * POST /api/interact — تعامل streaming با AI از طریق SSE.
   * Auth: Bearer.
   *
   * @example
   * for await (const event of client.streamInteract(payload)) {
   *   if (event.type === 'token') process.stdout.write(event.data as string);
   *   if (event.type === 'done') break;
   * }
   */
  async *streamInteract(payload: InteractRequest): AsyncGenerator<InteractStreamEvent, void, undefined> {
    yield *this.sseStream<InteractStreamEvent>(ALPHABET_ROUTES.interact, { ...payload, streaming: true });
  }

  /**
   * POST /api/voice/transcribe — تبدیل audio به text (multipart/form-data).
   * Auth: Bearer.
   *
   * @param visitorId - شناسه بازدیدکننده
   * @param sessionId - شناسه session
   * @param audioFile - فایل audio (mp3, wav, ogg)
   * @param language - کد زبان (اختیاری)
   * @param model - مدل Whisper (اختیاری)
   */
  async postVoiceTranscribe(
    visitorId: string,
    sessionId: string,
    audioFile: File | Blob,
    language?: string,
    model?: 'whisper-1',
  ): Promise<Result<VoiceTranscribeResponse, AlphabetError>> {
    const form = new FormData();
    form.append('visitorId', visitorId);
    form.append('sessionId', sessionId);
    form.append('audio', audioFile);
    if (language !== undefined) form.append('language', language);
    if (model !== undefined) form.append('model', model);
    return this.postForm<VoiceTranscribeResponse>(ALPHABET_ROUTES.voiceTranscribe, form);
  }

  /**
   * GET /api/suggestions — دریافت suggestionهای پویا بر اساس context.
   * Auth: None.
   */
  async getSuggestions(query: SuggestionsQuery): Promise<Result<SuggestionsResponse, AlphabetError>> {
    return this.get<SuggestionsResponse>(ALPHABET_ROUTES.suggestions, query as unknown as Record<string, unknown>, { noAuth: true });
  }

  // ── Group 3: Technology Pulse ─────────────────────────────────────────────

  /**
   * GET /api/technology-pulse — لیست سیگنال‌های technology با فیلتر.
   * Auth: None.
   */
  async getTechnologyPulse(query: TechnologyPulseQuery): Promise<Result<TechnologyPulseResponse, AlphabetError>> {
    return this.get<TechnologyPulseResponse>(ALPHABET_ROUTES.technologyPulse, query as unknown as Record<string, unknown>, { noAuth: true });
  }

  /**
   * POST /api/technology-pulse/brief — تولید خلاصه daily/weekly سیگنال‌ها.
   * Auth: Bearer.
   */
  async postTechnologyPulseBrief(payload: TechnologyPulseBriefRequest): Promise<Result<TechnologyPulseBriefResponse, AlphabetError>> {
    return this.post<TechnologyPulseBriefResponse>(ALPHABET_ROUTES.technologyPulseBrief, payload);
  }

  // ── Group 4: Memory ──────────────────────────────────────────────────────

  /**
   * POST /api/visitor/memory — ذخیره حافظه بازدیدکننده.
   * Auth: Bearer.
   */
  async postVisitorMemory(payload: StoreMemoryRequest): Promise<Result<StoreMemoryResponse, AlphabetError>> {
    return this.post<StoreMemoryResponse>(ALPHABET_ROUTES.visitorMemoryStore, payload);
  }

  /**
   * GET /api/visitor/memory — بازیابی حافظه بازدیدکننده.
   * Auth: Bearer.
   */
  async getVisitorMemory(query: GetMemoryQuery): Promise<Result<GetMemoryResponse, AlphabetError>> {
    return this.get<GetMemoryResponse>(ALPHABET_ROUTES.visitorMemoryRead, query as unknown as Record<string, unknown>);
  }

  /**
   * DELETE /api/visitor/memory — حذف حافظه (GDPR Art. 17 / CCPA).
   * Auth: Bearer.
   */
  async deleteVisitorMemory(payload: EraseMemoryRequest): Promise<Result<EraseMemoryResponse, AlphabetError>> {
    return this.delete<EraseMemoryResponse>(ALPHABET_ROUTES.visitorMemoryDelete, payload);
  }

  // ── Group 5: OpenClaw Mesh ────────────────────────────────────────────────

  /**
   * POST /api/claw/query — جستجوی یکپارچه در Memory Mesh.
   * Auth: Bearer.
   */
  async postClawQuery(payload: ClawQueryRequest): Promise<Result<ClawQueryResponse, AlphabetError>> {
    return this.post<ClawQueryResponse>(ALPHABET_ROUTES.clawQuery, payload);
  }

  /**
   * POST /api/claw/ingest — ingestion محتوا به Memory Mesh.
   * Auth: API Key.
   */
  async postClawIngest(payload: ClawIngestRequest): Promise<Result<ClawIngestResponse, AlphabetError>> {
    return this.post<ClawIngestResponse>(ALPHABET_ROUTES.clawIngest, payload, { apiKey: true });
  }

  /**
   * POST /api/claw/admin/audit — بازرسی و مدیریت حافظه (admin only).
   * Auth: API Key (Admin).
   */
  async postClawAdminAudit(payload: ClawAdminAuditRequest): Promise<Result<ClawAdminAuditResponse, AlphabetError>> {
    return this.post<ClawAdminAuditResponse>(ALPHABET_ROUTES.clawAdminAudit, payload, { apiKey: true });
  }

  // ── Group 6: Admin ────────────────────────────────────────────────────────

  /**
   * GET /api/admin/visitor-insights — داشبورد admin با داده‌های aggregate.
   * Auth: API Key (Admin).
   */
  async getAdminVisitorInsights(query: VisitorInsightsQuery): Promise<Result<VisitorInsightsResponse, AlphabetError>> {
    return this.get<VisitorInsightsResponse>(ALPHABET_ROUTES.adminVisitorInsights, query as unknown as Record<string, unknown>, { apiKey: true });
  }

  /**
   * GET /api/admin/technology-pulse/sources — مدیریت منابع Technology Pulse.
   * Auth: API Key (Admin).
   */
  async getAdminPulseSources(query: PulseSourcesQuery): Promise<Result<PulseSourcesResponse, AlphabetError>> {
    return this.get<PulseSourcesResponse>(ALPHABET_ROUTES.adminPulseSources, query as unknown as Record<string, unknown>, { apiKey: true });
  }

  // ── Private: Auth Headers ─────────────────────────────────────────────────

  private authHeaders(opts: { noAuth?: boolean; apiKey?: boolean } = {}): Record<string, string> {
    if (opts.noAuth === true) return {};
    if (opts.apiKey === true && this.apiKey !== undefined) {
      return { 'X-API-Key': this.apiKey };
    }
    if (this.bearerToken !== undefined) {
      return { Authorization: `Bearer ${this.bearerToken}` };
    }
    return {};
  }

  // ── Private: URL Builder ──────────────────────────────────────────────────

  private buildUrl(path: string, params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, String(v));
      } else {
        qs.set(key, String(value));
      }
    }
    const search = qs.toString();
    return search !== '' ? `${this.base}${path}?${search}` : `${this.base}${path}`;
  }

  // ── Private: Fetch With Timeout ───────────────────────────────────────────

  private fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // ── Private: Core Request ─────────────────────────────────────────────────

  private async doRequest<T>(
    url: string,
    init: RequestInit,
    attempt: number,
  ): Promise<Result<T, AlphabetError>> {
    try {
      const response = await this.fetchWithTimeout(url, init);

      if (!response.ok) {
        if (response.status >= 500 && attempt < this.maxRetries) {
          return this.doRequest<T>(url, init, attempt + 1);
        }
        const body = await response.json().catch(() => null) as { error?: AlphabetError } | null;
        return err(body?.error ?? {
          code: 'HTTP_ERROR',
          message: `Request failed with HTTP ${response.status}`,
          details: { status: response.status, attempt },
        });
      }

      const json = await response.json() as T & { success?: boolean; error?: AlphabetError };
      if (json.success === false) {
        return err(json.error ?? { code: 'API_ERROR', message: 'Server returned an unsuccessful response' });
      }
      return ok(json as T);
    } catch (e) {
      if (attempt < this.maxRetries) {
        return this.doRequest<T>(url, init, attempt + 1);
      }
      return err({
        code: 'NETWORK_ERROR',
        message: 'Network error during request',
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // ── Private: HTTP Verb Helpers ────────────────────────────────────────────

  private post<T>(
    path: string,
    payload: unknown,
    opts: { noAuth?: boolean; apiKey?: boolean } = {},
  ): Promise<Result<T, AlphabetError>> {
    return this.doRequest<T>(
      `${this.base}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(opts) },
        body: JSON.stringify(payload),
      },
      0,
    );
  }

  private get<T>(
    path: string,
    params: Record<string, unknown> = {},
    opts: { noAuth?: boolean; apiKey?: boolean } = {},
  ): Promise<Result<T, AlphabetError>> {
    return this.doRequest<T>(
      this.buildUrl(path, params),
      { method: 'GET', headers: { ...this.authHeaders(opts) } },
      0,
    );
  }

  private delete<T>(
    path: string,
    payload: unknown,
    opts: { noAuth?: boolean; apiKey?: boolean } = {},
  ): Promise<Result<T, AlphabetError>> {
    return this.doRequest<T>(
      `${this.base}${path}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(opts) },
        body: JSON.stringify(payload),
      },
      0,
    );
  }

  private postForm<T>(
    path: string,
    form: FormData,
    opts: { noAuth?: boolean; apiKey?: boolean } = {},
  ): Promise<Result<T, AlphabetError>> {
    return this.doRequest<T>(
      `${this.base}${path}`,
      { method: 'POST', headers: { ...this.authHeaders(opts) }, body: form },
      0,
    );
  }

  // ── Private: SSE Streaming ────────────────────────────────────────────────

  private async *sseStream<T>(path: string, payload: unknown): AsyncGenerator<T, void, undefined> {
    const controller = new AbortController();
    // Streaming uses a 6x longer timeout
    const timer = setTimeout(() => controller.abort(), this.timeoutMs * 6);
    try {
      const response = await fetch(`${this.base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || response.body === null) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '' || data === '[DONE]') continue;
          try {
            yield JSON.parse(data) as T;
          } catch {
            // ignore malformed SSE event data
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
