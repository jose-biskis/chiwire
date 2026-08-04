import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Label } from "../components/label";
import { Textarea } from "../components/textarea";
import { Input } from "../components/input";

const meta = {
  title: "Archetypes/Internal/Tabs",
  component: Tabs,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="text" className="w-[min(28rem,90vw)]">
      <TabsList>
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="file">File</TabsTrigger>
      </TabsList>
      <TabsContent value="text">
        <div className="grid gap-2">
          <Label htmlFor="tab-note">Note</Label>
          <Textarea id="tab-note" placeholder="Paste something worth sharing…" />
        </div>
      </TabsContent>
      <TabsContent value="file">
        <div className="grid gap-2">
          <Label htmlFor="tab-file">File</Label>
          <Input id="tab-file" type="file" />
        </div>
      </TabsContent>
    </Tabs>
  )
};
