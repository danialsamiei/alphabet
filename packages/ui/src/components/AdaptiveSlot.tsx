/**
 * @module components/AdaptiveSlot
 * @description
 * AdaptiveSlot — بر اساس `useAdaptiveLayer` لایه را انتخاب می‌کند و
 * render prop مربوط به همان لایه را فراخوانی می‌کند.
 *
 * Behavior:
 *  - Each render prop is optional; missing render props automatically
 *    fall back down the chain (R3F → CSS3D → Canvas2D → StaticHtml →
 *    TextOnly).
 *  - R3F is loaded via `React.lazy` so the base bundle never imports
 *    `@react-three/fiber`. The lazy promise is wrapped in
 *    `<Suspense>` and an `<R3FErrorBoundary>` that gracefully falls
 *    back to the next layer if loading or rendering fails.
 *  - SSR-safe: during SSR / pre-hydration, `useAdaptiveLayer` returns
 *    `STATIC_HTML` so any server-rendered HTML is stable and free of
 *    browser-only APIs.
 */

import {
  Component,
  Suspense,
  lazy,
  useMemo,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  useAdaptiveLayer,
  type UseAdaptiveLayerOptions,
  type UseAdaptiveLayerReturn,
} from '../hooks/useAdaptiveLayer.js';
import { useAlphabetContext } from './AlphabetProvider.js';
import {
  ADAPTIVE_LAYER_FALLBACK_CHAIN,
  type AdaptiveLayer,
} from '../runtime/layer-selector.js';

/** Render prop signature — همه لایه‌ها همین context را دریافت می‌کنند. */
export interface AdaptiveRenderContext {
  readonly layer: AdaptiveLayer;
  readonly direction: 'ltr' | 'rtl';
  readonly locale: string | null;
  readonly reason: string;
}

export type AdaptiveRenderer = (ctx: AdaptiveRenderContext) => ReactNode;

export interface AdaptiveSlotProps extends UseAdaptiveLayerOptions {
  readonly r3f?: AdaptiveRenderer;
  readonly css3d?: AdaptiveRenderer;
  readonly canvas2d?: AdaptiveRenderer;
  readonly staticHtml?: AdaptiveRenderer;
  readonly textOnly?: AdaptiveRenderer;
  /** نمایش fallback در حالی که R3F lazy load می‌شود. */
  readonly r3fFallback?: ReactNode;
}

// ─── Lazy R3F loader ─────────────────────────────────────────────────────────
//
// React.lazy نیاز دارد به یک ماژول با default export از نوع
// ComponentType. ما یک wrapper کوچک می‌نویسیم که render prop r3f را
// فراخوانی می‌کند. import پویا تضمین می‌کند که R3F فقط هنگامی که
// لایه R3F انتخاب شد در bundle قرار می‌گیرد.
type R3FLazyProps = { readonly render: AdaptiveRenderer; readonly ctx: AdaptiveRenderContext };

const LazyR3FLayer = lazy<ComponentType<R3FLazyProps>>(async () => {
  const mod = await import('../layers/R3FImmersiveLayer.lazy.js');
  const Layer = mod.R3FImmersiveLayer;
  const Wrapper: ComponentType<R3FLazyProps> = ({ render, ctx }) => (
    <Layer
      direction={ctx.direction}
      scene={render(ctx)}
      {...(ctx.locale !== null ? { locale: ctx.locale } : {})}
    />
  );
  // satisfy lazy: export default
  return { default: Wrapper };
});

// ─── Error boundary برای fallback نرم در صورت crash R3F ──────────────────────

interface BoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface BoundaryState {
  readonly error: Error | null;
}

class LayerErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError !== undefined) this.props.onError(error, info);
  }

  override render(): ReactNode {
    if (this.state.error !== null) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * در زنجیره fallback، اولین رندر موجود از `start` به پایین را انتخاب می‌کند.
 * Walks the canonical fallback chain starting at `start` and returns
 * the first layer whose renderer is provided.
 */
function pickRenderer(
  start: AdaptiveLayer,
  renderers: Partial<Record<AdaptiveLayer, AdaptiveRenderer>>
): { layer: AdaptiveLayer; renderer: AdaptiveRenderer } | null {
  const chain = ADAPTIVE_LAYER_FALLBACK_CHAIN.slice(
    ADAPTIVE_LAYER_FALLBACK_CHAIN.indexOf(start)
  );
  for (const candidate of chain) {
    const fn = renderers[candidate];
    if (fn !== undefined) return { layer: candidate, renderer: fn };
  }
  return null;
}

// ─── AdaptiveSlot ────────────────────────────────────────────────────────────

/**
 * AdaptiveSlot — انتخاب لایه + render.
 *
 * @example
 * <AdaptiveSlot
 *   r3f={(ctx) => <ImmersiveScene />}
 *   css3d={(ctx) => <Css3DLayer heading="Hi" />}
 *   staticHtml={(ctx) => <StaticHtmlLayer heading="Hi" />}
 *   textOnly={(ctx) => <TextOnlyLayer heading="Hi" />}
 * />
 */
export function AdaptiveSlot(props: AdaptiveSlotProps): JSX.Element | null {
  const {
    r3f,
    css3d,
    canvas2d,
    staticHtml,
    textOnly,
    r3fFallback = null,
    ...layerOptions
  } = props;

  // اگر AlphabetProvider موجود است، handshake را از آن می‌خوانیم.
  const ctx = useAlphabetContext();
  const handshakeFromProvider = ctx?.handshake;
  const layerInfo: UseAdaptiveLayerReturn = useAdaptiveLayer({
    ...layerOptions,
    ...(handshakeFromProvider !== undefined ? { handshake: handshakeFromProvider } : {}),
  });

  const renderers = useMemo<Partial<Record<AdaptiveLayer, AdaptiveRenderer>>>(
    () => ({
      ...(r3f !== undefined ? { R3F_IMMERSIVE: r3f } : {}),
      ...(css3d !== undefined ? { CSS_3D: css3d } : {}),
      ...(canvas2d !== undefined ? { CANVAS_2D: canvas2d } : {}),
      ...(staticHtml !== undefined ? { STATIC_HTML: staticHtml } : {}),
      ...(textOnly !== undefined ? { TEXT_ONLY: textOnly } : {}),
    }),
    [r3f, css3d, canvas2d, staticHtml, textOnly]
  );

  const picked = pickRenderer(layerInfo.layer, renderers);
  if (picked === null) return null;

  const renderCtx: AdaptiveRenderContext = {
    layer: picked.layer,
    direction: layerInfo.direction,
    locale: layerInfo.locale,
    reason: layerInfo.reason,
  };

  // R3F نیاز به lazy + suspense + error boundary دارد. سایر لایه‌ها ساده هستند.
  if (picked.layer === 'R3F_IMMERSIVE' && r3f !== undefined) {
    // در صورت خطا یا lazy load failure، به CSS_3D (یا اولین گزینه موجود از آنجا) سقوط می‌کنیم.
    const fallbackPick = pickRenderer('CSS_3D', renderers);
    const fallbackNode =
      fallbackPick !== null
        ? fallbackPick.renderer({
            ...renderCtx,
            layer: fallbackPick.layer,
            reason: 'R3F load failed — falling back.',
          })
        : null;
    return (
      <LayerErrorBoundary fallback={fallbackNode}>
        <Suspense fallback={r3fFallback}>
          <LazyR3FLayer render={r3f} ctx={renderCtx} />
        </Suspense>
      </LayerErrorBoundary>
    );
  }

  return <>{picked.renderer(renderCtx)}</>;
}
