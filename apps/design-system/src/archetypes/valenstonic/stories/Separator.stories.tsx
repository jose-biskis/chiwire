import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../components/separator";

const meta = {
  title: "Archetypes/Valenstonic/Separator",
  component: Separator,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[min(16rem,90vw)] space-y-3">
      <p className="font-display text-base text-foreground">Courses</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Practice labs</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Account</p>
    </div>
  )
};
