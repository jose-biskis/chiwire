import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "../components/scroll-area";
import { Separator } from "../components/separator";

const meta = {
  title: "Archetypes/Internal/ScrollArea",
  component: ScrollArea,
  parameters: { layout: "padded" }
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const tags = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`);

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-48 w-[min(18rem,90vw)] rounded-md border border-border">
      <div className="p-4">
        {tags.map((tag) => (
          <div key={tag}>
            <div className="py-2 text-sm">{tag}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
};
