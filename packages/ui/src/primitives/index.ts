/**
 * @module primitives
 * @description
 * shadcn-style primitives for `@alphabet/ui`. Each primitive is built
 * on `@radix-ui/react-*` headless components and styled via semantic
 * class names that resolve against the design tokens in
 * `@alphabet/ui/styles/tokens.css`. Components ship no Tailwind
 * dependency in source — consumers using Tailwind can still extend via
 * `className`.
 *
 * **Opt-in stylesheets:**
 *   import '@alphabet/ui/styles/tokens.css';      // CSS variables
 *   import '@alphabet/ui/styles/primitives.css';  // primitive rules
 *
 * The base `@alphabet/ui` bundle remains `sideEffects: false` and
 * R3F-free; importing this subpath does not pull in any styles
 * automatically.
 */

export { cn } from './cn.js';
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button.js';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  type CardProps,
  type CardVariant,
} from './Card.js';
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
} from './Dialog.js';
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
  type SheetContentProps,
  type SheetSide,
} from './Sheet.js';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs.js';
export {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './Tooltip.js';
export { Switch } from './Switch.js';
