import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../components/input";
import { Label } from "../components/label";

const meta = {
  title: "Archetypes/Valenstonic/Input",
  component: Input,
  args: {
    placeholder: "Course title",
    type: "text"
  }
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-[min(20rem,90vw)] gap-2">
      <Label htmlFor="vt-title">Title</Label>
      <Input id="vt-title" {...args} />
    </div>
  )
};

export const File: Story = {
  args: {
    type: "file",
    placeholder: undefined
  },
  render: (args) => (
    <div className="grid w-[min(20rem,90vw)] gap-2">
      <Label htmlFor="vt-file">Asset</Label>
      <Input id="vt-file" {...args} />
    </div>
  )
};
