import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "../components/textarea";
import { Label } from "../components/label";

const meta = {
  title: "Archetypes/Internal/Textarea",
  component: Textarea,
  args: {
    placeholder: "Paste something worth sharing…"
  }
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="grid w-[min(28rem,90vw)] gap-2">
      <Label htmlFor="note">Note</Label>
      <Textarea id="note" {...args} />
    </div>
  )
};
