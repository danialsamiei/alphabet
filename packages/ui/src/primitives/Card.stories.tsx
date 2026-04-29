import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from './Card.js';
import { Button } from './Button.js';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio', options: ['elevated', 'outline', 'glass'] },
  },
};
export default meta;
type Story = StoryObj<typeof Card>;

const Sample = () => (
  <>
    <CardHeader>
      <CardTitle>Adaptive Render Layer</CardTitle>
      <CardDescription>
        Layer selection respects capability, consent, and reduced motion.
      </CardDescription>
    </CardHeader>
    <CardBody>
      <p style={{ margin: 0, lineHeight: 1.55 }}>
        The handshake completes in under 60&nbsp;ms and degrades gracefully
        from R3F immersive to text-only.
      </p>
    </CardBody>
    <CardFooter>
      <Button size="sm">Inspect</Button>
      <Button size="sm" variant="ghost">Dismiss</Button>
    </CardFooter>
  </>
);

export const Elevated: Story = {
  args: { variant: 'elevated' },
  render: (args) => <Card {...args} style={{ width: 360 }}><Sample /></Card>,
};
export const Outline: Story = {
  args: { variant: 'outline' },
  render: (args) => <Card {...args} style={{ width: 360 }}><Sample /></Card>,
};
export const Glass: Story = {
  args: { variant: 'glass' },
  parameters: { backgrounds: { default: 'gradient' } },
  render: (args) => <Card {...args} style={{ width: 360 }}><Sample /></Card>,
};
