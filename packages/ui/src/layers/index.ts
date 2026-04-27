/**
 * @module layers
 * @description
 * Barrel export برای لایه‌های adaptive رندر (R3F lazy entry separate).
 * Barrel export for the adaptive render layers.
 *
 * Note: `R3FImmersiveLayer` is **not** re-exported here on purpose so
 * that importing `@awaf/ui/layers` does not pull R3F into the bundle.
 * Use `@awaf/ui/layers/r3f` (or `React.lazy`) when needed.
 */

export * from './TextOnlyLayer.js';
export * from './StaticHtmlLayer.js';
export * from './Canvas2DLayer.js';
export * from './Css3DLayer.js';
