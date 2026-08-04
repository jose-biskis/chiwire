import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../components/badge";

const meta = {
  title: "Archetypes/Internal/Badge",
  component: Badge,
  args: {
    children: "Live",
    variant: "default"
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "accent", "outline", "success", "warning"]
    }
  }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
    </div>
  )
};
