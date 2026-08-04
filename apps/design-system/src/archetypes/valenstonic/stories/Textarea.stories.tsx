import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "../components/textarea";
import { Label } from "../components/label";

const meta = {
  title: "Archetypes/Valenstonic/Textarea",
  component: Textarea,
  args: {
    placeholder: "Describe the tasting notes…"
  }
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="grid w-[min(28rem,90vw)] gap-2">
      <Label htmlFor="vt-notes">Notes</Label>
      <Textarea id="vt-notes" {...args} />
    </div>
  )
};
