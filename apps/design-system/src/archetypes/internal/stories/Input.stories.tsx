import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../components/input";
import { Label } from "../components/label";

const meta = {
  title: "Archetypes/Internal/Input",
  component: Input,
  args: {
    placeholder: "Type something…",
    type: "text"
  }
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-[min(20rem,90vw)] gap-2">
      <Label htmlFor="note-title">Title</Label>
      <Input id="note-title" {...args} />
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
      <Label htmlFor="file-input">File</Label>
      <Input id="file-input" {...args} />
    </div>
  )
};
