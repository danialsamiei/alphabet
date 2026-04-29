/**
 * @module primitives/Tooltip
 * @description
 * Accessible tooltip wrapper around Radix Tooltip. Use a single
 * `TooltipProvider` near the root of your app to share open-delay state.
 *
 * **Accessibility:** Radix wires `aria-describedby` automatically and
 * suppresses the tooltip on touch devices to avoid trapping focus.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from './cn.js';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn('alphabet-tooltip__content', className)}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});
