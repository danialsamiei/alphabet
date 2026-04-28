/**
 * @module handshake/pipeline/step
 * @description
 * Typed pipeline primitives for the handshake — composable `Step<I, O>`
 * units with `AbortSignal` cancellation and structured tracing. **Pure,
 * dependency-free, edge-safe.**
 *
 * Design notes
 * ─────────────
 * - A `Step<I, O>` is `(input, ctx) => Promise<Result<O, AWAFError>>`.
 *   It MUST NOT throw; any failure path is reported via `Result.err`.
 * - `compose(a, b)` short-circuits on first failure; the resulting step
 *   has type `Step<A_in, B_out>`.
 * - `parallel({ k: stepK, ... })` runs siblings concurrently and combines
 *   them into a single object output. Cancellation propagates instantly.
 * - Every step receives a `StepContext` carrying the shared `AbortSignal`,
 *   `Tracer`, and a `now()` clock — all replaceable for tests.
 *
 * This module **wraps**, not replaces, `SignalCollector` and
 * `EnrichmentPipeline`. The legacy classes still ship as-is; the pipeline
 * primitives let internal code (and adventurous consumers) compose new
 * collect/enrich flows with cancellation + retries + tracing for free.
 */

import { type AWAFError, type Result, err } from '../../types/result.js';
import { type Tracer, noopTracer, type SpanAttributes } from './trace.js';

// ─── Context ──────────────────────────────────────────────────────────────────

/** بافتار اجرای یک Step — قابل تزریق در تست. */
export interface StepContext {
  /** signal مشترک برای لغو زنجیره */
  readonly signal?: AbortSignal;
  /** tracer برای spanهای ساختاری — پیش‌فرض no-op */
  readonly tracer: Tracer;
  /** ساعت قابل تعویض — پیش‌فرض Date.now */
  readonly now: () => number;
}

/** گزینه‌های ساخت یک StepContext از مقادیر اختیاری. */
export interface StepContextOptions {
  readonly signal?: AbortSignal;
  readonly tracer?: Tracer;
  readonly now?: () => number;
}

/** ساخت یک StepContext با پیش‌فرض‌های ایمن. */
export function makeStepContext(options: StepContextOptions = {}): StepContext {
  const base = {
    tracer: options.tracer ?? noopTracer,
    now: options.now ?? ((): number => Date.now()),
  };
  return options.signal !== undefined ? { ...base, signal: options.signal } : base;
}

// ─── Step ─────────────────────────────────────────────────────────────────────

/** یک واحد اجرای async که `Result<O, AWAFError>` برمی‌گرداند. */
export interface Step<I, O> {
  readonly name: string;
  run(input: I, ctx: StepContext): Promise<Result<O, AWAFError>>;
}

/**
 * یک Step از یک تابع ساده می‌سازد. تابع نباید throw کند — تمام failureها
 * باید `Result.err` برگردانند. اگر throw کند، تابع به `STEP_THREW` تبدیل
 * می‌شود.
 */
export function defineStep<I, O>(
  name: string,
  fn: (input: I, ctx: StepContext) => Promise<Result<O, AWAFError>> | Result<O, AWAFError>,
  attributes?: SpanAttributes,
): Step<I, O> {
  return {
    name,
    async run(input, ctx) {
      if (ctx.signal?.aborted === true) return err(abortedError(name));

      const span = ctx.tracer.startSpan(name, attributes);
      try {
        const r = await fn(input, ctx);
        if (r.success) {
          span.end();
          return r;
        }
        span.fail(r.error.code);
        return r;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        span.fail('STEP_THREW');
        return err({
          code: 'STEP_THREW',
          message: `Step "${name}" threw: ${message}`,
          details: { step: name },
        });
      }
    },
  };
}

/**
 * یک Step که فقط input را پاس می‌دهد — برای ساخت زنجیره‌های همگن مفید است.
 */
