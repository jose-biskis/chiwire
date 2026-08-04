import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../components/label";
import { Input } from "../components/input";

const meta = {
  title: "Archetypes/Internal/Label",
  component: Label,
  args: {
    children: "Email"
  }
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="grid w-[min(20rem,90vw)] gap-2">
      <Label htmlFor="email" {...args} />
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  )
};
