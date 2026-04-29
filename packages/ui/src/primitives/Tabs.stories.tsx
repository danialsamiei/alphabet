import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs.js';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="signals">
      <TabsList aria-label="Trust pulse views">
        <TabsTrigger value="signals">Signals</TabsTrigger>
        <TabsTrigger value="provenance">Provenance</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
      </TabsList>
      <TabsContent value="signals">
        <p>Live ingest stream — T1, T2, T3 distribution.</p>
      </TabsContent>
      <TabsContent value="provenance">
        <p>Drill into a single signal&rsquo;s claim chain.</p>
      </TabsContent>
      <TabsContent value="domains">
        <p>Eight affected-domain heat-map.</p>
      </TabsContent>
    </Tabs>
  ),
};
