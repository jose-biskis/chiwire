import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import viteConfig from "../vite.config";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  async viteFinal(config) {
    return mergeConfig(config, viteConfig);
  }
};

export default config;
