import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../components/separator";

const meta = {
  title: "Archetypes/Internal/Separator",
  component: Separator,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[min(16rem,90vw)] space-y-3">
      <p className="text-sm font-medium">Section A</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Section B</p>
    </div>
  )
};
