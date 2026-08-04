import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "../components/scroll-area";
import { Separator } from "../components/separator";

const meta = {
  title: "Archetypes/Valenstonic/ScrollArea",
  component: ScrollArea,
  parameters: { layout: "padded" }
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const recipes = [
  "Negroni",
  "Boulevardier",
  "Old Fashioned",
  "Martini",
  "Manhattan",
  "Whiskey Sour",
  "Daiquiri",
  "Margarita",
  "Paloma",
  "Espresso Martini"
];

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-48 w-[min(18rem,90vw)] rounded-md border border-border bg-card">
      <div className="p-4">
        <p className="mb-2 font-script text-2xl text-primary">Classics</p>
        {recipes.map((name) => (
          <div key={name}>
            <div className="py-2 text-sm text-foreground">{name}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
};
