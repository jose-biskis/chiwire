import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColorSwatchGrid, type Swatch } from "@/components/ColorSwatch";

const swatches: Swatch[] = [
  { name: "Background", token: "--color-background", className: "bg-background" },
  { name: "Foreground", token: "--color-foreground", className: "bg-foreground" },
  { name: "Primary", token: "--color-primary", className: "bg-primary" },
  { name: "Accent", token: "--color-accent", className: "bg-accent" },
  { name: "Secondary", token: "--color-secondary", className: "bg-secondary" },
  { name: "Muted", token: "--color-muted", className: "bg-muted" },
  { name: "Shell", token: "--color-shell", className: "bg-shell" },
  { name: "Destructive", token: "--color-destructive", className: "bg-destructive" },
  { name: "Card", token: "--color-card", className: "bg-card" },
  { name: "Border", token: "--color-border", className: "bg-border" },
  { name: "Input", token: "--color-input", className: "bg-input" }
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
          One atelier layout, two palettes. Light: paper <code>#f7f4f0</code> + wine{" "}
          <code>#6d1d2a</code>. Dark: charcoal <code>#332d2f</code> + rose <code>#d01059</code>.
          Shape matches Internal (soft radii + system UI). Sharp atelier archived in{" "}
          <code>valenstonic/legacy/</code>.
        </p>
      </div>
      <ColorSwatchGrid swatches={swatches} />
    </div>
  )
};
