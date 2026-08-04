import type { Preview } from "@storybook/react-vite";
import React from "react";
import { archetypeFromStoryTitle, DEFAULT_ARCHETYPE } from "../src/lib/archetypes";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: "centered",
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

      return (
        <div
          data-archetype={archetype}
          className="min-h-40 min-w-72 rounded-lg bg-background p-8 text-foreground antialiased"
        >
          <Story />
        </div>
      );
    }
  ]
};

export default preview;
