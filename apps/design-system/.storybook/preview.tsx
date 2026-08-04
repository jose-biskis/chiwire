import type { Preview } from "@storybook/react-vite";
import React, { useEffect } from "react";
import {
  archetypeFromStoryTitle,
  DEFAULT_ARCHETYPE,
  defaultColorModeFor,
  type ColorMode
} from "../src/lib/archetypes";
import "../src/styles/globals.css";

type ToolbarColorMode = ColorMode | "auto";

function ThemeCanvas({
  archetype,
  colorMode,
  children
}: {
  archetype: string;
  colorMode: ColorMode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.dataset.archetype = archetype;
    root.dataset.theme = colorMode;
    body.dataset.archetype = archetype;
    body.dataset.theme = colorMode;
    body.style.background = "var(--archetype-background)";
    body.style.color = "var(--archetype-foreground)";

    return () => {
      delete root.dataset.archetype;
      delete root.dataset.theme;
      delete body.dataset.archetype;
      delete body.dataset.theme;
      body.style.background = "";
      body.style.color = "";
    };
  }, [archetype, colorMode]);

  return (
    <div
      data-archetype={archetype}
      data-theme={colorMode}
      className="box-border min-h-[100vh] w-full bg-background p-8 text-foreground antialiased"
    >
      {children}
    </div>
  );
}

const preview: Preview = {
  globalTypes: {
    colorMode: {
      description: "Light / dark (Auto = archetype default)",
      toolbar: {
        title: "Color mode",
        icon: "circlehollow",
        items: [
          { value: "auto", title: "Auto", icon: "mirror" },
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" }
        ],
        dynamicTitle: true
      }
    }
  },
  initialGlobals: {
    colorMode: "auto"
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: "fullscreen",
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: ["Introduction", "Archetypes", ["Internal", "Valenstonic"]]
      }
    }
  },
  decorators: [
    (Story, context) => {
      const archetype =
        archetypeFromStoryTitle(context.title) ?? DEFAULT_ARCHETYPE;
      const fromToolbar = context.globals.colorMode as ToolbarColorMode | undefined;
      const colorMode: ColorMode =
        !fromToolbar || fromToolbar === "auto"
          ? defaultColorModeFor(archetype)
          : fromToolbar;

      return (
        <ThemeCanvas archetype={archetype} colorMode={colorMode}>
          <Story />
        </ThemeCanvas>
      );
    }
  ]
};

export default preview;
