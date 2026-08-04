import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScriptMark } from "@chiwire/ui/valenstonic/exclusive";

const meta = {
  title: "Archetypes/Valenstonic/Exclusive/ScriptMark",
  component: ScriptMark,
  args: {
    children: "Valen's Tonic"
  }
} satisfies Meta<typeof ScriptMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
