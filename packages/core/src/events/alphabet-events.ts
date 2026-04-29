/**
 * @module events
 * @description
 * AlphabetEventEmitter — event emitter typed با priority و once support.
 * Typed event emitter with priority queue and one-time listeners.
 */

// ─── Event Map ────────────────────────────────────────────────────────────────

/**
 * نقشه رویدادهای Alphabet — نوع payload هر رویداد.
 * Event map: event name → payload type.
 */
export interface AlphabetEventMap {
  /** handshake کامل شد */
  'handshake:complete': { readonly sessionId: string; readonly layer: string };
  /** handshake در یک فاز خطا داد */
  'handshake:error': { readonly phase: string; readonly code: string; readonly message: string };
  /** consent بازدیدکننده تغییر کرد */
  'consent:changed': { readonly from: string; readonly to: string };
  /** یک توکن LLM مصرف شد */
  'token:used': { readonly tokensUsed: number; readonly tokensRemaining: number };
  /** یک entry در memory ذخیره شد */
  'memory:stored': { readonly domain: string; readonly key: string };
  /** یک entry از memory حذف شد */
  'memory:cleared': { readonly domain: string; readonly count: number };
  /** runtime loop heartbeat */
  'runtime:heartbeat': { readonly timestamp: string };
  /** خطای غیرمنتظره */
  'error': { readonly code: string; readonly message: string };
}

/** نام‌های رویدادهای موجود */
export type AlphabetEventName = keyof AlphabetEventMap;

// ─── Listener ────────────────────────────────────────────────────────────────

/** نوع listener برای یک رویداد */
export type AlphabetEventListener<K extends AlphabetEventName> = (
  payload: AlphabetEventMap[K]
) => void;

/** listener با priority و once flag */
interface ListenerEntry<K extends AlphabetEventName> {
  readonly listener: AlphabetEventListener<K>;
  readonly priority: number;
  readonly once: boolean;
}

// ─── AlphabetEventEmitter Class ───────────────────────────────────────────────────

/**
 * Event emitter typed با priority queue و once support.
 *
 * @example
 * const emitter = new AlphabetEventEmitter();
 *
 * emitter.on('handshake:complete', ({ sessionId, layer }) => {
 *   console.log(`Handshake done: session=${sessionId}, layer=${layer}`);
 * });
 *
 * emitter.once('consent:changed', ({ from, to }) => {
 *   console.log(`Consent: ${from} → ${to}`);
 * });
 *
 * emitter.emit('handshake:complete', { sessionId: 'sess-abc', layer: 'STATIC_HTML' });
 */
export class AlphabetEventEmitter {
  private readonly listeners = new Map<
    AlphabetEventName,
    ListenerEntry<AlphabetEventName>[]
  >();

  /**
   * ثبت listener برای یک رویداد.
   *
   * @param event - نام رویداد
   * @param listener - تابع listener
   * @param priority - اولویت (بیشتر = اجرا زودتر) — پیش‌فرض: 0
   * @returns this برای chaining
   */
  on<K extends AlphabetEventName>(
    event: K,
    listener: AlphabetEventListener<K>,
    priority = 0
  ): this {
    return this.addListener(event, listener, priority, false);
  }

  /**
   * ثبت listener یک‌بار مصرف.
   *
   * @param event - نام رویداد
   * @param listener - تابع listener
   * @param priority - اولویت — پیش‌فرض: 0
   * @returns this برای chaining
   */
  once<K extends AlphabetEventName>(
    event: K,
    listener: AlphabetEventListener<K>,
    priority = 0
  ): this {
    return this.addListener(event, listener, priority, true);
  }

  /**
   * حذف listener.
   *
   * @param event - نام رویداد
   * @param listener - تابع listener که باید حذف شود
   * @returns this برای chaining
   */
  off<K extends AlphabetEventName>(
    event: K,
    listener: AlphabetEventListener<K>
  ): this {
    const entries = this.listeners.get(event);
    if (!entries) return this;

    const filtered = entries.filter(
      (e) => e.listener !== (listener as AlphabetEventListener<AlphabetEventName>)
    );

    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }

    return this;
  }

  /**
   * emit یک رویداد به همه listenerهای ثبت‌شده (به ترتیب priority).
   *
   * @param event - نام رویداد
   * @param payload - داده رویداد
   */
  emit<K extends AlphabetEventName>(
    event: K,
    payload: AlphabetEventMap[K]
  ): void {
    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    // مرتب‌سازی بر اساس priority (نزولی)
    const sorted = [...entries].sort((a, b) => b.priority - a.priority);

    // listenerهای once را جمع‌آوری می‌کنیم تا حذف کنیم
    const toRemove: AlphabetEventListener<AlphabetEventName>[] = [];

    for (const entry of sorted) {
      entry.listener(payload as AlphabetEventMap[AlphabetEventName]);
      if (entry.once) {
        toRemove.push(entry.listener);
      }
    }

    // حذف listenerهای once
    if (toRemove.length > 0) {
      const remaining = entries.filter((e) => !toRemove.includes(e.listener));
      if (remaining.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, remaining);
      }
    }
  }

  /**
   * حذف تمام listenerهای یک رویداد.
   *
   * @param event - نام رویداد
   */
  removeAllListeners(event?: AlphabetEventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * تعداد listenerهای فعال برای یک رویداد.
   *
   * @param event - نام رویداد
   * @returns تعداد listener
   */
  listenerCount(event: AlphabetEventName): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * افزودن listener به map (helper داخلی).
   */
  private addListener<K extends AlphabetEventName>(
    event: K,
    listener: AlphabetEventListener<K>,
    priority: number,
    once: boolean
  ): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push({
      listener: listener as AlphabetEventListener<AlphabetEventName>,
      priority,
      once,
    });
    this.listeners.set(event, existing);
    return this;
  }
}
