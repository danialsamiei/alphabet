/**
 * @file components/AlefAgent.tsx
 * @description
 * Invisible Ethical Alef Agent — floating micro co-pilot that offers to
 * simplify the current section or switch the active render layer.
 *
 * The agent is "invisible" by default: a single ﺍ (Alef) FAB in the
 * corner. When opened, it surfaces context-aware suggestions, never
 * interrupts the user, and never talks over them.
 *
 * Ethical contract:
 *  - Suggestions are *offered*, never auto-applied. The agent only acts
 *    when the user explicitly clicks an action button.
 *  - The agent reads only public UI state passed via props — it never
 *    inspects consent state or memory it isn't allowed to.
 *  - When `prefersReducedMotion` is set, no animations run.
 *  - The agent collapses to NO_MEMORY mode when DNT/GPC are honored
 *    upstream — it has no storage of its own.
 */

import { useEffect, useId, useRef, useState } from 'react';

export type AlefSuggestionAction =
  | { readonly kind: 'switch-layer'; readonly to: 'CSS_3D' | 'CANVAS_2D' | 'STATIC_HTML' | 'TEXT_ONLY' }
  | { readonly kind: 'jump-to-tab'; readonly tab: string }
  | { readonly kind: 'simplify' }
  | { readonly kind: 'dismiss' };

export interface AlefSuggestion {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly actions: ReadonlyArray<{
    readonly label: string;
    readonly action: AlefSuggestionAction;
    readonly primary?: boolean;
  }>;
}

interface AlefAgentProps {
  readonly suggestions: ReadonlyArray<AlefSuggestion>;
  readonly onAction: (action: AlefSuggestionAction) => void;
  readonly localeKey: 'en-US' | 'fa-IR' | 'ar-SA';
}

/**
 * Floating Alef Agent FAB + panel.
 *
 * Renders a fixed-position circular button in the corner. Pressing it
 * opens a glass panel listing the currently relevant suggestions. The
 * panel auto-closes on Escape and on outside clicks.
 */
export function AlefAgent({
  suggestions,
  onAction,
  localeKey,
}: AlefAgentProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent): void => {
      const target = e.target as Node | null;
      if (
        target !== null &&
        panelRef.current !== null &&
        !panelRef.current.contains(target) &&
        fabRef.current !== null &&
        !fabRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const greeting =
    localeKey === 'fa-IR'
      ? 'سلام، من «الف» هستم.'
      : localeKey === 'ar-SA'
        ? 'مرحبًا، أنا «أَلِف».'
        : 'Hi — I’m Alef.';

  const tagline =
    localeKey === 'fa-IR'
      ? 'پیشنهادهای کوچک، بدون قطع کردن شما.'
      : localeKey === 'ar-SA'
        ? 'اقتراحات صغيرة، دون مقاطعتك.'
        : 'Small suggestions — never interrupting you.';

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="alf-agent-fab"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          localeKey === 'fa-IR'
            ? 'باز کردن دستیار الف'
            : localeKey === 'ar-SA'
              ? 'فتح مساعد ألف'
              : 'Open the Alef agent'
        }
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">ﺍ</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="alf-agent-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Alef agent suggestions"
        >
          <header>
            <span className="alf-agent-avatar" aria-hidden="true">
              ﺍ
            </span>
            <div>
              <strong style={{ display: 'block' }}>{greeting}</strong>
              <span className="alf-muted" style={{ fontSize: '0.82rem' }}>
                {tagline}
              </span>
            </div>
          </header>

          {suggestions.length === 0 ? (
            <p className="alf-muted">
              {localeKey === 'fa-IR'
                ? 'فعلاً پیشنهادی ندارم — تجربه‌تان عالی به‌نظر می‌رسد.'
                : localeKey === 'ar-SA'
                  ? 'لا اقتراحات الآن — تجربتك تبدو رائعة.'
                  : 'No suggestions right now — your experience looks great.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
              {suggestions.map((s) => (
                <li key={s.id} className="alf-agent-suggestion">
                  <strong>{s.title}</strong>
                  <span>{s.body}</span>
                  <div className="alf-agent-actions">
                    {s.actions.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        className={
                          a.primary === true
                            ? 'alf-btn alf-btn-primary alf-btn-sm'
                            : 'alf-btn alf-btn-ghost alf-btn-sm'
                        }
                        onClick={() => {
                          onAction(a.action);
                          if (a.action.kind === 'dismiss') setOpen(false);
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="alf-muted" style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>
            {localeKey === 'fa-IR'
              ? 'الف هیچ‌چیز ذخیره نمی‌کند. هر کلیک شما، یک تصمیم آگاهانه است.'
              : localeKey === 'ar-SA'
                ? 'ألف لا يخزن أي شيء. كل نقرة قرار واعٍ.'
                : 'Alef stores nothing. Every click is your conscious decision.'}
          </p>
        </div>
      ) : null}
    </>
  );
}
