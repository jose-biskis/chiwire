import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchetypeSelect,
  ThemeSelect,
  type UiArchetype,
  type UiColorMode
} from "@chiwire/ui/base";

const meta = {
  title: "Base/Appearance selects",
  parameters: { layout: "centered" }
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Pills: Story = {
  render: () => {
    const [archetype, setArchetype] = useState<UiArchetype>("internal");
    const [theme, setTheme] = useState<UiColorMode>("dark");
    return (
      <div className="flex flex-col gap-4 p-4">
        <ArchetypeSelect variant="pills" value={archetype} onValueChange={setArchetype} />
        <ThemeSelect variant="pills" value={theme} onValueChange={setTheme} />
      </div>
    );
  }
};

export const Menu: Story = {
  render: () => {
    const [archetype, setArchetype] = useState<UiArchetype>("valenstonic");
    const [theme, setTheme] = useState<UiColorMode>("light");
    return (
      <div className="min-w-[220px] rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md">
        <ArchetypeSelect variant="menu" value={archetype} onValueChange={setArchetype} />
        <div className="my-1 h-px bg-border" />
        <ThemeSelect variant="menu" value={theme} onValueChange={setTheme} />
      </div>
    );
  }
};
