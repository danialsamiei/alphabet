/**
 * @module primitives/Sheet
 * @description
 * Side-anchored panel built on top of Radix Dialog. Behaves identically
 * to `Dialog` (focus-trap, ESC-close, portal) but slides in from a side
 * (`top` | `right` | `bottom` | `left`). RTL flips `left`/`right`
 * automatically via CSS logical properties.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from './cn.js';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';

export interface SheetContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Edge the panel slides in from. Defaults to `right`. */
  readonly side?: SheetSide;
  /** When true, applies the frosted-glass surface. */
  readonly glass?: boolean;
}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  { side = 'right', glass = false, className, children, ...rest },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="alphabet-sheet__overlay" />
      <DialogPrimitive.Content
        ref={ref}
        data-side={side}
        className={cn(
          'alphabet-sheet__content',
          `alphabet-sheet__content--${side}`,
          glass && 'alphabet-sheet__content--glass',
          className,
        )}
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('alphabet-sheet__title', className)}
      {...rest}
    />
  );
});

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('alphabet-sheet__description', className)}
      {...rest}
    />
  );
});
