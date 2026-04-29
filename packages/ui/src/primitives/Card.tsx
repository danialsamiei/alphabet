/**
 * @module primitives/Card
 * @description
 * `Card` and friends — surface, header, body, and footer slots that
 * compose into a glassmorphism-ready content container. The base
 * `Card` ships with a subtle elevated surface; pass `variant="glass"`
 * to opt into the frosted look (uses `--alphabet-glass-*` tokens).
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn.js';

export type CardVariant = 'elevated' | 'glass' | 'outline';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'elevated', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('alphabet-card', `alphabet-card--${variant}`, className)}
      {...rest}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('alphabet-card__header', className)} {...rest} />;
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return <h3 ref={ref} className={cn('alphabet-card__title', className)} {...rest} />;
  },
);

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
  return <p ref={ref} className={cn('alphabet-card__description', className)} {...rest} />;
});

export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('alphabet-card__body', className)} {...rest} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('alphabet-card__footer', className)} {...rest} />;
  },
);
