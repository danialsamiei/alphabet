/**
 * @module events
 * @description
 * AWAFEventEmitter — event emitter typed با priority و once support.
 * Typed event emitter with priority queue and one-time listeners.
 */
/**
 * نقشه رویدادهای AWAF — نوع payload هر رویداد.
 * Event map: event name → payload type.
 */
export interface AWAFEventMap {
    /** handshake کامل شد */
    'handshake:complete': {
        readonly sessionId: string;
        readonly layer: string;
    };
    /** handshake در یک فاز خطا داد */
    'handshake:error': {
        readonly phase: string;
        readonly code: string;
        readonly message: string;
    };
    /** consent بازدیدکننده تغییر کرد */
    'consent:changed': {
        readonly from: string;
        readonly to: string;
    };
    /** یک توکن LLM مصرف شد */
    'token:used': {
        readonly tokensUsed: number;
        readonly tokensRemaining: number;
    };
    /** یک entry در memory ذخیره شد */
    'memory:stored': {
        readonly domain: string;
        readonly key: string;
    };
    /** یک entry از memory حذف شد */
    'memory:cleared': {
        readonly domain: string;
        readonly count: number;
    };
    /** runtime loop heartbeat */
    'runtime:heartbeat': {
        readonly timestamp: string;
    };
    /** خطای غیرمنتظره */
    'error': {
        readonly code: string;
        readonly message: string;
    };
}
/** نام‌های رویدادهای موجود */
export type AWAFEventName = keyof AWAFEventMap;
/** نوع listener برای یک رویداد */
export type AWAFEventListener<K extends AWAFEventName> = (payload: AWAFEventMap[K]) => void;
/**
 * Event emitter typed با priority queue و once support.
 *
 * @example
 * const emitter = new AWAFEventEmitter();
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
export declare class AWAFEventEmitter {
    private readonly listeners;
    /**
     * ثبت listener برای یک رویداد.
     *
     * @param event - نام رویداد
     * @param listener - تابع listener
     * @param priority - اولویت (بیشتر = اجرا زودتر) — پیش‌فرض: 0
     * @returns this برای chaining
     */
    on<K extends AWAFEventName>(event: K, listener: AWAFEventListener<K>, priority?: number): this;
    /**
     * ثبت listener یک‌بار مصرف.
     *
     * @param event - نام رویداد
     * @param listener - تابع listener
     * @param priority - اولویت — پیش‌فرض: 0
     * @returns this برای chaining
     */
    once<K extends AWAFEventName>(event: K, listener: AWAFEventListener<K>, priority?: number): this;
    /**
     * حذف listener.
     *
     * @param event - نام رویداد
     * @param listener - تابع listener که باید حذف شود
     * @returns this برای chaining
     */
    off<K extends AWAFEventName>(event: K, listener: AWAFEventListener<K>): this;
    /**
     * emit یک رویداد به همه listenerهای ثبت‌شده (به ترتیب priority).
     *
     * @param event - نام رویداد
     * @param payload - داده رویداد
     */
    emit<K extends AWAFEventName>(event: K, payload: AWAFEventMap[K]): void;
    /**
     * حذف تمام listenerهای یک رویداد.
     *
     * @param event - نام رویداد
     */
    removeAllListeners(event?: AWAFEventName): void;
    /**
     * تعداد listenerهای فعال برای یک رویداد.
     *
     * @param event - نام رویداد
     * @returns تعداد listener
     */
    listenerCount(event: AWAFEventName): number;
    /**
     * افزودن listener به map (helper داخلی).
     */
    private addListener;
}
//# sourceMappingURL=awaf-events.d.ts.map