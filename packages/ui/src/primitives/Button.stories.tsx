import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button.js';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'glass', 'destructive'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'icon'] },
    disabled: { control: 'boolean' },
    asChild: { table: { disable: true } },
  },
  args: { children: 'Continue' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', size: 'md' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Destructive: Story = { args: { variant: 'destructive', children: 'Revoke consent' } };
export const Glass: Story = {
  args: { variant: 'glass', size: 'lg', children: 'Glass action' },
  parameters: { backgrounds: { default: 'gradient' } },
};
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Settings">⚙</Button>
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true, children: 'Unavailable' } };
export const AsLink: Story = {
  args: {
    asChild: true,
    children: <a href="https://example.com">Open docs</a>,
  },
};
