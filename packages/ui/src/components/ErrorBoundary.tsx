/**
 * @module components/ErrorBoundary
 * @description
 * `<ErrorBoundary>` — یک React Error Boundary عمومی برای محافظت از زیردرخت
 * UI در برابر خطاهای رندر / lifecycle. تجربه‌ی پیش‌فرض fallback به‌صورت
 * accessible، بومی‌سازی‌پذیر و قابل reset طراحی شده است.
 *
 * Public, reusable React Error Boundary for `@alphabet/ui`.
 *
 * Goals:
 * - **Graceful degradation:** crashes in any subtree render an
 *   accessible fallback instead of unmounting the whole app.
 * - **No PII in logs:** the default `onError` hook receives only the
 *   `Error.message` and component stack — never DOM nodes or props.
 * - **Recoverable:** consumers can supply a `resetKeys` array; if any
 *   value changes, the boundary resets and re-renders children. Or
 *   render-prop fallbacks can call the provided `reset()` callback.
 * - **Bundle-friendly:** zero runtime dependencies beyond React.
 *
 * @example Basic usage
 * ```tsx
 * <ErrorBoundary
 *   fallback={<p role="alert">Something went wrong.</p>}
 *   onError={(err) => analytics.track('ui:error', { message: err.message })}
 * >
 *   <RiskySubtree />
 * </ErrorBoundary>
 * ```
 *
 * @example Render-prop fallback with reset
 * ```tsx
 * <ErrorBoundary
 *   resetKeys={[currentRoute]}
 *   fallback={({ error, reset }) => (
 *     <section role="alert">
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Try again</button>
 *     </section>
 *   )}
 * >
 *   <Page />
 * </ErrorBoundary>
 * ```
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Render-prop signature for advanced fallbacks. Receives the captured
 * error and a `reset()` callback that clears the boundary's error
 * state and re-renders children.
 */
export type ErrorBoundaryFallbackRender = (args: {
  readonly error: Error;
  readonly reset: () => void;
}) => ReactNode;

/**
 * Props for {@link ErrorBoundary}.
 */
export interface ErrorBoundaryProps {
  /** Subtree to protect. */
  readonly children: ReactNode;
  /**
   * Fallback UI to render when an error is captured. Either a
   * `ReactNode` (static) or a render-prop function receiving the
   * error + `reset()` callback.
   */
  readonly fallback?: ReactNode | ErrorBoundaryFallbackRender;
  /**
   * Optional error sink. Called once per captured error with the
   * `Error` instance and React `ErrorInfo` (component stack only).
   * Implementations **must not** log PII.
   */
  readonly onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * If any value in `resetKeys` changes between renders, the boundary
   * resets and re-renders its children. Useful for route changes.
   */
  readonly resetKeys?: ReadonlyArray<unknown>;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic React Error Boundary.
 *
 * The component itself never throws, never persists state, and never
 * touches `document`/`window` outside of React's lifecycle — it is
 * SSR-safe by construction.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError !== undefined) {
      try {
        this.props.onError(error, info);
      } catch {
        // The error sink itself failed — swallow to avoid an infinite loop.
        // Consumers are responsible for non-throwing sinks.
      }
    }
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error === null) return;
    if (!keysChanged(prev.resetKeys, this.props.resetKeys)) return;
    this.reset();
  }

  /** Public method to programmatically clear the captured error. */
  reset = (): void => {
    if (this.state.error !== null) this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') {
      return (fallback as ErrorBoundaryFallbackRender)({ error, reset: this.reset });
    }
    if (fallback !== undefined) return fallback;

    // Default fallback — minimal, accessible, locale-neutral. Consumers
    // who care about copy / styling should pass `fallback`.
    return (
      <div role="alert" aria-live="assertive" data-alphabet-error-boundary="">
        <p>{error.message || 'Something went wrong.'}</p>
      </div>
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function keysChanged(
  prev: ReadonlyArray<unknown> | undefined,
  next: ReadonlyArray<unknown> | undefined
): boolean {
  if (prev === next) return false;
  if (prev === undefined || next === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}
