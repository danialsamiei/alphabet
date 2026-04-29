/**
 * @module primitives/Button
 * @description
 * `Button` — a shadcn-style, polymorphic primitive. Uses Radix's `Slot`
 * pattern so consumers can render the underlying element of their choice
 * (e.g. a Next.js `<Link>` or a plain `<a>`) while inheriting all
 * behaviour and styling. Visuals are driven entirely by CSS variables
 * on `:root` from `@alphabet/ui/styles/tokens.css` and component rules
 * shipped in `@alphabet/ui/styles/primitives.css`.
 *
 * **Accessibility:** native `<button>` semantics by default; when
 * `asChild` is set the consumer is responsible for keyboard semantics
 * (Radix `Slot` forwards refs and props). All variants honour
 * `prefers-reduced-motion` via the duration tokens.
 */

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Visual emphasis. Defaults to `primary`. */
  readonly variant?: ButtonVariant;
  /** Padding/height scale. Defaults to `md`. */
  readonly size?: ButtonSize;
  /**
   * If true, renders the single child via Radix `Slot`, merging
   * className/handlers onto that element instead of a `<button>`.
   */
  readonly asChild?: boolean;
  /** Optional extra class names (consumer Tailwind, etc.). */
  readonly className?: string;
}

/**
 * A semantic, accessible button primitive.
 *
 * @example
 *   <Button variant="glass" size="lg">Continue</Button>
 *   <Button asChild><a href="/docs">Docs</a></Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', asChild = false, className, type, ...rest },
    ref,
  ) {
    const Comp = asChild ? Slot : 'button';
    const classes = cn(
      'alphabet-btn',
      `alphabet-btn--${variant}`,
      `alphabet-btn--size-${size}`,
      className,
    );
    // When rendering a real <button>, default `type="button"` to avoid
    // the dreaded implicit form submission. Slot consumers control their
    // own element so we don't inject a type there.
    const buttonType = asChild ? type : (type ?? 'button');
    return (
      <Comp ref={ref} className={classes} type={buttonType} {...rest} />
    );
  },
);
