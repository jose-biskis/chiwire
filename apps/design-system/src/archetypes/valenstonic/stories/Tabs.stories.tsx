import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Label } from "../components/label";
import { Textarea } from "../components/textarea";
import { Input } from "../components/input";

const meta = {
  title: "Archetypes/Valenstonic/Tabs",
  component: Tabs,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="recipe" className="w-[min(28rem,90vw)]">
      <TabsList>
        <TabsTrigger value="recipe">Recipe</TabsTrigger>
        <TabsTrigger value="lab">Lab</TabsTrigger>
      </TabsList>
      <TabsContent value="recipe">
        <div className="grid gap-2">
          <Label htmlFor="vt-recipe">Method</Label>
          <Textarea id="vt-recipe" placeholder="Stir over ice…" />
        </div>
      </TabsContent>
      <TabsContent value="lab">
        <div className="grid gap-2">
          <Label htmlFor="vt-lab">Session name</Label>
          <Input id="vt-lab" placeholder="Negroni practice" />
        </div>
      </TabsContent>
    </Tabs>
  )
};
