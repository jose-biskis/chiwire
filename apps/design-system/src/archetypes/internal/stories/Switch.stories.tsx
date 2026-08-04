import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../components/label";
import { Switch } from "../components/switch";

const meta = {
  title: "Archetypes/Internal/Switch",
  component: Switch
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="airplane" defaultChecked />
      <Label htmlFor="airplane">Airplane mode</Label>
    </div>
  )
};
