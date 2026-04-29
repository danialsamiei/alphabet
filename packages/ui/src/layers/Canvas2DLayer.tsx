/**
 * @module layers/Canvas2DLayer
 * @description
 * لایه ۳ — Canvas 2D با initialization تنبل.
 * Layer 3 — HTML5 Canvas 2D layer. Heavy initialization (animation
 * frame loop, particle setup) is deferred until after mount and is
 * only started in the browser. SSR returns the static fallback markup.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { isBrowser } from '../runtime/hydration-safe.js';

export interface Canvas2DLayerProps {
  readonly heading?: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly direction?: 'ltr' | 'rtl';
  readonly locale?: string;
  /**
   * Renderer سفارشی — اگر undefined باشد، یک ambient gradient ثابت
   * (no-animation) رسم می‌شود. اگر prefers-reduced-motion فعال است،
   * caller باید اصلاً این لایه را انتخاب نکند (selector این کار را می‌کند).
   *
   * Returns an optional cleanup function (e.g. cancelAnimationFrame).
   */
  readonly draw?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void | (() => void);
  /** آیا canvas decorative است (نه informational). پیش‌فرض `true`. */
  readonly decorative?: boolean;
}

function defaultDraw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const { width, height } = canvas;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * لایه Canvas 2D — درخت DOM همیشه render می‌شود اما drawing فقط
 * پس از mount روی client اجرا می‌شود.
 */
export function Canvas2DLayer({
  heading = 'Alphabet',
  description,
  children,
  direction = 'ltr',
  locale,
  draw,
  decorative = true,
}: Canvas2DLayerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isBrowser()) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    // اندازه را به اندازه بصری wrapper تنظیم می‌کنیم.
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    const cleanup = (draw ?? defaultDraw)(ctx, canvas);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [draw]);

  return (
    <section
      data-alphabet-layer="CANVAS_2D"
      dir={direction}
      {...(locale !== undefined ? { lang: locale } : {})}
      style={{
        position: 'relative',
        minHeight: '12rem',
        padding: '1.5rem',
        fontFamily: 'system-ui, sans-serif',
      }}
      aria-label="Alphabet canvas layer"
    >
      <canvas
        ref={canvasRef}
        aria-hidden={decorative}
        {...(decorative ? {} : { role: 'img' as const })}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ margin: 0 }}>{heading}</h1>
        {description !== undefined ? <p>{description}</p> : null}
        {children}
      </div>
    </section>
  );
}

export default Canvas2DLayer;