export function identityStep<T>(name = 'identity'): Step<T, T> {
  return defineStep(name, (input) =>
    ({ success: true, data: input }) as const,
  );
}

// ─── Compose ──────────────────────────────────────────────────────────────────

/**
 * دو Step را به‌صورت پیوسته اجرا می‌کند: `b ∘ a`.
 * شکست `a` بدون فراخوانی `b` به‌صورت Result.err منتشر می‌شود.
 */
export function compose<A, B, C>(a: Step<A, B>, b: Step<B, C>): Step<A, C> {
  return {
    name: `${a.name}→${b.name}`,
    async run(input, ctx) {
      const ra = await a.run(input, ctx);
      if (!ra.success) return ra;
      if (ctx.signal?.aborted === true) return err(abortedError(b.name));
      return b.run(ra.data, ctx);
    },
  };
}

/**
 * زنجیره‌سازی n-تایی: `pipe(a, b, c, d)` = `compose(compose(compose(a,b),c),d)`.
 * Type-safe برای ۲ تا ۴ گام؛ برای زنجیره‌های بلندتر، `compose` تو در تو شود.
 */
export function pipe<A, B, C>(a: Step<A, B>, b: Step<B, C>): Step<A, C>;
export function pipe<A, B, C, D>(a: Step<A, B>, b: Step<B, C>, c: Step<C, D>): Step<A, D>;
export function pipe<A, B, C, D, E>(
  a: Step<A, B>, b: Step<B, C>, c: Step<C, D>, d: Step<D, E>,
): Step<A, E>;
export function pipe(...steps: ReadonlyArray<Step<unknown, unknown>>): Step<unknown, unknown> {
  if (steps.length === 0) throw new Error('pipe requires at least one step');
  return steps.reduce((acc, s) => compose(acc, s));
}

// ─── Parallel ─────────────────────────────────────────────────────────────────

/** نگاشت نام→Step که خروجی هر کدام به یک کلید همان نام نگاشت می‌شود. */
export type ParallelMap<I, O extends Record<string, unknown>> = {
  readonly [K in keyof O]: Step<I, O[K]>;
};

/**
 * Stepهای موازی را با همان ورودی اجرا می‌کند و خروجی‌ها را در یک object جمع
 * می‌کند. اگر هر کدام شکست بخورد، اولین شکست برگردانده می‌شود (بقیه با signal
 * لغو می‌شوند، اگر AbortController داخلی موجود باشد).
 */
export function parallel<I, O extends Record<string, unknown>>(
  steps: ParallelMap<I, O>,
  options: { readonly name?: string } = {},
): Step<I, O> {
  const keys = Object.keys(steps) as Array<keyof O & string>;
  return {
    name: options.name ?? `parallel(${keys.join(',')})`,
    async run(input, ctx) {
      if (ctx.signal?.aborted === true) {
        return err(abortedError(this.name));
      }

      const span = ctx.tracer.startSpan(this.name);
      const inner = new AbortController();
      const onOuterAbort = (): void => inner.abort();
      ctx.signal?.addEventListener('abort', onOuterAbort, { once: true });

      const innerCtx: StepContext = { ...ctx, signal: inner.signal };

      try {
        const results = await Promise.all(
          keys.map((k) => steps[k].run(input, innerCtx)),
        );

        const partial = {} as Record<keyof O & string, unknown>;
        for (let i = 0; i < keys.length; i++) {
          const r = results[i] as Result<O[typeof keys[number]], AWAFError>;
          if (!r.success) {
            inner.abort();
            span.fail(r.error.code);
            return r;
          }
          partial[keys[i] as keyof O & string] = r.data;
        }
        span.end();
        return { success: true, data: partial as O } as const;
      } finally {
        ctx.signal?.removeEventListener('abort', onOuterAbort);
      }
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function abortedError(stepName: string): AWAFError {
  return {
    code: 'STEP_ABORTED',
    message: `Step "${stepName}" aborted via AbortSignal`,
    details: { step: stepName },
  };
}
