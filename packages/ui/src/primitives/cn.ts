/**
 * @module primitives/cn
 * @description
 * Tiny `className` composer used by every primitive. We intentionally
 * depend on `clsx` (≈ 0.5 kB gzipped) and *not* on `tailwind-merge`,
 * because primitives in this package author their styles via semantic
 * BEM-style class names against the design tokens in
 * `@alphabet/ui/styles/primitives.css`. Consumers using Tailwind in
 * their own apps can still pass utility classes through `className`.
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Compose `className` values. Falsy entries are dropped, arrays are
 * flattened, and the result is a single space-separated string.
 *
 * @example
 *   <button className={cn('btn', size === 'lg' && 'btn--lg', extra)} />
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
