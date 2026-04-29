/**
 * @module primitives/Dialog
 * @description
 * Accessible modal dialog wrapping `@radix-ui/react-dialog`. The Radix
 * primitives provide focus-trap, scroll-lock, and ESC-to-close out of
 * the box; we add tokenised styling and a glassmorphism overlay.
 *
 * **Accessibility notes:**
 * - Radix manages `aria-modal`, focus restoration, and labelling.
 * - Always pair a `DialogTitle` with `DialogContent` (Radix asserts).
 * - Animations honour `prefers-reduced-motion` via duration tokens.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from './cn.js';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn('alphabet-dialog__overlay', className)}
      {...rest}
    />
  );
});

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** When true, the content uses the frosted-glass surface. */
  readonly glass?: boolean;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ className, glass = false, children, ...rest }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'alphabet-dialog__content',
          glass && 'alphabet-dialog__content--glass',
          className,
        )}
        {...rest}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('alphabet-dialog__title', className)}
      {...rest}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('alphabet-dialog__description', className)}
      {...rest}
    />
  );
});
