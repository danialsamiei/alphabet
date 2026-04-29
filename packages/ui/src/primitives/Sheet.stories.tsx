import type { Meta, StoryObj } from '@storybook/react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
  type SheetSide,
} from './Sheet.js';
import { Button } from './Button.js';

const meta: Meta<typeof Sheet> = {
  title: 'Primitives/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<{ side: SheetSide }>;

const sides: SheetSide[] = ['top', 'right', 'bottom', 'left'];

export const Sides: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {sides.map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="secondary">From {side}</Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetTitle>Open from {side}</SheetTitle>
            <SheetDescription>
              The Alef agent surfaces consent-aware suggestions only.
            </SheetDescription>
            <SheetClose asChild>
              <Button size="sm" variant="ghost">Close</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const Glass: Story = {
  parameters: { backgrounds: { default: 'gradient' } },
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="glass">Open Alef co-pilot</Button>
      </SheetTrigger>
      <SheetContent side="right" glass>
        <SheetTitle>Alef</SheetTitle>
        <SheetDescription>
          A floating, invisible co-pilot. Suggestions only. Never persists
          without consent.
        </SheetDescription>
      </SheetContent>
    </Sheet>
  ),
};
