import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColorSwatchGrid, type Swatch } from "@/components/ColorSwatch";

const swatches: Swatch[] = [
  { name: "Background", token: "--color-background", className: "bg-background" },
  { name: "Foreground", token: "--color-foreground", className: "bg-foreground" },
  { name: "Primary", token: "--color-primary", className: "bg-primary" },
  { name: "Accent", token: "--color-accent", className: "bg-accent" },
  { name: "Secondary", token: "--color-secondary", className: "bg-secondary" },
  { name: "Muted", token: "--color-muted", className: "bg-muted" },
  { name: "Destructive", token: "--color-destructive", className: "bg-destructive" },
  { name: "Card", token: "--color-card", className: "bg-card" }
];

const meta = {
  title: "Archetypes/Valenstonic/Colors",
  parameters: { layout: "padded" }
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Palette: Story = {
  render: () => (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--archetype-surface-tint)" }}
    >
      <div className="mb-6 space-y-1">
        <p className="font-script text-4xl text-primary">Valen's Tonic</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Rose-ink atelier tokens for Academy marketing and product surfaces.
        </p>
      </div>
      <ColorSwatchGrid swatches={swatches} />
    </div>
  )
};
