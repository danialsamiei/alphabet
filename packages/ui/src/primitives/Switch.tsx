/**
 * @module primitives/Switch
 * @description
 * Accessible toggle switch wrapping Radix Switch. Renders a labelled
 * `role="switch"` element with `aria-checked` state and full keyboard
 * support (Space toggles).
 */

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from './cn.js';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...rest }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn('alphabet-switch', className)}
      {...rest}
    >
      <SwitchPrimitive.Thumb className="alphabet-switch__thumb" />
    </SwitchPrimitive.Root>
  );
});
