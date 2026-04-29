import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Switch } from './Switch.js';

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Uncontrolled: Story = {
  render: () => (
    <label style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center' }}>
      <Switch /> Reduced motion
    </label>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return (
        <label style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center' }}>
          <Switch checked={on} onCheckedChange={setOn} />
          {on ? 'Enriched memory' : 'Anonymous session'}
        </label>
      );
    }
    return <Demo />;
  },
};
