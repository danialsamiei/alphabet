import type { Meta, StoryObj } from '@storybook/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './Dialog.js';
import { Button } from './Button.js';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirm consent upgrade</DialogTitle>
        <DialogDescription>
          You can revoke this at any time. Memory persists only while consent
          is granted.
        </DialogDescription>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Upgrade</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  ),
};

export const Glass: Story = {
  parameters: { backgrounds: { default: 'gradient' } },
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="glass">Open glass dialog</Button>
      </DialogTrigger>
      <DialogContent glass>
        <DialogTitle>Frosted surface</DialogTitle>
        <DialogDescription>
          Backdrop-filter blur is sourced from <code>--alphabet-glass-*</code>{' '}
          tokens.
        </DialogDescription>
        <DialogClose asChild>
          <Button variant="glass" size="sm">Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  ),
};
