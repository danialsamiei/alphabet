/**
 * @module effect/layer
 * @description
 * `Layer<R>` — minimal DI container for the Effect runtime. A layer
 * resolves an environment record `R` of services, optionally building
 * services lazily with their own effectful constructors.
 *
 * The classical Effect-TS `Layer<RIn, E, ROut>` is more general (it
 * supports failure during layer construction and dependency on an input
 * environment). For Alphabet's needs — wiring a `now()` clock, a logger,
 * and a `Crypto` provider — a flat `Record<string, unknown>` builder is
 * enough.
 *
 * @example
 * const liveLayer = layerSucceed({ now: () => Date.now() });
 * runEffect(myEffect, liveLayer.build());
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A description of how to build an environment of services. */
export interface Layer<R> {
  build(): R;
}

// ─── Constructors ────────────────────────────────────────────────────────────

/** Static layer — services already built. */
export function layerSucceed<R>(services: R): Layer<R> {
  return {
    build: (): R => services,
  };
}

/** Lazy layer — services built on first `build()`. */
export function layerSync<R>(factory: () => R): Layer<R> {
  let cached: { readonly value: R } | undefined;
  return {
    build: (): R => {
      if (cached === undefined) cached = { value: factory() };
      return cached.value;
    },
  };
}

/**
 * Combine two layers into one. Services on the right override services on
 * the left when keys overlap.
 */
export function layerMerge<A extends object, B extends object>(
  left: Layer<A>,
  right: Layer<B>,
): Layer<A & B> {
  return {
    build: (): A & B => ({ ...left.build(), ...right.build() }),
  };
}
