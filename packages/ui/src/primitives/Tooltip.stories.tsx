import type { Meta, StoryObj } from '@storybook/react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './Tooltip.js';
import { Button } from './Button.js';

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={200}>
        <Story />
      </TooltipProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost">Hover or focus me</Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        Trust score = source × cross-references × freshness.
      </TooltipContent>
    </Tooltip>
  ),
};
